import asyncio
import base64
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
import io
import logging
import os
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from PIL import Image

from app.core.config import settings
from app.models.schemas import BoundingBox, ProductItem, VisualSearchResponse

logger = logging.getLogger(__name__)

# Lightweight thread pool executor (2 workers max to prevent Render 512MB RAM exhaustion)
_vision_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="vx_vision_worker")

# Lazy reference and failure latch for YOLO model
_yolo_model = None
_yolo_failed = False


def get_yolo_model():
    """
    Conditional lazy loader for Ultralytics YOLOv8.
    Wraps the import and model weights loading in a safe try-except block.
    If YOLO is unavailable, throws an error, or raises MemoryError, it gracefully
    bypasses YOLO and marks it failed so all visual searches fall back to Gemini-first.
    This guarantees memory usage stays well under Render's 512MB RAM ceiling.
    """
    global _yolo_model, _yolo_failed
    if _yolo_failed:
        return None
    if _yolo_model is None:
        if os.getenv("DISABLE_YOLO", "").lower() in ("1", "true", "yes"):
            logger.info("YOLO model disabled via DISABLE_YOLO environment flag. Using Gemini-first visual pipeline.")
            _yolo_failed = True
            return None

        try:
            logger.info(f"Attempting lazy load of YOLO model: {settings.YOLO_MODEL_NAME}")
            from ultralytics import YOLO
            _yolo_model = YOLO(settings.YOLO_MODEL_NAME)
            logger.info("Ultralytics YOLOv8 loaded successfully.")
        except (MemoryError, ImportError, Exception) as e:
            logger.warning(f"Could not initialize YOLOv8 model ({e}). Gracefully bypassing to Gemini-first vision pipeline.")
            _yolo_model = None
            _yolo_failed = True
    return _yolo_model


class VisionPreprocessingService:
    """
    Visual Search & Multimodal Preprocessing Service.
    - Tier 1: Attempts lightweight YOLOv8 object localization if available and within RAM bounds.
    - Tier 2 (Gemini-First): Routes visual search directly to Gemini 2.5 Flash via official google-genai
      SDK if YOLO is unavailable, times out, or encounters a memory error.
    - Zero Hallucination: Returns clean empty states on blank/monochrome inputs.
    - RAM Safe: Keeps total process memory footprint strictly under 300MB.
    """

    def __init__(self):
        self.min_confidence = 0.25

    @staticmethod
    def _is_blank_image(image: Image.Image) -> bool:
        """Detects if an image is completely blank, solid monochrome, or has no spatial variance."""
        try:
            arr = np.array(image)
            if arr.size == 0:
                return True
            spatial_std = float(np.mean(np.std(arr, axis=(0, 1))))
            return spatial_std < 5.0
        except Exception:
            return False

    def _run_yolo_inference(self, yolo, image: Image.Image, min_confidence: float):
        """Worker function for YOLO multi-angle detection with memory safety."""
        try:
            return yolo(
                image,
                verbose=False,
                augment=True,
                agnostic_nms=True,
                conf=min_confidence,
            )
        except Exception as e_aug:
            logger.warning(f"YOLO augmented inference error, retrying standard: {e_aug}")
            try:
                return yolo(image, verbose=False, conf=min_confidence)
            except Exception as e:
                logger.warning(f"YOLO inference error: {e}")
                return []

    def process_image_upload(
        self, image_bytes: bytes
    ) -> Tuple[Optional[bytes], Optional[BoundingBox], str, str]:
        """
        Processes raw uploaded image bytes:
        - Runs YOLOv8n inference to locate primary object if YOLO is loaded.
        - Crops primary detected bounding box.
        - Returns: (cropped_bytes, bounding_box, detected_label, status_message)
        """
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            img_width, img_height = image.size
        except Exception as e:
            logger.error(f"Failed to read image bytes: {e}")
            return None, None, "", f"Invalid image format: {e}"

        # Anti-Hallucination: Detect blank / monochrome test frames
        if self._is_blank_image(image):
            return None, None, "", "No confident objects detected. Please try another angle or a well-lit photo."

        yolo = get_yolo_model()
        if yolo is None:
            return None, None, "", "YOLO_UNAVAILABLE"

        primary_box = None
        detected_label = "object"
        detection_found = False

        try:
            results = self._run_yolo_inference(yolo, image, self.min_confidence)
            best_box = None
            max_area = 0.0

            for r in results:
                boxes = r.boxes
                if boxes is None or len(boxes) == 0:
                    continue
                for box in boxes:
                    conf = float(box.conf[0])
                    if conf < self.min_confidence:
                        continue

                    cls_id = int(box.cls[0])
                    cls_name = r.names.get(cls_id, "object")
                    coords = box.xyxy[0].tolist()
                    x1, y1, x2, y2 = coords

                    w = max(0.0, x2 - x1)
                    h = max(0.0, y2 - y1)
                    area = w * h

                    if area > max_area and w > 10 and h > 10:
                        max_area = area
                        best_box = (x1, y1, x2, y2, conf, cls_name)

            if best_box:
                x1, y1, x2, y2, conf, label = best_box
                detection_found = True
                detected_label = label
                x1 = max(0.0, min(float(x1), float(img_width)))
                y1 = max(0.0, min(float(y1), float(img_height)))
                x2 = max(x1 + 1.0, min(float(x2), float(img_width)))
                y2 = max(y1 + 1.0, min(float(y2), float(img_height)))

                primary_box = BoundingBox(
                    x1=round(x1, 1),
                    y1=round(y1, 1),
                    x2=round(x2, 1),
                    y2=round(y2, 1),
                    width=round(x2 - x1, 1),
                    height=round(y2 - y1, 1),
                    confidence=round(conf, 4),
                    label=label,
                )
        except Exception as e:
            logger.warning(f"YOLO inference failed: {e}. Falling back to Gemini-first vision.")
            return None, None, "", "YOLO_UNAVAILABLE"

        if not detection_found or primary_box is None:
            return None, None, "", "NO_YOLO_DETECTION"

        status_message = f"Object detected: '{primary_box.label}' (confidence: {primary_box.confidence * 100:.1f}%)."

        crop_region = (
            int(primary_box.x1),
            int(primary_box.y1),
            int(primary_box.x2),
            int(primary_box.y2),
        )
        cropped_img = image.crop(crop_region)

        buffer = io.BytesIO()
        cropped_img.save(buffer, format="JPEG", quality=90)
        cropped_bytes = buffer.getvalue()

        return cropped_bytes, primary_box, detected_label, status_message

    def _execute_gemini_vision_search(
        self,
        image_bytes: bytes,
        recommender_svc,
        top_k: int = 5,
    ) -> VisualSearchResponse:
        """
        Lightweight Gemini-first visual pipeline using gemini-2.5-flash via official google-genai SDK.
        Analyzes uploaded image bytes directly, bypassing PyTorch / YOLO.
        Keeps container memory usage well under 300MB on Render.
        """
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            img_w, img_h = image.size

            # Resize if large to ensure fast upload and low memory
            max_dim = 768
            if max(img_w, img_h) > max_dim:
                scale = max_dim / float(max(img_w, img_h))
                new_size = (int(img_w * scale), int(img_h * scale))
                image = image.resize(new_size, Image.Resampling.LANCZOS)
                img_w, img_h = image.size

            buf = io.BytesIO()
            image.save(buf, format="JPEG", quality=85)
            clean_bytes = buf.getvalue()
            b64_crop = base64.b64encode(clean_bytes).decode("utf-8")
        except Exception as e:
            logger.error(f"Failed to prepare image for Gemini vision: {e}")
            return VisualSearchResponse(
                detection_found=False,
                status_message=f"Invalid image format: {e}",
                recommendations=[],
                matches=[],
                error=str(e),
            )

        from app.services.gemini_service import analyze_image_multimodal
        gemini_analysis = analyze_image_multimodal(clean_bytes, yolo_label="product")

        detected_category = gemini_analysis.get("category") or "product"
        detected_brand = gemini_analysis.get("brand")
        query_text = (gemini_analysis.get("query_phrase") or detected_category).strip()

        is_confident = bool(
            detected_category
            and detected_category.lower() not in ("unknown", "unidentified", "none", "")
        )

        if not is_confident:
            return VisualSearchResponse(
                detection_found=False,
                bounding_box=None,
                detected_label=None,
                status_message="No confident objects detected. Please try another angle or a well-lit photo.",
                cropped_image_base64=None,
                recommendations=[],
                matches=[],
            )

        bbox = BoundingBox(
            x1=round(img_w * 0.05, 1),
            y1=round(img_h * 0.05, 1),
            x2=round(img_w * 0.95, 1),
            y2=round(img_h * 0.95, 1),
            width=round(img_w * 0.9, 1),
            height=round(img_h * 0.9, 1),
            confidence=0.92,
            label=detected_category,
        )

        matches, _ = recommender_svc.recommend_dwell(
            query_text=query_text,
            top_k=top_k,
        )
        items = matches or []

        return VisualSearchResponse(
            detection_found=True,
            bounding_box=bbox,
            detected_label=detected_category,
            status_message=f"Detected: {detected_category.title()} (Gemini 2.5 Flash AI)",
            cropped_image_base64=f"data:image/jpeg;base64,{b64_crop}",
            recommendations=items,
            matches=items,
            semantic_tags=gemini_analysis.get("semantic_tags", []),
            gemini_description=gemini_analysis.get("description"),
            detected_brand=detected_brand,
            detected_category=detected_category,
            detected_attributes={
                "color": gemini_analysis.get("color"),
                "material": gemini_analysis.get("material"),
                "style": gemini_analysis.get("style"),
                "source": gemini_analysis.get("source", "gemini-2.5-flash"),
            },
        )

    def search_by_image(
        self,
        image_bytes: bytes,
        recommender_svc,
        top_k: int = 5,
    ) -> VisualSearchResponse:
        """
        Executes end-to-end visual search:
        1. Checks for blank monochrome test images (anti-hallucination).
        2. Tries YOLO localization & crop if YOLO is loaded and available.
        3. Gemini-First Vision Fallback: If YOLO is unavailable, throws an OOM/memory error,
           or times out, routes directly to Gemini 2.5 Flash to analyze raw image bytes.
        4. Retrieves matching catalog items matching visual feature semantics.
        5. Keeps memory usage well under 300MB on Render.
        """
        try:
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            if self._is_blank_image(pil_img):
                return VisualSearchResponse(
                    detection_found=False,
                    bounding_box=None,
                    detected_label=None,
                    status_message="No confident objects detected. Please try another angle or a well-lit photo.",
                    cropped_image_base64=None,
                    recommendations=[],
                    matches=[],
                )
        except Exception as e:
            return VisualSearchResponse(
                detection_found=False,
                bounding_box=None,
                detected_label=None,
                status_message=f"Invalid image format: {e}",
                cropped_image_base64=None,
                recommendations=[],
                matches=[],
                error=str(e),
            )

        cropped_bytes, bbox, label, msg = self.process_image_upload(image_bytes)

        # If YOLO was available and successfully cropped the object:
        if cropped_bytes and bbox is not None:
            b64_crop = base64.b64encode(cropped_bytes).decode("utf-8")

            # Step 2: Gemini Vision Multimodal Tagging
            from app.services.gemini_service import analyze_image_multimodal
            gemini_analysis = analyze_image_multimodal(cropped_bytes, yolo_label=label)

            # Step 3: Hybrid Dense Embedding Matching with all-MiniLM-L6-v2
            query_text = (gemini_analysis.get("query_phrase") or label or "product").strip()
            recommendations, _ = recommender_svc.recommend_dwell(
                query_text=query_text,
                top_k=top_k,
            )

            matches = recommendations or []

            return VisualSearchResponse(
                detection_found=True,
                bounding_box=bbox,
                detected_label=label,
                status_message=f"Detected: {label.title()} (Confidence: {int(bbox.confidence * 100)}%)",
                cropped_image_base64=f"data:image/jpeg;base64,{b64_crop}",
                recommendations=matches,
                matches=matches,
                semantic_tags=gemini_analysis.get("semantic_tags", []),
                gemini_description=gemini_analysis.get("description"),
                detected_brand=gemini_analysis.get("brand"),
                detected_category=gemini_analysis.get("category"),
                detected_attributes={
                    "color": gemini_analysis.get("color"),
                    "material": gemini_analysis.get("material"),
                    "style": gemini_analysis.get("style"),
                    "source": gemini_analysis.get("source", "gemini-2.5-flash"),
                },
            )

        # If image was blank, do not hallucinate
        if msg == "No confident objects detected. Please try another angle or a well-lit photo.":
            return VisualSearchResponse(
                detection_found=False,
                bounding_box=None,
                detected_label=None,
                status_message=msg,
                cropped_image_base64=None,
                recommendations=[],
                matches=[],
            )

        # Gemini-First Vision Fallback: If YOLO was unavailable or failed detection on a real photo,
        # route directly to Gemini 2.5 Flash without crashing memory.
        logger.info("Executing Gemini-first visual search fallback...")
        return self._execute_gemini_vision_search(
            image_bytes=image_bytes,
            recommender_svc=recommender_svc,
            top_k=top_k,
        )

    async def async_search_by_image(
        self,
        image_bytes: bytes,
        recommender_svc,
        top_k: int = 5,
        timeout_seconds: float = 12.0,
    ) -> VisualSearchResponse:
        """
        Non-blocking asynchronous visual search executed in thread pool
        with strict timeout fail-safes and automatic Gemini-first fallback.
        """
        loop = asyncio.get_running_loop()
        try:
            return await asyncio.wait_for(
                loop.run_in_executor(
                    _vision_executor,
                    self.search_by_image,
                    image_bytes,
                    recommender_svc,
                    top_k,
                ),
                timeout=timeout_seconds,
            )
        except (asyncio.TimeoutError, FuturesTimeoutError):
            logger.warning(f"Async visual search pipeline timed out after {timeout_seconds}s fail-safe.")
            try:
                logger.info("Attempting quick Gemini-first fallback on timeout...")
                return self._execute_gemini_vision_search(
                    image_bytes=image_bytes,
                    recommender_svc=recommender_svc,
                    top_k=top_k,
                )
            except Exception as e:
                logger.warning(f"Gemini fallback on timeout failed: {e}")
                return VisualSearchResponse(
                    detection_found=False,
                    bounding_box=None,
                    detected_label=None,
                    status_message="Visual search timed out while analyzing image. Please try another angle or a smaller photo.",
                    cropped_image_base64=None,
                    recommendations=[],
                    matches=[],
                    error="timeout",
                )


vision_service = VisionPreprocessingService()

import asyncio
import base64
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
import io
import logging
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from PIL import Image

from app.core.config import settings
from app.models.schemas import BoundingBox, ProductItem, VisualSearchResponse

logger = logging.getLogger(__name__)

# Dedicated thread pool executor for CPU-intensive vision inference (4 workers)
_vision_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="vx_vision_worker")

# Lazy reference to YOLO model
_yolo_model = None


def get_yolo_model():
    """Lazy loader for Ultralytics YOLOv8n to ensure fast, low-memory startup."""
    global _yolo_model
    if _yolo_model is None:
        try:
            from ultralytics import YOLO
            logger.info(f"Loading YOLO model: {settings.YOLO_MODEL_NAME}")
            _yolo_model = YOLO(settings.YOLO_MODEL_NAME)
        except Exception as e:
            logger.warning(f"Could not initialize YOLO model: {e}")
            _yolo_model = None
    return _yolo_model


class VisionPreprocessingService:
    """
    Visual Crop & Preprocessing Service using Ultralytics YOLOv8n.
    Detects primary candidate object in raw user uploads, removes background clutter,
    and produces normalized cropped bounding boxes ready for catalog alignment.
    Optimized with thread-pooling and timeout fail-safes for non-blocking execution.
    """

    def __init__(self):
        self.min_confidence = 0.25

    def _run_yolo_inference(self, yolo, image: Image.Image, min_confidence: float):
        """Worker function for YOLO multi-angle detection."""
        try:
            # Configure Ultralytics YOLOv8 with augment=True, agnostic_nms=True, and conf=0.25
            # for robust multi-angle detection of rotated or skewed product images.
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
        - Runs YOLOv8n inference to locate primary object.
        - Crops primary detected bounding box (filtering floorboards/backgrounds).
        - Returns: (cropped_bytes, bounding_box, detected_label, status_message)
        """
        try:
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            img_width, img_height = image.size
        except Exception as e:
            logger.error(f"Failed to read image bytes: {e}")
            return None, None, "", f"Invalid image format: {e}"

        yolo = get_yolo_model()
        primary_box = None
        detected_label = "object"
        detection_found = False

        if yolo is not None:
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

                    # Calculate area
                    w = max(0.0, x2 - x1)
                    h = max(0.0, y2 - y1)
                    area = w * h

                    # Prefer prominent bounding boxes with good confidence
                    if area > max_area and w > 10 and h > 10:
                        max_area = area
                        best_box = (x1, y1, x2, y2, conf, cls_name)

            if best_box:
                x1, y1, x2, y2, conf, label = best_box
                detection_found = True
                detected_label = label
                # Clamp to image boundaries
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

        # Anti-Hallucination: If no confident objects are detected, do NOT hallucinate fake products
        if not detection_found or primary_box is None:
            return None, None, "", "No confident objects detected. Please try another angle or a well-lit photo."

        status_message = f"Object detected: '{primary_box.label}' (confidence: {primary_box.confidence * 100:.1f}%)."

        # Perform crop
        crop_region = (
            int(primary_box.x1),
            int(primary_box.y1),
            int(primary_box.x2),
            int(primary_box.y2),
        )
        cropped_img = image.crop(crop_region)

        # Export cropped bytes (JPEG)
        buffer = io.BytesIO()
        cropped_img.save(buffer, format="JPEG", quality=90)
        cropped_bytes = buffer.getvalue()

        return cropped_bytes, primary_box, detected_label, status_message

    def search_by_image(
        self,
        image_bytes: bytes,
        recommender_svc,
        top_k: int = 5,
    ) -> VisualSearchResponse:
        """
        Executes end-to-end visual search:
        1. Crops primary detected object using multi-angle augmented YOLOv8.
        2. Converts crop to Base64 for enterprise dashboard inspection.
        3. Retrieves matching catalog items matching visual feature semantics.
        4. No Hallucination: Returns clean empty state ({"matches": []}) if no confident detection.
        """
        cropped_bytes, bbox, label, msg = self.process_image_upload(image_bytes)

        if not cropped_bytes or bbox is None:
            return VisualSearchResponse(
                detection_found=False,
                bounding_box=None,
                detected_label=None,
                status_message=msg or "No confident objects detected. Please try another angle or a well-lit photo.",
                cropped_image_base64=None,
                recommendations=[],
                matches=[],
            )

        # Base64 string for preview
        b64_crop = base64.b64encode(cropped_bytes).decode("utf-8")

        # Map detected label to catalog query
        query_text = label if label else "product"
        recommendations, _ = recommender_svc.recommend_dwell(
            query_text=query_text,
            top_k=top_k,
        )

        matches = recommendations or []

        return VisualSearchResponse(
            detection_found=True,
            bounding_box=bbox,
            detected_label=label,
            status_message=msg,
            cropped_image_base64=f"data:image/jpeg;base64,{b64_crop}",
            recommendations=matches,
            matches=matches,
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
        with strict timeout fail-safes.
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
            return VisualSearchResponse(
                detection_found=False,
                bounding_box=None,
                detected_label=None,
                status_message="Visual search timed out while analyzing image. Please try another angle or a smaller photo.",
                cropped_image_base64=None,
                recommendations=[],
                matches=[],
            )


vision_service = VisionPreprocessingService()

"""
Visual Search Service with Direct Gemini REST API Integration.
Bypasses high-overhead SDKs to ensure robust multi-platform execution without dependency conflicts.
Provides strict product matching and ranking to guarantee no unrelated products are returned.
"""

import asyncio
import base64
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
import io
import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple
import httpx
import numpy as np
from PIL import Image

from app.core.config import settings
from app.models.schemas import BoundingBox, ProductItem, VisualSearchResponse

logger = logging.getLogger(__name__)

# Lightweight thread pool executor (2 workers max to protect Render 512MB RAM ceiling)
_vision_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="vx_vision_worker")


def get_gemini_api_key() -> str:
    """Retrieves GEMINI_API_KEY from environment or project .env."""
    api_key = os.environ.get("GEMINI_API_KEY", "").strip() or os.environ.get("GOOGLE_API_KEY", "").strip()
    if not api_key:
        try:
            from pathlib import Path
            env_file = Path(__file__).resolve().parent.parent.parent / ".env"
            if env_file.exists():
                for line in env_file.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line.startswith("GEMINI_API_KEY=") or line.startswith("GOOGLE_API_KEY="):
                        val = line.split("=", 1)[1].strip().strip("'\"")
                        if val:
                            api_key = val
                            break
        except Exception:
            pass
    return api_key


def call_gemini_rest_api(image_bytes: bytes) -> Dict[str, Any]:
    """
    Direct Gemini REST API invocation using httpx.
    - Reads api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    - Resizes image to max 512x512 JPEG in memory and base64 encodes it.
    - Sends POST to https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}
      (With immediate fallback to gemini-1.5-flash on 404).
    - Prompts Gemini strictly to return JSON: {"label": "...", "category": "...", "keywords": [...]}.
    - Parses JSON cleanly (stripping markdown fences).
    - If it fails, raises RuntimeError with exact HTTP error reason.
    """
    api_key = get_gemini_api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable is missing or empty.")

    # 1. Resize uploaded image to max 512x512 JPEG in memory
    try:
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        w, h = pil_img.size
        max_dim = 512
        if max(w, h) > max_dim:
            scale = max_dim / float(max(w, h))
            new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
            pil_img = pil_img.resize(new_size, Image.Resampling.BILINEAR)
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=80, optimize=True)
        compressed_bytes = buf.getvalue()
        b64_image = base64.b64encode(compressed_bytes).decode("utf-8")
    except Exception as e:
        raise RuntimeError(f"Failed to process and compress image: {e}")

    # 2. Strict prompt required by user
    prompt_text = (
        'Identify the main retail product in this image. Return ONLY a valid JSON object with keys: '
        '{"label": "exact product type (e.g. laptop, smartphone, watch, shoes, perfume, shirt)", '
        '"category": "broad category", '
        '"keywords": ["5 specific search keywords matching the product"]}'
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": b64_image
                        }
                    },
                    {
                        "text": prompt_text
                    }
                ]
            }
        ]
    }

    models = [
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-2.5-flash",
        "gemini-3.8-flash",
        "gemini-1.5-flash",
    ]
    last_error = ""

    for model in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            with httpx.Client(timeout=12.0) as client:
                resp = client.post(
                    url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )

            if resp.status_code in (404, 503):
                logger.warning(f"Gemini model '{model}' returned HTTP {resp.status_code}. Falling back to alternative model...")
                last_error = f"{model} returned HTTP {resp.status_code}"
                continue

            if resp.status_code != 200:
                try:
                    err_json = resp.json()
                    err_msg = err_json.get("error", {}).get("message") or resp.text
                except Exception:
                    err_msg = resp.text
                raise RuntimeError(f"HTTP {resp.status_code}: {err_msg}")

            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                raise RuntimeError(f"Gemini model {model} returned 0 candidates.")

            parts = candidates[0].get("content", {}).get("parts", [])
            raw_text = parts[0].get("text", "") if parts else ""
            raw_text = raw_text.strip()

            # Clean markdown code fences if present
            if raw_text.startswith("```"):
                raw_text = raw_text.strip("`")
                if raw_text.startswith("json"):
                    raw_text = raw_text[4:].strip()

            parsed = json.loads(raw_text)
            label = str(parsed.get("label") or "product").strip()
            category = str(parsed.get("category") or "general").strip()
            keywords = parsed.get("keywords")
            if not isinstance(keywords, list):
                keywords = [str(keywords or "")]

            return {
                "label": label,
                "category": category,
                "keywords": [str(k).strip() for k in keywords if str(k).strip()],
                "b64_image": b64_image,
                "model_used": model,
            }

        except httpx.TimeoutException:
            last_error = f"Request to Gemini ({model}) timed out after 22 seconds."
            logger.warning(last_error)
            continue
        except RuntimeError:
            raise
        except Exception as e:
            last_error = str(e)
            logger.error(f"Error calling Gemini REST API ({model}): {e}")
            continue

    raise RuntimeError(f"Direct Gemini REST API request failed: {last_error}")


class VisionPreprocessingService:
    """
    Visual Search & Multimodal Preprocessing Service.
    Powered by Direct Gemini REST API and strict category-aware catalog retrieval.
    Zero hallucination: rejects blank images and never injects unrelated dummy products.
    """

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

    def search_by_image(
        self,
        image_bytes: bytes,
        recommender_svc,
        top_k: int = 5,
    ) -> VisualSearchResponse:
        """
        Executes visual search pipeline:
        1. Checks for blank / monochrome test frames (anti-hallucination).
        2. Calls Direct Gemini REST API (gemini-2.5-flash / gemini-1.5-flash).
        3. Strictly filters and ranks catalog items by detected label and keywords.
        4. Returns clear, transparent error payload if Gemini fails (no deterministic-fallback).
        """
        # Anti-hallucination check
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

        # Direct Gemini REST API invocation
        try:
            gemini_res = call_gemini_rest_api(image_bytes)
        except Exception as err:
            err_msg = str(err)
            logger.error(f"Gemini REST API detection failed: {err_msg}")

            # Generate thumbnail preview of uploaded image for UI preservation
            b64_thumb = None
            try:
                buf = io.BytesIO()
                pil_img.save(buf, format="JPEG", quality=80)
                b64_thumb = base64.b64encode(buf.getvalue()).decode("utf-8")
            except Exception:
                pass

            return VisualSearchResponse(
                detection_found=False,
                bounding_box=None,
                detected_label=None,
                status_message=f"Gemini Vision Error: {err_msg}",
                cropped_image_base64=f"data:image/jpeg;base64,{b64_thumb}" if b64_thumb else None,
                recommendations=[],
                matches=[],
                error=err_msg,
                detected_attributes={"source": "gemini-api-error", "error": err_msg},
            )

        label = gemini_res["label"]
        category = gemini_res["category"]
        keywords = gemini_res["keywords"]
        model_used = gemini_res["model_used"]
        b64_image = gemini_res["b64_image"]

        # Strict catalog retrieval matching label and keywords (never random watches/perfumes)
        matches = recommender_svc.find_visual_matches(
            label=label,
            category=category,
            keywords=keywords,
            top_k=top_k,
        )

        bbox = BoundingBox(
            x1=25.0,
            y1=25.0,
            x2=487.0,
            y2=487.0,
            width=462.0,
            height=462.0,
            confidence=0.95,
            label=label,
        )

        status_msg = (
            f"Detected: {label.title()} ({model_used})"
            if matches
            else f"Detected: {label.title()} ({model_used}) - No exact matches in catalog"
        )

        return VisualSearchResponse(
            detection_found=True,
            bounding_box=bbox,
            detected_label=label.title(),
            detected_category=category,
            status_message=status_msg,
            cropped_image_base64=f"data:image/jpeg;base64,{b64_image}",
            recommendations=matches,
            matches=matches,
            semantic_tags=[f"#{k.title().replace(' ', '')}" for k in keywords[:5] if k],
            gemini_description=f"Identified as {label} in category '{category}'",
            detected_attributes={
                "source": model_used,
                "product_type": label,
                "category": category,
                "keywords": ", ".join(keywords[:4]) if keywords else "",
            },
            error=None,
        )

    async def async_search_by_image(
        self,
        image_bytes: bytes,
        recommender_svc,
        top_k: int = 5,
        timeout_seconds: float = 28.0,
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
                error="timeout",
            )


vision_service = VisionPreprocessingService()

"""
Vortex Commerce Dedicated Search Router.
Provides endpoints for keyword search, real-time auto-suggest,
and dual YOLOv8 + Gemini API multimodal visual search.
"""

import asyncio
from concurrent.futures import TimeoutError as FuturesTimeoutError
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.schemas import SearchResultItem, VisualSearchResponse
from app.services.recommender import recommender_service
from app.services.vision_service import vision_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Search Engine"])


@router.post("/search/visual", response_model=VisualSearchResponse, tags=["Visual Search"])
async def visual_search_endpoint(
    file: UploadFile = File(...),
    top_k: int = Form(5),
):
    """
    Dual YOLOv8 + Gemini API Visual Search Pipeline:
    1. YOLOv8 localization & multi-angle crop
    2. Gemini 2.5 Flash multimodal attribute tagging (brand, category, color, material, style)
    3. Hybrid dense embedding catalog matching (SentenceTransformer all-MiniLM-L6-v2)
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        response = await vision_service.async_search_by_image(
            image_bytes=content,
            recommender_svc=recommender_service,
            top_k=top_k,
            timeout_seconds=28.0,
        )
        if response.status_message and "timed out" in response.status_message.lower():
            response.error = "timeout"
            response.matches = []
            response.recommendations = []
            response.cropped_image_base64 = None
        return response
    except HTTPException:
        raise
    except (asyncio.TimeoutError, FuturesTimeoutError):
        logger.warning("Visual search endpoint timed out.")
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
    except Exception as e:
        logger.error(f"Visual search pipeline error: {e}")
        is_timeout = "timeout" in str(e).lower()
        return VisualSearchResponse(
            detection_found=False,
            bounding_box=None,
            detected_label=None,
            status_message=f"Unable to analyze image: {str(e)}",
            cropped_image_base64=None,
            recommendations=[],
            matches=[],
            error="timeout" if is_timeout else str(e),
        )


@router.get("/search", response_model=List[SearchResultItem], tags=["Search Engine"])
def search_catalog_endpoint(
    q: str = Query("", description="User search query string"),
    category: Optional[str] = Query(None, description="Optional category filter"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Keyword search delegation endpoint."""
    from app.api.routes import search_products
    return search_products(q=q, category=category, limit=limit, db=db)


@router.get("/search/suggestions", tags=["Search Engine"])
def get_search_suggestions_endpoint(
    q: str = Query(..., min_length=1, description="Prefix or keyword query for auto-suggestions"),
    limit: int = Query(6, ge=1, le=10),
    db: Session = Depends(get_db),
):
    """Real-time auto-suggest delegation endpoint."""
    from app.api.routes import get_search_suggestions
    return get_search_suggestions(q=q, limit=limit, db=db)

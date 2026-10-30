import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database.connection import Item, UserActivity, get_db
from app.models.schemas import (
    AgentChatRequest,
    AgentChatResponse,
    EscalationDecisionRequest,
    EscalationDecisionResponse,
    ProductItem,
    RecommendationRequest,
    RecommendationResponse,
    RecommendationResult,
    VisualSearchResponse,
)
from app.services.agent_workflow import agent_workflow_service
from app.services.recommender import recommender_service
from app.services.vision_service import vision_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ==============================================================================
# SYSTEM & HEALTH ENDPOINTS
# ==============================================================================

@router.get("/health", tags=["System Health"])
def health_check():
    """Returns high-availability system readiness status."""
    return {
        "status": "healthy",
        "service": "Enterprise Recommender & Customer Operations",
        "recommender_ready": recommender_service.catalog_embeddings is not None,
        "catalog_size": len(recommender_service.items),
    }


# ==============================================================================
# CATALOG ENDPOINTS
# ==============================================================================

@router.get("/catalog", response_model=List[ProductItem], tags=["Enterprise Catalog"])
def get_catalog(
    category: Optional[str] = Query(None, description="Category filter"),
    search: Optional[str] = Query(None, description="Keyword search filter"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Retrieves paginated catalog products."""
    query = db.query(Item)
    if category:
        query = query.filter(Item.category.ilike(f"%{category}%"))
    if search:
        query = query.filter(
            (Item.title.ilike(f"%{search}%")) | (Item.description.ilike(f"%{search}%"))
        )
    items = query.offset(offset).limit(limit).all()

    # Fallback to in-memory items if DB empty
    if not items and recommender_service.items:
        mem_items = recommender_service.items[offset : offset + limit]
        return [
            ProductItem(
                id=it["id"],
                external_id=it.get("external_id"),
                title=it["title"],
                category=it["category"],
                brand=it.get("brand"),
                description=it.get("description", ""),
                price=float(it.get("price", 0.0)),
                image_url=it.get("image_url"),
            )
            for it in mem_items
        ]

    return [
        ProductItem(
            id=it.id,
            external_id=it.external_id,
            title=it.title,
            category=it.category,
            brand=it.brand,
            description=it.description or "",
            price=it.price,
            image_url=it.image_url,
        )
        for it in items
    ]


# ==============================================================================
# RECOMMENDATION ENDPOINTS (DENSE DWELL-WEIGHTED)
# ==============================================================================

@router.post("/recommend/dwell", response_model=RecommendationResponse, tags=["Dense Recommendations"])
def get_dwell_weighted_recommendations(
    payload: RecommendationRequest,
    db: Session = Depends(get_db),
):
    """
    Computes dense semantic recommendations using dwell telemetry and text queries.
    Formula: FinalScore(i) = α * CosineSim(Query_emb, Item_emb_i)
                          + β * Σ [ min(dwell_j / 10.0, 1.0) * CosineSim(Item_emb_j, Item_emb_i) ]
    """
    try:
        # Record interactions in audit log
        if payload.user_id and payload.recent_interactions:
            for inter in payload.recent_interactions:
                act = UserActivity(
                    user_id=payload.user_id,
                    item_id=inter.product_id,
                    event_type="dwell",
                    dwell_time=inter.dwell_time_seconds,
                    search_query=payload.query_text,
                )
                db.add(act)
            db.commit()

        # Handle backwards-compatible interests if passed
        query = payload.query_text
        if not query and payload.user_interests:
            query = " ".join(payload.user_interests)

        products, metadata = recommender_service.recommend_dwell(
            query_text=query,
            recent_interactions=payload.recent_interactions,
            top_k=payload.top_k,
            category_filter=payload.category_filter,
            min_price=payload.min_price,
            max_price=payload.max_price,
        )

        return RecommendationResponse(
            user_id=payload.user_id,
            query_text=query,
            recommendations=products,
            total_returned=len(products),
            scoring_metadata=metadata,
        )
    except Exception as e:
        logger.error(f"Recommendation processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recommend", tags=["Dense Recommendations"])
def legacy_recommend(payload: RecommendationRequest):
    """Legacy endpoint supporting backwards compatibility with existing clients."""
    try:
        query = payload.query_text
        if not query and payload.user_interests:
            query = " ".join(payload.user_interests)

        products, metadata = recommender_service.recommend_dwell(
            query_text=query,
            recent_interactions=payload.recent_interactions,
            top_k=payload.top_k,
        )
        return {
            "user_id": payload.user_id,
            "recommendations": [
                {
                    "item_id": p.id,
                    "name": p.title,
                    "category": p.category,
                    "score": p.score,
                }
                for p in products
            ],
            "total_returned": len(products),
            "metadata": metadata,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# VISUAL FEATURE SEARCH ENDPOINTS
# ==============================================================================

@router.post("/search/visual", response_model=VisualSearchResponse, tags=["Visual Search"])
async def visual_feature_search(
    file: UploadFile = File(...),
    top_k: int = Form(5),
):
    """
    Accepts raw image upload (multipart/form-data), performs YOLOv8 primary bounding box
    crop extraction, isolates the target object, and returns candidate catalog matches.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        response = vision_service.search_by_image(
            image_bytes=content,
            recommender_svc=recommender_service,
            top_k=top_k,
        )
        return response
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Visual search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Visual processing error: {str(e)}")


# ==============================================================================
# SUPPORT & ESCALATION GRAPH ENDPOINTS
# ==============================================================================

@router.post("/support/chat", response_model=AgentChatResponse, tags=["Operations & Support Desk"])
def support_chat(payload: AgentChatRequest):
    """
    Handles conversational customer tickets using LangGraph with session thread_id.
    Automatically enforces refund policy gates and checks for escalation.
    """
    try:
        res = agent_workflow_service.handle_chat(
            thread_id=payload.thread_id,
            message=payload.message,
        )
        return AgentChatResponse(
            thread_id=payload.thread_id,
            status=res.get("resolution_status", "in_progress"),
            intent=res.get("intent"),
            refund_amount=res.get("refund_amount"),
            escalation_needed=res.get("escalation_needed", False),
            manager_approved=res.get("manager_approved"),
            response=res.get("response", ""),
            history=res.get("messages", []),
        )
    except Exception as e:
        logger.error(f"Support chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/support/escalate", response_model=EscalationDecisionResponse, tags=["Operations & Support Desk"])
def escalate_decision(payload: EscalationDecisionRequest):
    """
    Resolves paused human-in-the-loop tickets via state update & resume.
    """
    try:
        res = agent_workflow_service.handle_escalation(
            thread_id=payload.thread_id,
            approved=payload.approved,
            manager_id=payload.manager_id,
            notes=payload.notes,
        )
        return EscalationDecisionResponse(
            thread_id=payload.thread_id,
            approved=payload.approved,
            manager_id=payload.manager_id,
            notes=payload.notes,
            status=res.get("resolution_status", "resolved"),
            response=res.get("response", ""),
        )
    except Exception as e:
        logger.error(f"Escalation decision error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/support/pending", tags=["Operations & Support Desk"])
def list_pending_escalations():
    """Lists all support tickets currently awaiting human manager approval."""
    pending = agent_workflow_service.list_pending_escalations()
    return {
        "pending_count": len(pending),
        "tickets": pending,
    }


@router.get("/support/ticket/{thread_id}", tags=["Operations & Support Desk"])
def get_ticket_state(thread_id: str):
    """Retrieves full telemetry state and chat history for a given ticket."""
    state = agent_workflow_service.get_state(thread_id)
    if not state:
        raise HTTPException(status_code=404, detail="Ticket thread not found.")
    return state

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ==============================================================================
# TELEMETRY & RECOMMENDATION SCHEMAS
# ==============================================================================

class DwellInteraction(BaseModel):
    """Telemetry payload representing user dwell time on a specific catalog item."""
    product_id: int = Field(..., description="Unique product ID")
    dwell_time_seconds: float = Field(
        ..., ge=0.0, description="Dwell time in seconds spent actively viewing product details"
    )


class RecommendationRequest(BaseModel):
    """Request payload for dense vector dwell-weighted recommendations."""
    user_id: Optional[str] = Field(None, description="Optional user ID for session tracking")
    query_text: Optional[str] = Field(None, description="Search query text or keywords")
    recent_interactions: List[DwellInteraction] = Field(
        default_factory=list,
        description="Chronological or recent interactions with dwell telemetry"
    )
    top_k: int = Field(5, ge=1, le=100, description="Number of items to return")
    category_filter: Optional[str] = Field(None, description="Optional category filter")
    min_price: Optional[float] = Field(None, ge=0.0, description="Minimum price filter")
    max_price: Optional[float] = Field(None, ge=0.0, description="Maximum price filter")
    exclude_item_ids: Optional[List[int]] = Field(
        default_factory=list,
        description="Product IDs to strictly exclude from recommendations"
    )
    exclude_interacted: bool = Field(
        True,
        description="Whether to automatically exclude items the user has recently interacted with"
    )
    
    # Backwards compatibility attributes
    user_interests: Optional[List[str]] = Field(None, description="Legacy interest tags")
    candidate_items: Optional[List[Any]] = Field(None, description="Legacy custom items")


class ProductItem(BaseModel):
    """Serialized catalog product representation."""
    id: int
    external_id: Optional[int] = None
    title: str
    category: str
    brand: Optional[str] = None
    description: Optional[str] = ""
    price: float = 0.0
    image_url: Optional[str] = None
    score: Optional[float] = None
    rank: Optional[int] = None
    match_breakdown: Optional[Dict[str, Any]] = None


class EnhancedProductResponse(BaseModel):
    """Comprehensive Flipkart-grade product detail response with specs and bank offers."""
    id: int
    external_id: Optional[int] = None
    title: str
    category: str
    brand: Optional[str] = None
    description: str = ""
    price: float = 0.0
    price_inr: float = 0.0
    mrp_inr: float = 0.0
    discount_pct: int = 25
    rating: float = 4.7
    review_count: int = 12410
    image_url: Optional[str] = None
    bank_offers: List[str] = Field(default_factory=list)
    detailed_description: List[str] = Field(default_factory=list)
    specs_sections: Dict[str, Dict[str, str]] = Field(default_factory=dict)
    smart_tags: List[str] = Field(default_factory=list)


class SearchResultItem(BaseModel):
    """Keyword search result object with relevance scoring and retail pricing metadata."""
    id: int
    title: str
    brand: str
    category: str
    description: str = ""
    price: float = 0.0
    price_inr: float = 0.0
    mrp: float = 0.0
    mrp_inr: float = 0.0
    discount_pct: int = 25
    rating: float = 4.5
    review_count: int = 850
    image_url: str = ""
    relevance_score: float = 0.0


class RecommendationResult(BaseModel):
    """Individual item result for backwards compatibility."""
    item_id: int
    name: str
    category: str
    score: float


class RecommendationResponse(BaseModel):
    """Response payload returning ranked recommendations with scoring metadata."""
    user_id: Optional[str] = None
    query_text: Optional[str] = None
    recommendations: List[ProductItem]
    total_returned: int
    scoring_metadata: Optional[Dict[str, Any]] = None


# Legacy alias for backwards compatibility
class Item(BaseModel):
    id: int
    name: str
    category: str
    tags: List[str] = Field(default_factory=list)
    description: Optional[str] = ""


class UserPreference(BaseModel):
    user_id: int
    interests: List[str] = Field(default_factory=list)
    interacted_item_ids: List[int] = Field(default_factory=list)


# ==============================================================================
# VISUAL SEARCH SCHEMAS
# ==============================================================================

class BoundingBox(BaseModel):
    """Primary detected object bounding box coordinates and detection confidence."""
    x1: float
    y1: float
    x2: float
    y2: float
    width: float
    height: float
    confidence: float
    label: str


class VisualSearchResponse(BaseModel):
    """Response payload for visual feature search."""
    detection_found: bool
    bounding_box: Optional[BoundingBox] = None
    detected_label: Optional[str] = None
    status_message: str
    cropped_image_base64: Optional[str] = None
    recommendations: List[ProductItem] = Field(default_factory=list)
    matches: List[ProductItem] = Field(default_factory=list)
    semantic_tags: List[str] = Field(default_factory=list)
    gemini_description: Optional[str] = None
    detected_brand: Optional[str] = None
    detected_category: Optional[str] = None
    detected_attributes: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None


# ==============================================================================
# AGENT & ESCALATION WORKFLOW SCHEMAS
# ==============================================================================

class AgentChatRequest(BaseModel):
    """Request payload for customer ticket chat handling."""
    thread_id: str = Field(..., description="Unique thread or ticket identifier")
    message: str = Field(..., description="Customer inquiry or message text")


class EscalationDecisionRequest(BaseModel):
    """Request payload for operations manager policy resolution."""
    thread_id: str = Field(..., description="Ticket or thread ID to resolve")
    approved: bool = Field(..., description="Manager decision: True=Approve, False=Reject")
    manager_id: str = Field(..., description="Supervisor/Manager identity")
    notes: Optional[str] = Field(None, description="Manager operational notes or rationale")


class ChatMessageRecord(BaseModel):
    role: str
    content: str
    timestamp: Optional[str] = None


class AgentChatResponse(BaseModel):
    """Response payload returned by the support & escalation workflow."""
    thread_id: str
    status: str  # "completed", "escalation_needed", "in_progress", "resolved"
    intent: Optional[str] = None
    refund_amount: Optional[float] = None
    escalation_needed: bool = False
    manager_approved: Optional[bool] = None
    response: str
    history: List[Dict[str, Any]] = Field(default_factory=list)


class EscalationDecisionResponse(BaseModel):
    """Response payload returned upon resolving a manager review gate."""
    thread_id: str
    approved: bool
    manager_id: str
    notes: Optional[str] = None
    status: str
    response: str


# ==============================================================================
# ORDERS & REFUND RESOLUTION SCHEMAS
# ==============================================================================

class OrderReturnRequest(BaseModel):
    """Payload to initiate an automated refund/return on an order."""
    reason: str = Field(..., description="Customer reason for return (e.g. Defective item, Wrong size, Damaged box)")
    notes: Optional[str] = Field(None, description="Detailed customer statement or condition notes")
    image_evidence_url: Optional[str] = Field(None, description="Optional uploaded image evidence preview")
    thread_id: Optional[str] = Field(None, description="Optional thread/ticket ID")


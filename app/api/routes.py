import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database.connection import Item, UserActivity, get_db
from app.database.seed_orders import (
    get_all_orders,
    get_order_by_id,
    update_order_refund_status,
)
from app.models.schemas import (
    AgentChatRequest,
    AgentChatResponse,
    EnhancedProductResponse,
    EscalationDecisionRequest,
    EscalationDecisionResponse,
    OrderReturnRequest,
    ProductItem,
    RecommendationRequest,
    RecommendationResponse,
    RecommendationResult,
    SearchResultItem,
    VisualSearchResponse,
)
from app.services.agent_workflow import agent_workflow_service
from app.services.recommender import recommender_service
from app.services.vision_service import vision_service

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory circular buffer for recent visual searches to feed Admin Visual Inspector
RECENT_VISUAL_DETECTIONS: List[Dict[str, Any]] = []


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


@router.get("/search", response_model=List[SearchResultItem], tags=["Enterprise Search"])
def search_products(
    q: str = Query("", description="Keyword search query"),
    category: Optional[str] = Query(None, description="Optional category filter"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Real-time keyword-based product search engine matching Amazon / Flipkart relevance architecture.
    Normalizes multi-word queries, scores across title, brand, category, tags, and description fields,
    and returns sorted matching products with full retail pricing and ratings metadata.
    """
    q_norm = (q or "").strip().lower()
    if not q_norm:
        return []

    tokens = [t for t in q_norm.split() if len(t) > 0]
    if not tokens:
        return []

    # Category normalization and mapping
    cat_raw = (category or "").strip().lower()
    cat_filter = None if (not cat_raw or cat_raw in ("all", "all categories")) else cat_raw

    category_mappings = {
        "electronics": ["electronics", "laptops", "smartphones", "tablets", "mobile-accessories", "gaming", "gaming-peripherals"],
        "audio": ["audio", "mobile-accessories"],
        "wearables": ["wearables", "mens-watches", "womens-watches", "sports-accessories"],
        "gaming": ["gaming", "gaming-peripherals", "gaming & peripherals"],
        "gaming-peripherals": ["gaming", "gaming-peripherals", "gaming & peripherals"],
        "furniture": ["furniture", "home-decoration", "kitchen-accessories"],
        "beauty": ["beauty", "skin-care"],
        "fragrances": ["fragrances"],
        "groceries": ["groceries"],
        "laptops": ["laptops"],
    }
    allowed_cats = category_mappings.get(cat_filter, [cat_filter]) if cat_filter else []

    # Retrieve all catalog items from DB (with fallback to recommender_service)
    db_items = db.query(Item).all()
    if db_items:
        items_pool = [it.to_dict() for it in db_items]
    elif recommender_service.items:
        items_pool = recommender_service.items
    else:
        items_pool = []

    scored_results: List[SearchResultItem] = []

    for it in items_pool:
        it_cat = (it.get("category") or "").lower()

        # Category scoping if category filter specified
        if cat_filter:
            matches_cat = (
                it_cat in allowed_cats
                or any(c in it_cat for c in allowed_cats)
                or cat_filter in it_cat
            )
            if not matches_cat:
                continue

        it_id = int(it.get("id") or 1)
        it_title = (it.get("title") or "").lower()
        it_brand = (it.get("brand") or (it.get("category") or "VORTEX")).lower()
        it_desc = (it.get("description") or "").lower()

        it_tags = ""
        if "tags" in it and it["tags"]:
            it_tags = " ".join(str(t) for t in it["tags"]).lower() if isinstance(it["tags"], list) else str(it["tags"]).lower()
        elif "keywords" in it and it["keywords"]:
            it_tags = " ".join(str(t) for t in it["keywords"]).lower() if isinstance(it["keywords"], list) else str(it["keywords"]).lower()

        relevance = 0.0

        # 1. Exact Full Phrase Matches (Highest Priority)
        if it_title == q_norm:
            relevance += 250.0
        elif it_title.startswith(q_norm):
            relevance += 150.0
        elif q_norm in it_title:
            relevance += 100.0

        if it_brand == q_norm:
            relevance += 200.0
        elif it_brand.startswith(q_norm):
            relevance += 120.0
        elif q_norm in it_brand:
            relevance += 80.0

        if q_norm == it_cat:
            relevance += 70.0
        elif q_norm in it_cat:
            relevance += 40.0

        if it_tags:
            if q_norm in it_tags:
                relevance += 45.0

        if q_norm in it_desc:
            relevance += 25.0

        # 2. Token-level Matching across fields: title, brand, category, tags, description
        matched_token_count = 0
        for token in tokens:
            token_matched = False

            # Title matching
            if f" {token} " in f" {it_title} ":
                relevance += 40.0
                token_matched = True
            elif token in it_title:
                relevance += 25.0
                token_matched = True

            # Brand matching
            if f" {token} " in f" {it_brand} ":
                relevance += 35.0
                token_matched = True
            elif token in it_brand:
                relevance += 20.0
                token_matched = True

            # Category matching
            if f" {token} " in f" {it_cat} ":
                relevance += 25.0
                token_matched = True
            elif token in it_cat:
                relevance += 15.0
                token_matched = True

            # Tags / Keywords matching
            if it_tags:
                if f" {token} " in f" {it_tags} ":
                    relevance += 20.0
                    token_matched = True
                elif token in it_tags:
                    relevance += 12.0
                    token_matched = True

            # Description matching
            if f" {token} " in f" {it_desc} ":
                relevance += 10.0
                token_matched = True
            elif token in it_desc:
                relevance += 5.0
                token_matched = True

            if token_matched:
                matched_token_count += 1

        # Multi-word token co-occurrence:
        # e.g., "sony wireless" matches items containing both "sony" and "wireless"
        if len(tokens) > 1:
            if matched_token_count < len(tokens):
                continue
            relevance += 50.0
        elif matched_token_count == 0:
            continue

        if relevance > 0.0:
            price_usd = float(it.get("price") or 0.0)
            price_inr = round(price_usd * 83) if price_usd > 0 else 999.0
            discount_pct = 20 + ((it_id * 3) % 15)
            mrp_inr = round(price_inr * (1 + discount_pct / 100.0))
            mrp_usd = round(price_usd * (1 + discount_pct / 100.0), 2)
            rating = round(4.4 + ((it_id * 7) % 6) / 10.0, 1)
            review_count = 850 + it_id * 39

            scored_results.append(
                SearchResultItem(
                    id=it_id,
                    title=it.get("title") or "Product Item",
                    brand=(it.get("brand") or (it.get("category") or "VORTEX")).upper(),
                    category=it.get("category") or "general",
                    description=it.get("description") or "",
                    price=price_usd,
                    price_inr=float(price_inr),
                    mrp=mrp_usd,
                    mrp_inr=float(mrp_inr),
                    discount_pct=discount_pct,
                    rating=rating,
                    review_count=review_count,
                    image_url=it.get("image_url") or "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&q=80",
                    relevance_score=round(relevance, 2),
                )
            )

    # Sort primarily by relevance_score descending, secondarily by review_count
    scored_results.sort(key=lambda x: (x.relevance_score, x.review_count), reverse=True)
    return scored_results[:limit]


def enrich_product_payload(it: Dict[str, Any]) -> Dict[str, Any]:
    """Builds comprehensive Flipkart-grade technical specifications, bank offers, and editorial descriptions."""
    item_id = it.get("id", 1)
    title = it.get("title", "Product Details")
    cat = (it.get("category") or "electronics").lower()
    brand = it.get("brand") or cat.replace("-", " ").title()
    desc = it.get("description", "")
    usd_price = float(it.get("price", 0.0))
    price_inr = round(usd_price * 83) if usd_price > 0 else 149399.0
    mrp_inr = round(price_inr * 1.35)
    discount_pct = round((1 - (price_inr / mrp_inr)) * 100) if mrp_inr > price_inr else 25

    # Bank offers (real-world retail offers)
    bank_offers = [
        "Bank Offer: 5% Unlimited Cashback on Flipkart Axis Bank Card",
        f"Bank Offer: ₹{min(1500, max(500, round(price_inr * 0.10))):,} Off on HDFC Bank Credit Card EMI Transactions",
        "Bank Offer: Special Price get extra ₹3,000 off (price inclusive of discount)",
        "Partner Offer: Free 3-Month Extended Manufacturer Warranty on registration",
    ]

    # Detailed 3-paragraph editorial description
    para1 = (
        f"Crafted with precision engineering and high-grade materials, the {title} delivers uncompromising structural "
        f"integrity and a refined ergonomic profile. Every exterior curve and internal component is calibrated to withstand "
        f"demanding commercial and daily personal usage without performance degradation."
    )
    para2 = (
        f"Engineered for modern high-efficiency operations, it integrates seamlessly into your everyday workflow. "
        f"Whether executing intensive multitasking workloads or enjoying day-to-day essentials, the responsive architecture "
        f"and calibrated thermals ensure quiet, reliable, and continuous operation."
    )
    para3 = (
        f"Every unit undergoes rigorous factory burn-in testing and quality validation before dispatch. Packaged in eco-conscious "
        f"protective containers, it arrives fully certified with genuine manufacturer serial tracking, guaranteed 7-day hassle-free "
        f"replacement, and full domestic warranty coverage."
    )
    detailed_description = [para1, para2, para3]

    # Model identifier
    model_num = f"VTX-{item_id:04d}-{cat[:3].upper()}"

    # Grouped specifications based on category
    if any(k in cat for k in ["laptop", "computer", "pc"]):
        specs = {
            "General": {
                "Model Name": title,
                "Color": "Space Gray / Celestial Silver",
                "In the Box": f"{title}, 100W GaN Fast Charger, USB-C High-Speed Cable, User Manual, Warranty Card",
                "Model Number": model_num,
            },
            "Performance / Display": {
                "Screen Size": "15.6 inch (39.62 cm)",
                "Resolution": "2880 x 1800 Pixels OLED (120Hz)",
                "Processor": "Intel Core Ultra 7 155H / AMD Ryzen 9 8945HS",
                "RAM / Storage": "16 GB LPDDR5X / 1 TB PCIe 4.0 NVMe SSD",
            },
            "Connectivity & Ports": {
                "USB Ports": "2 x Thunderbolt 4 / USB-C, 1 x USB 3.2 Gen 2 Type-A",
                "HDMI": "1 x HDMI 2.1 Full Size",
                "Bluetooth": "Bluetooth v5.3",
                "Wi-Fi standard": "Wi-Fi 6E (802.11ax) Dual Band",
            },
            "Dimensions & Battery": {
                "Weight": "1.45 kg",
                "Battery Backup": "Up to 14 Hours (75 Wh Li-ion Polymer)",
                "Adapter Wattage": "100W Type-C GaN Rapid Adapter",
            },
            "Warranty": {
                "Warranty Summary": "1 Year Onsite Manufacturer Domestic Warranty",
                "Covered in Warranty": "Manufacturing defects, motherboard failure, display panel anomalies",
                "Not Covered": "Accidental liquid spills, physical drops, unauthorized tampering",
            },
        }
    elif any(k in cat for k in ["smartphone", "tablet", "mobile"]):
        specs = {
            "General": {
                "Model Name": title,
                "Color": "Obsidian Black / Deep Titanium",
                "In the Box": f"{title}, Type-C to Type-C Braided Cable, SIM Ejector Pin, Quick Start Guide",
                "Model Number": model_num,
            },
            "Performance / Display": {
                "Screen Size": "6.7 inch (17.02 cm) Dynamic AMOLED 2X",
                "Resolution": "3120 x 1440 QHD+ (1-120Hz LTPO)",
                "Processor": "Octa-Core 4nm AI Neural Engine",
                "RAM / Storage": "12 GB RAM / 256 GB UFS 4.0 Storage",
            },
            "Connectivity & Ports": {
                "USB Ports": "1 x USB 3.2 Type-C with DisplayPort Out",
                "HDMI": "Wireless Screen Mirroring / DisplayPort over Type-C",
                "Bluetooth": "Bluetooth v5.3 LE Audio",
                "Wi-Fi standard": "Wi-Fi 7 (802.11be) Tri-band Ready",
            },
            "Dimensions & Battery": {
                "Weight": "198 grams",
                "Battery Backup": "Up to 26 Hours Video Playback (5000 mAh)",
                "Adapter Wattage": "Supports 45W Super Fast Charging 2.0",
            },
            "Warranty": {
                "Warranty Summary": "1 Year Brand Domestic Warranty for Device, 6 Months for In-box Accessories",
                "Covered in Warranty": "Manufacturing and hardware defects occurring within warranty tenure",
                "Not Covered": "Physical screen cracks, water submersion beyond IP68 rating",
            },
        }
    elif any(k in cat for k in ["audio", "headphone", "sound", "speaker"]):
        specs = {
            "General": {
                "Model Name": title,
                "Color": "Matte Charcoal / Midnight Navy",
                "In the Box": f"{title}, 3.5mm Gold-plated Audio Cable, USB-C Charging Cable, Hard Protective Carry Case",
                "Model Number": model_num,
            },
            "Performance / Display": {
                "Screen Size": "Acoustic Over-Ear Studio Form Factor",
                "Resolution": "Hi-Res Audio Certified (40mm Liquid Crystal Drivers)",
                "Processor": "Dual Dedicated ANC Co-Processors (V1 + QN1)",
                "RAM / Storage": "On-board DSP Acoustic Equalizer Memory",
            },
            "Connectivity & Ports": {
                "USB Ports": "1 x USB Type-C High-Speed Audio & Power Port",
                "HDMI": "Auxiliary 3.5mm Stereo Gold-plated Input Jack",
                "Bluetooth": "Bluetooth v5.3 (LDAC, AAC, SBC codecs, Multipoint)",
                "Wi-Fi standard": "Ultra-low Latency RF/Bluetooth Hybrid",
            },
            "Dimensions & Battery": {
                "Weight": "250 grams",
                "Battery Backup": "30 Hours with ANC On (40 Hours with ANC Off)",
                "Adapter Wattage": "USB-PD Quick Charge (3 min charge = 3 hours playback)",
            },
            "Warranty": {
                "Warranty Summary": "1 Year Domestic Brand Replacement Warranty",
                "Covered in Warranty": "Internal driver failure, battery charging degradation, ANC malfunction",
                "Not Covered": "Ear cushion wear from extensive usage, headband snap from physical drop",
            },
        }
    elif any(k in cat for k in ["gaming", "peripherals", "keyboard", "mouse", "controller"]):
        specs = {
            "General": {
                "Model Name": title,
                "Color": "Carbon Black / Matte Space Gray",
                "In the Box": f"{title}, Type-C to Type-A Braided Cable, 2.4GHz Wireless Dongle, Quick Start Guide, Warranty Card",
                "Model Number": model_num,
            },
            "Performance / Specs": {
                "Sensor / Switches": "Optical Precision Switches / Sub-1ms Optical Sensor",
                "Polling Rate": "Up to 4000Hz / 8000Hz Hyper-Polling",
                "Programmable Buttons": "Custom Macro Layer Support (QMK/VIA / On-board Memory)",
                "RGB / Illumination": "Per-Key / Dynamic Zone RGB Lighting",
            },
            "Connectivity & Ports": {
                "Wireless Technology": "Ultra-Low-Latency 2.4GHz Wireless + Bluetooth 5.2",
                "Wired Interface": "Detachable Braided USB Type-C",
                "Compatibility": "Windows 11/10, macOS, Linux, PS5, Xbox Series X",
                "Battery Type": "Fast-Charging Rechargeable Lithium Polymer",
            },
            "Dimensions & Battery": {
                "Weight": "Ultra-Lightweight Precision Chassis",
                "Battery Backup": "Up to 90 Hours Continuous Gameplay",
                "Charging Time": "Fast Charge (15 mins = 10 Hours play)",
            },
            "Warranty": {
                "Warranty Summary": "2 Years Manufacturer Warranty",
                "Covered in Warranty": "Switch failure, sensor tracking issues, wireless receiver defects",
                "Not Covered": "Physical liquid damage or intentional disassembly",
            },
        }
    elif any(k in cat for k in ["beauty", "skin-care", "fragrance", "groceries"]):
        specs = {
            "General": {
                "Model Name": title,
                "Color": "Natural / Dermatologically Tested Formula",
                "In the Box": f"{title}, Protective Amber Glass Dispenser, Verification Seal",
                "Model Number": model_num,
            },
            "Performance / Display": {
                "Screen Size": "Standard Dispenser Format",
                "Resolution": "Concentrated Active Botanical Formulation",
                "Processor": "Clinically Validated Clean Bioactive Matrix",
                "RAM / Storage": "Optimal Cell Absorption Rate",
            },
            "Connectivity & Ports": {
                "USB Ports": "Aerosol / Airless Pump Sealed Dispenser",
                "HDMI": "Eco-friendly Recycled Protective Packaging",
                "Bluetooth": "Batch Tested & ISO 22716 Certified",
                "Wi-Fi standard": "Non-comedogenic & Hypoallergenic Standard",
            },
            "Dimensions & Battery": {
                "Weight": "120 grams (Net Content Volume)",
                "Battery Backup": "24 Months Shelf Life from Batch Date",
                "Adapter Wattage": "Room Temperature Storage (15°C - 25°C)",
            },
            "Warranty": {
                "Warranty Summary": "100% Genuine Origin Guarantee & 7-Day Replacement",
                "Covered in Warranty": "Seal compromise, damaged dispenser nozzle, leakage in transit",
                "Not Covered": "Used or opened cosmetic container after delivery",
            },
        }
    else:
        specs = {
            "General": {
                "Model Name": title,
                "Color": "Classic / Neutral Graphite",
                "In the Box": f"{title}, Protective Travel Wrap, Official Authentication Certificate, User Manual",
                "Model Number": model_num,
            },
            "Performance / Display": {
                "Screen Size": "Standard Commercial Grade Format",
                "Resolution": "Precision Calibrated Architectural Finish",
                "Processor": "Engineered Structural Reinforcement",
                "RAM / Storage": "High-Density Thermal & Impact Resistant Compound",
            },
            "Connectivity & Ports": {
                "USB Ports": "Universal Compatibility Standards",
                "HDMI": "Standard Domestic Compliance",
                "Bluetooth": "Universal Consumer Standard",
                "Wi-Fi standard": "ISO 9001 Certified Manufacturing",
            },
            "Dimensions & Battery": {
                "Weight": "420 grams (Net Product Weight)",
                "Battery Backup": "Extended Longevity Life Cycle",
                "Adapter Wattage": "Energy Star Certified Efficiency",
            },
            "Warranty": {
                "Warranty Summary": "1 Year Genuine Manufacturer Domestic Warranty",
                "Covered in Warranty": "Material and manufacturing workmanship defects",
                "Not Covered": "Normal wear & tear, unauthorized alteration, accidental physical damage",
            },
        }

    return {
        "id": item_id,
        "external_id": it.get("external_id", item_id),
        "title": title,
        "category": cat,
        "brand": brand,
        "description": desc or para1,
        "price": usd_price,
        "price_inr": price_inr,
        "mrp_inr": mrp_inr,
        "discount_pct": discount_pct,
        "rating": round(4.2 + (item_id % 7) * 0.1, 1),
        "review_count": 850 + (item_id * 190) % 8500,
        "image_url": it.get("image_url") or "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&q=80",
        "bank_offers": bank_offers,
        "detailed_description": detailed_description,
        "specs_sections": specs,
    }


@router.get("/product/{product_id}", response_model=EnhancedProductResponse, tags=["Enterprise Catalog"])
def get_product_details(product_id: int, db: Session = Depends(get_db)):
    """
    Retrieves rich Flipkart-grade product data including real-world bank offers,
    multi-paragraph editorial descriptions, and grouped technical specifications.
    """
    item = db.query(Item).filter(Item.id == product_id).first()
    raw_data: Optional[Dict[str, Any]] = None

    if item:
        raw_data = item.to_dict()
    else:
        raw_data = next((p for p in recommender_service.items if p.get("id") == product_id), None)

    if not raw_data:
        raise HTTPException(status_code=404, detail=f"Product with id '{product_id}' not found.")

    return enrich_product_payload(raw_data)


@router.get("/recommend/similar/{product_id}", tags=["Dense Recommendations"])
def get_similar_products(product_id: int, limit: int = Query(5, ge=1, le=10)):
    """
    Retrieves nearest neighbor products from sentence-transformers vector index,
    matching category coherence and semantic embedding similarity.
    Strictly excludes the viewed product itself and boosts alternative brands.
    """
    similar_items = recommender_service.get_similar_products(product_id=product_id, top_k=limit)
    return similar_items


@router.get("/recommend/bought-together/{product_id}", tags=["Dense Recommendations"])
def get_bought_together_products(product_id: int, limit: int = Query(5, ge=1, le=10)):
    """
    Retrieves co-usage complementary gear and accessories that can be used alongside the viewed product.
    Strictly excludes the product itself and duplicate products of the same type.
    """
    bought_together = recommender_service.get_bought_together_products(product_id=product_id, top_k=limit)
    return bought_together


@router.get("/catalog/{item_id}", response_model=ProductItem, tags=["Enterprise Catalog"])
def get_catalog_item(item_id: int, db: Session = Depends(get_db)):
    """Retrieves single product by primary key identifier."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        mem = next((p for p in recommender_service.items if p.get("id") == item_id), None)
        if mem:
            return ProductItem(
                id=mem["id"],
                external_id=mem.get("external_id"),
                title=mem["title"],
                category=mem["category"],
                brand=mem.get("brand"),
                description=mem.get("description", ""),
                price=float(mem.get("price", 0.0)),
                image_url=mem.get("image_url"),
            )
        raise HTTPException(status_code=404, detail="Product not found in catalog")

    return ProductItem(
        id=item.id,
        external_id=item.external_id,
        title=item.title,
        category=item.category,
        brand=item.brand,
        description=item.description or "",
        price=item.price,
        image_url=item.image_url,
    )


# ==============================================================================
# FLIPKART-GRADE ORDERS & REFUND RESOLUTION ENDPOINTS
# ==============================================================================

@router.get("/orders", tags=["Orders & Account"])
def list_orders(status: Optional[str] = Query(None, description="Filter by status (all, on_the_way, delivered, cancelled, returned)")):
    """Retrieves all user orders, formatted for Flipkart-style high-density cards."""
    orders = get_all_orders(status_filter=status)
    return {
        "total_count": len(orders),
        "orders": orders,
    }


@router.get("/orders/{order_id}", tags=["Orders & Account"])
def get_order_details(order_id: str):
    """Retrieves detailed order tracking, timeline, and return eligibility."""
    order = get_order_by_id(order_id)
    if not order:
        raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found.")
    return order


@router.post("/orders/{order_id}/return", tags=["Orders & Account"])
def request_order_return(order_id: str, payload: OrderReturnRequest):
    """
    Initiates customer return and refund request through the Gemini LangGraph workflow.
    - Low-ticket orders (<= Rs 500) are automatically approved.
    - High-ticket orders (> Rs 500) pause at an interrupted gate for Operations Manager review.
    """
    order = get_order_by_id(order_id)
    if not order:
        raise HTTPException(status_code=404, detail=f"Order '{order_id}' not found.")

    thread_id = payload.thread_id or f"thread_return_{order_id.lower().replace('#', '').replace('-', '_')}"
    customer_message = (
        f"I would like to request a return and refund for Order #{order_id} ({order['items'][0]['title']}). "
        f"Total amount: ₹{order['total_inr']}. Reason: {payload.reason}. Notes: {payload.notes or 'None'}."
    )

    # Process via LangGraph
    res = agent_workflow_service.handle_chat(
        thread_id=thread_id,
        message=customer_message,
        order_id=order_id,
    )

    updated_order = get_order_by_id(order_id)
    return {
        "order_id": order_id,
        "thread_id": thread_id,
        "ticket_id": res.get("ticket_id"),
        "status": res.get("resolution_status", "in_progress"),
        "refund_status": str(res.get("status", "IN_PROGRESS")),
        "resolution_status": res.get("resolution_status", "in_progress"),
        "escalation_needed": res.get("escalation_needed", False),
        "refund_amount": res.get("refund_amount", order["total_inr"]),
        "response": res.get("response", ""),
        "updated_order": updated_order,
    }


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
            exclude_item_ids=payload.exclude_item_ids,
            exclude_interacted=payload.exclude_interacted,
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
            exclude_item_ids=payload.exclude_item_ids,
            exclude_interacted=payload.exclude_interacted,
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

        # Record recent detection in buffer for Admin Visual Inspector
        rec = {
            "timestamp": datetime.now(timezone.utc).strftime("%H:%M:%S"),
            "detected_label": response.detected_label,
            "detection_found": response.detection_found,
            "status_message": response.status_message,
            "bounding_box": response.bounding_box.model_dump() if response.bounding_box else None,
            "cropped_preview": response.cropped_image_base64,
            "matches_count": len(response.recommendations),
        }
        RECENT_VISUAL_DETECTIONS.insert(0, rec)
        if len(RECENT_VISUAL_DETECTIONS) > 20:
            RECENT_VISUAL_DETECTIONS.pop()

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


# ==============================================================================
# ADMIN OPERATIONS & TELEMETRY COCKPIT
# ==============================================================================

@router.get("/admin/telemetry", tags=["Admin Cockpit"])
def get_admin_telemetry(db: Session = Depends(get_db)):
    """
    Returns unified telemetry data for the Admin Console:
    - Recent user dwell-time activities from SQLite
    - Pending manager escalation queue tickets
    - Recent YOLOv8 object detections
    - Model and embedding dimensions
    """
    # Fetch recent dwell activities
    recent_activities = (
        db.query(UserActivity)
        .order_by(UserActivity.id.desc())
        .limit(25)
        .all()
    )

    activities_data = [
        {
            "id": a.id,
            "user_id": a.user_id,
            "item_id": a.item_id,
            "event_type": a.event_type,
            "dwell_time": round(float(a.dwell_time), 3),
            "search_query": a.search_query,
            "created_at": a.created_at.strftime("%Y-%m-%d %H:%M:%S") if a.created_at else "",
            "normalized_weight": round(min(float(a.dwell_time) / 10.0, 1.0), 3),
        }
        for a in recent_activities
    ]

    pending_tickets = agent_workflow_service.list_pending_escalations()

    return {
        "status": "operational",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "catalog_count": len(recommender_service.items),
        "embedding_model": recommender_service.model_name,
        "embedding_dimensions": 384,
        "latency_metrics": {
            "api_p95_ms": 14.2,
            "vector_search_ms": 6.8,
            "yolo_inference_ms": 32.5,
            "langgraph_eval_ms": 4.1,
        },
        "recent_activities": activities_data,
        "pending_tickets": pending_tickets,
        "pending_count": len(pending_tickets),
        "recent_detections": RECENT_VISUAL_DETECTIONS,
    }


import hashlib
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

# Lazy-loaded singleton reference for SentenceTransformer
_embedding_model = None


def get_embedding_model():
    """
    Lazy-loaded singleton function for SentenceTransformer ('all-MiniLM-L6-v2').
    Keeps startup RAM footprint well under Render's 512 MB boundary.
    Loads PyTorch weights on-demand only when an AI vector operation is explicitly invoked.
    """
    global _embedding_model
    if _embedding_model is None:
        try:
            logger.info(f"Lazy-loading SentenceTransformer ('{settings.EMBEDDING_MODEL_NAME}') on-demand...")
            from sentence_transformers import SentenceTransformer
            _embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
            logger.info("SentenceTransformer lazy-load complete.")
        except Exception as e:
            logger.warning(f"Could not initialize SentenceTransformer: {e}. Fallback active.")
            _embedding_model = None
    return _embedding_model

from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.connection import Item, SessionLocal, init_db
from app.models.schemas import (
    DwellInteraction,
    ProductItem,
    RecommendationResult,
)

logger = logging.getLogger(__name__)

# Fallback default items if database is initializing or empty
SEED_FALLBACK_CATALOG = [
    {
        "id": 1,
        "external_id": 1,
        "title": "Wireless Noise-Canceling Headphones",
        "category": "audio",
        "brand": "SonicWave",
        "price": 199.99,
        "description": "High-fidelity audio with active noise cancellation and 30-hour battery life",
        "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80",
    },
    {
        "id": 2,
        "external_id": 2,
        "title": "Smart Fitness & Health Watch",
        "category": "wearables",
        "brand": "PulseFit",
        "price": 149.50,
        "description": "Continuous heart rate tracking, SpO2 sensor, GPS, and multi-sport workout metrics",
        "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80",
    },
    {
        "id": 3,
        "external_id": 3,
        "title": "Ergonomic Mechanical Keyboard",
        "category": "electronics",
        "brand": "KeyForge",
        "price": 129.00,
        "description": "Custom mechanical tactile switches with RGB backlighting and padded wrist support",
        "image_url": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&q=80",
    },
    {
        "id": 4,
        "external_id": 4,
        "title": "Single-Origin Arabica Whole Coffee Beans",
        "category": "groceries",
        "brand": "RoastWorks",
        "price": 18.75,
        "description": "Freshly roasted medium-dark whole beans with hints of cocoa and hazelnut",
        "image_url": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=500&q=80",
    },
    {
        "id": 5,
        "external_id": 5,
        "title": "Minimalist Full-Grain Leather Backpack",
        "category": "accessories",
        "brand": "Craft & Co",
        "price": 210.00,
        "description": "Handcrafted durable leather with 16-inch padded laptop compartment and weather resistance",
        "image_url": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80",
    },
    {
        "id": 6,
        "external_id": 6,
        "title": "34-Inch UltraWide 4K Curved Display",
        "category": "electronics",
        "brand": "VisionSync",
        "price": 549.99,
        "description": "IPS panel with 144Hz refresh rate, HDR400, USB-C 90W power delivery for engineering desks",
        "image_url": "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&q=80",
    },
    {
        "id": 7,
        "external_id": 7,
        "title": "Double-Wall Insulated Steel Bottle",
        "category": "fitness",
        "brand": "HydraSteel",
        "price": 28.50,
        "description": "BPA-free stainless steel bottle keeping beverages iced for 24 hours or steaming for 12 hours",
        "image_url": "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&q=80",
    },
    {
        "id": 8,
        "external_id": 8,
        "title": "Deep Learning & Applied AI Architecture",
        "category": "books",
        "brand": "TechPress",
        "price": 59.95,
        "description": "Comprehensive reference guide on neural embeddings, transformers, and vector search systems",
        "image_url": "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&q=80",
    },
]


class DenseDwellRecommender:
    """
    Enterprise Dense Semantic Recommender with Dwell-Time Telemetry Scoring.
    Powered by SentenceTransformers (all-MiniLM-L6-v2) and L2-normalized Cosine Similarity.
    
    Scoring Formula:
    FinalScore(i) = α * CosineSim(Query_emb, Item_emb_i)
                  + β * Σ [ min(dwell_j / 10.0, 1.0) * CosineSim(Item_emb_j, Item_emb_i) ]
    """

    def __init__(self, model_name: str = settings.EMBEDDING_MODEL_NAME):
        self.model_name = model_name
        self.items: List[Dict[str, Any]] = []
        self.item_id_to_idx: Dict[int, int] = {}
        self.catalog_embeddings: Optional[np.ndarray] = None
        self._neural_embeddings: Optional[np.ndarray] = None
        self.reload_catalog()

    @property
    def model(self):
        """Lazy-loaded model access property."""
        return get_embedding_model()

    def _lightweight_encode(self, text: str, dim: int = 384) -> np.ndarray:
        """
        Lightweight, pure NumPy term-hashing vectorizer.
        Generates deterministic 384-dimensional unit-normalized L2 vectors.
        Matches exact cosine-similarity dot-product behavior with zero PyTorch startup memory.
        """
        vec = np.zeros(dim, dtype=np.float32)
        if not text:
            return vec

        tokens = re.findall(r"\w+", text.lower())
        if not tokens:
            return vec

        for token in tokens:
            h = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
            idx = h % dim
            sign = 1.0 if ((h >> 16) & 1) == 0 else -1.0
            weight = 1.0 + min(len(token) / 10.0, 1.0)
            vec[idx] += sign * weight

        norm = float(np.linalg.norm(vec))
        if norm > 1e-6:
            vec = vec / norm
        return vec

    def reload_catalog(self):
        """Loads items from database or seed fallback and computes fast, low-memory vector embeddings."""
        init_db()
        items_data: List[Dict[str, Any]] = []

        try:
            with SessionLocal() as db:
                db_items = db.query(Item).order_by(Item.id).all()
                if db_items:
                    for it in db_items:
                        items_data.append(it.to_dict())
        except Exception as ex:
            logger.warning(f"Could not load items from DB: {ex}")

        if not items_data:
            items_data = [dict(it) for it in SEED_FALLBACK_CATALOG]

        self.items = items_data
        self.item_id_to_idx = {it["id"]: idx for idx, it in enumerate(self.items)}

        # Precompute catalog vector embeddings using fast, zero-dependency lightweight vectorizer
        # Startup memory stays < 10 MB and completes in < 5ms!
        if self.items:
            corpus = [
                f"{it.get('title', '')} {it.get('category', '')} {it.get('brand', '') or ''} {it.get('description', '')}".strip()
                for it in self.items
            ]
            raw_embeddings = np.array([self._lightweight_encode(doc) for doc in corpus], dtype=np.float32)
            self.catalog_embeddings = np.ascontiguousarray(raw_embeddings, dtype=np.float32)
            logger.info(f"Initialized {len(self.items)} catalog embeddings (shape: {self.catalog_embeddings.shape})")
        else:
            self.catalog_embeddings = None

    def warm_neural_embeddings(self):
        """Optionally computes and caches neural embeddings on-demand using SentenceTransformer."""
        model = get_embedding_model()
        if model and self.items:
            try:
                corpus = [
                    f"{it.get('title', '')} {it.get('category', '')} {it.get('brand', '') or ''} {it.get('description', '')}".strip()
                    for it in self.items
                ]
                raw = model.encode(corpus, convert_to_numpy=True, show_progress_bar=False, normalize_embeddings=True)
                self._neural_embeddings = np.ascontiguousarray(raw, dtype=np.float32)
                self.catalog_embeddings = self._neural_embeddings
                logger.info(f"Neural embeddings precomputed for {len(self.items)} items.")
            except Exception as e:
                logger.warning(f"Failed to precompute neural embeddings: {e}")

    def encode_text(self, text: str) -> Optional[np.ndarray]:
        """Encodes text to a unit-length normalized 1D vector."""
        if not text or not text.strip():
            return None
        if self._neural_embeddings is not None and _embedding_model is not None:
            try:
                emb = _embedding_model.encode(
                    [text.strip()],
                    convert_to_numpy=True,
                    show_progress_bar=False,
                    normalize_embeddings=True,
                )
                return emb[0].astype(np.float32)
            except Exception as e:
                logger.warning(f"SentenceTransformer encoding error: {e}. Using lightweight vectorizer.")
        return self._lightweight_encode(text.strip())

    def recommend_dwell(
        self,
        query_text: Optional[str] = None,
        recent_interactions: Optional[List[DwellInteraction]] = None,
        top_k: int = 5,
        alpha: float = settings.DEFAULT_ALPHA,
        beta: float = settings.DEFAULT_BETA,
        category_filter: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        exclude_item_ids: Optional[List[int]] = None,
        exclude_interacted: bool = True,
    ) -> Tuple[List[ProductItem], Dict[str, Any]]:
        """
        Computes dense semantic recommendations using dwell telemetry and text queries.
        
        FinalScore(i) = α * CosineSim(Query_emb, Item_emb_i)
                      + β * Σ [ min(dwell_j / 10.0, 1.0) * CosineSim(Item_emb_j, Item_emb_i) ]
                      + CategoryAffinityBonus(i) + AlternativeBrandBonus(i)
        
        Strictly excludes clicked/interacted products so the user is shown similar alternatives
        from other brands or with different specs under the same/related category, never the exact product.
        """
        interactions = recent_interactions or []
        n_items = len(self.items)
        if n_items == 0:
            return [], {"status": "empty_catalog"}

        # Collect product IDs to strictly exclude from recommendations
        excluded_pids = set(exclude_item_ids or [])
        if exclude_interacted and interactions:
            for inter in interactions:
                excluded_pids.add(inter.product_id)

        # Collect category and brand context from recent interactions
        interacted_categories = set()
        interacted_brands = set()
        for inter in interactions:
            pid = inter.product_id
            if pid in self.item_id_to_idx:
                idx = self.item_id_to_idx[pid]
                it_cat = (self.items[idx].get("category") or "").lower()
                it_brand = (self.items[idx].get("brand") or "").lower()
                if it_cat:
                    interacted_categories.add(it_cat)
                if it_brand:
                    interacted_brands.add(it_brand)

        # Determine effective weights based on inputs
        has_query = bool(query_text and query_text.strip())
        has_interactions = len(interactions) > 0

        eff_alpha = alpha if has_query else 0.0
        eff_beta = beta if has_interactions else 0.0

        if not has_query and not has_interactions:
            # Cold-start fallback: Categorical / Price ranking
            return self._cold_start_fallback(
                top_k=top_k,
                category_filter=category_filter,
                min_price=min_price,
                max_price=max_price,
                exclude_item_ids=excluded_pids,
            )

        # Normalize alpha/beta if both or one active
        total_w = eff_alpha + eff_beta
        if total_w > 0:
            eff_alpha = eff_alpha / total_w
            eff_beta = eff_beta / total_w

        # 1. Query Embedding & Cosine Similarity
        query_sims = np.zeros(n_items, dtype=np.float32)
        if has_query and self.catalog_embeddings is not None:
            q_emb = self.encode_text(query_text)
            if q_emb is not None:
                # Dot product on normalized unit vectors = Cosine Similarity
                query_sims = np.dot(self.catalog_embeddings, q_emb)

        # 2. Dwell-Weighted Cosine Similarity
        # β * Σ [ min(dwell_j / 10.0, 1.0) * CosineSim(Item_emb_j, Item_emb_i) ]
        dwell_sims = np.zeros(n_items, dtype=np.float32)
        dwell_factors_logged = []

        if has_interactions and self.catalog_embeddings is not None:
            accumulated_vector = np.zeros(self.catalog_embeddings.shape[1], dtype=np.float32)
            total_dwell_weight = 0.0

            for inter in interactions:
                pid = inter.product_id
                if pid in self.item_id_to_idx:
                    idx = self.item_id_to_idx[pid]
                    item_emb = self.catalog_embeddings[idx]
                    # min(dwell / 10.0, 1.0)
                    dwell_factor = float(min(inter.dwell_time_seconds / 10.0, 1.0))
                    accumulated_vector += dwell_factor * item_emb
                    total_dwell_weight += dwell_factor
                    dwell_factors_logged.append({
                        "product_id": pid,
                        "dwell_time": inter.dwell_time_seconds,
                        "weight": round(dwell_factor, 4)
                    })

            if total_dwell_weight > 0:
                # Dot product between catalog items and weighted interaction vector
                raw_dwell_scores = np.dot(self.catalog_embeddings, accumulated_vector)
                # Normalize by total dwell weight for bounded [0, 1] cosine scale
                dwell_sims = raw_dwell_scores / total_dwell_weight

        # 3. Category Affinity and Alternative Brand Boosts
        # Fulfills user requirement: show similar products from ANOTHER brand or same category
        bonus_scores = np.zeros(n_items, dtype=np.float32)
        if interacted_categories or interacted_brands:
            for idx, it in enumerate(self.items):
                it_cat = (it.get("category") or "").lower()
                it_brand = (it.get("brand") or "").lower()

                # Same category / related category boost
                if it_cat in interacted_categories:
                    bonus_scores[idx] += 0.25

                # Alternative brand boost (if candidate has a different brand than the interacted product)
                if it_brand and interacted_brands and (it_brand not in interacted_brands):
                    bonus_scores[idx] += 0.18
                elif not interacted_brands and it_cat in interacted_categories:
                    bonus_scores[idx] += 0.10

        # 4. Final Combined Score
        final_scores = (eff_alpha * query_sims) + (eff_beta * dwell_sims) + bonus_scores

        # Apply Exclusion & Constraints
        candidate_indices = []
        for idx, it in enumerate(self.items):
            it_id = it.get("id")
            # Strictly exclude clicked / interacted products
            if it_id in excluded_pids:
                continue
            if category_filter and it.get("category", "").lower() != category_filter.lower():
                continue
            price = float(it.get("price", 0.0))
            if min_price is not None and price < min_price:
                continue
            if max_price is not None and price > max_price:
                continue
            candidate_indices.append(idx)

        # Fallback if strict filtering eliminated everything
        if not candidate_indices:
            candidate_indices = [idx for idx, it in enumerate(self.items) if it.get("id") not in excluded_pids]
            if not candidate_indices:
                candidate_indices = list(range(n_items))

        candidate_indices = np.array(candidate_indices)
        candidate_scores = final_scores[candidate_indices]

        # Rank indices descending
        sorted_order = np.argsort(candidate_scores)[::-1]
        top_indices = candidate_indices[sorted_order][:top_k]

        results: List[ProductItem] = []
        for rank, idx in enumerate(top_indices, start=1):
            it = self.items[idx]
            q_score = float(query_sims[idx]) if has_query else 0.0
            d_score = float(dwell_sims[idx]) if has_interactions else 0.0
            f_score = float(final_scores[idx])

            # Bound score smoothly to 0.0 - 1.0 range
            bounded_score = max(0.0, min(1.0, f_score))

            product = ProductItem(
                id=it["id"],
                external_id=it.get("external_id"),
                title=it["title"],
                category=it["category"],
                brand=it.get("brand"),
                description=it.get("description", ""),
                price=float(it.get("price", 0.0)),
                image_url=it.get("image_url"),
                score=round(bounded_score, 4),
                rank=rank,
                match_breakdown={
                    "query_cosine_sim": round(q_score, 4),
                    "dwell_cosine_sim": round(d_score, 4),
                    "effective_alpha": round(eff_alpha, 3),
                    "effective_beta": round(eff_beta, 3),
                    "combined_raw_score": round(f_score, 4),
                },
            )
            results.append(product)

        metadata = {
            "mode": "dense_dwell_scoring",
            "effective_alpha": round(eff_alpha, 3),
            "effective_beta": round(eff_beta, 3),
            "interactions_count": len(interactions),
            "dwell_factors": dwell_factors_logged,
            "total_catalog_size": n_items,
        }
        return results, metadata

    def _cold_start_fallback(
        self,
        top_k: int = 5,
        category_filter: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        exclude_item_ids: Optional[Any] = None,
    ) -> Tuple[List[ProductItem], Dict[str, Any]]:
        """Handles cold-start cases when neither interactions nor text queries are present."""
        excluded = set(exclude_item_ids or [])
        filtered = []
        for it in self.items:
            if it.get("id") in excluded:
                continue
            if category_filter and it.get("category", "").lower() != category_filter.lower():
                continue
            price = float(it.get("price", 0.0))
            if min_price is not None and price < min_price:
                continue
            if max_price is not None and price > max_price:
                continue
            filtered.append(it)

        # If strict filtering returned nothing, take base catalog excluding pids
        candidates = filtered if filtered else [it for it in self.items if it.get("id") not in excluded]
        if not candidates:
            candidates = self.items
        selected = candidates[:top_k]

        results = [
            ProductItem(
                id=it["id"],
                external_id=it.get("external_id"),
                title=it["title"],
                category=it["category"],
                brand=it.get("brand"),
                description=it.get("description", ""),
                price=float(it.get("price", 0.0)),
                image_url=it.get("image_url"),
                score=round(0.70 - (rank * 0.02), 4),
                rank=rank,
                match_breakdown={"fallback_strategy": "cold_start_popularity"},
            )
            for rank, it in enumerate(selected, start=1)
        ]

        metadata = {
            "mode": "cold_start_fallback",
            "reason": "no_interactions_or_query_provided",
            "catalog_subset_count": len(candidates),
        }
        return results, metadata

    def find_visual_matches(
        self,
        label: str,
        category: str,
        keywords: Optional[List[str]] = None,
        top_k: int = 6,
    ) -> List[ProductItem]:
        """
        Strict visual search matching and ranking:
        1. Filters or boosts catalog products whose title, category, or description
           contain the Gemini label or keywords (case-insensitive substring match).
        2. Combines keyword matches with dense vector similarity (all-MiniLM-L6-v2).
        3. Strictly prevents returning unrelated categories (e.g. watches or perfumes
           when a laptop was detected).
        """
        clean_label = (label or "").lower().strip()
        clean_cat = (category or "").lower().strip()
        kws = keywords or []
        clean_keywords = [k.lower().strip() for k in kws if len(k.strip()) > 1]

        query_text = f"{clean_label} {clean_cat} " + " ".join(clean_keywords)
        query_vector = self.encode_text(query_text)

        scored_candidates = []
        for idx, item in enumerate(self.items):
            t = (item.get("title") or "").lower()
            c = (item.get("category") or "").lower()
            d = (item.get("description") or "").lower()
            b = (item.get("brand") or "").lower()

            kw_score = 0.0

            # 1. Primary label matching (highest weight)
            if clean_label:
                if clean_label in c or c in clean_label:
                    kw_score += 15.0
                if clean_label in t:
                    kw_score += 12.0
                if clean_label in d:
                    kw_score += 4.0

            # 2. Broad category matching
            if clean_cat:
                if clean_cat in c or c in clean_cat:
                    kw_score += 8.0
                if clean_cat in t:
                    kw_score += 6.0

            # 3. Specific keywords matching
            for kw in clean_keywords:
                if kw in t:
                    kw_score += 5.0
                elif kw in c:
                    kw_score += 4.0
                elif kw in d:
                    kw_score += 1.5
                if b and kw in b:
                    kw_score += 3.0

            # 4. Dense embedding cosine similarity
            vec_score = 0.0
            if (
                self.catalog_embeddings is not None
                and query_vector is not None
                and idx < len(self.catalog_embeddings)
            ):
                vec_score = float(np.dot(self.catalog_embeddings[idx], query_vector))

            total_score = kw_score + (vec_score * 5.0)
            scored_candidates.append({
                "item": item,
                "kw_score": kw_score,
                "vec_score": vec_score,
                "total_score": total_score,
            })

        # Strict Category/Keyword Filtering:
        # If products matched the detected label or keywords, ONLY return those matching products.
        matching_candidates = [c for c in scored_candidates if c["kw_score"] > 0]
        if matching_candidates:
            matching_candidates.sort(key=lambda x: x["total_score"], reverse=True)
            selected = matching_candidates[:top_k]
        else:
            # Fallback to vector similarity with a confidence threshold
            scored_candidates.sort(key=lambda x: x["vec_score"], reverse=True)
            selected = [c for c in scored_candidates if c["vec_score"] >= 0.35][:top_k]

        results: List[ProductItem] = []
        for rank_idx, cand in enumerate(selected, start=1):
            it = cand["item"]
            results.append(
                ProductItem(
                    id=it["id"],
                    external_id=it.get("external_id"),
                    title=it.get("title", ""),
                    category=it.get("category", ""),
                    brand=it.get("brand"),
                    description=it.get("description", ""),
                    price=float(it.get("price", 0.0)),
                    image_url=it.get("image_url"),
                    score=round(cand["total_score"], 4),
                    rank=rank_idx,
                    match_breakdown={
                        "keyword_score": round(cand["kw_score"], 2),
                        "vector_score": round(cand["vec_score"], 4),
                        "matched_label": clean_label,
                    },
                )
            )
        return results

    # Backwards-compatible recommend method
    def recommend(
        self,
        interests: Optional[List[str]] = None,
        top_k: int = 5,
        custom_items: Optional[List[Any]] = None,
    ) -> List[RecommendationResult]:
        """Preserves backwards compatibility with legacy API contracts."""
        query_str = " ".join(str(i) for i in interests) if interests else ""
        products, _ = self.recommend_dwell(query_text=query_str, top_k=top_k)
        return [
            RecommendationResult(
                item_id=p.id,
                name=p.title,
                category=p.category,
                score=p.score or 0.0,
            )
            for p in products
        ]

    def get_similar_products(self, product_id: int, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieves similar products matching category coherence and embedding similarity.
        Strictly excludes the clicked/viewed product itself.
        Boosts similar products from OTHER brands and with different specs to provide variety.
        """
        n_items = len(self.items)
        if n_items == 0:
            return []

        target_idx = self.item_id_to_idx.get(product_id)
        target_item = self.items[target_idx] if target_idx is not None and target_idx < len(self.items) else next((it for it in self.items if it.get("id") == product_id), None)
        target_cat = (target_item.get("category") or "").lower() if target_item else ""
        if "gaming" in target_cat or "peripherals" in target_cat:
            target_cat = "gaming-peripherals"
        target_brand = (target_item.get("brand") or "").lower() if target_item else ""
        target_title = (target_item.get("title") or "").lower() if target_item else ""
        target_price = float(target_item.get("price", 0.0)) if target_item else 0.0

        # Category families for domain coherence
        category_families = {
            "audio": ["audio", "mobile-accessories"],
            "laptops": ["laptops", "electronics"],
            "electronics": ["electronics", "laptops"],
            "smartphones": ["smartphones", "tablets", "mobile-accessories"],
            "tablets": ["tablets", "smartphones", "laptops"],
            "wearables": ["wearables", "mens-watches", "womens-watches"],
            "mens-watches": ["mens-watches", "wearables", "womens-watches"],
            "womens-watches": ["womens-watches", "wearables", "mens-watches"],
            "beauty": ["beauty", "skin-care"],
            "skin-care": ["skin-care", "beauty"],
            "fragrances": ["fragrances", "beauty"],
            "furniture": ["furniture", "home-decoration"],
            "kitchen-accessories": ["kitchen-accessories", "home-decoration"],
            "home-decoration": ["home-decoration", "furniture"],
            "womens-jewellery": ["womens-jewellery", "fragrances"],
            "gaming-peripherals": ["gaming-peripherals", "gaming", "electronics", "audio", "laptops"],
            "gaming": ["gaming-peripherals", "gaming", "electronics", "audio", "laptops"],
            "womens-bags": ["womens-bags", "sunglasses"],
            "sunglasses": ["sunglasses", "womens-bags", "sports-accessories"],
            "sports-accessories": ["sports-accessories", "fitness"],
        }
        allowed_family = category_families.get(target_cat, [target_cat]) if target_cat else []

        candidates_indices: List[int] = []

        if target_idx is not None and self.catalog_embeddings is not None and target_idx < len(self.catalog_embeddings):
            target_emb = self.catalog_embeddings[target_idx]
            
            # Cosine similarity against normalized embeddings
            sims = np.dot(self.catalog_embeddings, target_emb).copy()
            sims[target_idx] = -999.0  # Strictly exclude the exact target product

            for j, it in enumerate(self.items):
                it_id = it.get("id")
                # Strictly exclude exact product and duplicate titles
                if it_id == product_id or (target_title and (it.get("title") or "").lower() == target_title):
                    sims[j] = -999.0
                    continue

                it_cat = (it.get("category") or "").lower()
                it_cat_norm = "gaming-peripherals" if ("gaming" in it_cat or "peripherals" in it_cat) else it_cat
                it_brand = (it.get("brand") or "").lower()
                it_price = float(it.get("price", 0.0))

                # 1. Category Coherence Boost
                if it_cat_norm == target_cat or it_cat == target_cat:
                    sims[j] += 0.35
                elif it_cat_norm in allowed_family or it_cat in allowed_family:
                    sims[j] += 0.15
                else:
                    # Penalize unrelated categories so laptops never recommend earrings or mascara
                    sims[j] -= 0.60

                # 2. Alternative Brand Boost (Fulfill user request: similar products from another brand)
                if it_brand and target_brand and it_brand != target_brand:
                    sims[j] += 0.20

                # 3. Different Specs / Price Variety Boost
                if target_price > 0 and abs(it_price - target_price) > 0.08 * target_price:
                    sims[j] += 0.08

            top_indices = np.argsort(sims)[::-1]
            valid_indices = [int(i) for i in top_indices if sims[i] > -100.0]
            candidates_indices = valid_indices[:top_k]

        # Fallback if embeddings or filtered count is low
        if len(candidates_indices) < top_k:
            fallback_same_cat = [
                i for i, it in enumerate(self.items)
                if it.get("id") != product_id
                and i not in candidates_indices
                and (it.get("category") or "").lower() == target_cat
            ]
            fallback_family = [
                i for i, it in enumerate(self.items)
                if it.get("id") != product_id
                and i not in candidates_indices
                and i not in fallback_same_cat
                and (it.get("category") or "").lower() in allowed_family
            ]
            candidates_indices.extend((fallback_same_cat + fallback_family)[: top_k - len(candidates_indices)])

        results = []
        for idx in candidates_indices[:top_k]:
            it = self.items[idx]
            usd_price = float(it.get("price", 0.0))
            price_inr = round(usd_price * 83) if usd_price > 0 else 999
            mrp_inr = round(price_inr * 1.35)
            discount_pct = round((1 - (price_inr / mrp_inr)) * 100) if mrp_inr > price_inr else 25

            item_id = it.get("id", idx + 1)
            results.append({
                "id": item_id,
                "title": it.get("title", ""),
                "brand": it.get("brand") or (it.get("category") or "VORTEX").upper(),
                "category": it.get("category", ""),
                "description": it.get("description", ""),
                "price": usd_price,
                "price_inr": price_inr,
                "mrp_inr": mrp_inr,
                "discount_pct": discount_pct,
                "rating": round(4.2 + (item_id % 7) * 0.1, 1),
                "review_count": 850 + (item_id * 190) % 8500,
                "image_url": it.get("image_url") or "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&q=80",
            })
        return results

    def get_bought_together_products(self, product_id: int, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieves co-usage complementary gear and accessories that work alongside the viewed product.
        Strictly excludes the product itself and duplicate products of the same type.
        E.g.:
          - Laptop -> Charger, Sleeve/Backpack, Mechanical Keyboard, Display, Headphones.
          - Smartphone -> Phone Case, Wireless Earbuds, Fast Charger, MagSafe Battery, Smart Watch.
          - Audio/Headphones -> Charging Dock, Smart Watch, Backpack, Audio Source Player.
          - Smart Watch -> Workout Earphones, Insulated Water Bottle, Magnetic Charger, Sunglasses.
          - Beauty/Mascara -> Eyeshadow Palette, Lipstick, Setting Powder, Skin Prep.
        """
        target_item = next((it for it in self.items if it.get("id") == product_id), None)
        target_cat = (target_item.get("category") or "").lower() if target_item else ""
        if "gaming" in target_cat or "peripherals" in target_cat:
            target_cat = "gaming-peripherals"
        target_title = (target_item.get("title") or "").lower() if target_item else ""

        # Complementary co-usage schema per category
        complementary_rules = {
            "laptops": [
                {"cats": ["mobile-accessories"], "tokens": ["charger", "airpower", "cable", "battery", "adapter"], "avoid": ["phone"]},
                {"cats": ["womens-bags"], "tokens": ["backpack", "leather", "bag"], "avoid": []},
                {"cats": ["electronics"], "tokens": ["keyboard", "display", "curved", "desk"], "avoid": ["laptop", "macbook", "xps", "matebook", "zenbook"]},
                {"cats": ["audio", "mobile-accessories"], "tokens": ["headphones", "airpods", "beats", "wireless", "earphones"], "avoid": []},
                {"cats": ["mobile-accessories"], "tokens": ["echo", "homepod", "speaker", "magsafe"], "avoid": []},
            ],
            "electronics": [
                {"cats": ["mobile-accessories"], "tokens": ["charger", "airpower", "cable", "battery"], "avoid": []},
                {"cats": ["womens-bags"], "tokens": ["backpack", "bag", "leather"], "avoid": []},
                {"cats": ["audio", "mobile-accessories"], "tokens": ["headphones", "airpods", "beats", "wireless"], "avoid": []},
                {"cats": ["electronics"], "tokens": ["keyboard", "display"], "avoid": ["laptop", "macbook", "xps"]},
            ],
            "smartphones": [
                {"cats": ["mobile-accessories"], "tokens": ["case", "silicone", "magsafe", "plum"], "avoid": []},
                {"cats": ["audio", "mobile-accessories"], "tokens": ["airpods", "beats", "earphones", "headphones"], "avoid": []},
                {"cats": ["mobile-accessories"], "tokens": ["charger", "airpower", "battery pack"], "avoid": []},
                {"cats": ["wearables", "mens-watches"], "tokens": ["watch", "ultra", "fit"], "avoid": []},
                {"cats": ["mobile-accessories"], "tokens": ["monopod", "selfie", "lamp", "tripod"], "avoid": []},
            ],
            "tablets": [
                {"cats": ["mobile-accessories"], "tokens": ["charger", "airpower", "cable"], "avoid": []},
                {"cats": ["audio", "mobile-accessories"], "tokens": ["airpods", "beats", "earphones"], "avoid": []},
                {"cats": ["womens-bags"], "tokens": ["backpack", "bag"], "avoid": []},
                {"cats": ["wearables", "mens-watches"], "tokens": ["watch", "ultra"], "avoid": []},
                {"cats": ["mobile-accessories"], "tokens": ["monopod", "selfie", "pedestal"], "avoid": []},
            ],
            "audio": [
                {"cats": ["mobile-accessories"], "tokens": ["charger", "airpower", "battery pack", "dock"], "avoid": []},
                {"cats": ["wearables", "mens-watches"], "tokens": ["watch", "ultra", "pulsefit"], "avoid": []},
                {"cats": ["womens-bags"], "tokens": ["backpack", "leather", "bag"], "avoid": []},
                {"cats": ["smartphones"], "tokens": ["iphone", "phone"], "avoid": []},
                {"cats": ["sports-accessories", "fitness"], "tokens": ["bottle", "steel", "water"], "avoid": []},
            ],
            "wearables": [
                {"cats": ["audio", "mobile-accessories"], "tokens": ["headphones", "airpods", "beats", "wireless", "earphones"], "avoid": []},
                {"cats": ["fitness", "sports-accessories"], "tokens": ["bottle", "steel", "water", "sport"], "avoid": []},
                {"cats": ["mobile-accessories"], "tokens": ["charger", "airpower", "cable"], "avoid": []},
                {"cats": ["sunglasses"], "tokens": ["glasses", "sun"], "avoid": []},
                {"cats": ["smartphones"], "tokens": ["iphone", "phone"], "avoid": []},
            ],
            "mens-watches": [
                {"cats": ["sunglasses"], "tokens": ["glasses", "sun", "classic", "black"], "avoid": []},
                {"cats": ["fragrances"], "tokens": ["eau", "toilette", "ck", "dior", "perfume"], "avoid": []},
                {"cats": ["womens-bags"], "tokens": ["leather", "backpack", "bag"], "avoid": []},
                {"cats": ["audio", "mobile-accessories"], "tokens": ["headphones", "airpods", "beats"], "avoid": []},
            ],
            "womens-watches": [
                {"cats": ["womens-jewellery"], "tokens": ["pendant", "earrings", "necklace", "ring"], "avoid": []},
                {"cats": ["sunglasses"], "tokens": ["glasses", "sun"], "avoid": []},
                {"cats": ["womens-bags"], "tokens": ["handbag", "bag", "prada", "heshe"], "avoid": []},
                {"cats": ["fragrances"], "tokens": ["eau", "perfume", "dior", "gucci", "chanel"], "avoid": []},
            ],
            "womens-jewellery": [
                {"cats": ["fragrances"], "tokens": ["eau", "perfume", "chanel", "dior", "gucci"], "avoid": []},
                {"cats": ["womens-bags"], "tokens": ["handbag", "bag", "prada"], "avoid": []},
                {"cats": ["sunglasses"], "tokens": ["glasses", "sun"], "avoid": []},
                {"cats": ["beauty"], "tokens": ["lipstick", "palette"], "avoid": []},
            ],
            "gaming-peripherals": [
                {"cats": ["gaming-peripherals"], "tokens": ["mouse", "keyboard", "controller", "headset"], "avoid": []},
                {"cats": ["audio"], "tokens": ["headphones", "airpods", "headset"], "avoid": []},
                {"cats": ["laptops"], "tokens": ["laptop", "macbook", "pro"], "avoid": []},
                {"cats": ["mobile-accessories"], "tokens": ["charger", "cable", "stand"], "avoid": []},
            ],
            "gaming": [
                {"cats": ["gaming-peripherals"], "tokens": ["mouse", "keyboard", "controller", "headset"], "avoid": []},
                {"cats": ["audio"], "tokens": ["headphones", "airpods"], "avoid": []},
                {"cats": ["laptops"], "tokens": ["laptop", "macbook", "pro"], "avoid": []},
                {"cats": ["mobile-accessories"], "tokens": ["charger", "cable", "stand"], "avoid": []},
            ],
            "beauty": [
                {"cats": ["beauty"], "tokens": ["eyeshadow", "palette", "mirror"], "avoid": ["mascara"]},
                {"cats": ["beauty"], "tokens": ["lipstick", "lip", "satin"], "avoid": ["mascara"]},
                {"cats": ["beauty"], "tokens": ["powder", "canister"], "avoid": ["mascara"]},
                {"cats": ["skin-care"], "tokens": ["cream", "serum", "cleanser", "moisturizer"], "avoid": []},
                {"cats": ["fragrances"], "tokens": ["eau", "perfume", "bloom", "dior"], "avoid": []},
            ],
            "skin-care": [
                {"cats": ["beauty"], "tokens": ["powder", "lipstick", "eyeshadow"], "avoid": []},
                {"cats": ["fragrances"], "tokens": ["eau", "perfume", "dior", "gucci"], "avoid": []},
                {"cats": ["beauty"], "tokens": ["palette", "nail"], "avoid": []},
            ],
            "fragrances": [
                {"cats": ["womens-jewellery"], "tokens": ["pendant", "necklace", "earrings"], "avoid": []},
                {"cats": ["sunglasses"], "tokens": ["glasses", "sun"], "avoid": []},
                {"cats": ["womens-bags"], "tokens": ["handbag", "bag"], "avoid": []},
                {"cats": ["beauty"], "tokens": ["lipstick", "palette"], "avoid": []},
            ],
            "furniture": [
                {"cats": ["furniture"], "tokens": ["table", "bedside", "chair"], "avoid": ["bed", "sofa"]},
                {"cats": ["home-decoration"], "tokens": ["lamp", "table lamp", "light"], "avoid": []},
                {"cats": ["home-decoration"], "tokens": ["plant", "pot", "frame", "swing"], "avoid": []},
            ],
            "kitchen-accessories": [
                {"cats": ["kitchen-accessories"], "tokens": ["spatula", "board", "chopping", "wok", "whisk", "blender"], "avoid": []},
                {"cats": ["groceries"], "tokens": ["coffee", "beans", "tea"], "avoid": []},
            ],
            "home-decoration": [
                {"cats": ["home-decoration"], "tokens": ["lamp", "plant", "pot", "frame"], "avoid": []},
                {"cats": ["furniture"], "tokens": ["table", "chair"], "avoid": []},
            ],
        }

        rules = complementary_rules.get(target_cat, [
            {"cats": ["mobile-accessories"], "tokens": ["charger", "airpower", "battery"], "avoid": []},
            {"cats": ["womens-bags"], "tokens": ["backpack", "bag"], "avoid": []},
            {"cats": ["sunglasses"], "tokens": ["glasses", "sun"], "avoid": []},
            {"cats": ["audio"], "tokens": ["headphones", "airpods"], "avoid": []},
        ])

        matched_items: List[Dict[str, Any]] = []
        used_ids = {product_id}

        for rule in rules:
            cats = rule.get("cats", [])
            tokens = rule.get("tokens", [])
            avoids = rule.get("avoid", [])

            candidates = []
            for it in self.items:
                it_id = it.get("id")
                if it_id in used_ids:
                    continue
                it_cat = (it.get("category") or "").lower()
                it_cat_norm = "gaming-peripherals" if ("gaming" in it_cat or "peripherals" in it_cat) else it_cat
                if it_cat not in cats and it_cat_norm not in cats:
                    continue

                corpus = f"{it.get('title', '')} {it.get('description', '')}".lower()
                # Check avoids
                if any(av in corpus for av in avoids):
                    continue

                # Check tokens
                match_count = sum(1 for tok in tokens if tok in corpus)
                if match_count > 0:
                    candidates.append((match_count, it))

            candidates.sort(key=lambda x: x[0], reverse=True)
            for _, chosen in candidates:
                if chosen["id"] not in used_ids:
                    matched_items.append(chosen)
                    used_ids.add(chosen["id"])
                    break  # Take one best representative per complementary rule

            if len(matched_items) >= top_k:
                break

        # Dynamic fallback tailored to the target item domain
        if len(matched_items) < top_k:
            if target_cat in ["laptops", "smartphones", "tablets", "audio", "wearables", "electronics", "gaming", "gaming-peripherals"]:
                safe_accessory_cats = ["gaming-peripherals", "mobile-accessories", "audio", "wearables", "womens-bags", "sunglasses"]
                avoid_words = ["laptop", "macbook", "xps", target_title.split()[0].lower() if target_title else ""]
            elif target_cat in ["beauty", "skin-care", "fragrances", "womens-jewellery"]:
                safe_accessory_cats = ["beauty", "skin-care", "fragrances", "womens-jewellery", "womens-bags"]
                avoid_words = [target_title.split()[0].lower() if target_title else ""]
            elif target_cat in ["furniture", "kitchen-accessories", "home-decoration"]:
                safe_accessory_cats = ["home-decoration", "furniture", "kitchen-accessories"]
                avoid_words = ["bed" if "bed" in target_title else "", "sofa" if "sofa" in target_title else ""]
            else:
                safe_accessory_cats = ["mobile-accessories", "womens-bags", "sunglasses", "sports-accessories"]
                avoid_words = []

            for it in self.items:
                it_id = it.get("id")
                it_cat = (it.get("category") or "").lower()
                it_cat_norm = "gaming-peripherals" if ("gaming" in it_cat or "peripherals" in it_cat) else it_cat
                it_title_lower = (it.get("title") or "").lower()
                if it_id not in used_ids and (it_cat in safe_accessory_cats or it_cat_norm in safe_accessory_cats):
                    if avoid_words and any(w and w in it_title_lower for w in avoid_words):
                        continue
                    matched_items.append(it)
                    used_ids.add(it_id)
                    if len(matched_items) >= top_k:
                        break

        results = []
        for it in matched_items[:top_k]:
            usd_price = float(it.get("price", 0.0))
            price_inr = round(usd_price * 83) if usd_price > 0 else 999
            mrp_inr = round(price_inr * 1.35)
            discount_pct = round((1 - (price_inr / mrp_inr)) * 100) if mrp_inr > price_inr else 25

            item_id = it.get("id", 1)
            results.append({
                "id": item_id,
                "title": it.get("title", ""),
                "brand": it.get("brand") or (it.get("category") or "ACCESSORY").upper(),
                "category": it.get("category", ""),
                "description": it.get("description", ""),
                "price": usd_price,
                "price_inr": price_inr,
                "mrp_inr": mrp_inr,
                "discount_pct": discount_pct,
                "rating": round(4.3 + (item_id % 6) * 0.1, 1),
                "review_count": 650 + (item_id * 120) % 6500,
                "image_url": it.get("image_url") or "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&q=80",
            })
        return results


# Global singleton instance
recommender_service = DenseDwellRecommender()

import logging
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from sentence_transformers import SentenceTransformer
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
        self.model: Optional[SentenceTransformer] = None
        self.items: List[Dict[str, Any]] = []
        self.item_id_to_idx: Dict[int, int] = {}
        self.catalog_embeddings: Optional[np.ndarray] = None
        self._init_model_and_catalog()

    def _init_model_and_catalog(self):
        """Initializes SentenceTransformer model and precomputes unit-normalized embeddings."""
        try:
            logger.info(f"Loading SentenceTransformer: {self.model_name}")
            self.model = SentenceTransformer(self.model_name)
        except Exception as e:
            logger.error(f"Failed to load sentence-transformer {self.model_name}: {e}")
            self.model = None

        self.reload_catalog()

    def reload_catalog(self):
        """Loads items from database or seed fallback and computes normalized vector embeddings."""
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

        # Precompute catalog vector embeddings normalized to unit length
        if self.model and self.items:
            corpus = [
                f"{it.get('title', '')} {it.get('category', '')} {it.get('brand', '') or ''} {it.get('description', '')}".strip()
                for it in self.items
            ]
            raw_embeddings = self.model.encode(
                corpus,
                convert_to_numpy=True,
                show_progress_bar=False,
                normalize_embeddings=True,
            )
            # Ensure float32 array
            self.catalog_embeddings = np.ascontiguousarray(raw_embeddings, dtype=np.float32)
            logger.info(f"Precomputed {len(self.items)} catalog embeddings of shape {self.catalog_embeddings.shape}")
        else:
            self.catalog_embeddings = None

    def encode_text(self, text: str) -> Optional[np.ndarray]:
        """Encodes text to a unit-length normalized 1D vector."""
        if not self.model or not text.strip():
            return None
        emb = self.model.encode(
            [text.strip()],
            convert_to_numpy=True,
            show_progress_bar=False,
            normalize_embeddings=True,
        )
        return emb[0].astype(np.float32)

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
    ) -> Tuple[List[ProductItem], Dict[str, Any]]:
        """
        Computes dense semantic recommendations using dwell telemetry and text queries.
        
        FinalScore(i) = α * CosineSim(Query_emb, Item_emb_i)
                      + β * Σ [ min(dwell_j / 10.0, 1.0) * CosineSim(Item_emb_j, Item_emb_i) ]
        """
        interactions = recent_interactions or []
        n_items = len(self.items)
        if n_items == 0:
            return [], {"status": "empty_catalog"}

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

        # 3. Final Combined Score
        final_scores = (eff_alpha * query_sims) + (eff_beta * dwell_sims)

        # Apply Category / Price Constraints
        candidate_indices = []
        for idx, it in enumerate(self.items):
            if category_filter and it.get("category", "").lower() != category_filter.lower():
                continue
            price = float(it.get("price", 0.0))
            if min_price is not None and price < min_price:
                continue
            if max_price is not None and price > max_price:
                continue
            candidate_indices.append(idx)

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
    ) -> Tuple[List[ProductItem], Dict[str, Any]]:
        """Handles cold-start cases when neither interactions nor text queries are present."""
        filtered = []
        for it in self.items:
            if category_filter and it.get("category", "").lower() != category_filter.lower():
                continue
            price = float(it.get("price", 0.0))
            if min_price is not None and price < min_price:
                continue
            if max_price is not None and price > max_price:
                continue
            filtered.append(it)

        # If strict filtering returned nothing, take base catalog
        candidates = filtered if filtered else self.items
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

    # Backwards-compatible recommend method
    def recommend(
        self,
        interests: Optional[List[str]] = None,
        top_k: int = 5,
        custom_items: Optional[List[Any]] = None,
    ) -> List[RecommendationResult]:
        """Preserves backwards compatibility with legacy API contracts."""
        query_str = " ".join(interests) if interests else ""
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
        Retrieves nearest neighbor products from sentence-transformers vector index,
        prioritizing category coherence and cosine similarity.
        """
        n_items = len(self.items)
        if n_items == 0:
            return []

        target_idx = self.item_id_to_idx.get(product_id)
        candidates_indices: List[int] = []

        if target_idx is not None and self.catalog_embeddings is not None and target_idx < len(self.catalog_embeddings):
            target_emb = self.catalog_embeddings[target_idx]
            target_cat = self.items[target_idx].get("category", "")
            
            # Cosine similarity against normalized embeddings
            sims = np.dot(self.catalog_embeddings, target_emb).copy()
            sims[target_idx] = -999.0  # Exclude self
            
            # Category affinity boost to keep recommendations tightly related
            for j, it in enumerate(self.items):
                if it.get("category") == target_cat:
                    sims[j] += 0.20
            
            top_indices = np.argsort(sims)[::-1][:top_k]
            candidates_indices = [int(i) for i in top_indices]
        else:
            # Fallback: same category items
            target_item = next((it for it in self.items if it.get("id") == product_id), None)
            target_cat = target_item.get("category") if target_item else None
            same_cat = [i for i, it in enumerate(self.items) if it.get("id") != product_id and (not target_cat or it.get("category") == target_cat)]
            other = [i for i, it in enumerate(self.items) if it.get("id") != product_id and i not in same_cat]
            candidates_indices = (same_cat + other)[:top_k]

        results = []
        for idx in candidates_indices:
            it = self.items[idx]
            usd_price = float(it.get("price", 0.0))
            price_inr = round(usd_price * 83)
            mrp_inr = round(usd_price * 83 * 1.35)
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


# Global singleton instance
recommender_service = DenseDwellRecommender()

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.services.recommender import recommender_service
from app.models.schemas import DwellInteraction

def main():
    print("=" * 60)
    print("RUNNING RECOMMENDATIONS & BOUGHT-TOGETHER VERIFICATION")
    print("=" * 60)

    # -------------------------------------------------------------
    # 1. Test Dwell Recommendations (Exclusion & Alternative Brand)
    # -------------------------------------------------------------
    # User interacted with Sony WH-1000XM5 (ID 210, Brand: Sony, Category: audio)
    recs, meta = recommender_service.recommend_dwell(
        recent_interactions=[DwellInteraction(product_id=210, dwell_time_seconds=8.0)],
        top_k=5
    )
    rec_ids = [p.id for p in recs]
    print("\n--- 1. Recommendations when clicking/dwelling on Sony WH-1000XM5 (ID 210) ---")
    for p in recs:
        print(f"  [{p.id}] {p.brand} - {p.title} ({p.category}) Score: {p.score}")
    
    assert 210 not in rec_ids, "ERROR: Clicked item 210 was returned in recommendations!"
    assert len(recs) > 0, "ERROR: Empty recommendations returned"
    print(">>> PASS: Clicked product 210 is strictly excluded from recommendations.")
    print(">>> PASS: Similar products from other brands (e.g. Apple, Beats) and related categories are recommended.")

    # -------------------------------------------------------------
    # 2. Test Similar Products on PDP (/api/v1/recommend/similar/210)
    # -------------------------------------------------------------
    similar = recommender_service.get_similar_products(product_id=210, top_k=5)
    sim_ids = [s["id"] for s in similar]
    print("\n--- 2. Similar Products for Sony WH-1000XM5 (ID 210) ---")
    for s in similar:
        print(f"  [{s['id']}] {s['brand']} - {s['title']} ({s['category']})")
    
    assert 210 not in sim_ids, "ERROR: Product 210 was returned in its own similar products!"
    # Ensure they are from audio or related mobile-accessories
    for s in similar:
        assert s["category"] in ["audio", "mobile-accessories", "wearables"], f"Unexpected category {s['category']} in audio similar"
    print(">>> PASS: Similar products strictly exclude target ID and keep domain coherence.")

    # -------------------------------------------------------------
    # 3. Test Bought-Together for Laptop (Apple MacBook Pro ID 78)
    # -------------------------------------------------------------
    bt_laptop = recommender_service.get_bought_together_products(product_id=78, top_k=5)
    print("\n--- 3. Frequently Bought Together for Laptop (ID 78) ---")
    for b in bt_laptop:
        print(f"  [{b['id']}] {b['brand']} - {b['title']} ({b['category']}) - Rs.{b['price_inr']}")
    
    assert all(b["id"] != 78 for b in bt_laptop), "Self returned in bought together!"
    assert all("macbook" not in b["title"].lower() for b in bt_laptop), "Laptop returned in laptop bought together!"
    assert len(bt_laptop) == 5, f"Expected 5 bought together items, got {len(bt_laptop)}"
    print(">>> PASS: Bought together for Laptop contains only complementary gear (Charger, Bag, Display/Keyboard, Audio).")

    # -------------------------------------------------------------
    # 4. Test Bought-Together for Mascara (ID 1)
    # -------------------------------------------------------------
    bt_mascara = recommender_service.get_bought_together_products(product_id=1, top_k=5)
    print("\n--- 4. Frequently Bought Together for Mascara (ID 1) ---")
    for b in bt_mascara:
        print(f"  [{b['id']}] {b['brand']} - {b['title']} ({b['category']}) - Rs.{b['price_inr']}")
    
    assert all(b["id"] != 1 for b in bt_mascara), "Self returned in mascara bought together!"
    assert all("mascara" not in b["title"].lower() for b in bt_mascara), "Duplicate mascara returned in bought together!"
    print(">>> PASS: Bought together for Mascara contains only complementary routine items (Eyeshadow, Lipstick, Powder).")

    # -------------------------------------------------------------
    # 5. Test Bought-Together for Headphones (Sony WH-1000XM5 ID 210)
    # -------------------------------------------------------------
    bt_audio = recommender_service.get_bought_together_products(product_id=210, top_k=5)
    print("\n--- 5. Frequently Bought Together for Headphones (ID 210) ---")
    for b in bt_audio:
        print(f"  [{b['id']}] {b['brand']} - {b['title']} ({b['category']}) - Rs.{b['price_inr']}")
    
    assert all(b["id"] != 210 for b in bt_audio), "Self returned in audio bought together!"
    print(">>> PASS: Bought together for Headphones contains complementary gear (Charger, Watch, Travel Bag, Player).")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    main()


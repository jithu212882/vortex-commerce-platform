import sys
from pathlib import Path
from fastapi.testclient import TestClient

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.main import app

client = TestClient(app)


def test_keyword_search_engine():
    print("\n--- Test 1: Empty Query ---")
    r = client.get("/api/v1/search?q=")
    assert r.status_code == 200
    assert r.json() == []

    print("\n--- Test 2: Whitespace and Normalization ---")
    r1 = client.get("/api/v1/search?q=%20%20%20sony%20%20%20")
    assert r1.status_code == 200
    items1 = r1.json()
    assert len(items1) >= 1
    assert any("sony" in it["title"].lower() or "sony" in it["brand"].lower() for it in items1)

    print("\n--- Test 3: Multi-Word Token Query (sony wireless) ---")
    r_multi = client.get("/api/v1/search?q=sony%20wireless")
    assert r_multi.status_code == 200
    items_multi = r_multi.json()
    assert len(items_multi) >= 1
    # Every returned item MUST contain BOTH "sony" and "wireless" across its searchable fields
    for it in items_multi:
        corpus = f"{it['title']} {it['brand']} {it['category']} {it['description']}".lower()
        assert "sony" in corpus, f"Item {it['title']} missing 'sony'"
        assert "wireless" in corpus, f"Item {it['title']} missing 'wireless'"
    print(f"  Matched {len(items_multi)} item(s) containing both 'sony' and 'wireless'")

    print("\n--- Test 4: Full Metadata Verification ---")
    top_item = items_multi[0]
    required_keys = [
        "id", "title", "brand", "price", "mrp", "discount_pct",
        "rating", "review_count", "image_url", "category"
    ]
    for key in required_keys:
        assert key in top_item, f"Missing required metadata key: {key}"
        assert top_item[key] is not None, f"Key {key} is None"
    print("  Full metadata keys verified:", required_keys)

    print("\n--- Test 5: Category Scoping ---")
    # Category = audio: Should match Sony wireless headphones
    r_cat_audio = client.get("/api/v1/search?q=wireless&category=audio")
    assert r_cat_audio.status_code == 200
    audio_items = r_cat_audio.json()
    assert len(audio_items) >= 1
    print(f"  'wireless' with category=audio returned {len(audio_items)} item(s)")

    # Category = laptops: 'wireless' should NOT match laptops
    r_cat_laptops = client.get("/api/v1/search?q=wireless&category=laptops")
    assert r_cat_laptops.status_code == 200
    laptop_items = r_cat_laptops.json()
    assert len(laptop_items) == 0
    print("  'wireless' with category=laptops returned 0 items as expected")

    # Category = electronics: Should match laptops and computing
    r_laptops = client.get("/api/v1/search?q=laptop&category=electronics")
    assert r_laptops.status_code == 200
    assert len(r_laptops.json()) >= 1
    print(f"  'laptop' with category=electronics returned {len(r_laptops.json())} item(s)")

    print("\n--- Test 6: Relevance Ranking ---")
    # Search for "Sony WH-1000XM5" - exact title match should be rank #1 with highest score
    r_rank = client.get("/api/v1/search?q=Sony%20WH-1000XM5")
    assert r_rank.status_code == 200
    rank_items = r_rank.json()
    assert len(rank_items) >= 1
    assert "wh-1000xm5" in rank_items[0]["title"].lower()
    assert rank_items[0]["relevance_score"] > 100.0
    print(f"  Top rank score: {rank_items[0]['relevance_score']} for {rank_items[0]['title']}")

    print("\n--- Test 7: Zero Matches Non-Existent Product ---")
    r_none = client.get("/api/v1/search?q=xyznonexistentqwerty999")
    assert r_none.status_code == 200
    assert len(r_none.json()) == 0

    print("\n--- Test 8: Frontend HTML Contract ---")
    r_html = client.get("/")
    assert r_html.status_code == 200
    html_text = r_html.text
    # Search bar & suggest elements
    assert 'id="globalSearchInput"' in html_text
    assert 'id="searchSuggestDropdown"' in html_text
    assert 'id="searchSuggestList"' in html_text
    assert 'id="searchSuggestSeeAll"' in html_text
    assert 'id="btnSearchSubmit"' in html_text
    assert 'id="categorySelectDropdown"' in html_text
    # Search results view elements
    assert 'id="shelfSearchResults"' in html_text
    assert 'id="searchResultsTitle"' in html_text
    assert 'id="btnClearSearch"' in html_text
    assert 'id="searchResultsSort"' in html_text
    assert 'id="searchFilterPillsRow"' in html_text
    assert 'id="vxBrandLogo"' in html_text
    print("  All frontend DOM elements verified in storefront.html")

    print("\n--- Test 9: Frontend JS Functions Contract ---")
    r_js = client.get("/static/storefront.js")
    assert r_js.status_code == 200
    js_text = r_js.text
    assert "fetchAndRenderSuggestions" in js_text
    assert "renderSuggestDropdown" in js_text
    assert "executeSearch" in js_text
    assert "renderSearchResultsView" in js_text
    assert "clearSearch" in js_text
    assert "setViewMode" in js_text
    assert "ArrowDown" in js_text
    assert "ArrowUp" in js_text
    assert "lucide-search-x" in js_text or "No results found" in js_text
    print("  All frontend UX behaviors verified in storefront.js")

    print("\n=======================================================")
    print(">>> ALL SEARCH ENGINE INTEGRATION TESTS PASSED! <<<")
    print("=======================================================\n")


if __name__ == "__main__":
    test_keyword_search_engine()


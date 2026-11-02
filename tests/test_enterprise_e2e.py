import io
import sys
from pathlib import Path
from PIL import Image
from fastapi.testclient import TestClient

# Ensure root is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.main import app

client = TestClient(app)


def test_e2e_suite():
    print("\n--- Test 1: Health check ---")
    r = client.get("/api/v1/health")
    print("Health status:", r.status_code, r.json())
    assert r.status_code == 200

    print("\n--- Test 2: Catalog list ---")
    r = client.get("/api/v1/catalog?limit=5")
    items = r.json()
    print("Catalog status:", r.status_code, "Count:", len(items))
    assert r.status_code == 200
    assert len(items) > 0

    print("\n--- Test 3: Dwell recommendation ---")
    payload = {
        "user_id": "test_user_42",
        "query_text": "mascara lipstick cosmetics beauty",
        "recent_interactions": [
            {"product_id": 1, "dwell_time_seconds": 12.5},
            {"product_id": 2, "dwell_time_seconds": 4.2},
        ],
        "top_k": 3,
    }
    r = client.post("/api/v1/recommend/dwell", json=payload)
    print("Recs status:", r.status_code)
    data = r.json()
    print("Total returned:", data["total_returned"])
    for rec in data["recommendations"]:
        print(f"  Rank #{rec['rank']}: ID={rec['id']} {rec['title']} | Score: {rec['score']} | Breakdown: {rec.get('match_breakdown')}")
    assert r.status_code == 200
    assert len(data["recommendations"]) == 3

    print("\n--- Test 4: Visual search ---")
    img = Image.new("RGB", (200, 200), color=(73, 109, 137))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    files = {"file": ("test.jpg", buf.getvalue(), "image/jpeg")}
    r = client.post("/api/v1/search/visual", files=files, data={"top_k": 3})
    print("Visual status:", r.status_code)
    v_data = r.json()
    print("Detection found:", v_data["detection_found"], "Label:", v_data["detected_label"])
    print("Status msg:", v_data["status_message"])
    assert r.status_code == 200
    assert "recommendations" in v_data

    print("\n--- Test 5A: Support Chat (Auto-approved refund <= 1000) ---")
    r = client.post("/api/v1/support/chat", json={"thread_id": "thread_auto_1", "message": "I want a refund of $350 for my order"})
    res = r.json()
    print("Chat auto status:", r.status_code, res["response"])
    assert res["status"] == "auto_approved"
    assert res["escalation_needed"] is False

    print("\n--- Test 5B: Support Chat (Escalation needed refund > 1000) ---")
    r = client.post("/api/v1/support/chat", json={"thread_id": "thread_esc_1", "message": "I need a refund of $2500 for the broken server equipment"})
    res = r.json()
    print("Chat esc status:", r.status_code, res["response"])
    assert res["escalation_needed"] is True
    assert res["status"] == "pending_manager_approval"

    print("\n--- Test 6: Manager Escalation Resolution ---")
    r = client.post("/api/v1/support/escalate", json={
        "thread_id": "thread_esc_1",
        "approved": True,
        "manager_id": "MGR_EXEC_99",
        "notes": "Hardware return inspected and approved for full refund",
    })
    res = r.json()
    print("Escalate status:", r.status_code, res["response"])
    assert r.status_code == 200
    assert res["status"] == "manager_approved"

    print("\n--- Test 7: Static files & Architectural Separation ---")
    r_store = client.get("/")
    print("Storefront root status:", r_store.status_code, "Content length:", len(r_store.text))
    assert r_store.status_code == 200
    assert "MERIDIAN" in r_store.text

    r_admin = client.get("/admin")
    print("Admin console status:", r_admin.status_code, "Content length:", len(r_admin.text))
    assert r_admin.status_code == 200
    assert "OPERATIONS COCKPIT" in r_admin.text

    r_telem = client.get("/api/v1/admin/telemetry")
    print("Admin telemetry status:", r_telem.status_code, "Metrics:", r_telem.json().get("metrics"))
    assert r_telem.status_code == 200
    assert r_telem.json()["status"] == "operational"

    print("\n=======================================================")
    print(">>> ALL 7 END-TO-END INTEGRATION TESTS PASSED! <<<")
    print("=======================================================\n")


if __name__ == "__main__":
    test_e2e_suite()

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
    assert "vortex" in r_store.text.lower() or "meridian" in r_store.text.lower()

    r_admin = client.get("/admin")
    print("Admin console status:", r_admin.status_code, "Content length:", len(r_admin.text))
    assert r_admin.status_code == 200
    assert "OPERATIONS COCKPIT" in r_admin.text

    r_telem = client.get("/api/v1/admin/telemetry")
    print("Admin telemetry status:", r_telem.status_code, "Metrics:", r_telem.json().get("metrics"))
    assert r_telem.status_code == 200
    assert r_telem.json()["status"] == "operational"

    print("\n--- Test 8: Dedicated Orders and Account Profile Pages ---")
    r_orders_page = client.get("/orders")
    print("Orders page status:", r_orders_page.status_code, "Length:", len(r_orders_page.text))
    assert r_orders_page.status_code == 200
    assert "My Orders" in r_orders_page.text

    r_account_page = client.get("/account")
    print("Account page status:", r_account_page.status_code, "Length:", len(r_account_page.text))
    assert r_account_page.status_code == 200
    assert "Sreejith" in r_account_page.text

    r_orders_api = client.get("/api/v1/orders")
    orders_data = r_orders_api.json()
    print("Orders API status:", r_orders_api.status_code, "Count:", orders_data["total_count"])
    assert r_orders_api.status_code == 200
    assert orders_data["total_count"] >= 3

    r_order_detail = client.get("/api/v1/orders/VTX-90812")
    assert r_order_detail.status_code == 200
    assert r_order_detail.json()["total_inr"] == 450.0

    print("\n--- Test 9: Automated Refund Engine (Low Ticket <= 500 Auto vs High Ticket > 500 Escalate) ---")
    # Low ticket (Rs 450 <= 500)
    r_ret_low = client.post("/api/v1/orders/VTX-90812/return", json={
        "reason": "Defective item / Damaged on arrival",
        "notes": "Bottle seal broken on delivery",
    })
    low_res = r_ret_low.json()
    print("Low ticket return status:", r_ret_low.status_code, "Policy status:", low_res["status"])
    assert r_ret_low.status_code == 200
    assert low_res["status"] == "auto_approved"
    assert low_res["escalation_needed"] is False

    # High ticket (Rs 26,990 > 500)
    r_ret_high = client.post("/api/v1/orders/VTX-44210/return", json={
        "reason": "Wrong item delivered",
        "notes": "Received silver color instead of black studio edition",
    })
    high_res = r_ret_high.json()
    print("High ticket return status:", r_ret_high.status_code, "Policy status:", high_res["status"])
    assert r_ret_high.status_code == 200
    assert high_res["status"] == "pending_manager_approval"
    assert high_res["escalation_needed"] is True

    # Operations supervisor approval of high-ticket claim
    r_esc_resolve = client.post("/api/v1/support/escalate", json={
        "thread_id": high_res["thread_id"],
        "approved": True,
        "manager_id": "OPS_MGR_PRIYA",
        "notes": "Physical return collected and verified at Marthandam hub",
    })
    esc_res = r_esc_resolve.json()
    print("Escalation resolve status:", r_esc_resolve.status_code, "Final status:", esc_res["status"])
    assert r_esc_resolve.status_code == 200
    assert esc_res["status"] == "manager_approved"

    print("\n=======================================================")
    print(">>> ALL 9 END-TO-END INTEGRATION TESTS PASSED! <<<")
    print("=======================================================\n")


if __name__ == "__main__":
    test_e2e_suite()

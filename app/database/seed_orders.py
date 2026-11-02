"""
Seed Orders Dataset and Order Management Service
Flipkart-Grade Commercial Order History for VORTEX COMMERCE
- Low-ticket order: #VTX-90812 (Minimalist Face Serum - Rs 450 - Auto-Refund Eligible)
- High-ticket order: #VTX-44210 (Sony WH-1000XM5 - Rs 26,990 - Manual Verification Required)
- Delivered standard order: #VTX-11029 (Bellroy Leather Wallet - Rs 3,890)
- On the way order: #VTX-55102 (Apple Watch Series 9 - Rs 41,900)
- Cancelled order: #VTX-33019 (Philips Rapid Air Fryer - Rs 7,499)
"""

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# Initial Seed Data
INITIAL_ORDERS: List[Dict[str, Any]] = [
    {
        "order_id": "VTX-90812",
        "placed_date": "Oct 31, 2026",
        "total_inr": 450.0,
        "currency": "INR",
        "status": "Delivered yesterday",
        "status_category": "delivered",  # all, on_the_way, delivered, cancelled, returned
        "status_message": "Package was handed directly to resident",
        "delivered_date": "Nov 01, 2026",
        "return_window": "Open until 7 days (Nov 08, 2026)",
        "return_eligible": True,
        "refund_status": None,  # None, "AUTO_APPROVED", "PENDING_MANAGER_REVIEW", "MANAGER_APPROVED", "MANAGER_REJECTED"
        "refund_ticket_id": None,
        "refund_notes": None,
        "payment_method": "UPI - Google Pay (TXN-9081248)",
        "shipping_address": {
            "name": "Sreejith Kumar",
            "phone": "+91 98401 23456",
            "address_line": "42/7 Temple Road, Near CSI Church",
            "locality": "Marthandam",
            "city": "Marthandam",
            "district": "Kanyakumari Dist",
            "state": "Tamil Nadu",
            "pincode": "629165",
            "address_type": "HOME",
        },
        "items": [
            {
                "product_id": 1,
                "title": "Minimalist 10% Niacinamide Face Serum with Zinc",
                "brand": "MINIMALIST",
                "category": "beauty",
                "quantity": 1,
                "unit_price_inr": 450.0,
                "image_url": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=400&q=80",
            }
        ],
        "timeline": [
            {"title": "Order Confirmed", "date": "Oct 31, 2026 • 10:14 AM", "done": True},
            {"title": "Shipped from Chennai Fulfilment Center", "date": "Oct 31, 2026 • 04:30 PM", "done": True},
            {"title": "Out for Delivery (Marthandam Hub)", "date": "Nov 01, 2026 • 09:15 AM", "done": True},
            {"title": "Delivered", "date": "Nov 01, 2026 • 01:45 PM", "done": True},
        ],
    },
    {
        "order_id": "VTX-44210",
        "placed_date": "Oct 29, 2026",
        "total_inr": 26990.0,
        "currency": "INR",
        "status": "Delivered 2 days ago",
        "status_category": "delivered",
        "status_message": "Delivered with OTP verification at main door",
        "delivered_date": "Oct 31, 2026",
        "return_window": "Open until 7 days (Nov 07, 2026)",
        "return_eligible": True,
        "refund_status": None,
        "refund_ticket_id": None,
        "refund_notes": None,
        "payment_method": "HDFC Bank Credit Card ending in 4102",
        "shipping_address": {
            "name": "Sreejith Kumar",
            "phone": "+91 98401 23456",
            "address_line": "42/7 Temple Road, Near CSI Church",
            "locality": "Marthandam",
            "city": "Marthandam",
            "district": "Kanyakumari Dist",
            "state": "Tamil Nadu",
            "pincode": "629165",
            "address_type": "HOME",
        },
        "items": [
            {
                "product_id": 103,
                "title": "Sony WH-1000XM5 Wireless Noise-Canceling Headphones (Silver)",
                "brand": "SONY",
                "category": "audio",
                "quantity": 1,
                "unit_price_inr": 26990.0,
                "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
            }
        ],
        "timeline": [
            {"title": "Order Placed", "date": "Oct 29, 2026 • 11:20 AM", "done": True},
            {"title": "Packed & Quality Inspected", "date": "Oct 29, 2026 • 02:45 PM", "done": True},
            {"title": "Dispatched via Express Air", "date": "Oct 30, 2026 • 08:10 AM", "done": True},
            {"title": "Delivered (OTP Verified)", "date": "Oct 31, 2026 • 03:12 PM", "done": True},
        ],
    },
    {
        "order_id": "VTX-11029",
        "placed_date": "Oct 25, 2026",
        "total_inr": 3890.0,
        "currency": "INR",
        "status": "Delivered on Oct 28",
        "status_category": "delivered",
        "status_message": "Item delivered to security reception",
        "delivered_date": "Oct 28, 2026",
        "return_window": "Open until Nov 04, 2026",
        "return_eligible": True,
        "refund_status": None,
        "refund_ticket_id": None,
        "refund_notes": None,
        "payment_method": "Paytm UPI (TXN-1102983)",
        "shipping_address": {
            "name": "Sreejith Kumar",
            "phone": "+91 98401 23456",
            "address_line": "Tech Hub Towers, 3rd Floor, Industrial Estate",
            "locality": "Marthandam",
            "city": "Marthandam",
            "district": "Kanyakumari Dist",
            "state": "Tamil Nadu",
            "pincode": "629165",
            "address_type": "WORK",
        },
        "items": [
            {
                "product_id": 93,
                "title": "Bellroy Minimalist Full-Grain RFID Slim Leather Wallet",
                "brand": "BELLROY",
                "category": "mens-watches",
                "quantity": 1,
                "unit_price_inr": 3890.0,
                "image_url": "https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&q=80",
            }
        ],
        "timeline": [
            {"title": "Order Placed", "date": "Oct 25, 2026 • 09:30 AM", "done": True},
            {"title": "Shipped from Bengaluru Hub", "date": "Oct 26, 2026 • 05:00 PM", "done": True},
            {"title": "Delivered", "date": "Oct 28, 2026 • 11:40 AM", "done": True},
        ],
    },
    {
        "order_id": "VTX-55102",
        "placed_date": "Nov 01, 2026",
        "total_inr": 41900.0,
        "currency": "INR",
        "status": "On the way • Expected today by 8 PM",
        "status_category": "on_the_way",
        "status_message": "Package arrived at Marthandam Local Delivery Center",
        "delivered_date": None,
        "return_window": "Eligible after delivery",
        "return_eligible": False,
        "refund_status": None,
        "refund_ticket_id": None,
        "refund_notes": None,
        "payment_method": "HDFC Credit Card EMI",
        "shipping_address": {
            "name": "Sreejith Kumar",
            "phone": "+91 98401 23456",
            "address_line": "42/7 Temple Road, Near CSI Church",
            "locality": "Marthandam",
            "city": "Marthandam",
            "district": "Kanyakumari Dist",
            "state": "Tamil Nadu",
            "pincode": "629165",
            "address_type": "HOME",
        },
        "items": [
            {
                "product_id": 78,
                "title": "Apple Watch Series 9 GPS + Cellular 45mm Midnight Aluminum",
                "brand": "APPLE",
                "category": "wearables",
                "quantity": 1,
                "unit_price_inr": 41900.0,
                "image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80",
            }
        ],
        "timeline": [
            {"title": "Order Confirmed", "date": "Nov 01, 2026 • 08:15 AM", "done": True},
            {"title": "Shipped from Kochi Hub", "date": "Nov 01, 2026 • 02:00 PM", "done": True},
            {"title": "Arrived at Marthandam Delivery Station", "date": "Nov 02, 2026 • 06:30 AM", "done": True},
            {"title": "Out for Delivery", "date": "Nov 02, 2026 • Expected by 8 PM", "done": False},
        ],
    },
    {
        "order_id": "VTX-33019",
        "placed_date": "Oct 22, 2026",
        "total_inr": 7499.0,
        "currency": "INR",
        "status": "Cancelled on Oct 22",
        "status_category": "cancelled",
        "status_message": "Order cancelled as per customer request before dispatch",
        "delivered_date": None,
        "return_window": "Not applicable",
        "return_eligible": False,
        "refund_status": "AUTO_APPROVED",
        "refund_ticket_id": "TKT-CAN-33019",
        "refund_notes": "Immediate cancellation refund processed to source account",
        "payment_method": "UPI - Google Pay",
        "shipping_address": {
            "name": "Sreejith Kumar",
            "phone": "+91 98401 23456",
            "address_line": "42/7 Temple Road, Near CSI Church",
            "locality": "Marthandam",
            "city": "Marthandam",
            "district": "Kanyakumari Dist",
            "state": "Tamil Nadu",
            "pincode": "629165",
            "address_type": "HOME",
        },
        "items": [
            {
                "product_id": 14,
                "title": "Philips Rapid Air HD9252 Smart Air Fryer (4.1L)",
                "brand": "PHILIPS",
                "category": "kitchen-accessories",
                "quantity": 1,
                "unit_price_inr": 7499.0,
                "image_url": "https://images.unsplash.com/photo-1585515320310-259814833e62?w=400&q=80",
            }
        ],
        "timeline": [
            {"title": "Order Placed", "date": "Oct 22, 2026 • 03:10 PM", "done": True},
            {"title": "Cancellation Requested", "date": "Oct 22, 2026 • 03:45 PM", "done": True},
            {"title": "Refund Processed (₹7,499.00)", "date": "Oct 22, 2026 • 03:50 PM", "done": True},
        ],
    },
]

# Active mutable store
_ORDERS_STORE: List[Dict[str, Any]] = deepcopy(INITIAL_ORDERS)


def get_all_orders(status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves all pre-seeded user orders, optionally filtered by status category."""
    if not status_filter or status_filter == "all":
        return [deepcopy(o) for o in _ORDERS_STORE]
    return [
        deepcopy(o)
        for o in _ORDERS_STORE
        if o.get("status_category") == status_filter
        or (status_filter == "returned" and o.get("refund_status") in ["AUTO_APPROVED", "MANAGER_APPROVED"])
    ]


def get_order_by_id(order_id: str) -> Optional[Dict[str, Any]]:
    """Finds an order by its canonical ID (e.g., 'VTX-90812' or '90812')."""
    clean_id = order_id.strip().upper().replace("#", "")
    for order in _ORDERS_STORE:
        curr_id = order["order_id"].upper()
        if curr_id == clean_id or curr_id.replace("VTX-", "") == clean_id:
            return deepcopy(order)
    return None


def update_order_refund_status(
    order_id: str,
    refund_status: str,
    ticket_id: Optional[str] = None,
    notes: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Updates the refund and return status of a target order."""
    clean_id = order_id.strip().upper().replace("#", "")
    for order in _ORDERS_STORE:
        curr_id = order["order_id"].upper()
        if curr_id == clean_id or curr_id.replace("VTX-", "") == clean_id:
            order["refund_status"] = refund_status
            if ticket_id:
                order["refund_ticket_id"] = ticket_id
            if notes:
                order["refund_notes"] = notes

            # If approved, update status category
            if refund_status in ["AUTO_APPROVED", "MANAGER_APPROVED"]:
                order["status"] = "Return Approved • Refund Initiated"
                order["status_category"] = "returned"
                order["timeline"].append({
                    "title": f"Return Approved ({refund_status})",
                    "date": datetime.now(timezone.utc).strftime("%b %d, %Y • %I:%M %p"),
                    "done": True,
                })
            elif refund_status == "PENDING_MANAGER_REVIEW":
                order["status"] = "Return Claim Under Review"
                order["timeline"].append({
                    "title": "Return Claim Gated for Operations Review",
                    "date": datetime.now(timezone.utc).strftime("%b %d, %Y • %I:%M %p"),
                    "done": True,
                })
            elif refund_status == "MANAGER_REJECTED":
                order["status"] = "Return Claim Declined"
                order["timeline"].append({
                    "title": "Return Claim Declined by Operations Supervisor",
                    "date": datetime.now(timezone.utc).strftime("%b %d, %Y • %I:%M %p"),
                    "done": True,
                })

            return deepcopy(order)
    return None


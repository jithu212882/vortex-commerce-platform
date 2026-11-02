"""
Database Seeding Module for Enterprise RecSys Catalog.
Supports live fetching from DummyJSON public API with offline enterprise product fallback.
"""

import logging
import requests
from sqlalchemy import select
from app.database.connection import Item, SessionLocal, init_db

logger = logging.getLogger("enterprise_recsys.seed")

# Robust offline fallback catalog items across major commercial retail categories
OFFLINE_FALLBACK_CATALOG = [
    {
        "id": 1,
        "title": "Essence Mascara Lash Princess",
        "category": "beauty",
        "brand": "Essence",
        "description": "The Essence Lash Princess False Lash Effect Mascara achieves voluminous, lengthened lashes without clumps or flaking.",
        "price": 9.99,
        "image_url": "https://cdn.dummyjson.com/products/images/beauty/Essence%20Mascara%20Lash%20Princess/thumbnail.png",
    },
    {
        "id": 2,
        "title": "Eyeshadow Palette with Mirror",
        "category": "beauty",
        "brand": "Glamour Beauty",
        "description": "High-pigment, versatile eyeshadow palette featuring 12 neutral, matte, and shimmer pans with built-in vanity mirror.",
        "price": 19.99,
        "image_url": "https://cdn.dummyjson.com/products/images/beauty/Eyeshadow%20Palette%20with%20Mirror/thumbnail.png",
    },
    {
        "id": 3,
        "title": "Powder Canister Matte Finish",
        "category": "beauty",
        "brand": "Velvet Touch",
        "description": "Translucent setting powder for long-lasting oil control, soft-focus blurring, and lightweight all-day comfort.",
        "price": 14.99,
        "image_url": "https://cdn.dummyjson.com/products/images/beauty/Powder%20Canister/thumbnail.png",
    },
    {
        "id": 4,
        "title": "Red Lipstick Satin Formula",
        "category": "beauty",
        "brand": "Chic Cosmetics",
        "description": "Richly pigmented classic crimson lipstick enriched with hydrating botanical oils and antioxidant vitamin E.",
        "price": 12.99,
        "image_url": "https://cdn.dummyjson.com/products/images/beauty/Red%20Lipstick/thumbnail.png",
    },
    {
        "id": 5,
        "title": "Red Nail Polish Gloss Glaze",
        "category": "beauty",
        "brand": "Nail Couture",
        "description": "Chip-resistant, fast-drying gel-shine nail lacquer in high-gloss red for salon-quality manicures at home.",
        "price": 8.99,
        "image_url": "https://cdn.dummyjson.com/products/images/beauty/Red%20Nail%20Polish/thumbnail.png",
    },
    {
        "id": 6,
        "title": "Calvin Klein CK One Eau de Toilette",
        "category": "fragrances",
        "brand": "Calvin Klein",
        "description": "Iconic, clean citrus fragrance with notes of green tea, papaya, bergamot, and cedar for modern unisex daily wear.",
        "price": 49.99,
        "image_url": "https://cdn.dummyjson.com/products/images/fragrances/Calvin%20Klein%20CK%20One/thumbnail.png",
    },
    {
        "id": 7,
        "title": "Chanel Coco Noir Eau De Parfum",
        "category": "fragrances",
        "brand": "Chanel",
        "description": "Luminous oriental perfume with top notes of grapefruit and bergamot, rose and geranium heart, and tonka bean base.",
        "price": 129.99,
        "image_url": "https://cdn.dummyjson.com/products/images/fragrances/Chanel%20Coco%20Noir%20Eau%20De%20Parfum/thumbnail.png",
    },
    {
        "id": 8,
        "title": "Dior J'adore Eau de Parfum",
        "category": "fragrances",
        "brand": "Dior",
        "description": "Opulent floral bouquet combining ylang-ylang, damascena rose, and jasmine sambac for timeless feminine elegance.",
        "price": 89.99,
        "image_url": "https://cdn.dummyjson.com/products/images/fragrances/Dior%20J'adore/thumbnail.png",
    },
    {
        "id": 9,
        "title": "Dolce Shine Eau de Parfum",
        "category": "fragrances",
        "brand": "Dolce & Gabbana",
        "description": "Sunny and cheerful fruity floral fragrance with vibrant notes of lush mango, salty quince, and Australian blonde woods.",
        "price": 69.99,
        "image_url": "https://cdn.dummyjson.com/products/images/fragrances/Dolce%20Shine%20Eau%20de%20Parfum/thumbnail.png",
    },
    {
        "id": 10,
        "title": "Gucci Bloom Eau de Parfum",
        "category": "fragrances",
        "brand": "Gucci",
        "description": "Captivating white flower scent created with tuberose, jasmine bud extract, and Rangoon creeper from South India.",
        "price": 79.99,
        "image_url": "https://cdn.dummyjson.com/products/images/fragrances/Gucci%20Bloom%20Eau%20de%20Parfum/thumbnail.png",
    },
    {
        "id": 11,
        "title": "Annibale Colombo Bed Artisan Oak",
        "category": "furniture",
        "brand": "Annibale Colombo",
        "description": "Handcrafted luxury solid oak platform bed frame with integrated upholstered leather headboard and ergonomic slat system.",
        "price": 1899.99,
        "image_url": "https://cdn.dummyjson.com/products/images/furniture/Annibale%20Colombo%20Bed/thumbnail.png",
    },
    {
        "id": 12,
        "title": "Annibale Colombo Sofa Modular",
        "category": "furniture",
        "brand": "Annibale Colombo",
        "description": "Modular executive velvet lounge sofa with down feather cushions and brushed brass hardware accents.",
        "price": 2499.99,
        "image_url": "https://cdn.dummyjson.com/products/images/furniture/Annibale%20Colombo%20Sofa/thumbnail.png",
    },
    {
        "id": 13,
        "title": "Bedside Table Two Drawer Nightstand",
        "category": "furniture",
        "brand": "Furniture Crafts",
        "description": "Mid-century solid walnut nightstand featuring soft-close ball-bearing drawers and hidden power cord routing pass-through.",
        "price": 299.99,
        "image_url": "https://cdn.dummyjson.com/products/images/furniture/Bedside%20Table%20Two%20Drawer/thumbnail.png",
    },
    {
        "id": 14,
        "title": "Carpenters Armchair Leather Lounge",
        "category": "furniture",
        "brand": "Artisan Living",
        "description": "Ergonomic molded bentwood armchair clad in full-grain cognac saddle leather with high-resilience foam cushioning.",
        "price": 799.99,
        "image_url": "https://cdn.dummyjson.com/products/images/furniture/Carpenters%20Armchair/thumbnail.png",
    },
    {
        "id": 15,
        "title": "Minimalist Standing Desk Dual Motor",
        "category": "furniture",
        "brand": "ErgoPro",
        "description": "Commercial dual-motor height-adjustable standing desk with solid bamboo surface and programmable memory presets.",
        "price": 549.99,
        "image_url": "https://cdn.dummyjson.com/products/images/furniture/Annibale%20Colombo%20Bed/thumbnail.png",
    },
    {
        "id": 16,
        "title": "MacBook Pro 16 M3 Max",
        "category": "electronics",
        "brand": "Apple",
        "description": "Flagship workstation laptop with Liquid Retina XDR display, 36GB unified memory, and 1TB ultra-fast NVMe storage.",
        "price": 3499.99,
        "image_url": "https://cdn.dummyjson.com/products/images/laptops/Apple%20MacBook%20Pro%2014%20Inch%20Space%20Grey/thumbnail.png",
    },
    {
        "id": 17,
        "title": "Dell XPS 15 InfinityEdge OLED",
        "category": "electronics",
        "brand": "Dell",
        "description": "Precision aluminum chassis creator laptop featuring 3.5K OLED touch display, Intel Core i9, and NVIDIA GeForce RTX graphics.",
        "price": 2199.99,
        "image_url": "https://cdn.dummyjson.com/products/images/laptops/Apple%20MacBook%20Pro%2014%20Inch%20Space%20Grey/thumbnail.png",
    },
    {
        "id": 18,
        "title": "Sony WH-1000XM5 Wireless Headphones",
        "category": "audio",
        "brand": "Sony",
        "description": "Industry-leading active noise canceling wireless over-ear headphones with 30-hour battery life and Hi-Res LDAC audio.",
        "price": 399.99,
        "image_url": "https://cdn.dummyjson.com/products/images/beauty/Powder%20Canister/thumbnail.png",
    },
    {
        "id": 19,
        "title": "AirPods Pro 2nd Gen USB-C",
        "category": "audio",
        "brand": "Apple",
        "description": "Active noise cancellation wireless earbuds with Adaptive Transparency, personalized spatial audio, and MagSafe case.",
        "price": 249.99,
        "image_url": "https://cdn.dummyjson.com/products/images/beauty/Red%20Nail%20Polish/thumbnail.png",
    },
    {
        "id": 20,
        "title": "Apple Watch Ultra 2 Titanium",
        "category": "wearables",
        "brand": "Apple",
        "description": "Rugged 49mm aerospace-grade titanium smartwatch with precision dual-frequency GPS and up to 72 hours low-power battery life.",
        "price": 799.99,
        "image_url": "https://cdn.dummyjson.com/products/images/fragrances/Calvin%20Klein%20CK%20One/thumbnail.png",
    },
]


def seed_catalog_database(api_url: str = "https://dummyjson.com/products?limit=194") -> int:
    """
    Seeds catalog items into database. Tries external DummyJSON API first;
    falls back cleanly to offline curated catalog if network unavailable.
    """
    init_db()

    products = []
    try:
        logger.info(f"Connecting to public catalog API: {api_url}")
        res = requests.get(api_url, timeout=6)
        if res.status_code == 200:
            data = res.json()
            products = data.get("products", [])
            logger.info(f"Retrieved {len(products)} products from remote seed endpoint.")
    except Exception as e:
        logger.warning(f"Could not reach remote catalog API ({e}). Falling back to offline seed dataset.")

    if not products:
        products = OFFLINE_FALLBACK_CATALOG

    inserted_count = 0
    with SessionLocal() as session:
        existing_external_ids = set(session.scalars(select(Item.external_id)).all())

        for prod in products:
            ext_id = prod.get("id")
            if ext_id is None or ext_id in existing_external_ids:
                continue

            image_url = prod.get("thumbnail") or (
                prod.get("images")[0] if prod.get("images") else ""
            ) or prod.get("image_url", "")

            item = Item(
                external_id=ext_id,
                title=prod.get("title", ""),
                category=prod.get("category", ""),
                brand=prod.get("brand"),
                description=prod.get("description", ""),
                price=float(prod.get("price", 0.0)),
                image_url=image_url,
            )
            session.add(item)
            existing_external_ids.add(ext_id)
            inserted_count += 1

        session.commit()

    logger.info(f"Catalog seeding complete. Inserted {inserted_count} new SKUs.")
    return inserted_count


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    count = seed_catalog_database()
    print(f"Catalog seed finished. Total newly inserted: {count}")


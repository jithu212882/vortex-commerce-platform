import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router as api_router
from app.core.config import settings
from app.database.connection import Item, SessionLocal, init_db, seed_items_from_public_api
from app.services.recommender import recommender_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("enterprise_recsys")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler: Initializes DB schema, seeds catalog if needed, warms models."""
    logger.info("Initializing Enterprise RecSys & Customer Operations platform...")
    init_db()

    # Seed catalog if needed
    try:
        with SessionLocal() as db:
            count = db.query(Item).count()
            if count < 194:
                logger.info(f"Database contains {count} items. Seeding catalog from public API...")
                seed_items_from_public_api()
            else:
                logger.info(f"Database contains full catalog ({count} items).")
    except Exception as e:
        logger.warning(f"Database seed check skipped: {e}")

    # Warm up recommender catalog embeddings
    try:
        recommender_service.reload_catalog()
        logger.info(f"Dense vector recommender operational with {len(recommender_service.items)} items.")
    except Exception as e:
        logger.error(f"Recommender initialization error: {e}")

    yield
    logger.info("Enterprise RecSys & Customer Operations platform shutdown complete.")


app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise-grade e-commerce recommendation system and customer operations desk.",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Cross-Origin Resource Sharing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router, prefix=settings.API_V1_STR)

# Ensure static directory exists
os.makedirs(settings.STATIC_DIR, exist_ok=True)

# Architectural Separation Routes
@app.get("/", include_in_schema=False)
def get_storefront():
    """Serves high-craft public consumer storefront."""
    storefront_file = settings.STATIC_DIR / "storefront.html"
    if storefront_file.exists():
        return FileResponse(storefront_file)
    return FileResponse(settings.STATIC_DIR / "index.html")

@app.get("/admin", include_in_schema=False)
@app.get("/admin/", include_in_schema=False)
def get_admin():
    """Serves high-density operations and engineering cockpit."""
    return FileResponse(settings.STATIC_DIR / "admin.html")

# Mount static directory
app.mount("/static", StaticFiles(directory=str(settings.STATIC_DIR)), name="static_assets")
app.mount("/", StaticFiles(directory=str(settings.STATIC_DIR), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

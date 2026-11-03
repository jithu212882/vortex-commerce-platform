import os
from pathlib import Path
from pydantic import BaseModel


def _resolve_default_db_url() -> str:
    """Resolves database URL, using writable /tmp for Vercel serverless functions."""
    if os.getenv("VERCEL"):
        return "sqlite:////tmp/recsys.db"
    return f"sqlite:///{Path(__file__).resolve().parent.parent.parent / 'recsys.db'}"


class Settings(BaseModel):
    APP_NAME: str = "Enterprise Catalog & Operations Desk"
    API_V1_STR: str = "/api/v1"
    
    # Base directory paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    STATIC_DIR: Path = Path(__file__).resolve().parent.parent / "static"
    
    # Database resolution: checks environment, workspace root, or relative
    DATABASE_URL: str = os.getenv("DATABASE_URL", _resolve_default_db_url())

    # Machine Learning & AI Models
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
    YOLO_MODEL_NAME: str = "yolov8n.pt"

    # Business Policy Rules
    REFUND_THRESHOLD: float = 1000.0
    
    # Recommendation Defaults
    DEFAULT_ALPHA: float = 0.5
    DEFAULT_BETA: float = 0.5


settings = Settings()

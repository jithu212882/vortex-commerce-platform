import os
from pathlib import Path
from pydantic import BaseModel


class Settings(BaseModel):
    APP_NAME: str = "Enterprise Catalog & Operations Desk"
    API_V1_STR: str = "/api/v1"
    
    # Base directory paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    STATIC_DIR: Path = Path(__file__).resolve().parent.parent / "static"
    
    # Database resolution: checks environment, workspace root, or relative
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{Path(__file__).resolve().parent.parent.parent / 'recsys.db'}"
    )

    # Machine Learning & AI Models
    EMBEDDING_MODEL_NAME: str = "all-MiniLM-L6-v2"
    YOLO_MODEL_NAME: str = "yolov8n.pt"

    # Business Policy Rules
    REFUND_THRESHOLD: float = 1000.0
    
    # Recommendation Defaults
    DEFAULT_ALPHA: float = 0.5
    DEFAULT_BETA: float = 0.5


settings = Settings()

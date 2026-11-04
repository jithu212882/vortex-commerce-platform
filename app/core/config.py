import os
from pathlib import Path
from pydantic import BaseModel

# Automatically load local .env if present
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if _env_path.exists():
    try:
        with open(_env_path, "r", encoding="utf-8") as _f:
            for _line in _f:
                _line = _line.strip()
                if _line and not _line.startswith("#") and "=" in _line:
                    _k, _v = _line.split("=", 1)
                    _k = _k.strip()
                    _v = _v.strip().strip("'\"")
                    if _k not in os.environ:
                        os.environ[_k] = _v
    except Exception:
        pass


class Settings(BaseModel):
    APP_NAME: str = "Enterprise Catalog & Operations Desk"
    API_V1_STR: str = "/api/v1"
    
    # Base directory paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    STATIC_DIR: Path = Path(__file__).resolve().parent.parent / "static"
    
    # Database resolution: checks environment or defaults to local recsys.db
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

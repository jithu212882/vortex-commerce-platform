import os
from datetime import datetime, timezone
from typing import Generator, List, Optional
import requests
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    create_engine,
    select,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

from app.core.config import settings

# Engine configuration with thread safety for SQLite
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Item(Base):
    """Product Item Model for E-Commerce Catalog."""

    __tablename__ = "items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    external_id = Column(Integer, unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    brand = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False, default=0.0)
    image_url = Column(String(500), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "external_id": self.external_id,
            "title": self.title,
            "category": self.category,
            "brand": self.brand,
            "description": self.description,
            "price": self.price,
            "image_url": self.image_url,
        }

    def __repr__(self):
        return f"<Item(id={self.id}, title='{self.title[:25]}', category='{self.category}', price={self.price})>"


class UserActivity(Base):
    """User Interaction Activity and Dwell-time Telemetry Model."""

    __tablename__ = "user_activities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(100), index=True, nullable=False)
    item_id = Column(Integer, index=True, nullable=True)
    event_type = Column(String(50), nullable=False)  # 'view', 'dwell', 'cart', 'purchase', 'search'
    dwell_time = Column(Float, default=0.0, nullable=False)
    search_query = Column(String(255), nullable=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "item_id": self.item_id,
            "event_type": self.event_type,
            "dwell_time": self.dwell_time,
            "search_query": self.search_query,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return (
            f"<UserActivity(id={self.id}, user_id='{self.user_id}', "
            f"event_type='{self.event_type}', dwell_time={self.dwell_time})>"
        )


def init_db():
    """Create all database tables."""
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency helper to yield a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_items_from_public_api(api_url: str = "https://dummyjson.com/products?limit=194") -> int:
    """
    Fetches products from DummyJSON public API and inserts missing items into the items table.
    """
    init_db()

    try:
        response = requests.get(api_url, timeout=10)
        response.raise_for_status()
        data = response.json()
        products = data.get("products", [])
    except Exception as e:
        print(f"[Database Seed Warning] Could not reach external seed API: {e}")
        products = []

    inserted_count = 0
    with SessionLocal() as session:
        existing_external_ids = set(session.scalars(select(Item.external_id)).all())

        for prod in products:
            ext_id = prod.get("id")
            if ext_id is None or ext_id in existing_external_ids:
                continue

            image_url = prod.get("thumbnail") or (
                prod.get("images")[0] if prod.get("images") else ""
            )

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

    return inserted_count

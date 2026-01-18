"""Database initialization endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db, Base, engine

router = APIRouter()


@router.post("/init")
async def initialize_database(db: Session = Depends(get_db)):
    """Initialize the database by creating all tables."""
    try:
        Base.metadata.create_all(bind=engine)
        return {"success": True, "message": "Database initialized successfully"}
    except Exception as e:
        return {"success": False, "error": str(e)}

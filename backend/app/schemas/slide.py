from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SlideCreate(BaseModel):
    project_id: str
    index: int
    markdown: str
    image_data: Optional[str] = None
    theme: str = "default"


class SlideUpdate(BaseModel):
    index: Optional[int] = None
    markdown: Optional[str] = None
    image_data: Optional[str] = None
    theme: Optional[str] = None


class SlideResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    project_id: str
    index: int
    markdown: str
    image_data: Optional[str] = None
    theme: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

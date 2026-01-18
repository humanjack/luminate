from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ContentFormat(str, Enum):
    PRESENTATION = "presentation"
    TUTORIAL = "tutorial"
    EXPLAINER = "explainer"


class ContentRequest(BaseModel):
    research: str
    format: ContentFormat = ContentFormat.PRESENTATION
    target_length: int = 10


class ContentCreate(BaseModel):
    project_id: str
    title: Optional[str] = None
    format: str = "presentation"
    target_length: int = 10
    outline: Optional[List[dict]] = None
    markdown: Optional[str] = None


class ContentUpdate(BaseModel):
    title: Optional[str] = None
    format: Optional[str] = None
    target_length: Optional[int] = None
    outline: Optional[List[dict]] = None
    markdown: Optional[str] = None


class ContentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    project_id: str
    title: Optional[str] = None
    format: str
    target_length: int
    outline: Optional[List[dict]] = None
    markdown: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

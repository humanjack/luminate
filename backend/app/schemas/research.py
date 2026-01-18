from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ResearchDepth(str, Enum):
    QUICK = "quick"
    DETAILED = "detailed"
    COMPREHENSIVE = "comprehensive"


class ResearchRequest(BaseModel):
    topic: str
    depth: ResearchDepth = ResearchDepth.DETAILED


class ResearchCreate(BaseModel):
    project_id: str
    topic: str
    depth: str = "detailed"
    content: Optional[str] = None
    sources: Optional[List[dict]] = None


class ResearchUpdate(BaseModel):
    topic: Optional[str] = None
    depth: Optional[str] = None
    content: Optional[str] = None
    sources: Optional[List[dict]] = None


class ResearchResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    project_id: str
    topic: str
    depth: str
    content: Optional[str] = None
    sources: Optional[List[dict]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

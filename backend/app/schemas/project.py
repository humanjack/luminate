from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ProjectStatus(str, Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class ProjectCreate(BaseModel):
    name: str


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    current_step: Optional[int] = None
    status: Optional[ProjectStatus] = None


class ProjectResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    name: str
    current_step: int
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def from_orm_with_conversion(cls, obj):
        return cls(
            id=obj.id,
            name=obj.name,
            current_step=obj.current_step,
            status=obj.status.value if hasattr(obj.status, 'value') else obj.status,
            created_at=datetime.fromtimestamp(obj.created_at / 1000) if obj.created_at else None,
            updated_at=datetime.fromtimestamp(obj.updated_at / 1000) if obj.updated_at else None,
        )


class ProjectWithRelations(ProjectResponse):
    research_data: Optional[dict] = None
    content_data: Optional[dict] = None
    slides: List[dict] = []
    scripts: List[dict] = []
    recordings: List[dict] = []
    analysis_results: List[dict] = []
    videos: List[dict] = []

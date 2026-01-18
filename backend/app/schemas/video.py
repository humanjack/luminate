from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class VideoStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class VideoCreate(BaseModel):
    project_id: str
    output_path: Optional[str] = None
    duration: Optional[float] = None
    resolution: str = "1920x1080"
    status: str = "pending"


class VideoUpdate(BaseModel):
    output_path: Optional[str] = None
    duration: Optional[float] = None
    resolution: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    youtube_url: Optional[str] = None
    youtube_video_id: Optional[str] = None
    error_message: Optional[str] = None


class VideoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    project_id: str
    output_path: Optional[str] = None
    duration: Optional[float] = None
    resolution: str
    status: str
    progress: int
    youtube_url: Optional[str] = None
    youtube_video_id: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

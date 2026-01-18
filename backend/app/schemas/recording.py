from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class RecordingCreate(BaseModel):
    project_id: str
    slide_id: Optional[str] = None
    slide_index: Optional[int] = None
    audio_path: str
    duration: Optional[float] = None
    waveform_data: Optional[List[float]] = None


class RecordingResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    project_id: str
    slide_id: Optional[str] = None
    slide_index: Optional[int] = None
    audio_path: str
    duration: Optional[float] = None
    waveform_data: Optional[List[float]] = None
    created_at: Optional[datetime] = None

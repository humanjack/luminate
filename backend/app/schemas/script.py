from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ScriptRequest(BaseModel):
    slide_content: str
    slide_index: int


class ScriptCreate(BaseModel):
    project_id: str
    slide_id: Optional[str] = None
    slide_index: int
    text: str
    speaker_notes: Optional[str] = None
    estimated_duration: Optional[int] = None


class ScriptUpdate(BaseModel):
    slide_id: Optional[str] = None
    slide_index: Optional[int] = None
    text: Optional[str] = None
    speaker_notes: Optional[str] = None
    estimated_duration: Optional[int] = None


class ScriptResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    project_id: str
    slide_id: Optional[str] = None
    slide_index: int
    text: str
    speaker_notes: Optional[str] = None
    estimated_duration: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class AnalysisCreate(BaseModel):
    recording_id: str
    project_id: str
    overall_score: Optional[float] = None
    pronunciation_score: Optional[float] = None
    fluency_score: Optional[float] = None
    confidence_score: Optional[float] = None
    naturalness_score: Optional[float] = None
    words_per_minute: Optional[float] = None
    filler_words: Optional[List[dict]] = None
    segments: Optional[List[dict]] = None
    recommendations: Optional[List[str]] = None


class AnalysisResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    recording_id: str
    project_id: str
    overall_score: Optional[float] = None
    pronunciation_score: Optional[float] = None
    fluency_score: Optional[float] = None
    confidence_score: Optional[float] = None
    naturalness_score: Optional[float] = None
    words_per_minute: Optional[float] = None
    filler_words: Optional[List[dict]] = None
    segments: Optional[List[dict]] = None
    recommendations: Optional[List[str]] = None
    created_at: Optional[datetime] = None

from sqlalchemy import Column, String, Integer, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import json

from app.core.database import Base


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(String, primary_key=True)
    recording_id = Column("recording_id", String, ForeignKey("recordings.id", ondelete="CASCADE"), nullable=False)
    project_id = Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    overall_score = Column("overall_score", Float, nullable=True)
    pronunciation_score = Column("pronunciation_score", Float, nullable=True)
    fluency_score = Column("fluency_score", Float, nullable=True)
    confidence_score = Column("confidence_score", Float, nullable=True)
    naturalness_score = Column("naturalness_score", Float, nullable=True)
    words_per_minute = Column("words_per_minute", Float, nullable=True)
    filler_words = Column("filler_words", Text, nullable=True)  # JSON stored as text
    segments = Column(Text, nullable=True)  # JSON stored as text
    recommendations = Column(Text, nullable=True)  # JSON stored as text
    created_at = Column("created_at", Integer, nullable=False)

    # Relationships
    recording = relationship("Recording", back_populates="analysis_results")
    project = relationship("Project", back_populates="analysis_results")

    def to_dict(self):
        filler_words_data = None
        if self.filler_words:
            try:
                filler_words_data = json.loads(self.filler_words)
            except json.JSONDecodeError:
                filler_words_data = None

        segments_data = None
        if self.segments:
            try:
                segments_data = json.loads(self.segments)
            except json.JSONDecodeError:
                segments_data = None

        recommendations_data = None
        if self.recommendations:
            try:
                recommendations_data = json.loads(self.recommendations)
            except json.JSONDecodeError:
                recommendations_data = None

        return {
            "id": self.id,
            "recordingId": self.recording_id,
            "projectId": self.project_id,
            "overallScore": self.overall_score,
            "pronunciationScore": self.pronunciation_score,
            "fluencyScore": self.fluency_score,
            "confidenceScore": self.confidence_score,
            "naturalnessScore": self.naturalness_score,
            "wordsPerMinute": self.words_per_minute,
            "fillerWords": filler_words_data,
            "segments": segments_data,
            "recommendations": recommendations_data,
            "createdAt": datetime.fromtimestamp(self.created_at / 1000).isoformat() if self.created_at else None,
        }

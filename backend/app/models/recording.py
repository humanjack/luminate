from sqlalchemy import Column, String, Integer, ForeignKey, Text, Float, LargeBinary
from sqlalchemy.orm import relationship
from datetime import datetime
import json

from app.core.database import Base


class Recording(Base):
    __tablename__ = "recordings"

    id = Column(String, primary_key=True)
    project_id = Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    slide_id = Column("slide_id", String, ForeignKey("slides.id", ondelete="CASCADE"), nullable=True)
    slide_index = Column("slide_index", Integer, nullable=True)
    audio_path = Column("audio_path", String, nullable=False)
    audio_data = Column("audio_data", LargeBinary, nullable=True)
    duration = Column(Float, nullable=True)
    waveform_data = Column("waveform_data", Text, nullable=True)  # JSON stored as text
    created_at = Column("created_at", Integer, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="recordings")
    slide = relationship("Slide", back_populates="recordings")
    analysis_results = relationship("AnalysisResult", back_populates="recording", cascade="all, delete-orphan")

    def to_dict(self):
        waveform = None
        if self.waveform_data:
            try:
                waveform = json.loads(self.waveform_data)
            except json.JSONDecodeError:
                waveform = None

        return {
            "id": self.id,
            "projectId": self.project_id,
            "slideId": self.slide_id,
            "slideIndex": self.slide_index,
            "audioPath": self.audio_path,
            "duration": self.duration,
            "waveformData": waveform,
            "createdAt": datetime.fromtimestamp(self.created_at / 1000).isoformat() if self.created_at else None,
        }

from sqlalchemy import Column, String, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class Script(Base):
    __tablename__ = "scripts"

    id = Column(String, primary_key=True)
    project_id = Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    slide_id = Column("slide_id", String, ForeignKey("slides.id", ondelete="CASCADE"), nullable=True)
    slide_index = Column("slide_index", Integer, nullable=False)
    text = Column(Text, nullable=False)
    speaker_notes = Column("speaker_notes", Text, nullable=True)
    estimated_duration = Column("estimated_duration", Integer, nullable=True)
    created_at = Column("created_at", Integer, nullable=False)
    updated_at = Column("updated_at", Integer, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="scripts")
    slide = relationship("Slide", back_populates="scripts")

    def to_dict(self):
        return {
            "id": self.id,
            "projectId": self.project_id,
            "slideId": self.slide_id,
            "slideIndex": self.slide_index,
            "text": self.text,
            "speakerNotes": self.speaker_notes,
            "estimatedDuration": self.estimated_duration,
            "createdAt": datetime.fromtimestamp(self.created_at / 1000).isoformat() if self.created_at else None,
            "updatedAt": datetime.fromtimestamp(self.updated_at / 1000).isoformat() if self.updated_at else None,
        }

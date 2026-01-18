from sqlalchemy import Column, String, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class ProjectStatus(str, enum.Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    current_step = Column("current_step", Integer, nullable=False, default=1)
    status = Column(String, nullable=False, default="draft")
    created_at = Column("created_at", Integer, nullable=False)
    updated_at = Column("updated_at", Integer, nullable=False)

    # Relationships
    research_data = relationship("ResearchData", back_populates="project", uselist=False, cascade="all, delete-orphan")
    content_data = relationship("ContentData", back_populates="project", uselist=False, cascade="all, delete-orphan")
    slides = relationship("Slide", back_populates="project", cascade="all, delete-orphan")
    scripts = relationship("Script", back_populates="project", cascade="all, delete-orphan")
    recordings = relationship("Recording", back_populates="project", cascade="all, delete-orphan")
    analysis_results = relationship("AnalysisResult", back_populates="project", cascade="all, delete-orphan")
    videos = relationship("Video", back_populates="project", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "currentStep": self.current_step,
            "status": self.status or "draft",
            "createdAt": datetime.fromtimestamp(self.created_at / 1000).isoformat() if self.created_at else None,
            "updatedAt": datetime.fromtimestamp(self.updated_at / 1000).isoformat() if self.updated_at else None,
        }

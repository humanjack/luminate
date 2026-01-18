from sqlalchemy import Column, String, Integer, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class VideoStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Video(Base):
    __tablename__ = "videos"

    id = Column(String, primary_key=True)
    project_id = Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    output_path = Column("output_path", String, nullable=True)
    duration = Column(Float, nullable=True)
    resolution = Column(String, default="1920x1080")
    status = Column(String, nullable=False, default="pending")
    progress = Column(Integer, default=0)
    youtube_url = Column("youtube_url", String, nullable=True)
    youtube_video_id = Column("youtube_video_id", String, nullable=True)
    error_message = Column("error_message", Text, nullable=True)
    created_at = Column("created_at", Integer, nullable=False)
    updated_at = Column("updated_at", Integer, nullable=False)

    # Relationship
    project = relationship("Project", back_populates="videos")

    def to_dict(self):
        return {
            "id": self.id,
            "projectId": self.project_id,
            "outputPath": self.output_path,
            "duration": self.duration,
            "resolution": self.resolution,
            "status": self.status,
            "progress": self.progress,
            "youtubeUrl": self.youtube_url,
            "youtubeVideoId": self.youtube_video_id,
            "errorMessage": self.error_message,
            "createdAt": datetime.fromtimestamp(self.created_at / 1000).isoformat() if self.created_at else None,
            "updatedAt": datetime.fromtimestamp(self.updated_at / 1000).isoformat() if self.updated_at else None,
        }

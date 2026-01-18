from sqlalchemy import Column, String, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import json

from app.core.database import Base


class ContentFormat(str, enum.Enum):
    PRESENTATION = "presentation"
    TUTORIAL = "tutorial"
    EXPLAINER = "explainer"


class ContentData(Base):
    __tablename__ = "content_data"

    id = Column(String, primary_key=True)
    project_id = Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=True)
    format = Column(String, nullable=False, default="presentation")
    target_length = Column("target_length", Integer, nullable=False, default=10)
    outline = Column(Text, nullable=True)  # JSON stored as text
    markdown = Column(Text, nullable=True)
    created_at = Column("created_at", Integer, nullable=False)
    updated_at = Column("updated_at", Integer, nullable=False)

    # Relationship
    project = relationship("Project", back_populates="content_data")

    def to_dict(self):
        outline_data = None
        if self.outline:
            try:
                outline_data = json.loads(self.outline)
            except json.JSONDecodeError:
                outline_data = None

        return {
            "id": self.id,
            "projectId": self.project_id,
            "title": self.title,
            "format": self.format,
            "targetLength": self.target_length,
            "outline": outline_data,
            "markdown": self.markdown,
            "createdAt": datetime.fromtimestamp(self.created_at / 1000).isoformat() if self.created_at else None,
            "updatedAt": datetime.fromtimestamp(self.updated_at / 1000).isoformat() if self.updated_at else None,
        }

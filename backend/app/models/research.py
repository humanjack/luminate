from sqlalchemy import Column, String, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import json

from app.core.database import Base


class ResearchDepth(str, enum.Enum):
    QUICK = "quick"
    DETAILED = "detailed"
    COMPREHENSIVE = "comprehensive"


class ResearchData(Base):
    __tablename__ = "research_data"

    id = Column(String, primary_key=True)
    project_id = Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    topic = Column(String, nullable=False)
    depth = Column(String, nullable=False, default="detailed")
    content = Column(Text, nullable=True)
    sources = Column(Text, nullable=True)  # JSON stored as text
    created_at = Column("created_at", Integer, nullable=False)
    updated_at = Column("updated_at", Integer, nullable=False)

    # Relationship
    project = relationship("Project", back_populates="research_data")

    def to_dict(self):
        sources_data = None
        if self.sources:
            try:
                sources_data = json.loads(self.sources)
            except json.JSONDecodeError:
                sources_data = None

        return {
            "id": self.id,
            "projectId": self.project_id,
            "topic": self.topic,
            "depth": self.depth,
            "content": self.content,
            "sources": sources_data,
            "createdAt": datetime.fromtimestamp(self.created_at / 1000).isoformat() if self.created_at else None,
            "updatedAt": datetime.fromtimestamp(self.updated_at / 1000).isoformat() if self.updated_at else None,
        }

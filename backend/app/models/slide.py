from sqlalchemy import Column, String, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class Slide(Base):
    __tablename__ = "slides"

    id = Column(String, primary_key=True)
    project_id = Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    index = Column(Integer, nullable=False)
    markdown = Column(Text, nullable=False)
    image_data = Column("image_data", Text, nullable=True)
    theme = Column(String, default="default")
    created_at = Column("created_at", Integer, nullable=False)
    updated_at = Column("updated_at", Integer, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="slides")
    scripts = relationship("Script", back_populates="slide", cascade="all, delete-orphan")
    recordings = relationship("Recording", back_populates="slide", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "projectId": self.project_id,
            "index": self.index,
            "markdown": self.markdown,
            "imageData": self.image_data,
            "theme": self.theme,
            "createdAt": datetime.fromtimestamp(self.created_at / 1000).isoformat() if self.created_at else None,
            "updatedAt": datetime.fromtimestamp(self.updated_at / 1000).isoformat() if self.updated_at else None,
        }

from sqlalchemy import Column, String, Integer, Text
from datetime import datetime

from app.core.database import Base


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)
    updated_at = Column("updated_at", Integer, nullable=False)

    def to_dict(self):
        return {
            "key": self.key,
            "value": self.value,
            "updatedAt": datetime.fromtimestamp(self.updated_at / 1000).isoformat() if self.updated_at else None,
        }

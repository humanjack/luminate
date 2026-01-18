from pydantic import BaseModel
from typing import Dict, Any


class SettingUpdate(BaseModel):
    settings: Dict[str, Any]


class SettingsResponse(BaseModel):
    settings: Dict[str, Any]

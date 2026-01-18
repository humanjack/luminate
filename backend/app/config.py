from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # Database
    database_url: str = f"sqlite:///{os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))}/luminate.db"

    # Application
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    # CORS
    cors_origins: List[str] = ["http://localhost:3000"]


settings = Settings()

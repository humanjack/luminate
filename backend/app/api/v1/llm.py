"""LLM streaming API routes with multi-provider support."""

import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.models import Setting
from app.llm.llm_client import get_llm_client, DEFAULT_MODELS

router = APIRouter()


class ResearchRequest(BaseModel):
    topic: str
    depth: str = "detailed"


class ContentRequest(BaseModel):
    research: str
    format: str = "presentation"
    target_length: int = 10


class ScriptRequest(BaseModel):
    slide_content: str
    slide_index: int


def get_settings_dict(db: Session) -> dict:
    """Get all settings as a dictionary."""
    settings = db.query(Setting).all()
    return {s.key: s.value for s in settings}


def get_provider_config(settings: dict) -> tuple[str, str, str]:
    """Extract provider, API key, and model from settings.

    Returns:
        Tuple of (provider, api_key, model)
    """
    provider = settings.get("llmProvider", "anthropic")

    # Map provider to API key setting name
    api_key_map = {
        "anthropic": "anthropicApiKey",
        "openai": "openaiApiKey",
        "google": "googleApiKey",
    }

    # Map provider to model setting name
    model_map = {
        "anthropic": "claudeModel",
        "openai": "openaiModel",
        "google": "googleModel",
    }

    api_key = settings.get(api_key_map.get(provider, ""), "")
    model = settings.get(model_map.get(provider, ""), "") or DEFAULT_MODELS.get(provider, "")

    return provider, api_key, model


@router.post("/research")
async def stream_research(request: ResearchRequest, db: Session = Depends(get_db)):
    """Stream research generation via SSE."""
    settings = get_settings_dict(db)
    provider, api_key, model = get_provider_config(settings)

    if not api_key:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'content': f'{provider.title()} API key not configured'})}\n\n"
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )

    llm = get_llm_client(provider=provider, api_key=api_key, model=model)

    async def generate():
        try:
            async for message in llm.stream_research(request.topic, request.depth):
                yield f"data: {json.dumps(message)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/content")
async def stream_content(request: ContentRequest, db: Session = Depends(get_db)):
    """Stream content/slide generation via SSE."""
    settings = get_settings_dict(db)
    provider, api_key, model = get_provider_config(settings)

    if not api_key:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'content': f'{provider.title()} API key not configured'})}\n\n"
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )

    llm = get_llm_client(provider=provider, api_key=api_key, model=model)

    async def generate():
        try:
            async for message in llm.stream_content(
                request.research, request.format, request.target_length
            ):
                yield f"data: {json.dumps(message)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/script")
async def stream_script(request: ScriptRequest, db: Session = Depends(get_db)):
    """Stream script generation via SSE."""
    settings = get_settings_dict(db)
    provider, api_key, model = get_provider_config(settings)

    if not api_key:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'content': f'{provider.title()} API key not configured'})}\n\n"
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )

    llm = get_llm_client(provider=provider, api_key=api_key, model=model)

    async def generate():
        try:
            async for message in llm.stream_script(
                request.slide_content, request.slide_index
            ):
                yield f"data: {json.dumps(message)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

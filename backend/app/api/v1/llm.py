"""LLM streaming API routes."""

import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.models import Setting
from app.llm.anthropic_client import AnthropicLLM

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


async def stream_generator(llm: AnthropicLLM, stream_func):
    """Generic async generator for streaming LLM responses."""
    async for message in stream_func:
        yield f"data: {json.dumps(message)}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/research")
async def stream_research(request: ResearchRequest, db: Session = Depends(get_db)):
    """Stream research generation via SSE."""
    settings = get_settings_dict(db)
    provider = settings.get("llmProvider", "anthropic")

    if provider != "anthropic":
        # For now, only support Anthropic API in Python backend
        # Claude CLI support would need subprocess handling
        raise HTTPException(
            status_code=400,
            detail="Only Anthropic API provider is supported in Python backend"
        )

    api_key = settings.get("anthropicApiKey")
    model = settings.get("claudeModel", "claude-sonnet-4-5-20250514")

    if not api_key:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'content': 'Anthropic API key not configured'})}\n\n"
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )

    llm = AnthropicLLM(api_key=api_key, model=model)

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
    provider = settings.get("llmProvider", "anthropic")

    if provider != "anthropic":
        raise HTTPException(
            status_code=400,
            detail="Only Anthropic API provider is supported in Python backend"
        )

    api_key = settings.get("anthropicApiKey")
    model = settings.get("claudeModel", "claude-sonnet-4-5-20250514")

    if not api_key:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'content': 'Anthropic API key not configured'})}\n\n"
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )

    llm = AnthropicLLM(api_key=api_key, model=model)

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
    provider = settings.get("llmProvider", "anthropic")

    if provider != "anthropic":
        raise HTTPException(
            status_code=400,
            detail="Only Anthropic API provider is supported in Python backend"
        )

    api_key = settings.get("anthropicApiKey")
    model = settings.get("claudeModel", "claude-sonnet-4-5-20250514")

    if not api_key:
        async def error_stream():
            yield f"data: {json.dumps({'type': 'error', 'content': 'Anthropic API key not configured'})}\n\n"
        return StreamingResponse(
            error_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )

    llm = AnthropicLLM(api_key=api_key, model=model)

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

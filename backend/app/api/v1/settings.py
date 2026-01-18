"""Settings API routes."""

import json
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
from pydantic import BaseModel
import httpx

from app.core.database import get_db
from app.models import Setting

router = APIRouter()


class SettingsUpdate(BaseModel):
    settings: Dict[str, Any]


@router.get("")
async def get_settings(db: Session = Depends(get_db)):
    """Get all settings."""
    all_settings = db.query(Setting).all()

    settings_dict = {}
    for setting in all_settings:
        try:
            settings_dict[setting.key] = json.loads(setting.value) if setting.value else None
        except json.JSONDecodeError:
            settings_dict[setting.key] = setting.value

    return settings_dict


@router.post("")
async def save_settings(body: Dict[str, Any], db: Session = Depends(get_db)):
    """Save settings."""
    now = int(time.time() * 1000)

    for key, value in body.items():
        string_value = value if isinstance(value, str) else json.dumps(value)

        existing = db.query(Setting).filter(Setting.key == key).first()
        if existing:
            existing.value = string_value
            existing.updated_at = now
        else:
            new_setting = Setting(key=key, value=string_value, updated_at=now)
            db.add(new_setting)

    db.commit()
    return {"success": True}


@router.post("/verify/anthropic")
async def verify_anthropic(db: Session = Depends(get_db)):
    """Verify Anthropic API key."""
    api_key_setting = db.query(Setting).filter(Setting.key == "anthropicApiKey").first()

    if not api_key_setting or not api_key_setting.value:
        raise HTTPException(status_code=400, detail="Anthropic API key not configured")

    api_key = api_key_setting.value

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-5-20250514",
                    "max_tokens": 10,
                    "messages": [{"role": "user", "content": "Hi"}],
                },
                timeout=30.0,
            )

            if response.status_code == 200:
                return {"valid": True, "message": "API key is valid"}
            elif response.status_code == 401:
                return {"valid": False, "message": "Invalid API key"}
            else:
                return {
                    "valid": False,
                    "message": f"API error: {response.status_code}",
                }

    except Exception as e:
        return {"valid": False, "message": f"Connection error: {str(e)}"}


@router.post("/verify/claude-cli")
async def verify_claude_cli():
    """Verify Claude CLI availability."""
    import shutil
    import subprocess

    claude_path = shutil.which("claude")
    if not claude_path:
        return {"available": False, "error": "Claude CLI not found in PATH"}

    try:
        result = subprocess.run(
            ["claude", "--version"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            return {"available": True, "version": result.stdout.strip()}
        else:
            return {"available": False, "error": result.stderr.strip()}
    except subprocess.TimeoutExpired:
        return {"available": False, "error": "Claude CLI timed out"}
    except Exception as e:
        return {"available": False, "error": str(e)}


@router.post("/verify/openai")
async def verify_openai(db: Session = Depends(get_db)):
    """Verify OpenAI API key."""
    api_key_setting = db.query(Setting).filter(Setting.key == "openaiApiKey").first()

    if not api_key_setting or not api_key_setting.value:
        raise HTTPException(status_code=400, detail="OpenAI API key not configured")

    api_key = api_key_setting.value

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.openai.com/v1/models",
                headers={
                    "Authorization": f"Bearer {api_key}",
                },
                timeout=30.0,
            )

            if response.status_code == 200:
                return {"valid": True, "message": "API key is valid"}
            elif response.status_code == 401:
                return {"valid": False, "message": "Invalid API key"}
            else:
                return {
                    "valid": False,
                    "message": f"API error: {response.status_code}",
                }

    except Exception as e:
        return {"valid": False, "message": f"Connection error: {str(e)}"}


@router.post("/verify/google")
async def verify_google(db: Session = Depends(get_db)):
    """Verify Google Gemini API key."""
    api_key_setting = db.query(Setting).filter(Setting.key == "googleApiKey").first()

    if not api_key_setting or not api_key_setting.value:
        raise HTTPException(status_code=400, detail="Google API key not configured")

    api_key = api_key_setting.value

    try:
        async with httpx.AsyncClient() as client:
            # Test with a simple model list request
            response = await client.get(
                f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
                timeout=30.0,
            )

            if response.status_code == 200:
                return {"valid": True, "message": "API key is valid"}
            elif response.status_code == 400:
                data = response.json()
                if "error" in data:
                    return {"valid": False, "message": data["error"].get("message", "Invalid API key")}
                return {"valid": False, "message": "Invalid API key"}
            else:
                return {
                    "valid": False,
                    "message": f"API error: {response.status_code}",
                }

    except Exception as e:
        return {"valid": False, "message": f"Connection error: {str(e)}"}


@router.post("/verify/speechsuper")
async def verify_speechsuper(db: Session = Depends(get_db)):
    """Verify SpeechSuper API credentials."""
    app_key = db.query(Setting).filter(Setting.key == "speechSuperAppKey").first()
    secret_key = db.query(Setting).filter(Setting.key == "speechSuperSecretKey").first()

    if not app_key or not app_key.value:
        return {"valid": False, "message": "SpeechSuper App Key not configured"}
    if not secret_key or not secret_key.value:
        return {"valid": False, "message": "SpeechSuper Secret Key not configured"}

    # Note: Full verification would require a test API call
    # For now, just verify the keys are set
    return {"valid": True, "message": "Credentials configured (not verified)"}


@router.post("/verify/elsa")
async def verify_elsa(db: Session = Depends(get_db)):
    """Verify ELSA API credentials."""
    api_key = db.query(Setting).filter(Setting.key == "elsaApiKey").first()

    if not api_key or not api_key.value:
        return {"valid": False, "message": "ELSA API key not configured"}

    # Note: Full verification would require a test API call
    # For now, just verify the key is set
    return {"valid": True, "message": "API key configured (not verified)"}

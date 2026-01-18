"""LLM provider tests."""

import pytest
from app.llm.llm_client import UnifiedLLMClient, get_llm_client, DEFAULT_MODELS


def test_default_models():
    """Test that default models are defined for all providers."""
    assert "anthropic" in DEFAULT_MODELS
    assert "openai" in DEFAULT_MODELS
    assert "google" in DEFAULT_MODELS
    assert DEFAULT_MODELS["anthropic"] == "claude-sonnet-4-5-20250514"
    assert DEFAULT_MODELS["openai"] == "gpt-4.1"
    assert DEFAULT_MODELS["google"] == "gemini-2.5-flash"


def test_llm_client_creation_anthropic():
    """Test creating an Anthropic LLM client."""
    client = get_llm_client(provider="anthropic", api_key="test-key")
    assert isinstance(client, UnifiedLLMClient)
    assert client.provider == "anthropic"
    assert client.api_key == "test-key"
    assert client.model == DEFAULT_MODELS["anthropic"]


def test_llm_client_creation_openai():
    """Test creating an OpenAI LLM client."""
    client = get_llm_client(provider="openai", api_key="test-key")
    assert isinstance(client, UnifiedLLMClient)
    assert client.provider == "openai"
    assert client.api_key == "test-key"
    assert client.model == DEFAULT_MODELS["openai"]


def test_llm_client_creation_google():
    """Test creating a Google LLM client."""
    client = get_llm_client(provider="google", api_key="test-key")
    assert isinstance(client, UnifiedLLMClient)
    assert client.provider == "google"
    assert client.api_key == "test-key"
    assert client.model == DEFAULT_MODELS["google"]


def test_llm_client_custom_model():
    """Test creating a client with a custom model."""
    client = get_llm_client(
        provider="anthropic",
        api_key="test-key",
        model="claude-opus-4-20241022"
    )
    assert client.model == "claude-opus-4-20241022"


def test_llm_client_default_provider():
    """Test that default provider is anthropic."""
    client = get_llm_client(api_key="test-key")
    assert client.provider == "anthropic"
    assert client.model == DEFAULT_MODELS["anthropic"]

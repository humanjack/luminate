"""Unified LLM client supporting multiple providers with streaming."""

from typing import AsyncGenerator, Literal
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from app.llm.prompts import (
    RESEARCH_SYSTEM_PROMPT,
    CONTENT_SYSTEM_PROMPT,
    SCRIPT_SYSTEM_PROMPT,
    get_research_prompt,
    get_content_prompt,
    get_script_prompt,
)


# Default models for each provider (updated January 2026)
DEFAULT_MODELS = {
    "anthropic": "claude-sonnet-4-5-20250514",
    "openai": "gpt-4.1",
    "google": "gemini-2.5-flash",
}


LLMProvider = Literal["anthropic", "openai", "google"]


class UnifiedLLMClient:
    """Unified LLM client supporting Anthropic, OpenAI, and Google Gemini."""

    def __init__(
        self,
        provider: LLMProvider = "anthropic",
        api_key: str = "",
        model: str = "",
    ):
        self.provider = provider
        self.api_key = api_key
        self.model = model or DEFAULT_MODELS.get(provider, "")
        self._client = None

    @property
    def client(self):
        """Lazy initialization of the appropriate LangChain client."""
        if self._client is None:
            if self.provider == "anthropic":
                self._client = ChatAnthropic(
                    api_key=self.api_key,
                    model=self.model,
                    streaming=True,
                )
            elif self.provider == "openai":
                self._client = ChatOpenAI(
                    api_key=self.api_key,
                    model=self.model,
                    streaming=True,
                )
            elif self.provider == "google":
                self._client = ChatGoogleGenerativeAI(
                    google_api_key=self.api_key,
                    model=self.model,
                    streaming=True,
                )
            else:
                raise ValueError(f"Unsupported provider: {self.provider}")

        return self._client

    async def stream_research(
        self, topic: str, depth: str = "detailed"
    ) -> AsyncGenerator[dict, None]:
        """Stream research content generation.

        Yields:
            dict with type ("text", "done", "error") and content
        """
        try:
            messages = [
                SystemMessage(content=RESEARCH_SYSTEM_PROMPT),
                HumanMessage(content=get_research_prompt(topic, depth)),
            ]

            async for chunk in self.client.astream(messages):
                if chunk.content:
                    yield {"type": "text", "content": chunk.content}

            yield {"type": "done", "content": ""}

        except Exception as e:
            yield {"type": "error", "content": str(e)}

    async def stream_content(
        self, research: str, format: str = "presentation", target_length: int = 10
    ) -> AsyncGenerator[dict, None]:
        """Stream slide content generation.

        Yields:
            dict with type ("text", "done", "error") and content
        """
        try:
            messages = [
                SystemMessage(content=CONTENT_SYSTEM_PROMPT),
                HumanMessage(content=get_content_prompt(research, format, target_length)),
            ]

            async for chunk in self.client.astream(messages):
                if chunk.content:
                    yield {"type": "text", "content": chunk.content}

            yield {"type": "done", "content": ""}

        except Exception as e:
            yield {"type": "error", "content": str(e)}

    async def stream_script(
        self, slide_content: str, slide_index: int
    ) -> AsyncGenerator[dict, None]:
        """Stream script generation for a slide.

        Yields:
            dict with type ("text", "done", "error") and content
        """
        try:
            messages = [
                SystemMessage(content=SCRIPT_SYSTEM_PROMPT),
                HumanMessage(content=get_script_prompt(slide_content, slide_index)),
            ]

            async for chunk in self.client.astream(messages):
                if chunk.content:
                    yield {"type": "text", "content": chunk.content}

            yield {"type": "done", "content": ""}

        except Exception as e:
            yield {"type": "error", "content": str(e)}


def get_llm_client(
    provider: LLMProvider = "anthropic",
    api_key: str = "",
    model: str = "",
) -> UnifiedLLMClient:
    """Factory function to get a unified LLM client.

    Args:
        provider: LLM provider ("anthropic", "openai", or "google")
        api_key: API key for the provider
        model: Model name (uses default if not specified)

    Returns:
        UnifiedLLMClient instance
    """
    return UnifiedLLMClient(provider=provider, api_key=api_key, model=model)

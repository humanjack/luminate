"""Anthropic LLM client using LangChain for streaming responses."""

from typing import AsyncGenerator
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

from app.llm.prompts import (
    RESEARCH_SYSTEM_PROMPT,
    CONTENT_SYSTEM_PROMPT,
    SCRIPT_SYSTEM_PROMPT,
    get_research_prompt,
    get_content_prompt,
    get_script_prompt,
)


class AnthropicLLM:
    """LangChain-based Anthropic LLM client with streaming support."""

    def __init__(self, api_key: str, model: str = "claude-sonnet-4-5-20250514"):
        self.api_key = api_key
        self.model = model
        self._client = None

    @property
    def client(self) -> ChatAnthropic:
        """Lazy initialization of the LangChain ChatAnthropic client."""
        if self._client is None:
            self._client = ChatAnthropic(
                api_key=self.api_key,
                model=self.model,
                streaming=True,
            )
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


async def get_llm_client(api_key: str, model: str = "claude-sonnet-4-5-20250514") -> AnthropicLLM:
    """Factory function to get an AnthropicLLM client."""
    return AnthropicLLM(api_key=api_key, model=model)

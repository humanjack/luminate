# LLM Models Reference

*Updated: January 2026*

## Supported Providers

The Luminate backend supports three LLM providers through LangChain. Configure your provider and model via the `/api/settings` endpoint.

---

## Anthropic (Claude)

**Provider ID**: `anthropic`
**API Key Setting**: `anthropicApiKey`
**Model Setting**: `claudeModel`

### Available Models

| Model ID | Name | Context | Best For |
|----------|------|---------|----------|
| `claude-opus-4-5-20251101` | Claude Opus 4.5 | 200K+ | Most intelligent, complex tasks |
| `claude-sonnet-4-5-20250514` | Claude Sonnet 4.5 | 200K | **DEFAULT** - Best balance of speed/quality |
| `claude-haiku-4-5-20251101` | Claude Haiku 4.5 | 200K | Fastest responses, cost-effective |
| `claude-3-7-sonnet-20250224` | Claude 3.7 Sonnet | 200K | Hybrid reasoning model |

**API Key**: Get from [Anthropic Console](https://console.anthropic.com)

**Note**: Claude 3.x models (Opus, Sonnet, Haiku from 2024) have been deprecated.

---

## OpenAI (GPT)

**Provider ID**: `openai`
**API Key Setting**: `openaiApiKey`
**Model Setting**: `openaiModel`

### Available Models

| Model ID | Name | Context | Best For |
|----------|------|---------|----------|
| `gpt-5.2` | GPT-5.2 | 196K | Latest flagship model |
| `gpt-4.1` | GPT-4.1 | 128K | **DEFAULT** - Smartest non-reasoning model |
| `gpt-4.1-mini` | GPT-4.1 Mini | 128K | Cost-effective, fast |
| `gpt-4.1-nano` | GPT-4.1 Nano | 128K | Lightweight, efficient |
| `o3` | O3 | 128K | Most powerful reasoning model |
| `o4-mini` | O4 Mini | 128K | Fast, cost-efficient reasoning |
| `gpt-4o` | GPT-4o (Legacy) | 128K | Previous generation multimodal |

**API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)

**Note**: o1-preview and o1-mini have been deprecated. GPT-4o is now a legacy model.

---

## Google (Gemini)

**Provider ID**: `google`
**API Key Setting**: `googleApiKey`
**Model Setting**: `googleModel`

### Available Models

| Model ID | Name | Context | Best For |
|----------|------|---------|----------|
| `gemini-3-pro-preview` | Gemini 3 Pro | 1M | Latest reasoning-first model |
| `gemini-3-flash-preview` | Gemini 3 Flash | 1M | Fast Gemini 3 variant |
| `gemini-2.5-flash` | Gemini 2.5 Flash | 1M | **DEFAULT** - Fast, recommended |
| `gemini-2.5-pro` | Gemini 2.5 Pro | 1M | Quality-focused |
| `gemini-2.5-flash-lite` | Gemini 2.5 Flash Lite | 1M | Most cost-efficient |
| `gemini-2.0-flash` | Gemini 2.0 Flash (Legacy) | 1M | Previous generation |

**API Key**: Get from [Google AI Studio](https://aistudio.google.com/apikey)

**Note**: Gemini 2.0 models will be retired on March 3, 2026. Gemini 1.x models are already retired.

---

## Configuration Example

### Via API (`POST /api/settings`)

```json
{
  "llmProvider": "anthropic",
  "anthropicApiKey": "sk-ant-...",
  "claudeModel": "claude-sonnet-4-5-20250514"
}
```

### Via Environment Variables (`.env`)

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-5-20250514
```

---

## Switching Providers

1. Set your API key for the desired provider
2. Update `llmProvider` to `anthropic`, `openai`, or `google`
3. Optionally specify a model (defaults shown above)
4. Verify your API key via `/api/settings/verify/{provider}`

All LLM endpoints (`/api/llm/research`, `/api/llm/content`, `/api/llm/script`) automatically use the configured provider.

---

## Default Models

If no model is specified, these defaults are used:

- **Anthropic**: `claude-sonnet-4-5-20250514`
- **OpenAI**: `gpt-4.1`
- **Google**: `gemini-2.5-flash`

These models provide the best balance of speed, quality, and cost for video content generation.

---

## Model Deprecation Notes

### Anthropic
- Claude 3 Opus (2024) deprecated June 2025, retired January 2026
- Claude 3 Sonnet and Claude 2.1 retired July 2025

### OpenAI
- o1-preview and o1-mini deprecated
- GPT-4o replaced by GPT-4.1 in API

### Google
- All Gemini 1.x models retired
- Gemini 2.0 models retiring March 3, 2026

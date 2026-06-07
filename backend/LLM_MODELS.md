# LLM Models Reference

*Updated: June 2026*

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
| `claude-opus-4-8` | Claude Opus 4.8 | 1M | Most intelligent, long-horizon agentic & complex tasks |
| `claude-opus-4-7` | Claude Opus 4.7 | 1M | Previous-generation Opus |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 | 1M | **DEFAULT** - Best balance of speed/quality |
| `claude-haiku-4-5` | Claude Haiku 4.5 | 200K | Fastest responses, cost-effective |

**API Key**: Get from [Anthropic Console](https://console.anthropic.com)

**Note**: Use bare model aliases (no date suffix). Claude 3.x and 4.5 models have been deprecated or retired.

---

## OpenAI (GPT)

**Provider ID**: `openai`
**API Key Setting**: `openaiApiKey`
**Model Setting**: `openaiModel`

### Available Models

| Model ID | Name | Context | Best For |
|----------|------|---------|----------|
| `gpt-5.5` | GPT-5.5 | 256K | **DEFAULT** - Latest flagship model |
| `gpt-5.2` | GPT-5.2 | 256K | Previous flagship model |
| `gpt-4.1` | GPT-4.1 | 128K | Smartest non-reasoning legacy model |
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
| `gemini-3-pro-preview` | Gemini 3 Pro | 1M | **DEFAULT** - Latest reasoning-first model |
| `gemini-3-flash-preview` | Gemini 3 Flash | 1M | Fast Gemini 3 variant |
| `gemini-2.5-flash` | Gemini 2.5 Flash | 1M | Fast, cost-effective legacy model |
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
  "llmProvider": "openai",
  "openaiApiKey": "sk-...",
  "openaiModel": "gpt-5.5"
}
```

### Via Environment Variables (`.env`)

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.5
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

- **Anthropic**: `claude-sonnet-4-6`
- **OpenAI**: `gpt-5.5`
- **Google**: `gemini-3-pro-preview`

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

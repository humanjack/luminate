# Multi-Provider LLM Support

The Luminate backend now supports **three LLM providers** with seamless switching between them.

## ✅ What's New

### Supported Providers

1. **Anthropic (Claude)** - Original provider
   - Default model: `claude-sonnet-4-5-20250514`
   - Best for: High-quality content generation

2. **OpenAI (GPT)** - NEW
   - Default model: `gpt-4o`
   - Best for: Fast, multimodal responses

3. **Google (Gemini)** - NEW
   - Default model: `gemini-2.0-flash-exp`
   - Best for: Large context windows (up to 2M tokens)

### Files Added/Modified

**New Files:**
- `/backend/app/llm/llm_client.py` - Unified LLM client
- `/backend/tests/test_llm.py` - Provider tests (6 tests)
- `/backend/LLM_MODELS.md` - Model reference guide
- `/backend/MULTI_PROVIDER.md` - This file

**Modified Files:**
- `/backend/requirements.txt` - Added `langchain-openai`, `langchain-google-genai`
- `/backend/pyproject.toml` - Added provider dependencies
- `/backend/app/llm/__init__.py` - Exported new client
- `/backend/app/api/v1/llm.py` - Refactored to support all providers
- `/backend/app/api/v1/settings.py` - Added verification endpoints
- `/backend/.env.example` - Added provider configurations
- `/backend/README.md` - Documented multi-provider support
- `/CLAUDE.md` - Updated with provider info

## 🚀 Usage

### 1. Configure Provider via API

```bash
POST /api/settings
{
  "llmProvider": "openai",
  "openaiApiKey": "sk-...",
  "openaiModel": "gpt-4o"
}
```

### 2. Verify API Key

```bash
POST /api/settings/verify/openai
# Returns: {"valid": true, "message": "API key is valid"}
```

### 3. Use LLM Endpoints

All endpoints automatically use the configured provider:

```bash
POST /api/llm/research
{
  "topic": "Climate change",
  "depth": "detailed"
}
# Streams response using configured provider (OpenAI in this example)
```

## 📊 Default Models

| Provider | Default Model | Context | Speed |
|----------|--------------|---------|-------|
| Anthropic | `claude-sonnet-4-5-20250514` | 200K | Medium |
| OpenAI | `gpt-4o` | 128K | Fast |
| Google | `gemini-2.0-flash-exp` | 1M | Very Fast |

See `/backend/LLM_MODELS.md` for complete model lists.

## 🧪 Testing

```bash
# Run all tests (16 total)
make backend-test

# API tests: 10 passed
# LLM tests: 6 passed
```

## 🔄 Switching Providers

Providers can be switched at any time without code changes:

1. Set API key for new provider
2. Update `llmProvider` setting
3. All LLM endpoints automatically use new provider

No restart required - changes take effect immediately!

## 📝 Configuration Options

### Settings Keys

| Key | Description | Example |
|-----|-------------|---------|
| `llmProvider` | Active provider | `"anthropic"`, `"openai"`, `"google"` |
| `anthropicApiKey` | Anthropic API key | `"sk-ant-..."` |
| `claudeModel` | Claude model name | `"claude-sonnet-4-5-20250514"` |
| `openaiApiKey` | OpenAI API key | `"sk-..."` |
| `openaiModel` | OpenAI model name | `"gpt-4o"` |
| `googleApiKey` | Google API key | `"AIza..."` |
| `googleModel` | Gemini model name | `"gemini-2.0-flash-exp"` |

### Environment Variables

```bash
# .env file
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

## 🔐 API Key Sources

- **Anthropic**: https://console.anthropic.com
- **OpenAI**: https://platform.openai.com/api-keys
- **Google**: https://aistudio.google.com/apikey

## 💡 Implementation Details

The `UnifiedLLMClient` class provides a single interface for all providers:

```python
from app.llm.llm_client import get_llm_client

# Works with any provider
llm = get_llm_client(
    provider="anthropic",  # or "openai" or "google"
    api_key=api_key,
    model=model
)

# Same streaming interface
async for chunk in llm.stream_research(topic, depth):
    yield chunk
```

All providers return the same message format: `{"type": "text|done|error", "content": "..."}`

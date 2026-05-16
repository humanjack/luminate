# Luminate Backend (frozen / legacy)

> **⚠️ Frozen as of issue #7.** Next.js is the canonical MVP API runtime — see
> [`../docs/runtime-boundary.md`](../docs/runtime-boundary.md). This directory
> is kept for reference (multi-provider LLM streaming sketches, alternate
> SQLAlchemy schema) and is not in scope for MVP issues.

Python backend for Luminate YouTube video automation, built with FastAPI and LangChain.

## Setup

1. Install Poetry if not already installed:
```bash
curl -sSL https://install.python-poetry.org | python3 -
```

2. Install dependencies:
```bash
cd backend
poetry install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Run the development server:
```bash
poetry run python -m app.main
```

Or using uvicorn directly:
```bash
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create a new project
- `GET /api/projects/{id}` - Get project with all related data
- `PATCH /api/projects/{id}` - Update a project
- `DELETE /api/projects/{id}` - Delete a project

### Research, Content, Slides, Scripts, Recordings, Analysis, Video
Each project has nested resources:
- `/api/projects/{id}/research`
- `/api/projects/{id}/content`
- `/api/projects/{id}/slides`
- `/api/projects/{id}/scripts`
- `/api/projects/{id}/recordings`
- `/api/projects/{id}/analysis`
- `/api/projects/{id}/video`

### LLM (Streaming)
- `POST /api/llm/research` - Stream research generation
- `POST /api/llm/content` - Stream content/slide generation
- `POST /api/llm/script` - Stream script generation

### Settings
- `GET /api/settings` - Get all settings
- `POST /api/settings` - Save settings
- `POST /api/settings/verify/anthropic` - Verify Anthropic API key
- `POST /api/settings/verify/openai` - Verify OpenAI API key
- `POST /api/settings/verify/google` - Verify Google Gemini API key
- `POST /api/settings/verify/claude-cli` - Verify Claude CLI

### Database
- `POST /api/init` - Initialize the database

## Database Migrations

Using Alembic for database migrations:

```bash
# Generate a new migration
poetry run alembic revision --autogenerate -m "description"

# Run migrations
poetry run alembic upgrade head

# Rollback one migration
poetry run alembic downgrade -1
```

## Testing

```bash
poetry run pytest
```

## LLM Provider Support

The backend supports multiple LLM providers through LangChain:

### Anthropic (Claude)
- **Default Model**: `claude-sonnet-4-5-20250514`
- **Other Models**: `claude-sonnet-4-20241022`, `claude-opus-4-20241022`, etc.
- **API Key**: Anthropic Console (https://console.anthropic.com)

### OpenAI (GPT)
- **Default Model**: `gpt-4o`
- **Other Models**: `gpt-4-turbo`, `gpt-4`, `gpt-3.5-turbo`, etc.
- **API Key**: OpenAI Platform (https://platform.openai.com)

### Google (Gemini)
- **Default Model**: `gemini-2.0-flash-exp`
- **Other Models**: `gemini-1.5-pro`, `gemini-1.5-flash`, etc.
- **API Key**: Google AI Studio (https://aistudio.google.com/apikey)

### Configuration

Configure via `/api/settings` endpoint or `.env` file:

```python
{
  "llmProvider": "anthropic",  # or "openai" or "google"
  "anthropicApiKey": "sk-ant-...",
  "claudeModel": "claude-sonnet-4-5-20250514",
  "openaiApiKey": "sk-...",
  "openaiModel": "gpt-4o",
  "googleApiKey": "AIza...",
  "googleModel": "gemini-2.0-flash-exp"
}
```

## Architecture

- **FastAPI** - Web framework
- **SQLAlchemy** - ORM
- **Alembic** - Database migrations
- **LangChain** - Unified LLM integration (Anthropic/OpenAI/Google)
- **Pydantic** - Data validation
- **SSE-Starlette** - Server-Sent Events for streaming

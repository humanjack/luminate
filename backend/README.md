# Luminate Backend

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

## Architecture

- **FastAPI** - Web framework
- **SQLAlchemy** - ORM
- **Alembic** - Database migrations
- **LangChain** - LLM integration with Anthropic Claude
- **Pydantic** - Data validation
- **SSE-Starlette** - Server-Sent Events for streaming

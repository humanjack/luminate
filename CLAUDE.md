# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Luminate is a YouTube video automation application with a 7-step workflow: Research → Content → Slides → Script → Recording → Analysis → Video.

**Frontend**: Next.js 15 with React 19, SQLite/Drizzle for persistence, and Zustand for client state.

**Backend** (optional): Python FastAPI backend with LangChain, SQLAlchemy, and streaming LLM support. Can run standalone or alongside Next.js API routes.

## Commands

### Frontend (Next.js)

```bash
# Development
npm run dev              # Start dev server with Turbopack
make dev                 # Alternative via Makefile

# Build & Production
npm run build            # Production build
npm run start            # Start production server
make build               # Build via Makefile
make start               # Start via Makefile

# Database (Drizzle)
npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Run migrations
npm run db:studio        # Launch Drizzle Studio GUI
make db-generate
make migrate

# Linting & Testing
npm run lint             # Run ESLint
make lint
make test                # Run frontend tests
```

### Backend (Python/FastAPI)

```bash
# Setup
make backend-install     # Install Python dependencies (creates .venv)

# Development
make backend-dev         # Start FastAPI server (port 8000)

# Database (Alembic)
make backend-migrate     # Run Alembic migrations
make backend-migrate-generate  # Generate new migration

# Testing
make backend-test        # Run pytest tests

# Cleanup
make backend-clean       # Remove .venv and build artifacts
```

**First-time setup**:
- Frontend: Call `POST /api/init` to initialize the database
- Backend: Run `make backend-install` then `make backend-migrate`

## Architecture

### Workflow Pipeline

The app enforces a linear 7-step workflow managed by `useWorkflowStore`. Users must complete each step before proceeding:

1. **Research** - LLM generates markdown research with citations
2. **Content** - LLM creates Slidev-formatted presentation content
3. **Slides** - Content parsed into individual slides with previews
4. **Script** - LLM generates conversational scripts per slide
5. **Recording** - Audio capture with waveform visualization
6. **Analysis** - External speech analysis (SpeechSuper/ELSA)
7. **Video** - FFmpeg.wasm combines slides + audio, optional YouTube upload

### State Management

Three Zustand stores in `/src/stores/`:

- **useProjectStore** - Project CRUD and all workflow data, syncs with SQLite via API
- **useWorkflowStore** - Step navigation and locking (ephemeral, not persisted)
- **useSettingsStore** - API keys, preferences, persisted to localStorage and SQLite

### LLM Integration

Dual provider support configured in settings:

- **Anthropic API** - Uses `@anthropic-ai/sdk` with streaming
- **Claude CLI** - Spawns `claude` process with `--output-format stream-json`

All LLM operations stream via Server-Sent Events. The `useLLM()` hook provides async generators that yield `{type: "text"|"done"|"error", content}` messages. Prompts are centralized in `/src/lib/llm/prompts.ts`.

### Database Schema

SQLite with Drizzle ORM. Key tables in `/src/lib/db/schema.ts`:

- `projects` - Main entity with `currentStep` tracking
- `researchData`, `contentData` - One-to-one per project
- `slides`, `scripts`, `recordings` - Many per project
- `analysisResults` - Many per recording
- `videos` - Many per project with processing status
- `settings` - Key-value store for configuration

All relations use cascade delete.

### API Structure

REST endpoints available in both Next.js (`/src/app/api/`) and Python backend (`/backend/app/api/v1/`):

- `/api/projects/*` - Project CRUD and nested resources
- `/api/llm/*` - Streaming LLM endpoints (research, content, script)
- `/api/settings/*` - Configuration and provider verification
- `/api/speech/analyze` - Speech analysis integration (Next.js only)
- `/api/youtube/upload` - YouTube upload via googleapis (Next.js only)
- `/api/init` - Database initialization

Both implementations share the same API contract and database schema.

### Component Patterns

Workflow step pages use consistent wrappers:
- `StepContainer` - Header with title, description, actions
- `StepNavigation` - Previous/Next buttons with validation
- `LLMProgressPanel` - Real-time prompt and streaming output display

UI components in `/src/components/ui/` are Shadcn/Radix-based.

### Media Processing

- **Audio**: `react-media-recorder` for capture, `wavesurfer.js` for visualization
- **Video**: `@ffmpeg/ffmpeg` (WASM) for client-side encoding

Next.js config includes required CORS headers for FFmpeg WASM:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Backend Architecture (Python/FastAPI)

The `/backend` directory contains an alternative Python implementation of the API layer.

### Technology Stack

- **FastAPI** - Modern async web framework with automatic OpenAPI docs
- **SQLAlchemy 2.0** - ORM with same SQLite schema as Drizzle
- **LangChain + langchain-anthropic** - Streaming LLM responses with async generators
- **Alembic** - Database migrations
- **Pydantic v2** - Request/response validation with model_config
- **pytest + pytest-asyncio** - Testing framework

### Project Structure

```
backend/
├── app/
│   ├── api/v1/          # API route handlers
│   │   ├── init.py      # Database initialization
│   │   ├── llm.py       # Streaming LLM endpoints (SSE)
│   │   ├── projects.py  # Project CRUD + nested resources
│   │   └── settings.py  # Settings + verification endpoints
│   ├── core/
│   │   └── database.py  # SQLAlchemy engine, session, Base
│   ├── llm/
│   │   ├── anthropic_client.py  # LangChain streaming client
│   │   └── prompts.py   # Centralized LLM prompts
│   ├── models/          # SQLAlchemy models (9 tables)
│   ├── schemas/         # Pydantic request/response schemas
│   ├── config.py        # Settings with pydantic-settings
│   └── main.py          # FastAPI app entry point
├── alembic/             # Database migrations
├── tests/               # pytest test suite
├── requirements.txt     # Pip dependencies
└── pyproject.toml       # Poetry config (Python 3.9+)
```

### LLM Integration (LangChain)

The backend uses LangChain's streaming API via `ChatAnthropic.astream()`:

```python
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

# Async generator for streaming responses
async def stream_research(topic: str, depth: str):
    client = ChatAnthropic(api_key=api_key, model=model, streaming=True)
    messages = [SystemMessage(...), HumanMessage(...)]

    async for chunk in client.astream(messages):
        if chunk.content:
            yield {"type": "text", "content": chunk.content}

    yield {"type": "done", "content": ""}
```

All LLM endpoints (`/api/llm/research`, `/api/llm/content`, `/api/llm/script`) return Server-Sent Events compatible with the frontend's `useLLM()` hook.

### Database Models

SQLAlchemy models in `/backend/app/models/` mirror the Drizzle schema:

- **Project** - Main entity, uses String column for status (not Enum)
- **ResearchData, ContentData** - JSON fields stored as TEXT with manual serialization
- **Slide, Script, Recording, AnalysisResult, Video, Setting** - Same structure as frontend
- Timestamps stored as Unix milliseconds (integer) for compatibility
- All relationships use `cascade="all, delete-orphan"`

### Running Both Frontend + Backend

```bash
# Terminal 1: Next.js frontend (port 3000)
npm run dev

# Terminal 2: Python backend (port 8000)
make backend-dev
```

Configure frontend to proxy LLM requests to backend by updating API base URL in settings, or run Next.js API routes alongside for speech/YouTube features.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Luminate is a YouTube video automation application with a 7-step workflow: Research → Content → Slides → Script → Recording → Analysis → Video. It uses Next.js 15 with React 19, SQLite/Drizzle for persistence, and Zustand for client state.

## Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack

# Build & Production
npm run build            # Production build
npm run start            # Start production server

# Database
npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Run migrations
npm run db:studio        # Launch Drizzle Studio GUI

# Linting
npm run lint             # Run ESLint
```

**First-time setup**: Call `POST /api/init` to initialize the database.

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

REST endpoints in `/src/app/api/`:

- `/api/projects/*` - Project CRUD and nested resources
- `/api/llm/*` - Streaming LLM endpoints (research, content, script)
- `/api/settings/*` - Configuration and provider verification
- `/api/speech/analyze` - Speech analysis integration
- `/api/youtube/upload` - YouTube upload via googleapis

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

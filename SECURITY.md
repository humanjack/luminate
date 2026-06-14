# Security Policy

## Supported versions

Luminate is a pre‑1.0 MVP; security fixes are applied to the `main` branch only.

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for an unfixed vulnerability.

- Preferred: open a [GitHub Security Advisory](https://github.com/humanjack/luminate/security/advisories/new) (Security → Advisories → "Report a vulnerability").
- Alternatively, contact the maintainer directly.

We aim to acknowledge a report within a few business days and to keep you updated on remediation. Please give us a reasonable window to ship a fix before any public disclosure.

## Secrets handling

Luminate's threat model is unusual: users paste **live provider API keys** (Anthropic, OpenAI, Google, Azure Speech, SpeechSuper, ELSA, Tavily, Brave) into the Settings page, and they are persisted to a **local SQLite database** (`luminate.db`).

- `GET /api/settings` **redacts** secret values before returning them to the browser (it returns a sentinel plus a `<key>Configured` flag, not the raw key).
- Keys are currently stored **in plaintext at rest** in `luminate.db`. Encryption at rest is a tracked follow‑up. The client still sends a key to the LLM/verify endpoints when making a request.
- **Operators must treat `luminate.db` as sensitive.** It is excluded by [`.gitignore`](.gitignore) (`*.db`, `*.sqlite`); never commit it and never host it on a public/shared filesystem.

## Hardening already in place

- SSRF protection on server‑side URL fetches (private/loopback/metadata IPs blocked) — `src/lib/net/safe-fetch.ts`.
- Path‑traversal protection on recording audio paths — `src/lib/analysis/audio.ts`.
- Mass‑assignment allow‑lists on update routes — `src/lib/api/sanitize.ts`.
- Baseline security response headers + report‑only CSP — `src/lib/security/headers.ts`.
- Request‑body validation — `src/lib/api/validate.ts`.

Note that there is currently **no authentication** layer — Luminate is intended to run as a single‑user, locally‑hosted tool. Do not expose an instance to untrusted networks without adding access control.

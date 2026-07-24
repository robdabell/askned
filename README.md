# Ask Ned 🚴‍♂️🟡

A small, dependency-free chatbot web app that answers questions about the
**Tour de France** in the warm, witty, self-deprecating voice of British cycling
commentator **Ned Boulting**.

- **Talk to Ned** about the jerseys, the great climbs, the history and this
  year's race.
- **Live race context** — the current year's Tour de France article is pulled
  from Wikipedia and given to the model, so Ned can talk about the race
  happening *now*, not just his training data.
- **Route visuals** — every 2026 stage, with the official
  [letour.fr](https://www.letour.fr/en/overall-route) map & elevation profile
  embedded in the app (optional VeloViewer 3D route per stage).
- **Latest sources** — a curated list of trusted cycling news, results and
  broadcast sources, surfaced in the UI and cited by Ned when he doesn't hold a
  live fact.
- **Pluggable LLM** — works with Google Gemini, any OpenAI-compatible endpoint
  (Groq, Ollama, …), Anthropic Claude, or a built-in offline responder.

## Requirements

- Node.js **>= 18** (uses the built-in `http` and global `fetch`; no `npm install` needed).

## Quick start

```bash
cp .env.example .env      # then edit .env to add your provider + key
npm start                 # http://localhost:3001
```

With no `.env`, the app still runs using a small **offline** responder, so you
can try the UI immediately.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the server (loads `.env` if present) → http://localhost:3001 |
| `npm run dev` | Same, with auto-reload (`--watch`) |
| `npm test` | HTTP integration tests (`node:test`) |

## Configuration

The chat "brain" auto-selects a provider based on environment variables
(see [`.env.example`](.env.example) for ready-to-use blocks):

| Provider | How to enable |
| --- | --- |
| **Google Gemini** (free tier) | `OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`, `OPENAI_API_KEY`, `OPENAI_MODEL=gemini-flash-latest` |
| **Groq / Ollama / other** | Any OpenAI-compatible `OPENAI_BASE_URL` (+ `OPENAI_API_KEY`, `OPENAI_MODEL`) |
| **Anthropic Claude** | `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`) |
| **Offline** | Set nothing — built-in canned responder |

Other vars: `PORT` (default `3001`).

> **Never commit `.env`** — it holds your API key and is gitignored. Rotate any
> key that has been shared or exposed.

## Project layout

| File | Purpose |
| --- | --- |
| `server.js` | HTTP server + routes (`/`, `/api/chat`, `/api/stages`, `/api/sources`) |
| `chat.js` | LLM provider selection + calls (Gemini / OpenAI-compatible / Anthropic / offline) |
| `persona.js` | Ned Boulting system prompt + offline fallback responder |
| `race-context.js` | Fetches the current year's Tour de France article (Wikipedia) for live context |
| `stages-2026.js` | Official 2026 stage list (from letour.fr) + route assets |
| `sources.js` | Curated cycling news / data / broadcast sources |
| `index.html` | Front-end: chat UI, route visuals panel, sources panel |
| `server.test.js` | HTTP integration tests |

## Notes & limitations

- Live race data is only as fresh/accurate as the Wikipedia article and the
  official site; granular figures (exact time gaps mid-stage) won't be present.
- Free LLM tiers are rate-limited — when the quota is hit, Ned says so in
  character rather than erroring.
- The `letour.fr` stage embed relies on that site continuing to allow framing.

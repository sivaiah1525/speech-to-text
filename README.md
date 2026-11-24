# Speech to Text — real-time multilingual transcription

A web application where a user speaks in real time — including **mixed Hindi + English (Hinglish)** — and sees the words transcribed live. Every transcription can be saved to a **PostgreSQL** database and managed from a **history dashboard with full CRUD** (create, read, update, delete, search, pagination).

Built for the Procucev AI Tech hiring assignment.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Angular 19 (standalone components, signals), TypeScript, SCSS |
| Backend | Node.js 20+, Express, `ws` WebSockets |
| Database | PostgreSQL (`pg` driver) |
| Speech-to-text | **Engine 1:** browser Web Speech API (no key; `hi-IN` handles Hinglish)<br>**Engine 2:** Google **Gemini Live API** streamed through the server (`@google/genai`) |

## Architecture

```
Browser (Angular)
 ├─ Engine "Browser":  mic ──> Web Speech API ──> live text
 ├─ Engine "Gemini":   mic ──> AudioWorklet (16 kHz PCM16) ──WebSocket /ws/transcribe──┐
 │                                                                                     ▼
 │                                                     Node/Express ──> Gemini Live API
 │                                                     (API key stays on the server)
 └─ History dashboard ──REST /api/transcriptions──> Express ──> PostgreSQL
```

- Audio for the Gemini engine is captured with an **AudioWorklet**, converted to 16-bit PCM at 16 kHz and sent in ~100 ms chunks, so text appears while the user is still speaking.
- Interim (not yet final) words are shown in grey; final words in black.
- The Gemini API key is never sent to the browser.

## REST API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check (DB status, Gemini enabled) |
| GET | `/api/transcriptions?q=&page=&pageSize=` | List with search + pagination |
| GET | `/api/transcriptions/:id` | Get one |
| POST | `/api/transcriptions` | Create `{ text, title?, language?, engine?, durationMs? }` |
| PUT | `/api/transcriptions/:id` | Update `{ title?, text? }` |
| DELETE | `/api/transcriptions/:id` | Delete |
| WS | `/ws/transcribe` | Binary PCM16 audio in, `{type:'transcript', text, final}` out |

## Database schema

```sql
CREATE TABLE transcriptions (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(200) NOT NULL DEFAULT 'Untitled',
  text        TEXT         NOT NULL,
  language    VARCHAR(20)  NOT NULL DEFAULT 'hi-IN',
  engine      VARCHAR(30)  NOT NULL DEFAULT 'browser',
  duration_ms INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```
The table is created automatically on server start.

## Run locally

Prerequisites: Node.js 20+, and PostgreSQL (Docker, a local install, or the bundled dev helper).

```bash
# 1. Database (pick one)
docker compose up -d            # PostgreSQL in Docker
# or: cd server && npm run db   # portable PostgreSQL 16, no Docker needed

# 2. Server
cd server
npm install
cp .env.example .env            # add GEMINI_API_KEY to enable the Gemini engine
npm start                       # http://localhost:3000

# 3. Frontend (production build, served by the Node server)
cd ../client
npm install
npx ng build
```
Open http://localhost:3000 in **Chrome or Edge** and allow microphone access.

For frontend development with live reload: `cd client && npx ng serve --proxy-config proxy.conf.json` (proxies `/api` and `/ws` to port 3000).

## Deploy (Render, free tier)

1. Create a free PostgreSQL database on Render (or Neon) and copy its connection string.
2. New **Web Service** from this GitHub repo:
   - Build command: `cd server && npm install && cd ../client && npm install && npx ng build`
   - Start command: `cd server && npm start`
   - Environment: `DATABASE_URL=<connection string>`, `DB_SSL=true`, optional `GEMINI_API_KEY`
3. Render serves HTTPS, which browsers require for microphone access.

## Notes and limitations

- The browser engine depends on the browser's built-in recognizer (best in Chrome/Edge). Firefox does not support it; use the Gemini engine there.
- `hi-IN` recognises Hindi and English words in the same sentence; Hindi words may appear in Devanagari or Latin script depending on the engine.
- Possible next steps: authentication per user, export to PDF/DOCX, speaker labels, and a self-hosted Whisper engine for fully offline use.

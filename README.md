# PostGen

AI-powered LinkedIn post generator. Paste articles, research papers, or Notion journal entries, tell the AI what angle you want, and get a polished post in seconds. Refine it through a back-and-forth chat until it sounds exactly like you.

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Project structure](#project-structure)
4. [Architecture overview](#architecture-overview)
5. [Local setup](#local-setup)
6. [Environment variables](#environment-variables)
7. [Database](#database)
8. [Key design decisions](#key-design-decisions)

---

## Features

| Feature | Details |
|---|---|
| **URL sources** | Paste any article / paper URL; the server fetches and extracts readable text server-side (no external scraping service) |
| **Notion integration** | OAuth connection; lists sub-pages from a chosen journal page and pulls their content as source material |
| **Streaming generation** | AI response streams token-by-token via `ReadableStream`; the post appears in real time |
| **Tone presets** | Storytelling · Data-driven · Thought Leader · Casual · Inspirational — appended to the system prompt |
| **Multi-model support** | Free models (no key required) + paid models (GPT-4o, Claude, Gemini) unlocked with a personal OpenRouter key |
| **Free model fallback** | If the selected free model is rate-limited (429) or unavailable (404), the engine automatically falls back through the remaining free models |
| **Hashtag suggestions** | After generation, a fast free model suggests 3–5 relevant hashtags that the user can click to append |
| **Templates** | Save a set of instructions as a named template; reuse with one click from a dropdown |
| **Posts library** | Save, browse, and copy generated posts; grouped by lifecycle (pending review / scheduled / published / drafts / failed) |
| **LinkedIn auto-posting** | Connect LinkedIn with a pasted access token, configure frequency (daily/weekly/bi-weekly/monthly), source, prompt, day & time. A daily cron drafts on cadence, parks for review, then publishes at the scheduled time after approval |
| **Session persistence** | Generated post, conversation history, and hashtags survive a page refresh via `localStorage` |
| **Collapsible / resizable UI** | Sidebar, source panel, chat panel, and post panel all have independent collapse toggles; the chat/post divider is draggable |

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [SvelteKit](https://kit.svelte.dev/) (Svelte 5 with Runes) |
| UI | Tailwind CSS v4 |
| Auth | [Auth.js v5](https://authjs.dev/) — Google OAuth, session stored in DB |
| Database | PostgreSQL via [Neon](https://neon.tech/) (serverless) |
| ORM | [Drizzle ORM](https://orm.drizzle.team/) |
| AI | [OpenRouter](https://openrouter.ai/) via the OpenAI-compatible SDK |
| Notion API | [@notionhq/client](https://github.com/makenotion/notion-sdk-js) |
| Deployment | Vercel (adapter-vercel) |

---

## Project structure

```
src/
├── auth.ts                        # Auth.js config (Google OAuth + Drizzle adapter)
├── hooks.server.ts                # SvelteKit hook — attaches auth to every request
│
├── lib/
│   ├── models.ts                  # AI model definitions (FREE_MODELS, PAID_MODELS, DEFAULT_MODEL)
│   ├── components/
│   │   ├── Button.svelte          # Reusable button (variant + size props)
│   │   └── generate/
│   │       ├── ContentSource.svelte   # Sources panel: URL inputs + Notion picker
│   │       ├── InstructionsPanel.svelte # Left chat panel: history, prompt, settings
│   │       ├── PostEditor.svelte      # Right post panel: streaming output + actions
│   │       └── Guide.svelte           # Center modal: full feature documentation
│   │
│   └── server/                    # Server-only code (never imported by client)
│       ├── ai/
│       │   └── index.ts           # generatePostStream(), suggestHashtags()
│       ├── automation/
│       │   └── index.ts           # isDraftDue(), computeNextPublishTime() — pure helpers
│       ├── db/
│       │   ├── index.ts           # Drizzle client (Neon serverless)
│       │   ├── schema/
│       │   │   ├── auth.ts        # Auth.js tables (users, accounts, sessions, tokens)
│       │   │   ├── app.ts         # App tables (notion_page, template, generated_post)
│       │   │   ├── automation.ts  # automation_setting (1:1 with user)
│       │   │   └── relations.ts   # Drizzle relation definitions
│       │   └── models/
│       │       ├── types.ts       # Inferred TS types for all tables
│       │       ├── user.ts        # UserModel — findById, findByEmail, update, disconnectLinkedin
│       │       ├── post.ts        # PostModel — CRUD + cron queries (findApprovedDueBefore, etc)
│       │       ├── template.ts    # TemplateModel — CRUD for template
│       │       └── automation.ts  # AutomationSettingModel — upsert, findEligible
│       ├── linkedin/
│       │   └── index.ts           # verifyToken(), publishPost()
│       └── notion/
│           └── index.ts           # listJournalPages(), getPageContent()
│
└── routes/
    ├── +page.svelte               # Landing / redirect page
    ├── login/+page.svelte         # Google sign-in screen
    │
    ├── (app)/                     # Authenticated route group
    │   ├── +layout.server.ts      # Redirects unauthenticated users to /login
    │   ├── +layout.svelte         # App shell: sidebar nav, guide modal
    │   ├── generate/              # Main generation page
    │   ├── posts/                 # Saved posts library
    │   ├── templates/             # Saved templates
    │   └── settings/              # AI model, OpenRouter key, Notion config
    │
    └── api/
        ├── generate/+server.ts            # POST — stream AI post generation
        ├── hashtags/+server.ts            # POST — suggest hashtags for a post
        ├── url/+server.ts                 # POST — fetch and extract text from a URL
        ├── posts/                         # GET (list) · POST (create) · PATCH/DELETE [id] · POST [id]/refine
        ├── templates/                     # GET (list) · POST (create) · DELETE [id]
        ├── settings/
        │   ├── +server.ts                 # PATCH — save user settings (model, keys, notion)
        │   └── linkedin/+server.ts        # POST — verify & save LinkedIn token · DELETE — disconnect
        ├── automation/
        │   └── settings/+server.ts        # PATCH — save automation_setting row
        ├── cron/
        │   └── run-automations/+server.ts # GET — daily cron: draft + publish phase
        └── notion/
            ├── pages/+server.ts           # GET — list journal sub-pages
            └── pages/[id]/                # GET — fetch a single page's content
```

---

## Architecture overview

### Request lifecycle

```
Browser → SvelteKit route (load fn or +server.ts)
              ↓
         auth() — validates the session from the cookie
              ↓
         UserModel.findById() — fetch per-user settings (API key, model pref)
              ↓
         server/ai, server/notion, server/db — business logic
              ↓
         Response (JSON, stream, redirect)
```

### AI generation pipeline

```
POST /api/generate
  ├── authenticate user
  ├── fetch user.openrouterApiKey from DB
  ├── call generatePostStream(content, conversationHistory, model, tone, apiKey)
  │     ├── build messages: system prompt + tone addendum + source content + history
  │     ├── call OpenRouter (openai-compatible SDK) with stream:true
  │     ├── on 429/404: try next free model from fallback list
  │     └── return ReadableStream<Uint8Array>
  └── pipe stream directly into Response body (text/plain, no buffering)

Client side:
  fetch() → res.body.getReader() → decode chunks → append to generatedPost state
```

### URL content extraction

The `/api/url` route fetches external pages entirely server-side (no third-party service). It strips boilerplate HTML (`<script>`, `<nav>`, `<header>`, `<footer>`, `<aside>`) using regex, converts block-level closing tags to newlines, and decodes HTML entities. Content is capped at 8 000 characters to stay within prompt budget.

### Notion data flow

1. User connects Notion via OAuth (Settings page → `/api/notion/auth` redirect).
2. The access token is stored in `users.notionAccessToken`.
3. On the Generate page, "Pull from Notion" calls `GET /api/notion/pages`, which calls `listJournalPages()` using the stored token.
4. Selecting a page calls `GET /api/notion/pages/[id]`, which recursively walks the Notion block tree and returns plain text.
5. All loaded source texts are combined into a structured markdown string and sent to the AI as context.

### Session persistence

The generate page stores `{ generatedPost, promptHistory, conversationHistory, suggestedHashtags }` to `localStorage` under the key `postgen:session` after every change. On page load, this is restored before any reactive state is initialised. `localStorage` access is guarded by the `browser` flag from `$app/environment` to prevent SSR errors.

---

## Local setup

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Neon free tier works)
- A Google OAuth app (for auth)
- An OpenRouter account (free tier is enough to start)
- A Notion integration (optional, for the Notion source feature)

### Steps

```bash
# 1. Clone and install
git clone https://github.com/your-org/linkedin-post-generation.git
cd linkedin-post-generation
npm install

# 2. Copy the env template and fill in your values
cp .env.example .env

# 3. Push the database schema
npx drizzle-kit push

# 4. Start the dev server
npm run dev
```

The app runs at `http://localhost:5173`.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (e.g. Neon `postgresql://...`) |
| `AUTH_SECRET` | ✅ | Random string used to sign Auth.js session cookies — generate with `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | ✅ | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | ✅ | Google OAuth client secret |
| `OPENROUTER_API_KEY` | ✅ | Server-level OpenRouter key used as fallback when a user hasn't set their own |
| `CRON_SECRET` | ✅ | Random string Vercel attaches to cron-triggered requests as `Authorization: Bearer …`. The `/api/cron/run-automations` endpoint refuses requests without a matching secret. Generate with `openssl rand -base64 32` |
| `NOTION_API_KEY` | ☑️ | Optional dev fallback. Per-user Notion tokens are pasted in Settings |
| `NOTION_JOURNAL_PAGE_ID` | ☑️ | Optional dev fallback for the journal page |

> **Per-user API keys:** Users can add their own OpenRouter key in Settings. It is stored encrypted in the DB and takes precedence over the server-level `OPENROUTER_API_KEY`. This allows users to access paid models (GPT-4o, Claude, Gemini) without the server owner paying for them.

---

## Database

### Schema summary

**Auth tables** (managed by Auth.js / Drizzle adapter):
- `users` — extended with `openrouterApiKey`, `preferredModel`, `notionAccessToken`, `notionWorkspaceName`, `notionJournalPageId`, `linkedinAccessToken`, `linkedinMemberUrn`, `linkedinTokenExpiresAt`
- `accounts`, `sessions`, `verification_tokens` — standard Auth.js tables

**App tables:**
- `notion_page` — cached Notion page content per user
- `template` — named instruction sets; `systemPrompt` is the full prompt text saved for reuse
- `generated_post` — saved posts with full `conversationHistory` (JSON), `rawInput`, `generatedContent`, `editedContent`, `status` (`draft | final | archived | pending_review | approved | published | failed | skipped`), `source` (`manual | auto`), `scheduledFor`, `publishedAt`, `linkedinPostUrn`, `failureReason`, `sourceContent`, `editConversation`
- `automation_setting` — one row per user with `enabled`, `frequency`, `sourceType`, `sourcePageId`, `sourceLookbackDays`, `prompt`, `publishDayOfWeek`, `publishTime`, `timezone`, `lastDraftAt`

### Migrations

```bash
# Generate a migration file after changing schema files
npx drizzle-kit generate

# Push schema directly to the DB (dev only — skips migration files)
npx drizzle-kit push

# Open Drizzle Studio to browse data
npx drizzle-kit studio
```

---

## Key design decisions

### Why OpenRouter instead of a direct model API?

OpenRouter gives access to 200+ models (OpenAI, Anthropic, Google, Meta) through a single API key and endpoint. The free tier includes capable open-source models (Llama, Mistral, Gemma) that work well for post generation without any cost. Paid models are a one-line change and are unlocked per user via their own API key.

### Why stream the AI response?

Streaming means the first words appear within ~500ms instead of waiting 10–30s for the full response. SvelteKit makes this clean: the API route returns `new Response(readableStream)`, and the client reads it with `res.body.getReader()`, appending each chunk to a reactive `$state` variable.

### Why no DOM-parsing library for URL extraction?

Using `cheerio`, `jsdom`, or similar would add significant bundle weight and cold-start time (especially on Vercel Edge). The regex-based extraction in `/api/url` is fast, dependency-free, and handles the vast majority of articles and research pages well enough for AI context purposes.

### Why Svelte 5 Runes instead of stores?

Runes (`$state`, `$derived`, `$effect`, `$bindable`) provide fine-grained reactivity without the indirection of writable stores. `$bindable` is used for two-way data flow between parent and child components (e.g. `generatedPost` binds from `PostEditor` up to `+page.svelte`), keeping the component API declarative.

### Why localStorage for session persistence?

The conversation history and generated post are transient UI state — they don't belong in the database until the user explicitly saves. `localStorage` provides zero-latency persistence across page refreshes without a server round-trip. The database is only written when the user clicks "Save".

---

## Auto-posting workflow

The auto-posting feature is implemented as a **single daily cron** that does both halves of the workflow on every run. There is no per-user job scheduler — instead, "is there work to do?" is a query against the database.

### Architecture

```
        ┌─────────────────────────────────────┐
        │ Vercel Cron (once per day, 13:00 UTC)│
        │   GET /api/cron/run-automations     │
        │   Authorization: Bearer ${CRON_SECRET}│
        └────────────────┬────────────────────┘
                         │
              ┌──────────┴───────────┐
              │                      │
              ▼                      ▼
   ┌──────────────────┐    ┌──────────────────────┐
   │ Phase A — Drafts │    │ Phase B — Publishing │
   │                  │    │                      │
   │ for each user:   │    │ for each post where: │
   │  - automation on │    │  status='approved'   │
   │  - LinkedIn set  │    │  scheduled_for ≤ now │
   │  - Notion set    │    │                      │
   │  - prompt set    │    │ → publishPost()      │
   │  - draft is due  │    │ → markPublished or   │
   │ → fetchSource()  │    │   markFailed         │
   │ → AI generate    │    └──────────────────────┘
   │ → insert row     │
   │   pending_review │
   └──────────────────┘
```

### Status state machine

```
manual flow:    draft → final → archived
                                       ↑
auto flow: pending_review → approved → published
                ↓               ↓
            skipped          failed (retryable)
```

### Why no native scheduling?

LinkedIn's `/v2/ugcPosts` API publishes immediately — it has no `scheduled_at` field. We compensate by storing `scheduled_for` on the `generated_post` row and letting the daily cron pick up "approved + due" rows. Trade-off: the cron's once-a-day cadence means publish times are accurate to ±the gap between the cron run and the user's chosen `publishTime`. With a daily cron, that's ≤24 hours; running it more frequently would tighten the bound at the cost of free-tier serverless invocations.

### Why a 60-day pasted token instead of full OAuth?

Mirrors the existing Notion integration pattern (single secret pasted in Settings). LinkedIn's developer portal has self-serve OAuth Token Tools that issue 60-day tokens — fine for personal-scale use. Adding the full 3-leg OAuth flow (with refresh tokens) would buy "user never has to re-paste" but cost much more code and a publicly-routable callback URL. We can upgrade later without changing the schema (`linkedinAccessToken` doesn't care how it was obtained).

### Testing the cron locally

```bash
# Hit the cron endpoint with the secret from .env
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:5173/api/cron/run-automations

# Returns a JSON report:
# { "drafted": 1, "publishedCount": 0, "skipped": [...], "failed": [...] }
```

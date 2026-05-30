# Email Notifications

## Purpose
Sends email notifications to users via Resend when their automation generates a new draft. Fail-soft: a failed email never blocks draft creation or publishing.

## How it works
1. Cron generates a draft (Phase A in `run-automations`).
2. After the draft is saved to the DB, the cron calls `sendDraftReadyEmail()` with the user's email and a preview snippet.
3. The function instantiates a Resend client (lazily, from `RESEND_API_KEY`), sends an HTML email with the preview and a link to `/posts`, and catches any error to log-and-continue.

## Key files
| File | Responsibility |
|---|---|
| `index.ts` | `sendDraftReadyEmail()` — the only export. Composes HTML, calls Resend SDK. |

## Design decisions
- **Fail-soft over fail-fast.** A broken email must never prevent a draft from being created. `sendDraftReadyEmail` wraps the entire send in a try/catch and logs warnings.
- **No template engine.** The email is a single inline HTML string. For one email type on a learning project, a template engine would be over-engineering.
- **Lazy client instantiation.** `getClient()` reads `RESEND_API_KEY` from `$env/dynamic/private` on every call rather than at module load, so missing env vars produce a warning instead of a crash.
- **`onboarding@resend.dev` sender.** Resend's free tier allows sending from this address without DNS setup. For a custom domain, add it in the Resend dashboard and update the `from` field.

## Gotchas
- `RESEND_API_KEY` must be set or all emails are silently skipped.
- Resend free tier: 3,000 emails/month, single sender address only.
- `PUBLIC_APP_URL` env var controls the "Review & approve" link; defaults to `http://localhost:5176`.

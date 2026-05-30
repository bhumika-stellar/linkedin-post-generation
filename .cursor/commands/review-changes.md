# Review Changes Since Last Commit

Review everything that has changed since the last git commit. Find bugs, regressions, and convention violations before committing.

## Step 1 — Discover what changed

Run these commands:

```bash
git diff HEAD
git diff --cached
git diff --name-status HEAD
git status --short
```

Read every changed file in full — not just the diff — so you have full context around each change.

## Step 2 — Review each changed file

### Bugs
- **Null / undefined access** — is every nullable column or optional field guarded before use?
- **Missing error handling** — are async operations wrapped with try/catch where the caller can't recover?
- **Type mismatches** — does data flowing between layers (route → model → DB) stay type-safe? No `as SomeType` casts hiding real mismatches.
- **Race conditions** — any non-atomic read-then-write that could corrupt state under concurrent requests?
- **Missing `await`** — any async call whose result is silently discarded?
- **Wrong query scope** — is every user-facing query scoped by `userId`? The only exception is cron operations, which must have a comment explaining why.

### Architecture violations
- DB logic inside a route handler (belongs in a model file)
- Model logic inside a schema file (schema files define tables only)
- Direct `db.*` calls in a route instead of calling a `*Model` method
- Fat routes — a route doing more than: (1) check auth, (2) validate input, (3) call model/service, (4) return response

### Convention violations
- New types that don't come from `InferSelectModel` / `InferInsertModel` in `types.ts`
- A new entity without a corresponding model file in `src/lib/server/db/models/`
- A schema change with no new migration file in `drizzle/`
- Status/state stored as a Postgres enum instead of a text column with `$type<...>()`
- Client-side code importing from `$lib/server/*`

### Regression risk
- Did any **existing model method signatures** change? List every file that imports from the changed model.
- Did any **shared type** in `types.ts` change? List every file that uses that type.
- Did any **API response shape** change? Name the frontend components that consume that endpoint.
- Does any change touch **status transition logic**? Verify the full state machine is still intact.
- Does any change touch the **cron path** (`/api/cron/run-automations`)? Breakage here is silent — the cron runs unattended.

## Step 3 — Output a structured review

### Summary
One paragraph: what this changeset does, and overall assessment (safe to commit / needs fixes / major issues).

### Findings
Each finding tagged by severity:

- **[CRITICAL]** `file:line` — description. Must fix before committing.
- **[WARNING]** `file:line` — description. Should fix; may cause subtle bugs.
- **[SUGGESTION]** `file:line` — description. Optional improvement.

Omit a severity level if there are no findings at that level.

### Regression map
List any files not in the diff that could be affected by these changes:

```
Changed: src/lib/server/db/models/post.ts (PostModel.update signature)
Affects: src/routes/api/posts/[id]/+server.ts — imports PostModel.update directly
Affects: src/routes/api/posts/[id]/refine/+server.ts — may pass data that no longer matches
```

If no regressions are possible, explicitly say "No regression risk identified."

### Missing pieces
Anything the changeset started but didn't finish — e.g. a new schema column with no model method, a new model method with no route wired to it, a new route with no frontend call.

### Verdict
One of:
- **Safe to commit** — no critical issues found
- **Fix before committing** — list the critical findings that must be resolved
- **Needs discussion** — architectural concerns that require a decision before proceeding

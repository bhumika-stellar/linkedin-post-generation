# Feature Plan Review

Critically review the feature plan the developer just described before any code is written.

## Step 1 — Read the existing codebase

Read these files first so the review is grounded in reality, not assumptions:

- `src/lib/server/db/schema/app.ts` — app tables and columns
- `src/lib/server/db/schema/auth.ts` — user + auth tables
- `src/lib/server/db/schema/automation.ts` — automation table
- `src/lib/server/db/schema/relations.ts` — all FK relations
- `src/lib/server/db/models/types.ts` — all inferred types
- `src/lib/server/db/models/user.ts`, `post.ts`, `template.ts`, `automation.ts` — existing query patterns
- `src/lib/models.ts` — shared AI model definitions
- `src/routes/` — existing route structure (what already exists)

## Step 2 — Evaluate the plan against these principles

### Architecture (non-negotiable)
The layered architecture must be respected:

```
Schema (table definitions)
  → Models (typed queries, one file per entity)
    → Service modules (ai/, notion/, linkedin/, automation/)
      → API Routes (thin: auth check + input validation only)
        → Page loads (+page.server.ts)
```

**Red flags to call out:**
- Database logic inside a route handler
- A new feature that adds columns to an existing model instead of a new domain file
- Type assertions (`as SomeType`) instead of Drizzle inference
- Direct `db.*` calls outside of a model file
- A new entity that doesn't get its own model file

### Extension over mutation
New features should **add** new files. Existing working code should not be touched unless strictly necessary. Ask: can this be a new schema file + new model file + new route?

### Modularity
Each concern gets its own file:
- New DB entity → new file in `src/lib/server/db/schema/` + `src/lib/server/db/models/`
- New integration → new file in `src/lib/server/`
- Shared pure logic → `src/lib/shared/utils.ts` or a new util file

### Type safety
- Schema types must come from `InferSelectModel` / `InferInsertModel` in `types.ts`
- Status/source columns use `$type<'a' | 'b'>()` on text — not Postgres enums
- No `any`. No casting away from Drizzle-inferred types.

### Bug resistance
- Every query scoped by `userId` (unless it's a cron operation with a documented reason)
- All nullable columns handled explicitly — never assume a field is set
- Status transitions enforced in the route, not the client
- `ON CONFLICT` / upsert where the row may or may not exist

### Strategic over tactical
- Does the plan solve the problem class or just the immediate symptom?
- Will this require a rewrite when the next similar feature is added?
- Is there a simpler data model that covers the same requirements?

## Step 3 — Output a structured review

### What works well
What parts of the plan align well with the architecture and are safe to proceed with.

### Concerns / redesign needed
Specific problems, each tagged: **[CRITICAL]**, **[WARNING]**, or **[SUGGESTION]**. Explain *why* it's a problem, not just that it is one.

### Recommended implementation breakdown
A concrete file-by-file plan:
- Which new schema columns or tables are needed (and which migration)
- Which new model methods are needed (and in which file)
- Which new service functions are needed
- Which new API routes are needed, and what each one does
- Which existing files need to change (and why that's unavoidable)

### Learning note
Name one design principle or pattern the feature touches that's worth understanding deeply. Briefly explain it.

### Questions before proceeding
Any ambiguities that need the developer's decision. Present as options with tradeoffs — don't decide unilaterally.

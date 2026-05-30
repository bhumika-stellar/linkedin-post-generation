# Automation Helpers

## Purpose
Pure functions that the hourly cron (`/api/cron/run-automations`) uses to decide *whether* and *when* to draft and publish posts. No DB calls, no side effects — just date/timezone math.

## How it works
The cron calls these in order for each eligible user:
1. `isDraftTimeNow(automation, now)` — Is the current hour (in the user's timezone) the configured draft hour?
2. `isDraftDue(automation, now)` — Has enough time elapsed since `lastDraftAt` based on frequency?
3. `computeNextPublishTime(automation, now)` — What UTC instant should the approved post publish at?

## Key files
| File | Responsibility |
|---|---|
| `index.ts` | Exports `isDraftDue`, `isDraftTimeNow`, `computeNextPublishTime`. All pure functions. |

## Design decisions
- **Hour-level granularity for draft time.** The cron runs hourly. `isDraftTimeNow` compares only the hour portion of `draftTime` against the user's local hour, ignoring minutes. This means "08:30" and "08:00" both match during the 8 AM cron run.
- **Forgiving thresholds for cadence.** Weekly uses 6.5 days instead of 7 so that minor cron drift doesn't skip a cycle.
- **Timezone via `Intl.DateTimeFormat`.** No date library needed; the built-in API handles DST transitions correctly by walking calendar days in the user's timezone.
- **Pure functions only.** No imports from `$env`, no `fetch`, no DB — makes these unit-testable in isolation.

## Gotchas
- `isDraftTimeNow` relies on the cron firing once per hour. If the cron runs more often (e.g. every 15 min), drafts could fire multiple times in the same hour because the function only checks the hour, not a "did we already run this hour?" flag. The cadence check (`isDraftDue`) prevents duplicate drafts across days, but not within a single day if frequency is `'daily'`.
- `computeNextPublishTime` searches up to 14 days ahead. Misconfigured settings (e.g. `publishDayOfWeek=3` with `frequency='monthly'`) could theoretically miss the window and fall back to "publish now".

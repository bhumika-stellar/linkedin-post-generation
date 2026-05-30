/**
 * Automation schema.
 *
 * One row per user, holding everything the daily cron needs to:
 *   1. Decide whether a draft is "due" for this user today.
 *   2. Pull the right source content from Notion.
 *   3. Apply the user's standing prompt to the AI generation.
 *   4. Compute when the approved draft should be published to LinkedIn.
 *
 * Why a separate table (not more columns on `user`)?
 *   The `user` row holds *credentials* (Notion / OpenRouter / LinkedIn tokens) —
 *   stuff that exists from the moment a user signs in. Automation settings are
 *   a separate concern: they only exist when the user opts into the workflow.
 *   Keeping them apart lets us treat "did the user enable automation?" as a
 *   simple "does a row exist + is enabled=true?" query, and keeps the user row
 *   from accumulating concerns it doesn't need to know about.
 *
 * Why 1:1 with user (and not 1:N)?
 *   The product is intentionally one automation per user for v1 — simpler UI,
 *   simpler "is a draft due?" math, simpler queries. If we ever need multiple
 *   automations (e.g. one weekly thoughtful post + one daily quick share),
 *   we'd switch the PK to (userId, automationId) and add a `name` column.
 */
import { pgTable, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const automationSettings = pgTable('automation_setting', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),

	// ── On/off toggle ────────────────────────────────────────────────────────
	// Single source of truth for "is auto-posting active for this user?".
	// The cron's eligibility filter checks this first.
	enabled: boolean('enabled').notNull().default(false),

	// ── Cadence ──────────────────────────────────────────────────────────────
	// How often a fresh draft should be created. The single daily cron checks
	// `lastDraftAt` against this to decide whether to draft for this user today.
	frequency: text('frequency')
		.$type<'daily' | 'weekly' | 'biweekly' | 'monthly'>()
		.notNull()
		.default('weekly'),
	lastDraftAt: timestamp('last_draft_at', { mode: 'date' }),

	// ── Source of truth ──────────────────────────────────────────────────────
	// 'notion_page'   — always pull a specific Notion page (sourcePageId set).
	// 'notion_recent' — pull the most-recently-edited child of the journal root,
	//                   provided it was edited within the last `sourceLookbackDays`.
	sourceType: text('source_type')
		.$type<'notion_page' | 'notion_recent'>()
		.notNull()
		.default('notion_recent'),
	sourcePageId: text('source_page_id'),
	sourceLookbackDays: integer('source_lookback_days').default(5),

	// ── Standing instructions ────────────────────────────────────────────────
	// The user's permanent prompt — what they'd type in the chat bar manually.
	// Fed into the existing AI pipeline as the user-turn message alongside the
	// Notion source content.
	prompt: text('prompt'),

	// ── Draft schedule ───────────────────────────────────────────────────────
	// When the cron should generate a draft. The hourly cron checks whether
	// the current hour (in the user's timezone) matches this time.
	draftTime: text('draft_time').notNull().default('08:00'), // HH:MM (24h)

	// ── Publish schedule ─────────────────────────────────────────────────────
	// When the post should go live on LinkedIn after approval.
	// publishDayOfWeek: 0=Sun..6=Sat. Null when frequency='daily' (publishes the
	// next day after drafting).
	publishDayOfWeek: integer('publish_day_of_week'),
	publishTime: text('publish_time').notNull().default('09:00'), // HH:MM (24h)
	timezone: text('timezone').notNull().default('America/New_York'),

	updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow()
});

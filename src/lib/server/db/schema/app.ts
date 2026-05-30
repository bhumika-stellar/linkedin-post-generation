import { pgTable, text, timestamp, boolean, json } from 'drizzle-orm/pg-core';
import { users } from './auth';

/**
 * A single image attached to a post. Defined here (rather than in
 * models/types.ts) to avoid a circular import: schema/app → models/types →
 * schema/app. models/types.ts imports this type from here.
 *
 * Images originate as Notion block URLs, are stored in Vercel Blob for
 * durability, and are uploaded to LinkedIn at publish time.
 */
export interface PostImage {
	blobUrl: string;       // permanent Vercel Blob URL
	altText: string;       // from Notion image caption (empty string if none)
	notionBlockId: string; // Notion block id for traceability
	contentType: string;   // e.g. 'image/jpeg', 'image/png', 'image/gif'
}

export const notionPages = pgTable('notion_page', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	notionPageId: text('notion_page_id').notNull(),
	title: text('title').notNull(),
	content: text('content'),
	fetchedAt: timestamp('fetched_at', { mode: 'date' }).defaultNow(),
	lastEditedAt: timestamp('last_edited_at', { mode: 'date' })
});

export const templates = pgTable('template', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	systemPrompt: text('system_prompt').notNull(),
	isDefault: boolean('is_default').default(false),
	createdAt: timestamp('created_at', { mode: 'date' }).defaultNow()
});

export const generatedPosts = pgTable('generated_post', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	templateId: text('template_id').references(() => templates.id, { onDelete: 'set null' }),
	sourcePageIds: json('source_page_ids').$type<string[]>().default([]),
	rawInput: text('raw_input'),
	generatedContent: text('generated_content').notNull(),
	editedContent: text('edited_content'),
	conversationHistory: json('conversation_history')
		.$type<{ role: 'user' | 'assistant'; content: string }[]>()
		.default([]),

	// Status is a state machine. Manual flow uses draft/final/archived (existing).
	// The automation flow adds: pending_review (cron drafted, awaiting user) →
	// approved (user approved, scheduled to publish) → published or failed.
	// `skipped` is the terminal state for drafts the user explicitly declined.
	// Storing this as plain text (not a Postgres enum) keeps schema migrations
	// trivial when we add another state — Drizzle's $type<...>() gives us
	// compile-time safety without DB-level rigidity.
	status: text('status')
		.$type<
			| 'draft'
			| 'final'
			| 'archived'
			| 'pending_review'
			| 'approved'
			| 'published'
			| 'failed'
			| 'skipped'
		>()
		.default('draft'),

	// Distinguishes human-initiated rows from cron-generated ones. Used by the
	// /posts UI to show automated drafts with their own grouping and actions.
	source: text('source').$type<'manual' | 'auto'>().notNull().default('manual'),

	// ── Scheduling fields (only populated for source='auto') ────────────────
	// `scheduledFor` is computed at draft time (Saturday cron picks next valid
	// publish slot). The Monday-side of the cron filters approved rows by this.
	scheduledFor: timestamp('scheduled_for', { mode: 'date' }),
	publishedAt: timestamp('published_at', { mode: 'date' }),
	linkedinPostUrn: text('linkedin_post_urn'),
	failureReason: text('failure_reason'),

	// Snapshot of the Notion content used to draft this post. We store it because
	// the user might edit the Notion page after drafting; without a snapshot, "what
	// was this drafted from?" becomes unanswerable, and refinements would re-pull
	// possibly-changed source which is surprising behaviour.
	sourceContent: text('source_content'),

	// Refinement chat — separate from `conversationHistory` (which holds the
	// cron's deterministic generation context). Splitting them means
	// "regenerate from scratch" is a one-liner: clear `editConversation`,
	// re-run from `conversationHistory`.
	editConversation: json('edit_conversation')
		.$type<{ role: 'user' | 'assistant'; content: string }[]>()
		.default([]),

	// Images extracted from the Notion source page and stored in Vercel Blob.
	// Populated when the source page contains image blocks; empty array otherwise.
	// At publish time the cron uploads these to LinkedIn's Images API and
	// references the resulting URNs in the post body.
	images: json('images').$type<PostImage[]>().default([]),

	createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow()
});

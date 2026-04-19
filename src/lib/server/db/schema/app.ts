import { pgTable, text, timestamp, boolean, json } from 'drizzle-orm/pg-core';
import { users } from './auth';

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
	status: text('status').$type<'draft' | 'final' | 'archived'>().default('draft'),
	createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
	updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow()
});

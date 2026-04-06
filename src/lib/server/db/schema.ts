import {
	pgTable,
	text,
	timestamp,
	boolean,
	json,
	primaryKey,
	integer
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { AdapterAccountType } from '@auth/sveltekit/adapters';

// ─── Auth.js tables ───

export const users = pgTable('user', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name'),
	email: text('email').unique(),
	emailVerified: timestamp('emailVerified', { mode: 'date' }),
	image: text('image'),
	openrouterApiKey: text('openrouter_api_key'),
	preferredModel: text('preferred_model').default('qwen/qwen3.6-plus:free'),
	notionAccessToken: text('notion_access_token'),
	notionWorkspaceName: text('notion_workspace_name'),
	createdAt: timestamp('created_at', { mode: 'date' }).defaultNow()
});

export const accounts = pgTable(
	'account',
	{
		userId: text('userId')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: text('type').$type<AdapterAccountType>().notNull(),
		provider: text('provider').notNull(),
		providerAccountId: text('providerAccountId').notNull(),
		refresh_token: text('refresh_token'),
		access_token: text('access_token'),
		expires_at: integer('expires_at'),
		token_type: text('token_type'),
		scope: text('scope'),
		id_token: text('id_token'),
		session_state: text('session_state')
	},
	(account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })]
);

export const sessions = pgTable('session', {
	sessionToken: text('sessionToken').primaryKey(),
	userId: text('userId')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expires: timestamp('expires', { mode: 'date' }).notNull()
});

export const verificationTokens = pgTable(
	'verificationToken',
	{
		identifier: text('identifier').notNull(),
		token: text('token').notNull(),
		expires: timestamp('expires', { mode: 'date' }).notNull()
	},
	(verificationToken) => [
		primaryKey({ columns: [verificationToken.identifier, verificationToken.token] })
	]
);

// ─── App tables ───

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

// ─── Relations ───

export const usersRelations = relations(users, ({ many }) => ({
	accounts: many(accounts),
	sessions: many(sessions),
	notionPages: many(notionPages),
	templates: many(templates),
	generatedPosts: many(generatedPosts)
}));

export const notionPagesRelations = relations(notionPages, ({ one }) => ({
	user: one(users, { fields: [notionPages.userId], references: [users.id] })
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
	user: one(users, { fields: [templates.userId], references: [users.id] }),
	generatedPosts: many(generatedPosts)
}));

export const generatedPostsRelations = relations(generatedPosts, ({ one }) => ({
	user: one(users, { fields: [generatedPosts.userId], references: [users.id] }),
	template: one(templates, { fields: [generatedPosts.templateId], references: [templates.id] })
}));

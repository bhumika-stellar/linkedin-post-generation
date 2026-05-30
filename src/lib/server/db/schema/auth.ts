import { pgTable, text, timestamp, primaryKey, integer } from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from '@auth/sveltekit/adapters';

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
	// Notion internal integration credentials (set by each user in Settings)
	notionAccessToken: text('notion_access_token'),    // stores the integration secret (ntn_...)
	notionWorkspaceName: text('notion_workspace_name'), // reserved for future OAuth workspace name
	notionJournalPageId: text('notion_journal_page_id'), // the root journal page ID
	// LinkedIn credentials (set by each user in Settings).
	// LinkedIn does not issue durable API keys for member-level posting; this token
	// is generated manually from the LinkedIn developer portal's OAuth tools and is
	// valid for ~60 days. Users rotate it by pasting a fresh one. We mirror the
	// Notion pattern (token directly on the user row) deliberately — keeps the
	// settings UI symmetric and avoids inventing a new OAuth-link table for what
	// is, semantically, just another integration secret.
	linkedinAccessToken: text('linkedin_access_token'),
	linkedinMemberUrn: text('linkedin_member_urn'),     // urn:li:person:<sub>, returned by /v2/userinfo
	linkedinTokenExpiresAt: timestamp('linkedin_token_expires_at', { mode: 'date' }),
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

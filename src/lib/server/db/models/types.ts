/**
 * Centralised TypeScript types inferred directly from the Drizzle schema.
 *
 * Using InferSelectModel / InferInsertModel means these types are always in
 * sync with the actual table definitions — no manual type maintenance required.
 *
 * Select types (User, Post, …)  — what the DB returns from a SELECT.
 * Insert types (NewUser, …)     — what you pass to db.insert(); generated
 *                                  columns (id, createdAt) are optional.
 */
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { users, accounts, sessions } from '../schema/auth';
import type { notionPages, templates, generatedPosts } from '../schema/app';

// Re-export so the rest of the codebase can import PostImage from the models
// layer without needing to know it's defined in the schema layer.
export type { PostImage } from '../schema/app';
import type { automationSettings } from '../schema/automation';

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Account = InferSelectModel<typeof accounts>;
export type NewAccount = InferInsertModel<typeof accounts>;

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

export type NotionPage = InferSelectModel<typeof notionPages>;
export type NewNotionPage = InferInsertModel<typeof notionPages>;

export type Template = InferSelectModel<typeof templates>;
export type NewTemplate = InferInsertModel<typeof templates>;

export type GeneratedPost = InferSelectModel<typeof generatedPosts>;
export type NewGeneratedPost = InferInsertModel<typeof generatedPosts>;

export type AutomationSetting = InferSelectModel<typeof automationSettings>;
export type NewAutomationSetting = InferInsertModel<typeof automationSettings>;

// PostStatus combines the original manual lifecycle (draft/final/archived) with
// the new automation lifecycle (pending_review → approved → published/failed,
// plus skipped). The literal union mirrors the Drizzle column's $type<…>().
export type PostStatus =
	| 'draft'
	| 'final'
	| 'archived'
	| 'pending_review'
	| 'approved'
	| 'published'
	| 'failed'
	| 'skipped';

export type PostSource = 'manual' | 'auto';

export type AutomationFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type AutomationSourceType = 'notion_page' | 'notion_recent';

export type ConversationMessage = { role: 'user' | 'assistant'; content: string };

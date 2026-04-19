import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { users, accounts, sessions } from '../schema/auth';
import type { notionPages, templates, generatedPosts } from '../schema/app';

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

export type PostStatus = 'draft' | 'final' | 'archived';
export type ConversationMessage = { role: 'user' | 'assistant'; content: string };

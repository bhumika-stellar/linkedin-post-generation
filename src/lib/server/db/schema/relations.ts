import { relations } from 'drizzle-orm';
import { users, accounts, sessions } from './auth';
import { notionPages, templates, generatedPosts } from './app';

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

import { relations } from 'drizzle-orm';
import { users, accounts, sessions } from './auth';
import { notionPages, templates, generatedPosts } from './app';
import { automationSettings } from './automation';

export const usersRelations = relations(users, ({ many, one }) => ({
	accounts: many(accounts),
	sessions: many(sessions),
	notionPages: many(notionPages),
	templates: many(templates),
	generatedPosts: many(generatedPosts),
	// 1:1 — automationSettings.userId is the PK, so each user has at most one row.
	automationSetting: one(automationSettings, {
		fields: [users.id],
		references: [automationSettings.userId]
	})
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

export const automationSettingsRelations = relations(automationSettings, ({ one }) => ({
	user: one(users, { fields: [automationSettings.userId], references: [users.id] })
}));

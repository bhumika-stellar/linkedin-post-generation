/**
 * TemplateModel — data-access layer for the `template` table.
 *
 * A template is a saved set of instructions (systemPrompt) that the user can
 * apply to any generation with one click. The systemPrompt is sent as an
 * additional user-turn message after the source content, overriding the
 * default instruction the user typed in the chat bar.
 *
 * isDefault marks the template the user wants pre-selected on page load
 * (not yet surfaced in the UI — reserved for a future feature).
 * Deletion is hard-delete; all queries are scoped by userId.
 */
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../index';
import { templates } from '../schema/app';
import type { Template, NewTemplate } from './types';

export const TemplateModel = {
	async findByUser(userId: string): Promise<Template[]> {
		return db
			.select()
			.from(templates)
			.where(eq(templates.userId, userId))
			.orderBy(desc(templates.createdAt));
	},

	async create(data: NewTemplate): Promise<{ id: string }> {
		const [template] = await db.insert(templates).values(data).returning({ id: templates.id });
		return template;
	},

	async delete(id: string, userId: string): Promise<void> {
		await db
			.delete(templates)
			.where(and(eq(templates.id, id), eq(templates.userId, userId)));
	}
};

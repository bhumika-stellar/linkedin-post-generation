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

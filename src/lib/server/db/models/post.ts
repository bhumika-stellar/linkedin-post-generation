import { eq, and, desc } from 'drizzle-orm';
import { db } from '../index';
import { generatedPosts } from '../schema/app';
import type { GeneratedPost, NewGeneratedPost } from './types';

export const PostModel = {
	async findByUser(userId: string): Promise<GeneratedPost[]> {
		return db
			.select()
			.from(generatedPosts)
			.where(eq(generatedPosts.userId, userId))
			.orderBy(desc(generatedPosts.createdAt));
	},

	async create(data: NewGeneratedPost): Promise<{ id: string }> {
		const [post] = await db
			.insert(generatedPosts)
			.values(data)
			.returning({ id: generatedPosts.id });
		return post;
	},

	async delete(id: string, userId: string): Promise<void> {
		await db
			.delete(generatedPosts)
			.where(and(eq(generatedPosts.id, id), eq(generatedPosts.userId, userId)));
	}
};

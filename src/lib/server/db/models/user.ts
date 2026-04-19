import { eq } from 'drizzle-orm';
import { db } from '../index';
import { users } from '../schema/auth';
import type { User } from './types';

export const UserModel = {
	async findById(id: string): Promise<User | undefined> {
		const [user] = await db.select().from(users).where(eq(users.id, id));
		return user;
	},

	async findByEmail(email: string): Promise<User | undefined> {
		const [user] = await db.select().from(users).where(eq(users.email, email));
		return user;
	},

	async update(id: string, data: Partial<Pick<User, 'name' | 'openrouterApiKey' | 'preferredModel' | 'notionAccessToken' | 'notionWorkspaceName' | 'notionJournalPageId'>>) {
		const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
		return updated;
	}
};

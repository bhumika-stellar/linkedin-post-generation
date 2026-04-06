import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { generatedPosts } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();

	const posts = await db
		.select()
		.from(generatedPosts)
		.where(eq(generatedPosts.userId, session!.user!.id!))
		.orderBy(desc(generatedPosts.createdAt));

	return { posts };
};

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { generatedPosts } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const DELETE: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		error(401, 'Not authenticated');
	}

	const { id } = event.params;

	await db
		.delete(generatedPosts)
		.where(and(eq(generatedPosts.id, id), eq(generatedPosts.userId, session.user.id)));

	return json({ message: 'Post deleted' });
};

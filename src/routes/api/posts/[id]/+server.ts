import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PostModel } from '$lib/server/db/models';

export const DELETE: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		error(401, 'Not authenticated');
	}

	const { id } = event.params;

	await PostModel.delete(id, session.user.id);

	return json({ message: 'Post deleted' });
};

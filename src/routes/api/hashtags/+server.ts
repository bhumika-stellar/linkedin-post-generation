import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { suggestHashtags } from '$lib/server/ai';
import { UserModel } from '$lib/server/db/models/user';

export const POST: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		error(401, 'Not authenticated');
	}

	const body = await event.request.json();
	const { post } = body;

	if (!post || typeof post !== 'string') {
		error(400, 'post is required and must be a string');
	}

	const user = await UserModel.findById(session.user.id);
	const apiKey = user?.openrouterApiKey ?? undefined;

	const hashtags = await suggestHashtags(post, apiKey);
	return json({ hashtags });
};

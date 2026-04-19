import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PostModel } from '$lib/server/db/models';

export const POST: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		error(401, 'Not authenticated');
	}

	const body = await event.request.json();
	const { generatedContent, rawInput, conversationHistory = [], status = 'draft' } = body;

	if (!generatedContent || typeof generatedContent !== 'string') {
		error(400, 'generatedContent is required');
	}

	const post = await PostModel.create({
		userId: session.user.id,
		rawInput,
		generatedContent,
		conversationHistory,
		status
	});

	return json({ id: post.id, message: 'Post saved' });
};

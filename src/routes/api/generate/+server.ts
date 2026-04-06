import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generatePost } from '$lib/server/ai';

export const POST: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user) {
		error(401, 'Not authenticated');
	}

	const body = await event.request.json();
	const { content, conversationHistory = [], model } = body;

	if (!content || typeof content !== 'string') {
		error(400, 'content is required and must be a string');
	}

	try {
		const post = await generatePost(content, conversationHistory, model);
		return json({ post });
	} catch (err) {
		console.error('AI generation failed:', err);
		const message = err instanceof Error ? err.message : 'Unknown error';
		error(500, `AI generation failed: ${message}`);
	}
};

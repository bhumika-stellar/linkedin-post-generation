/**
 * POST /api/hashtags
 *
 * Suggests 3–5 LinkedIn hashtags for a generated post.
 *
 * Request body (JSON):
 *   post - The full text of the generated LinkedIn post.
 *
 * Response (JSON):
 *   { hashtags: string[] } — hashtag strings with the # prefix,
 *   e.g. ["#leadership", "#AI", "#growth"].
 *
 * Auth: session cookie required (401 if missing).
 *
 * Uses a fast free model (openrouter/free) regardless of the user's preferred
 * model, since hashtag suggestion is lightweight and does not need to be streamed.
 * Errors are silently swallowed in the AI layer and return an empty array so a
 * hashtag failure never blocks the user's post.
 */
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

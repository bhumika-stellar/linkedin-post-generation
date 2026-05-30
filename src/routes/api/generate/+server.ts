/**
 * POST /api/generate
 *
 * Streams a LinkedIn post from the AI model token-by-token.
 *
 * Request body (JSON):
 *   content            - Combined source text (URL extracts, Notion pages, pasted text).
 *                        May be an empty string when generating from the chat prompt alone.
 *   conversationHistory - Array of { role: 'user'|'assistant', content: string } pairs
 *                        representing the prior turns in this session.
 *   model              - OpenRouter model ID (defaults to FREE_MODELS[0]).
 *   tone               - Optional tone key ('storytelling' | 'data-driven' | 'thought-leader'
 *                        | 'casual' | 'inspirational').
 *
 * Response:
 *   text/plain stream — raw AI output chunks encoded as UTF-8.
 *   The client reads these with `res.body.getReader()` and appends each chunk
 *   to the displayed post in real time.
 *
 * Auth: session cookie required (401 if missing).
 *
 * The per-user OpenRouter API key is fetched from the DB and passed to the AI
 * module so paid models work transparently for users who have added their own key.
 * Falls back to the server-level OPENROUTER_API_KEY env var if no user key exists.
 */
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generatePostStream } from '$lib/server/ai';
import { UserModel } from '$lib/server/db/models/user';

export const POST: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		error(401, 'Not authenticated');
	}

	const body = await event.request.json();
	const { content = '', conversationHistory = [], model, tone = '' } = body;

	if (typeof content !== 'string') {
		error(400, 'content must be a string');
	}

	// Use the per-user OpenRouter key when available, fall back to the server key.
	const user = await UserModel.findById(session.user.id);
	const apiKey = user?.openrouterApiKey ?? undefined;

	try {
		const stream = await generatePostStream(
			content,
			conversationHistory,
			model,
			tone,
			apiKey
		);

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				// Tell Vercel / nginx not to buffer the stream.
				'X-Accel-Buffering': 'no',
				'Cache-Control': 'no-cache'
			}
		});
	} catch (err) {
		console.error('AI generation failed:', err);
		const message = err instanceof Error ? err.message : 'Unknown error';
		error(500, `AI generation failed: ${message}`);
	}
};

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

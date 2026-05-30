/**
 * POST /api/posts/[id]/refine
 *
 * "Refine an existing pending_review post with a fresh instruction from the
 *  user." This is the chat-style edit flow on /posts:
 *
 *   user types: "make it shorter"
 *     →
 *   we replay the original sourceContent + original prompt + the prior refinement
 *   turns + the new instruction, stream a fresh post, and persist it as
 *   `editedContent`. The `editConversation` keeps a log of the back-and-forth
 *   so subsequent refinements have context.
 *
 * Request body:
 *   { instruction: string }
 *
 * Response: text/plain stream — same shape as /api/generate so the client can
 * reuse the same reader code.
 *
 * Why a separate route instead of overloading /api/generate?
 *   /api/generate is stateless — it knows nothing about persistence. This route
 *   reads from and writes back to a specific row, which is a different concern.
 *   Keeping them separate also means /api/generate stays usable for the manual
 *   /generate page without entangling it with the auto-flow lifecycle.
 */
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PostModel, UserModel } from '$lib/server/db/models';
import { generatePostStream } from '$lib/server/ai';
import type { ConversationMessage } from '$lib/server/db/models/types';

export const POST: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, 'Not authenticated');

	const { id } = event.params;
	const { instruction } = await event.request.json();

	if (typeof instruction !== 'string' || !instruction.trim()) {
		error(400, 'instruction is required');
	}

	const post = await PostModel.findById(id, session.user.id);
	if (!post) error(404, 'Post not found');

	// Refinement is only meaningful on rows in the review/approved/failed states.
	// Trying to refine a published post would invalidate the LinkedIn URN.
	const refineable = ['pending_review', 'approved', 'failed'];
	if (!post.status || !refineable.includes(post.status)) {
		error(400, `Cannot refine a post with status '${post.status}'`);
	}

	// Build the conversation. We treat the standing prompt + the existing
	// generation as the "first turn", then append every refinement turn that
	// has happened so far, then the user's new instruction. The current draft
	// (editedContent if present, else the original generatedContent) is shown
	// to the model as the most recent assistant message — that's the thing
	// the user is asking us to refine.
	const currentDraft = post.editedContent ?? post.generatedContent;
	const priorEditConversation = (post.editConversation ?? []) as ConversationMessage[];

	// `originalConversationHistory` holds the cron's seed (just the prompt, by
	// design — see the cron's draft phase). We replay it so the model has the
	// same starting context.
	const originalConversation = (post.conversationHistory ?? []) as ConversationMessage[];

	const refinementHistory: ConversationMessage[] = [
		...originalConversation,
		// Anchor: this is the post produced by the seed conversation.
		{ role: 'assistant', content: currentDraft },
		...priorEditConversation,
		{ role: 'user', content: instruction.trim() }
	];

	// Fetch the user's OpenRouter key so paid models work for refinements too.
	const user = await UserModel.findById(session.user.id);
	const apiKey = user?.openrouterApiKey ?? undefined;

	let stream: ReadableStream<Uint8Array>;
	try {
		stream = await generatePostStream(
			post.sourceContent ?? '',
			refinementHistory,
			user?.preferredModel ?? undefined,
			'',
			apiKey
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Refinement failed';
		error(500, `AI refinement failed: ${message}`);
	}

	// Tee the stream: one branch goes to the client (so they see typing in
	// real time), the other accumulates so we can persist the final text.
	// This is the same pattern Vercel and OpenAI's own SDK use to "save and
	// stream" — duplicating the stream upstream avoids a second AI call.
	const [toClient, toBuffer] = stream.tee();

	// Capture the userId locally so the closure below has a non-nullable value
	// (the early `error(401)` already guarantees it exists at this point, but
	// TS narrowing doesn't carry into the IIFE).
	const userId = session.user.id;

	// Fire-and-forget: collect the buffered side and write it back to the row.
	(async () => {
		const reader = toBuffer.getReader();
		const decoder = new TextDecoder();
		let acc = '';
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				acc += decoder.decode(value, { stream: true });
			}
			acc += decoder.decode();

			await PostModel.update(id, userId, {
				editedContent: acc,
				editConversation: [
					...priorEditConversation,
					{ role: 'user', content: instruction.trim() },
					{ role: 'assistant', content: acc }
				]
			});
		} catch (err) {
			console.error('Failed to persist refinement:', err);
		}
	})();

	return new Response(toClient, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'X-Accel-Buffering': 'no',
			'Cache-Control': 'no-cache'
		}
	});
};

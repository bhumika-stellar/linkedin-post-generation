/**
 * POST /api/templates
 *
 * Saves the current chat session as a reusable template.
 *
 * Template format (the `systemPrompt` we persist):
 *
 *   <seed instruction — exactly what the user typed first>
 *
 *   Refinements applied during the original session:
 *   - <refinement 1>
 *   - <refinement 2>
 *
 * Why this shape over a flat join of every user turn?
 *   • The first user message is the *seed idea* — what the user actually
 *     wanted from a blank slate. It deserves top billing.
 *   • Later turns are *corrections to a draft* ("make it shorter", "end with
 *     a question"). Listing them as a labelled bullet list signals that to
 *     both humans (skimming the templates page) and to the AI on reuse.
 *   • Single-turn sessions skip the "Refinements" block entirely so we don't
 *     leave a dangling header.
 *
 * Single-message sessions store just the seed verbatim, so re-applying the
 * template feels like the user is re-typing their original prompt.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TemplateModel } from '$lib/server/db/models';
import { FIRST_TURN_INSTRUCTIONS_PREFIX } from '$lib/server/ai';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Strip the legacy first-turn wrapper that the client used to prepend before
 * the framing moved server-side. New sessions never include it; old
 * `localStorage` ones might. Keeping this defensive avoids leaking the magic
 * string into a user's saved template if they pick up an old session.
 */
function stripLegacyWrapper(content: string): string {
	return content.startsWith(FIRST_TURN_INSTRUCTIONS_PREFIX)
		? content.slice(FIRST_TURN_INSTRUCTIONS_PREFIX.length)
		: content;
}

function buildTemplatePrompt(history: ChatMessage[]): string {
	const userTurns = history.filter((m) => m.role === 'user').map((m) => m.content.trim());
	const [seedRaw, ...refinements] = userTurns;
	const seed = stripLegacyWrapper(seedRaw).trim();

	if (refinements.length === 0) return seed;

	const bulletList = refinements
		.filter((r) => r.length > 0)
		.map((r) => `- ${r}`)
		.join('\n');

	return `${seed}\n\nRefinements applied during the original session:\n${bulletList}`;
}

export const POST: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		error(401, 'Not authenticated');
	}

	const body = await event.request.json();
	const { name, conversationHistory = [] } = body as {
		name?: string;
		conversationHistory?: ChatMessage[];
	};

	if (!name || typeof name !== 'string') {
		error(400, 'name is required');
	}

	if (!conversationHistory.length) {
		error(400, 'conversationHistory is required to create a template');
	}

	if (!conversationHistory.some((m) => m.role === 'user')) {
		error(400, 'conversationHistory must contain at least one user message');
	}

	const systemPrompt = buildTemplatePrompt(conversationHistory);
	const refinementCount = conversationHistory.filter((m) => m.role === 'user').length - 1;

	const template = await TemplateModel.create({
		userId: session.user.id,
		name,
		description:
			refinementCount > 0
				? `Seed prompt + ${refinementCount} refinement${refinementCount === 1 ? '' : 's'}`
				: 'Single-prompt template',
		systemPrompt
	});

	return json({ id: template.id, message: 'Template saved' });
};

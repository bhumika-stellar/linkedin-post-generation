import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TemplateModel } from '$lib/server/db/models';

export const POST: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		error(401, 'Not authenticated');
	}

	const body = await event.request.json();
	const { name, conversationHistory = [] } = body;

	if (!name || typeof name !== 'string') {
		error(400, 'name is required');
	}

	if (!conversationHistory.length) {
		error(400, 'conversationHistory is required to create a template');
	}

	const guidelines = conversationHistory
		.filter((m: { role: string }) => m.role === 'user')
		.map((m: { content: string }) => m.content)
		.join('\n\n');

	const template = await TemplateModel.create({
		userId: session.user.id,
		name,
		description: `Template created from a ${conversationHistory.length}-message generation session`,
		systemPrompt: guidelines
	});

	return json({ id: template.id, message: 'Template saved' });
};

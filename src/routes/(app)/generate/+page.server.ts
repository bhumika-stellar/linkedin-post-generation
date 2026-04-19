import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { UserModel } from '$lib/server/db/models/user';
import { TemplateModel } from '$lib/server/db/models';
import { DEFAULT_MODEL } from '$lib/server/ai';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		redirect(303, '/login');
	}

	// Load user + templates in parallel — no reason to wait for one before the other
	const [user, templates] = await Promise.all([
		UserModel.findById(session.user.id),
		TemplateModel.findByUser(session.user.id)
	]);

	return {
		notionConfigured: !!(user?.notionAccessToken && user?.notionJournalPageId),
		// Only expose the fields the page needs — name and systemPrompt for the picker
		templates: templates.map((t) => ({ id: t.id, name: t.name, systemPrompt: t.systemPrompt })),
		preferredModel: user?.preferredModel ?? DEFAULT_MODEL
	};
};

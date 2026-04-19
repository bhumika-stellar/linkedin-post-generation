import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { UserModel } from '$lib/server/db/models/user';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		redirect(303, '/login');
	}

	const user = await UserModel.findById(session.user.id);

	// Only expose the fields the settings page needs — never send the full
	// user record to the client (it could contain sensitive data).
	return {
		settings: {
			preferredModel: user?.preferredModel ?? null,
			hasOpenrouterKey: !!user?.openrouterApiKey,
			hasNotionToken: !!user?.notionAccessToken,
			notionJournalPageId: user?.notionJournalPageId ?? null
		}
	};
};

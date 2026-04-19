import type { PageServerLoad } from './$types';
import { UserModel } from '$lib/server/db/models/user';
import { DEFAULT_MODEL } from '$lib/server/ai';

export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	// The (app) layout already redirects unauthenticated users, but we guard
	// here too so TypeScript knows session.user.id is defined below.
	if (!session?.user?.id) return { settings: null };

	const user = await UserModel.findById(session.user.id);

	return {
		settings: {
			preferredModel: user?.preferredModel ?? DEFAULT_MODEL,
			// Never send the raw token to the client — just whether one exists.
			hasNotionToken: !!user?.notionAccessToken,
			notionJournalPageId: user?.notionJournalPageId ?? ''
		}
	};
};

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listJournalPages } from '$lib/server/notion';
import { UserModel } from '$lib/server/db/models/user';

// GET /api/notion/pages
// Returns the list of weekly journal sub-pages so the UI can display a picker.
export const GET: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		error(401, 'Not authenticated');
	}

	// Load this user's Notion credentials from the DB.
	// Each user configures their own integration token and page ID in Settings.
	const user = await UserModel.findById(session.user.id);
	if (!user?.notionAccessToken || !user?.notionJournalPageId) {
		error(400, 'Notion is not configured. Go to Settings to add your integration token and journal page ID.');
	}

	try {
		const pages = await listJournalPages({
			apiKey: user.notionAccessToken,
			journalPageId: user.notionJournalPageId
		});
		return json({ pages });
	} catch (err) {
		console.error('Failed to fetch Notion pages:', err);
		const message = err instanceof Error ? err.message : 'Unknown error';
		error(500, `Failed to fetch Notion pages: ${message}`);
	}
};

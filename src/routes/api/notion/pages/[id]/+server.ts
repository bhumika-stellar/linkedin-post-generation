import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPageContent } from '$lib/server/notion';
import { UserModel } from '$lib/server/db/models/user';

// GET /api/notion/pages/:id
// Returns the full text content of a specific journal page, ready to be
// passed to the AI as source material.
export const GET: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		error(401, 'Not authenticated');
	}

	const user = await UserModel.findById(session.user.id);
	if (!user?.notionAccessToken || !user?.notionJournalPageId) {
		error(400, 'Notion is not configured. Go to Settings to add your integration token and journal page ID.');
	}

	const { id } = event.params;

	try {
		const content = await getPageContent(id, {
			apiKey: user.notionAccessToken,
			journalPageId: user.notionJournalPageId
		});
		return json({ content });
	} catch (err) {
		console.error(`Failed to fetch Notion page ${id}:`, err);
		const message = err instanceof Error ? err.message : 'Unknown error';
		error(500, `Failed to fetch Notion page: ${message}`);
	}
};

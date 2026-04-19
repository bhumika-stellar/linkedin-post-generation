import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { UserModel } from '$lib/server/db/models/user';

// PATCH /api/settings
// Accepts a partial settings object and merges it into the user's record.
// We use PATCH (not PUT) because the client only sends the fields it wants
// to change — the other fields are left untouched in the database.
export const PATCH: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) {
		error(401, 'Not authenticated');
	}

	const body = await event.request.json();

	// Whitelist only the fields we allow users to update via this route.
	// Never trust the client to tell you what fields to write.
	const allowed = [
		'preferredModel',
		'openrouterApiKey',
		'notionAccessToken',
		'notionJournalPageId'
	] as const;

	const updates: Record<string, unknown> = {};
	for (const key of allowed) {
		if (key in body) {
			updates[key] = body[key];
		}
	}

	if (Object.keys(updates).length === 0) {
		error(400, 'No valid fields to update');
	}

	const updated = await UserModel.update(session.user.id, updates);
	return json({ user: updated });
};

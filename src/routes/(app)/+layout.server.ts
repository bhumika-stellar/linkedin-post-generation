import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { PostModel } from '$lib/server/db/models';

export const load: LayoutServerLoad = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user) {
		redirect(303, '/login');
	}

	// Count of pending-review drafts the user hasn't acted on yet — drives
	// the badge on the "Posts" nav item. A single COUNT(*) query is cheap
	// enough to run on every (app) page render without caching.
	const pendingReviewCount = session.user.id
		? await PostModel.countPendingReview(session.user.id)
		: 0;

	return { session, pendingReviewCount };
};

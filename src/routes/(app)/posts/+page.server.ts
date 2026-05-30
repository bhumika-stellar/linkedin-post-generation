import type { PageServerLoad } from './$types';
import { PostModel } from '$lib/server/db/models';
import type { GeneratedPost } from '$lib/server/db/models/types';

/**
 * /posts loader.
 *
 * Returns the user's posts grouped by lifecycle stage so the page can render
 * each section without doing the bucketing in the template. Doing it on the
 * server keeps the Svelte side simple and testable — the loader becomes a
 * single source of truth for "what does each section contain?"
 *
 * One query, client-side grouping: cheaper and simpler than running five
 * separate queries against the same small table.
 */
export const load: PageServerLoad = async (event) => {
	const session = await event.locals.auth();
	const userId = session!.user!.id!;

	const all = await PostModel.findByUser(userId);

	// Build the buckets in one pass.
	const buckets = {
		pendingReview: [] as GeneratedPost[],
		scheduled: [] as GeneratedPost[],
		published: [] as GeneratedPost[],
		failed: [] as GeneratedPost[],
		drafts: [] as GeneratedPost[],
		archived: [] as GeneratedPost[]
	};

	for (const post of all) {
		switch (post.status) {
			case 'pending_review':
				buckets.pendingReview.push(post);
				break;
			case 'approved':
				buckets.scheduled.push(post);
				break;
			case 'published':
			case 'final':
				// Both manual "final" and automation "published" land here —
				// from the user's perspective they're "the polished, done posts".
				buckets.published.push(post);
				break;
			case 'failed':
				buckets.failed.push(post);
				break;
			case 'skipped':
				// Skipped is terminal and not interesting to show prominently;
				// roll into the archived section.
				buckets.archived.push(post);
				break;
			case 'archived':
				buckets.archived.push(post);
				break;
			case 'draft':
			default:
				buckets.drafts.push(post);
				break;
		}
	}

	return { buckets };
};

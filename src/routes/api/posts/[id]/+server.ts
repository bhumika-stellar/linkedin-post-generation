/**
 * /api/posts/[id]
 *
 *   PATCH  — partial update; backs the approve / skip / retry / inline-edit
 *            actions on /posts. State transitions are guarded so users can't
 *            jump from any status to any other.
 *
 *   DELETE — hard-delete a post. Existing behaviour, unchanged.
 *
 * Allowed transitions (in PATCH):
 *   pending_review → approved        (user clicks "Approve & schedule")
 *   pending_review → skipped         (user clicks "Skip")
 *   approved       → pending_review  (user changed their mind before publish)
 *   failed         → approved        (user clicks "Retry"; cron re-tries it)
 *
 * Anything else is rejected with 400. We don't allow flipping to 'published'
 * by hand — that's set by the cron after the actual LinkedIn POST succeeds,
 * so a manual flip would lie about reality.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PostModel } from '$lib/server/db/models';
import type { PostStatus } from '$lib/server/db/models/types';

const ALLOWED_TRANSITIONS: Record<string, Set<PostStatus>> = {
	pending_review: new Set<PostStatus>(['approved', 'skipped']),
	approved: new Set<PostStatus>(['pending_review', 'skipped']),
	failed: new Set<PostStatus>(['approved', 'skipped']),
	// Manual lifecycle stays untouched.
	draft: new Set<PostStatus>(['final', 'archived']),
	final: new Set<PostStatus>(['draft', 'archived']),
	archived: new Set<PostStatus>(['draft', 'final'])
};

export const PATCH: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, 'Not authenticated');

	const { id } = event.params;
	const body = await event.request.json();

	const post = await PostModel.findById(id, session.user.id);
	if (!post) error(404, 'Post not found');

	const updates: Parameters<typeof PostModel.update>[2] = {};

	if ('status' in body) {
		const next = body.status as PostStatus;
		const allowed = ALLOWED_TRANSITIONS[post.status ?? 'draft'];
		if (!allowed?.has(next)) {
			error(400, `Cannot transition from '${post.status}' to '${next}'`);
		}
		updates.status = next;

		// Retrying a failed post: clear the previous reason so the UI doesn't
		// keep showing it, and the cron treats it as a clean attempt.
		if (post.status === 'failed' && next === 'approved') {
			updates.failureReason = null;
		}
	}

	if ('editedContent' in body) {
		if (typeof body.editedContent !== 'string') error(400, 'editedContent must be a string');
		updates.editedContent = body.editedContent;
	}

	if ('scheduledFor' in body) {
		if (body.scheduledFor === null) {
			updates.scheduledFor = null;
		} else if (typeof body.scheduledFor === 'string') {
			const d = new Date(body.scheduledFor);
			if (Number.isNaN(d.getTime())) error(400, 'scheduledFor is not a valid date');
			updates.scheduledFor = d;
		} else {
			error(400, 'scheduledFor must be an ISO string or null');
		}
	}

	if (Object.keys(updates).length === 0) {
		error(400, 'No valid fields to update');
	}

	const updated = await PostModel.update(id, session.user.id, updates);
	return json({ post: updated });
};

export const DELETE: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user?.id) error(401, 'Not authenticated');

	const { id } = event.params;
	await PostModel.delete(id, session.user.id);

	return json({ message: 'Post deleted' });
};

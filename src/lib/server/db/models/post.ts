/**
 * PostModel — data-access layer for the `generated_post` table.
 *
 * A post is created in two ways:
 *   1. Manual flow — user clicks "Save" in /generate. status='draft', source='manual'.
 *   2. Auto flow   — the daily cron drafts a post. status='pending_review', source='auto'.
 *
 * Status state machine:
 *   manual:   draft → final → archived
 *   auto:     pending_review → approved → published or failed
 *                           → skipped
 *
 * Image flow:
 *   Notion images are extracted at page-fetch time, uploaded to Vercel Blob
 *   for durability, and stored in the `images` JSON column as PostImage[].
 *   At publish time, the cron reads these and uploads them to LinkedIn's
 *   Images API before creating the post.
 *
 * All queries are scoped by userId (or by status filters in the cron's case)
 * to prevent cross-user access. Deletion is hard-delete.
 */
import { and, desc, eq, lte, asc, count } from 'drizzle-orm';
import { db } from '../index';
import { generatedPosts } from '../schema/app';
import type { GeneratedPost, NewGeneratedPost, PostStatus } from './types';

export const PostModel = {
	async findByUser(userId: string): Promise<GeneratedPost[]> {
		return db
			.select()
			.from(generatedPosts)
			.where(eq(generatedPosts.userId, userId))
			.orderBy(desc(generatedPosts.createdAt));
	},

	async findById(id: string, userId: string): Promise<GeneratedPost | undefined> {
		const [post] = await db
			.select()
			.from(generatedPosts)
			.where(and(eq(generatedPosts.id, id), eq(generatedPosts.userId, userId)));
		return post;
	},

	async create(data: NewGeneratedPost): Promise<{ id: string }> {
		const [post] = await db
			.insert(generatedPosts)
			.values(data)
			.returning({ id: generatedPosts.id });
		return post;
	},

	async delete(id: string, userId: string): Promise<void> {
		await db
			.delete(generatedPosts)
			.where(and(eq(generatedPosts.id, id), eq(generatedPosts.userId, userId)));
	},

	/**
	 * Generic partial update, scoped to userId.
	 * Backs the approve / skip / retry / inline-edit actions on /posts.
	 *
	 * Whitelist enforcement happens at the API route — this method is the
	 * thin pass-through. Always bumps `updatedAt` so list views can sort by
	 * "most recently touched" if we want.
	 */
	async update(
		id: string,
		userId: string,
		data: Partial<
			Pick<
				GeneratedPost,
				| 'status'
				| 'editedContent'
				| 'scheduledFor'
				| 'failureReason'
				| 'editConversation'
			>
		>
	): Promise<GeneratedPost | undefined> {
		const [updated] = await db
			.update(generatedPosts)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(generatedPosts.id, id), eq(generatedPosts.userId, userId)))
			.returning();
		return updated;
	},

	/**
	 * Mark a post as published. Called by the cron's publish phase after a
	 * successful POST to /rest/posts. Stores the LinkedIn URN so the UI can
	 * link out to the live post.
	 *
	 * Not scoped by userId on purpose — the cron acts on behalf of the user
	 * via the post's stored userId, so we only need the post id.
	 */
	async markPublished(id: string, linkedinPostUrn: string): Promise<void> {
		await db
			.update(generatedPosts)
			.set({
				status: 'published',
				publishedAt: new Date(),
				linkedinPostUrn,
				failureReason: null,
				updatedAt: new Date()
			})
			.where(eq(generatedPosts.id, id));
	},

	/**
	 * Mark a post as failed. Stores the human-readable reason so /posts can
	 * surface it next to a Retry button.
	 */
	async markFailed(id: string, reason: string): Promise<void> {
		await db
			.update(generatedPosts)
			.set({
				status: 'failed',
				failureReason: reason,
				updatedAt: new Date()
			})
			.where(eq(generatedPosts.id, id));
	},

	/**
	 * Approved rows whose scheduled time has come. The cron's publish phase
	 * loads this list every run and pushes each one to LinkedIn.
	 *
	 * Idempotency: once published, status flips to 'published' so the same
	 * row never appears in this query again — even if Vercel retries the cron.
	 */
	async findApprovedDueBefore(when: Date): Promise<GeneratedPost[]> {
		return db
			.select()
			.from(generatedPosts)
			.where(
				and(
					eq(generatedPosts.status, 'approved'),
					lte(generatedPosts.scheduledFor, when)
				)
			)
			.orderBy(asc(generatedPosts.scheduledFor));
	},

	/**
	 * Count of pending_review rows for a user. Powers the badge on the
	 * "Posts" nav item.
	 */
	async countPendingReview(userId: string): Promise<number> {
		const [row] = await db
			.select({ value: count() })
			.from(generatedPosts)
			.where(
				and(
					eq(generatedPosts.userId, userId),
					eq(generatedPosts.status, 'pending_review')
				)
			);
		return row?.value ?? 0;
	},

	/**
	 * Group helper: returns posts filtered by a status set, scoped to a user.
	 * Used by the /posts loader to fetch each section in one round trip.
	 */
	async findByUserAndStatuses(
		userId: string,
		statuses: PostStatus[]
	): Promise<GeneratedPost[]> {
		if (statuses.length === 0) return [];
		const all = await db
			.select()
			.from(generatedPosts)
			.where(eq(generatedPosts.userId, userId))
			.orderBy(desc(generatedPosts.createdAt));
		// Filter client-side because Drizzle's `inArray` types don't play
		// nicely with our literal-union `status` column. The list is small
		// per user, so the perf cost is negligible.
		const set = new Set<string>(statuses);
		return all.filter((p) => p.status !== null && set.has(p.status));
	}
};

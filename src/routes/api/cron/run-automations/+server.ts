/**
 * GET /api/cron/run-automations
 *
 * The single daily cron. Does both halves of the workflow:
 *
 *   Phase A — Drafting
 *     For each user with a fully-configured, enabled automation, decide
 *     whether a fresh draft is due today (based on frequency vs lastDraftAt).
 *     If so: pull the source from Notion (text + images), download images to
 *     Vercel Blob for durability, generate a post via the AI pipeline, write
 *     a row with status='pending_review' and a computed scheduled_for, and
 *     bump lastDraftAt.
 *
 *   Phase B — Publishing
 *     Find every row with status='approved' and scheduled_for <= now().
 *     Upload any stored images to LinkedIn's Images API, then push the post
 *     to LinkedIn. Mark published or failed.
 *
 * Both phases are independent and run on every cron invocation. That means a
 * post drafted Saturday and approved Sunday will publish on Monday's cron —
 * we never need to schedule a job; "approved + due" is a query, not a queue.
 *
 * Auth:
 *   Vercel Cron auto-attaches `Authorization: Bearer <CRON_SECRET>`.
 *   Locally / curl, you can pass the same header to test by hand.
 */
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import {
	AutomationSettingModel,
	PostModel,
	UserModel
} from '$lib/server/db/models';
import type {
	AutomationSetting,
	User,
	PostImage
} from '$lib/server/db/models/types';
import { getPageContent, listJournalPages } from '$lib/server/notion';
import { storeNotionImage } from '$lib/server/storage';
import { generatePostStream } from '$lib/server/ai';
import { publishPost } from '$lib/server/linkedin';
import { isDraftDue, computeNextPublishTime } from '$lib/server/automation';
import { sendDraftReadyEmail } from '$lib/server/email';

interface RunReport {
	startedAt: string;
	finishedAt: string;
	drafted: number;
	publishedCount: number;
	skipped: Array<{ userId: string; reason: string }>;
	failed: Array<{ id: string; reason: string }>;
}

export const GET: RequestHandler = async (event) => {
	// ── Auth ─────────────────────────────────────────────────────────────────
	const expected = env.CRON_SECRET;
	if (!expected) {
		error(500, 'CRON_SECRET is not configured');
	}
	const authHeader = event.request.headers.get('authorization');
	if (authHeader !== `Bearer ${expected}`) {
		error(401, 'Invalid cron secret');
	}

	const now = new Date();
	const report: RunReport = {
		startedAt: now.toISOString(),
		finishedAt: '',
		drafted: 0,
		publishedCount: 0,
		skipped: [],
		failed: []
	};

	// ── Phase A — Drafting ───────────────────────────────────────────────────
	const eligible = await AutomationSettingModel.findEligible();

	for (const { user, automation } of eligible) {
		try {
			if (!isDraftDue(automation, now)) {
				report.skipped.push({ userId: user.id, reason: 'not due yet' });
				continue;
			}

			const { text: sourceContent, images } = await fetchSourceContent(user, automation);
			if (!sourceContent || !sourceContent.trim()) {
				report.skipped.push({ userId: user.id, reason: 'no source content found' });
				continue;
			}

			// Same conversation shape the manual /generate flow produces.
			const conversationHistory = [
				{ role: 'user' as const, content: automation.prompt ?? '' }
			];

			const generated = await generateOnce(
				sourceContent,
				conversationHistory,
				user.preferredModel ?? undefined,
				user.openrouterApiKey ?? undefined
			);

			const scheduledFor = computeNextPublishTime(automation, now);

			const { id: postId } = await PostModel.create({
				userId: user.id,
				source: 'auto',
				status: 'pending_review',
				generatedContent: generated,
				sourceContent,
				images,
				conversationHistory,
				scheduledFor
			});

			await AutomationSettingModel.touchLastDraftAt(user.id, now);
			report.drafted++;

			if (user.email) {
				const preview = generated.slice(0, 100);
				const appUrl = env.APP_URL ?? 'http://localhost:5176';
				await sendDraftReadyEmail(user.email, postId, preview, appUrl);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'unknown error';
			report.skipped.push({ userId: user.id, reason: `draft failed: ${message}` });
			console.error(`[cron] draft failed for user ${user.id}:`, err);
		}
	}

	// ── Phase B — Publishing ─────────────────────────────────────────────────
	const due = await PostModel.findApprovedDueBefore(now);
	for (const post of due) {
		try {
			const user = await UserModel.findById(post.userId);
			if (!user?.linkedinAccessToken || !user?.linkedinMemberUrn) {
				await PostModel.markFailed(post.id, 'LinkedIn is not connected');
				report.failed.push({ id: post.id, reason: 'no linkedin connection' });
				continue;
			}

			const text = post.editedContent ?? post.generatedContent;

			// Build the images array for the LinkedIn publisher.
			// post.images may be null (pre-image-feature rows) or an empty array
			// (text-only posts), so we guard with ?. / ?? [].
			const storedImages = (post.images ?? []) as PostImage[];
			const imagesToPost = storedImages.map((img) => ({
				url: img.blobUrl,
				altText: img.altText,
				contentType: img.contentType
			}));

			const urn = await publishPost({
				accessToken: user.linkedinAccessToken,
				memberUrn: user.linkedinMemberUrn,
				text,
				images: imagesToPost.length > 0 ? imagesToPost : undefined
			});

			await PostModel.markPublished(post.id, urn);
			report.publishedCount++;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'unknown error';
			await PostModel.markFailed(post.id, message);
			report.failed.push({ id: post.id, reason: message });
			console.error(`[cron] publish failed for post ${post.id}:`, err);
		}
	}

	report.finishedAt = new Date().toISOString();
	return json(report);
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pull Notion content for this user's automation configuration.
 * Returns both the text (for the AI prompt) and images (stored to Vercel Blob
 * for use when publishing to LinkedIn).
 *
 * For 'notion_page': use the configured page id directly.
 * For 'notion_recent': list journal children, filter to those edited within
 *   the lookback window, take the most recent.
 */
async function fetchSourceContent(
	user: User,
	automation: AutomationSetting
): Promise<{ text: string; images: PostImage[] }> {
	const credentials = {
		apiKey: user.notionAccessToken!,
		journalPageId: user.notionJournalPageId!
	};

	let pageId: string | null = null;

	if (automation.sourceType === 'notion_page') {
		if (!automation.sourcePageId) return { text: '', images: [] };
		pageId = automation.sourcePageId;
	} else {
		// notion_recent: list + filter + sort
		const lookback = automation.sourceLookbackDays ?? 5;
		const cutoff = Date.now() - lookback * 24 * 60 * 60 * 1000;
		const pages = await listJournalPages(credentials);
		const recent = pages
			.filter((p) => new Date(p.lastEditedTime).getTime() >= cutoff)
			.sort(
				(a, b) =>
					new Date(b.lastEditedTime).getTime() - new Date(a.lastEditedTime).getTime()
			);

		if (recent.length === 0) return { text: '', images: [] };
		pageId = recent[0].id;
	}

	const { text, images: notionImages } = await getPageContent(pageId, credentials);

	// Download each image from Notion's temporary URL and upload to Vercel Blob.
	// storeNotionImage returns null on failure — we skip those rather than
	// aborting the whole draft.
	const imageResults = await Promise.all(
		notionImages.map((img) =>
			storeNotionImage(img.url, pageId!, img.blockId, img.altText)
		)
	);
	const images = imageResults.filter((img): img is PostImage => img !== null);

	return { text, images };
}

/**
 * Run AI generation and accumulate the streamed output into a single string.
 * The cron has nowhere to stream to, so we buffer the full response.
 */
async function generateOnce(
	content: string,
	conversationHistory: { role: 'user' | 'assistant'; content: string }[],
	model: string | undefined,
	apiKey: string | undefined
): Promise<string> {
	const stream = await generatePostStream(content, conversationHistory, model, '', apiKey);
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let acc = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		acc += decoder.decode(value, { stream: true });
	}
	acc += decoder.decode();
	return acc.trim();
}

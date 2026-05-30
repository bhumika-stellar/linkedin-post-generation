import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPageContent } from '$lib/server/notion';
import { storeNotionImage } from '$lib/server/storage';
import { UserModel } from '$lib/server/db/models/user';

// GET /api/notion/pages/:id
// Returns the full text content of a specific journal page plus any images
// extracted from image blocks, stored durably in Vercel Blob.
//
// Response shape:
//   { content: string, images: PostImage[] }
//
// Why download images here instead of returning Notion URLs directly?
//   Notion signs image URLs with a ~1-hour expiry. If we returned those URLs
//   to the browser, the user would see broken images within the hour and we
//   couldn't safely reference them when publishing to LinkedIn later.
//   Uploading to Blob immediately converts the short-lived URL to a permanent
//   one — a technique called "URL proxying" or "asset mirroring".
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
		const { text, images: notionImages } = await getPageContent(id, {
			apiKey: user.notionAccessToken,
			journalPageId: user.notionJournalPageId
		});

		// Download each image from the temporary Notion URL and upload to
		// Vercel Blob. We run them concurrently (Promise.all) since they're
		// independent — this is fine for a typical page (< 20 images).
		// storeNotionImage returns null on failure so one bad image doesn't
		// break the whole page load.
		const imageResults = await Promise.all(
			notionImages.map((img) =>
				storeNotionImage(img.url, id, img.blockId, img.altText)
			)
		);

		// Filter out nulls from failed uploads.
		const images = imageResults.filter((img) => img !== null);

		return json({ content: text, images });
	} catch (err) {
		console.error(`Failed to fetch Notion page ${id}:`, err);
		const message = err instanceof Error ? err.message : 'Unknown error';
		error(500, `Failed to fetch Notion page: ${message}`);
	}
};

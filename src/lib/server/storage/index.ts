/**
 * Storage helpers — download images from temporary URLs and persist them to
 * Vercel Blob so they are available indefinitely.
 *
 * Why this module exists?
 *   Notion image URLs are signed and expire after ~1 hour. LinkedIn image URLs
 *   also expire. We need a durable copy that lives as long as the post does.
 *   Vercel Blob is the natural choice for a Vercel-deployed project: zero
 *   infrastructure, simple API, and a generous free tier.
 *
 * Single Responsibility: this module only knows about downloading bytes and
 * uploading them to Blob. It does not know about Notion blocks, LinkedIn posts,
 * or database rows.
 *
 * Authentication — two methods, resolved in priority order:
 *   1. BLOB_READ_WRITE_TOKEN (classic) — a static token you paste in .env.
 *   2. VERCEL_OIDC_TOKEN + BLOB_STORE_ID (OIDC) — injected automatically by
 *      Vercel in production and by `vercel dev` locally.
 *
 *   SvelteKit's Vite server does not expose .env.local to process.env, so
 *   we read both via $env/dynamic/private and pass them explicitly to put().
 */
import { put } from '@vercel/blob';
import { env } from '$env/dynamic/private';
import type { PostImage } from '$lib/server/db/schema/app';

/**
 * Build the auth options object for @vercel/blob. The SDK accepts either a
 * classic read-write token OR an OIDC token paired with a store ID. We check
 * for both and pass whichever is available, keeping the call site clean.
 */
function blobAuthOptions(): { token?: string; oidcToken?: string; storeId?: string } {
	if (env.BLOB_READ_WRITE_TOKEN) {
		return { token: env.BLOB_READ_WRITE_TOKEN };
	}
	if (env.VERCEL_OIDC_TOKEN && env.BLOB_STORE_ID) {
		return { oidcToken: env.VERCEL_OIDC_TOKEN, storeId: env.BLOB_STORE_ID };
	}
	return {};
}

/**
 * Maps a MIME type to a file extension for constructing readable Blob paths.
 * LinkedIn supports JPG, PNG, and GIF for images.
 */
function extFromContentType(contentType: string): string {
	if (contentType.includes('png')) return 'png';
	if (contentType.includes('gif')) return 'gif';
	if (contentType.includes('webp')) return 'webp';
	return 'jpg'; // default — LinkedIn accepts image/jpeg for most uploads
}

/**
 * Download a single image from `url` and upload it to Vercel Blob.
 *
 * @param url        - Temporary source URL (e.g. from Notion's API).
 * @param pageId     - Notion page ID — used as a namespace in the Blob path.
 * @param blockId    - Notion block ID — used as the file stem in the Blob path.
 * @param altText    - Caption text from the Notion block.
 * @returns          - A PostImage with a permanent blobUrl, or null if the
 *                     download or upload failed. Returning null instead of
 *                     throwing lets callers skip broken images without failing
 *                     the entire page fetch.
 */
export async function storeNotionImage(
	url: string,
	pageId: string,
	blockId: string,
	altText: string
): Promise<PostImage | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) {
			console.warn(`[storage] Failed to download image (${res.status}): ${url}`);
			return null;
		}

		const buffer = await res.arrayBuffer();
		const contentType = res.headers.get('content-type') ?? 'image/jpeg';
		const ext = extFromContentType(contentType);

		// Path is namespaced by page → block so multiple pages never collide.
		// Example: notion-images/abc123/def456.jpg
		const pathname = `notion-images/${pageId}/${blockId}.${ext}`;

		const blob = await put(pathname, buffer, {
			access: 'public',
			contentType,
			addRandomSuffix: false,
			allowOverwrite: true,
			...blobAuthOptions()
		});

		return { blobUrl: blob.url, altText, notionBlockId: blockId, contentType };
	} catch (err) {
		console.warn(`[storage] Skipping image ${blockId}:`, err);
		return null;
	}
}

/**
 * Download an image from a durable URL (e.g. Vercel Blob) and return the
 * raw binary. Used by the LinkedIn publisher to upload images to LinkedIn's
 * asset API immediately before posting.
 *
 * Separation of concerns: this keeps the LinkedIn module free of fetch logic.
 */
export async function downloadImage(url: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to download image from ${url}: ${res.status}`);
	}
	const buffer = await res.arrayBuffer();
	const contentType = res.headers.get('content-type') ?? 'image/jpeg';
	return { buffer, contentType };
}

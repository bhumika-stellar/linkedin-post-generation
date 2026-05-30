/**
 * LinkedIn helper — talks to the LinkedIn REST API.
 *
 * Three responsibilities:
 *   1. verifyToken()   — validate a pasted access token, return the member URN
 *                        needed as the `author` of every post.
 *   2. uploadImage()   — upload a single image to LinkedIn's Images API and
 *                        return the `urn:li:image:{id}` asset URN.
 *   3. publishPost()   — POST to /rest/posts with optional image content.
 *                        Handles text-only, single-image, and multi-image posts.
 *
 * --- API migration note ---
 * The previous version used /v2/ugcPosts (text-only, deprecated UGC API).
 * This version uses /rest/posts, which is LinkedIn's current Posts API and
 * the only endpoint that supports image and multi-image posts.
 *
 * Key differences:
 *   - Endpoint: /rest/posts (not /v2/ugcPosts)
 *   - Body shape: flat `commentary` field (not nested specificContent)
 *   - New required header: LinkedIn-Version: YYYYMM
 *   - Images are uploaded separately via /rest/images?action=initializeUpload,
 *     then referenced by URN in the post body.
 *
 * Why pasted token instead of OAuth?
 *   Mirrors the Notion integration pattern: user pastes a ~60-day LinkedIn
 *   access token from the developer portal's OAuth Token Tools. Simpler than
 *   a full OAuth redirect flow for a personal-use tool, but the user must
 *   re-paste every ~60 days. Trade-off: simplicity vs. UX friction.
 */

const BASE = 'https://api.linkedin.com';

// LinkedIn versions their REST API by calendar month (YYYYMM format).
// Pin to a specific month so we always get a stable, documented behaviour.
// Update this when LinkedIn deprecates older versions (check their changelog).
const LINKEDIN_VERSION = '202605';

// Shared headers for all /rest/* endpoints.
function restHeaders(accessToken: string): Record<string, string> {
	return {
		Authorization: `Bearer ${accessToken}`,
		'Content-Type': 'application/json',
		'LinkedIn-Version': LINKEDIN_VERSION,
		'X-Restli-Protocol-Version': '2.0.0'
	};
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerifiedToken {
	memberUrn: string;    // e.g. 'urn:li:person:abc123'
	memberName: string;
	memberEmail: string;
	// LinkedIn's userinfo response doesn't include expiry. We compute a
	// best-effort 60-day hint shown in Settings — not a guarantee.
	expiresAtHint: Date;
}

interface UserInfoResponse {
	sub: string;
	name?: string;
	email?: string;
}

/** A single image to attach to a post. */
export interface ImageToPost {
	url: string;     // permanent URL to download from (e.g. Vercel Blob)
	altText: string; // screen-reader description; empty string is fine
	contentType: string; // 'image/jpeg', 'image/png', 'image/gif'
}

export interface PublishOptions {
	accessToken: string;
	memberUrn: string;
	text: string;
	images?: ImageToPost[];
}

// ---------------------------------------------------------------------------
// verifyToken
// ---------------------------------------------------------------------------
// Calls the OpenID Connect userinfo endpoint to:
//   1. Validate the token.
//   2. Confirm scopes (openid profile email).
//   3. Return the member ID — wrapped as urn:li:person:<id>, the `author`
//      field every post requires. Without this URN we can't construct a post.

export async function verifyToken(accessToken: string): Promise<VerifiedToken> {
	const res = await fetch(`${BASE}/v2/userinfo`, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`LinkedIn token verification failed (${res.status}): ${body || res.statusText}`);
	}

	const data: UserInfoResponse = await res.json();

	const expiresAtHint = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

	return {
		memberUrn: `urn:li:person:${data.sub}`,
		memberName: data.name ?? '',
		memberEmail: data.email ?? '',
		expiresAtHint
	};
}

// ---------------------------------------------------------------------------
// uploadImage
// ---------------------------------------------------------------------------
// Two-step process required by the LinkedIn Images API:
//   Step 1 — POST /rest/images?action=initializeUpload
//             LinkedIn registers the upcoming upload and returns:
//               - uploadUrl: a pre-signed S3-like URL to PUT the binary to
//               - image: the asset URN (urn:li:image:{id})
//   Step 2 — PUT uploadUrl with raw binary data
//             LinkedIn receives the image bytes. Status moves to AVAILABLE.
//
// After both steps succeed, the returned URN can be referenced in a post.
// LinkedIn supports: JPG, PNG, GIF (max 36,152,320 px, max 36 MB for images).

async function uploadImage(
	accessToken: string,
	ownerUrn: string,
	buffer: ArrayBuffer,
	contentType: string
): Promise<string> {
	// Step 1: register the upload
	const initRes = await fetch(`${BASE}/rest/images?action=initializeUpload`, {
		method: 'POST',
		headers: restHeaders(accessToken),
		body: JSON.stringify({
			initializeUploadRequest: { owner: ownerUrn }
		})
	});

	if (!initRes.ok) {
		const body = await initRes.text().catch(() => '');
		throw new Error(`LinkedIn image init failed (${initRes.status}): ${body}`);
	}

	const initData = await initRes.json();
	const uploadUrl: string = initData.value?.uploadUrl;
	const imageUrn: string = initData.value?.image;

	if (!uploadUrl || !imageUrn) {
		throw new Error('LinkedIn image init returned unexpected shape: ' + JSON.stringify(initData));
	}

	// Step 2: upload the binary
	const uploadRes = await fetch(uploadUrl, {
		method: 'PUT',
		// LinkedIn expects the raw binary, not multipart/form-data.
		// The Content-Type must match the actual image format.
		headers: { 'Content-Type': contentType },
		body: buffer
	});

	if (!uploadRes.ok) {
		const body = await uploadRes.text().catch(() => '');
		throw new Error(`LinkedIn image upload failed (${uploadRes.status}): ${body}`);
	}

	return imageUrn; // e.g. 'urn:li:image:C4E10AQFoyyAjHPMQuQ'
}

// ---------------------------------------------------------------------------
// publishPost
// ---------------------------------------------------------------------------
// Builds the correct post body shape depending on image count:
//   0 images → text-only post (no `content` field)
//   1 image  → single-image post: content.media.id = imageUrn
//   2-20     → multi-image post:  content.multiImage.images = [...urns]
//
// All images are uploaded first (concurrently), then the post is created.
// Uploading first ensures we don't partially create a post if an upload fails.
//
// Returns the LinkedIn post URN (e.g. 'urn:li:share:7193...'), which we store
// so the user can click through to their live post on LinkedIn.

export async function publishPost(opts: PublishOptions): Promise<string> {
	// Download and upload images to LinkedIn if any are present.
	// We do this before constructing the post body so that if any upload fails,
	// we throw before hitting /rest/posts (avoiding partial post creation).
	let content: Record<string, unknown> | undefined;

	if (opts.images && opts.images.length > 0) {
		// Download from Vercel Blob then upload to LinkedIn.
		// Using Promise.all keeps the pipeline fast when there are multiple images.
		const imageUrns = await Promise.all(
			opts.images.map(async (img) => {
				// Download the image binary from its permanent URL (Vercel Blob).
				const downloadRes = await fetch(img.url);
				if (!downloadRes.ok) {
					throw new Error(`Failed to download image ${img.url}: ${downloadRes.status}`);
				}
				const buffer = await downloadRes.arrayBuffer();
				const urn = await uploadImage(opts.accessToken, opts.memberUrn, buffer, img.contentType);
				return { urn, altText: img.altText };
			})
		);

		if (imageUrns.length === 1) {
			// Single-image post: content.media
			content = {
				media: {
					altText: imageUrns[0].altText || undefined,
					id: imageUrns[0].urn
				}
			};
		} else {
			// Multi-image post (2-20): content.multiImage
			// Requires at least 2 images — the LinkedIn API rejects fewer.
			content = {
				multiImage: {
					images: imageUrns.map(({ urn, altText }) => ({
						id: urn,
						...(altText ? { altText } : {})
					}))
				}
			};
		}
	}

	const body: Record<string, unknown> = {
		author: opts.memberUrn,
		// `commentary` is the flat post text in the new Posts API.
		// (The old UGC API used specificContent.shareCommentary.text.)
		commentary: opts.text,
		visibility: 'PUBLIC',
		distribution: {
			feedDistribution: 'MAIN_FEED',
			targetEntities: [],
			thirdPartyDistributionChannels: []
		},
		lifecycleState: 'PUBLISHED',
		isReshareDisabledByAuthor: false
	};

	if (content) {
		body.content = content;
	}

	const res = await fetch(`${BASE}/rest/posts`, {
		method: 'POST',
		headers: restHeaders(opts.accessToken),
		body: JSON.stringify(body)
	});

	if (!res.ok) {
		const errBody = await res.text().catch(() => '');
		throw new Error(`LinkedIn publish failed (${res.status}): ${errBody || res.statusText}`);
	}

	// The /rest/posts API returns the new post URN in the x-restli-id header.
	// Some LinkedIn API responses also include it in the body `id` field —
	// we check both for robustness.
	const data = (await res.json().catch(() => ({}))) as { id?: string };
	const headerUrn = res.headers.get('x-restli-id');
	const urn = data.id ?? headerUrn;

	if (!urn) {
		throw new Error('LinkedIn publish succeeded but no post URN was returned');
	}

	return urn;
}

# LinkedIn Module

## Purpose
Validates access tokens and publishes posts (text-only, single-image, or
multi-image) to LinkedIn on behalf of a user.

## How it works

### Token verification
`verifyToken(accessToken)` calls `/v2/userinfo` (OpenID Connect). This validates
the token, confirms required scopes, and returns the `memberUrn`
(`urn:li:person:{sub}`) which every post requires as the `author` field.

### Image upload — two steps required by LinkedIn
1. **Initialize**: `POST /rest/images?action=initializeUpload` with the owner
   URN → LinkedIn returns a pre-signed `uploadUrl` and an image asset URN
   (`urn:li:image:{id}`).
2. **Upload binary**: `PUT uploadUrl` with the raw image bytes. No auth header
   needed — the URL is pre-signed.

### Post creation
`publishPost(opts)` handles three cases based on `opts.images.length`:
- **0 images** → plain text post, no `content` field.
- **1 image** → `content.media.id = imageUrn`.
- **2–20 images** → `content.multiImage.images = [{id, altText}, ...]`.

Images are downloaded from their `blobUrl` (Vercel Blob) and uploaded to LinkedIn
before the post body is sent, so a failed upload does not create a partial post.

## Key files
| File | Responsibility |
|---|---|
| `index.ts` | `verifyToken`, `uploadImage` (internal), `publishPost` (public) |

## Design decisions
- **API migration**: The old code used `/v2/ugcPosts` (deprecated UGC API,
  text-only). This module now uses `/rest/posts`, which is LinkedIn's current
  Posts API and the only one that supports image posts. The body shape changed
  from nested `specificContent.shareCommentary.text` to a flat `commentary` field.
- **LinkedIn-Version header pinned to `202505`**: LinkedIn versions its REST API
  by month. Pinning avoids silent behaviour changes. Update the constant when
  LinkedIn deprecates older versions.
- **Pasted token, not full OAuth**: Users paste a ~60-day access token from the
  LinkedIn developer portal. Simpler code, symmetric with the Notion integration
  pattern. Trade-off: users must re-paste every ~60 days.
- **Upload-before-post ordering**: Images are uploaded with `Promise.all` before
  the post body is sent. If an upload fails, we throw before hitting `/rest/posts`
  — the user sees an error instead of a post that references a broken asset.

## Gotchas
- The `w_member_social` scope is required for posting. Users must include it when
  generating the access token from the LinkedIn developer portal.
- For `multiImage`, LinkedIn requires exactly 2–20 images. 1 image must use
  `content.media` instead of `content.multiImage`.
- LinkedIn returns the new post URN in the `x-restli-id` response header (and
  sometimes in the body `id` field). We check both for robustness.
- Image upload returns 201 with no body — only the `x-restli-id` matters.
  The `initializeUpload` response body contains `value.uploadUrl` and
  `value.image` (the URN) — deeply nested, easy to get wrong.

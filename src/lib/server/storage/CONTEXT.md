# Storage Module

## Purpose
Downloads images from temporary URLs (e.g. Notion's 1-hour signed links) and
uploads them to Vercel Blob for permanent, publicly-accessible storage.

## How it works
1. A Notion page fetch returns image blocks with temporary signed S3 URLs.
2. `storeNotionImage(url, pageId, blockId, altText)` fetches the binary via
   `fetch()`, uploads it to Vercel Blob under a deterministic path
   (`notion-images/{pageId}/{blockId}.{ext}`), and returns a `PostImage` with
   a permanent `blobUrl`.
3. At publish time, `downloadImage(blobUrl)` retrieves the binary from Vercel
   Blob so it can be uploaded to LinkedIn's Images API.

## Key files
| File | Responsibility |
|---|---|
| `index.ts` | `storeNotionImage`, `downloadImage` — the only two public functions |

## Design decisions
- **Fail-soft**: `storeNotionImage` returns `null` on error rather than throwing.
  One bad image should not abort the entire page fetch.
- **Idempotent path**: `addRandomSuffix: false` means re-fetching the same page
  overwrites the existing Blob rather than creating duplicates.
- **Content-type forwarded**: The content-type from the Notion response is passed
  through to Blob and stored in `PostImage.contentType`. This avoids an extra
  HEAD request when LinkedIn needs the MIME type at upload time.
- **Why Vercel Blob?** Zero infrastructure — added from the Vercel dashboard,
  credentials auto-injected as `BLOB_READ_WRITE_TOKEN`. The alternative would be
  S3 or Cloudinary, which require account setup and more env vars.

## Gotchas
- `BLOB_READ_WRITE_TOKEN` must be set. Vercel injects it automatically for
  deployed projects; for local dev, copy it from the Vercel dashboard → Storage.
- Notion `file`-type image URLs expire in ~1 hour. Always call `storeNotionImage`
  immediately after fetching the page — do not defer it.
- LinkedIn's Images API accepts JPG, PNG, GIF (max 36 MB / 36 million pixels).
  WebP is stored in Blob but may be rejected by LinkedIn; the ext map defaults
  unrecognised types to `.jpg` which LinkedIn handles as `image/jpeg`.

# Notion Module

## Purpose
Fetches journal sub-page listings and page content (text + images) from the
Notion API using a per-user internal integration token.

## How it works

### Listing pages
`listJournalPages(credentials)` calls `listAllChildren` on the user's
configured root journal page ID and returns all `child_page` blocks,
following pagination cursors to ensure none are missed.

### Fetching page content
`getPageContent(pageId, credentials)` walks the block tree recursively and
returns `{ text: string, images: NotionImage[] }`:

- **Text** is assembled by `blockToText()`, which maps supported block types
  (paragraph, headings, lists, quotes, code, dividers) to plain text / light
  markdown. Formatting (bold, italic) is stripped — the AI only needs the words.
- **Images** are collected as `NotionImage[]`. Each entry has the block's `id`,
  a temporary `url`, and `altText` from the block's caption. File-type images
  have URLs that expire in ~1 hour; external URLs never expire.

### Block tree traversal
`collectBlocks` uses `listAllChildren` to fetch all blocks under a parent,
following pagination cursors automatically. Image blocks are handled before
`blockToText` so they don't fall into the `default: null` case. Blocks with
`has_children = true` are recursed into.

## Key files
| File | Responsibility |
|---|---|
| `index.ts` | `listJournalPages`, `getPageContent`, block parsing |

## Design decisions
- **Return type changed from `string` to `PageContent`**: Before this feature,
  `getPageContent` returned a plain string. Changing the return type to
  `{ text, images }` was the cleanest way to add image support without mixing
  binary concerns into the text pipeline. Every caller was updated accordingly.
- **Images separated from text**: Image block URLs are temporary and need to be
  downloaded immediately. Returning them separately from text makes the caller's
  intent explicit: "take this text to the AI; take these images to storage."
- **Dependency injection for credentials**: Functions receive `NotionCredentials`
  from callers (API routes, cron) rather than reading env vars. This makes any
  user's token work — not just the one in `.env`.
- **Journal-centric model**: Only direct child pages of the configured root page
  are listed in the picker. This keeps the UI focused and avoids exposing the
  entire Notion workspace.

## Gotchas
- **Image URL expiry**: Notion `file`-type image URLs expire in ~1 hour. Callers
  must download and store them immediately after `getPageContent` returns.
  Never persist a `NotionImage.url` to the database.
- **Only direct children listed**: Nested sub-pages (child pages of child pages)
  appear as `child_page` blocks in text form (`### {title}`) but their content
  is not fetched.

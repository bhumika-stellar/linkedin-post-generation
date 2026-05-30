import { Client } from '@notionhq/client';
import type {
	BlockObjectResponse,
	PartialBlockObjectResponse,
	RichTextItemResponse
} from '@notionhq/client/build/src/api-endpoints';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotionCredentials {
	apiKey: string;
	journalPageId: string;
}

export interface NotionPage {
	id: string;
	title: string;
	lastEditedTime: string;
}

/**
 * A raw image extracted from a Notion block. The URL is temporary (Notion
 * signs it with a 1-hour expiry for file-type images). Callers must download
 * and store the image immediately — never persist these URLs to the database.
 */
export interface NotionImage {
	blockId: string;
	url: string;     // temporary signed URL — expires in ~1 hour for 'file' type
	altText: string; // extracted from the block's caption
}

/**
 * Combined result of parsing a Notion page. Text is a plain-text / light
 * markdown representation suitable for the AI prompt; images are the raw
 * block-level images that must be stored by the caller before the URLs expire.
 */
export interface PageContent {
	text: string;
	images: NotionImage[];
}

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------
// The Notion API paginates all list endpoints. blocks.children.list returns
// up to 100 blocks per page and sets has_more=true when more exist. Without
// following the cursor, pages/blocks beyond the first batch are silently lost.

async function listAllChildren(
	notion: Client,
	blockId: string
): Promise<(BlockObjectResponse | PartialBlockObjectResponse)[]> {
	const all: (BlockObjectResponse | PartialBlockObjectResponse)[] = [];
	let cursor: string | undefined;

	do {
		const response = await notion.blocks.children.list({
			block_id: blockId,
			start_cursor: cursor
		});
		all.push(...response.results);
		cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
	} while (cursor);

	return all;
}

// ---------------------------------------------------------------------------
// List journal sub-pages
// ---------------------------------------------------------------------------
// Credentials are passed in by the caller (the API route) rather than read
// from env — this is Dependency Injection. The route fetches the user's
// stored credentials from the DB and passes them here, so this function
// works for any user, not just the one whose keys are in .env.

export async function listJournalPages(credentials: NotionCredentials): Promise<NotionPage[]> {
	const notion = new Client({ auth: credentials.apiKey });
	const parentId = credentials.journalPageId;

	const blocks = await listAllChildren(notion, parentId);

	const pages: NotionPage[] = [];

	for (const block of blocks) {
		if (!('type' in block)) continue;
		if (block.type !== 'child_page') continue;

		pages.push({
			id: block.id,
			title: block.child_page.title,
			lastEditedTime: block.last_edited_time
		});
	}

	return pages;
}

// ---------------------------------------------------------------------------
// Fetch a single page's content as text + images
// ---------------------------------------------------------------------------
// Notion stores page content as a tree of "blocks". Each block has a type
// (paragraph, heading_1, bulleted_list_item, image, etc.) and a rich_text
// array. We recursively walk the tree, extract plain text from text blocks,
// and collect image blocks separately.
//
// Why separate text and images?
//   Text goes to the AI prompt as a string. Images are binary assets that
//   need to be downloaded and stored before Notion's signed URLs expire (~1h).
//   Mixing concerns in a single string would make both jobs harder.

export async function getPageContent(pageId: string, credentials: NotionCredentials): Promise<PageContent> {
	const notion = new Client({ auth: credentials.apiKey });
	const lines: string[] = [];
	const images: NotionImage[] = [];

	await collectBlocks(notion, pageId, lines, images, 0);
	return { text: lines.join('\n'), images };
}

async function collectBlocks(
	notion: Client,
	blockId: string,
	lines: string[],
	images: NotionImage[],
	depth: number
): Promise<void> {
	const blocks = await listAllChildren(notion, blockId);

	for (const block of blocks) {
		if (!('type' in block)) continue;

		// Image blocks are handled separately — they yield no text line.
		if (block.type === 'image') {
			const img = block.image;
			// Notion images are either uploaded ('file') or externally linked
			// ('external'). File URLs are signed and expire in ~1 hour.
			const url =
				img.type === 'file'
					? img.file.url
					: img.type === 'external'
						? img.external.url
						: '';
			const altText = extractText(img.caption);
			if (url) {
				images.push({ blockId: block.id, url, altText });
			}
			continue;
		}

		const line = blockToText(block, depth);
		if (line !== null) lines.push(line);

		// If this block has children (e.g. a toggle or nested list), recurse.
		if (block.has_children) {
			await collectBlocks(notion, block.id, lines, images, depth + 1);
		}
	}
}

function blockToText(block: BlockObjectResponse | PartialBlockObjectResponse, depth: number): string | null {
	if (!('type' in block)) return null;

	const indent = '  '.repeat(depth);

	switch (block.type) {
		case 'paragraph':
			return indent + extractText(block.paragraph.rich_text);

		case 'heading_1':
			return `\n# ${extractText(block.heading_1.rich_text)}`;

		case 'heading_2':
			return `\n## ${extractText(block.heading_2.rich_text)}`;

		case 'heading_3':
			return `\n### ${extractText(block.heading_3.rich_text)}`;

		case 'bulleted_list_item':
			return `${indent}- ${extractText(block.bulleted_list_item.rich_text)}`;

		case 'numbered_list_item':
			return `${indent}1. ${extractText(block.numbered_list_item.rich_text)}`;

		case 'to_do':
			return `${indent}- [${block.to_do.checked ? 'x' : ' '}] ${extractText(block.to_do.rich_text)}`;

		case 'quote':
			return `${indent}> ${extractText(block.quote.rich_text)}`;

		case 'callout':
			return `${indent}> ${extractText(block.callout.rich_text)}`;

		case 'code':
			return `\`\`\`\n${extractText(block.code.rich_text)}\n\`\`\``;

		case 'divider':
			return '---';

		case 'child_page':
			// Nested sub-pages appear as blocks too; we label them so the AI
			// knows a new sub-section is starting.
			return `\n### ${block.child_page.title}`;

		default:
			return null;
	}
}

// Rich text in Notion is an array of "spans", each with its own formatting.
// We just want the raw text — formatting (bold, italic) doesn't matter for
// the AI prompt.
function extractText(richText: RichTextItemResponse[]): string {
	return richText.map((span) => span.plain_text).join('');
}

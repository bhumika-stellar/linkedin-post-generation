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

	const response = await notion.blocks.children.list({ block_id: parentId });

	const pages: NotionPage[] = [];

	for (const block of response.results) {
		// Notion returns two types: full BlockObjectResponse or partial.
		// Partial blocks have no type field, so we guard against that.
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
// Fetch a single page's content as plain text
// ---------------------------------------------------------------------------
// Notion stores page content as a tree of "blocks". Each block has a type
// (paragraph, heading_1, bulleted_list_item, etc.) and a rich_text array.
// We recursively walk the tree and extract the plain text from each block,
// adding appropriate formatting so the AI can understand the structure.

export async function getPageContent(pageId: string, credentials: NotionCredentials): Promise<string> {
	const notion = new Client({ auth: credentials.apiKey });
	const lines: string[] = [];

	await collectBlocks(notion, pageId, lines, 0);
	return lines.join('\n');
}

async function collectBlocks(
	notion: Client,
	blockId: string,
	lines: string[],
	depth: number
): Promise<void> {
	const response = await notion.blocks.children.list({ block_id: blockId });

	for (const block of response.results) {
		if (!('type' in block)) continue;

		const line = blockToText(block, depth);
		if (line !== null) lines.push(line);

		// If this block has children (e.g. a toggle or nested list), recurse.
		if (block.has_children) {
			await collectBlocks(notion, block.id, lines, depth + 1);
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

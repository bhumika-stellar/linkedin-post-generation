import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// ---------------------------------------------------------------------------
// HTML → readable text extraction (no external dependencies).
// Strategy: strip boilerplate sections (scripts, nav, footer…), then strip
// remaining tags while preserving block-level whitespace so the AI sees
// paragraph breaks rather than a wall of text.
// ---------------------------------------------------------------------------

function decodeEntities(html: string): string {
	return html
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&nbsp;/g, ' ')
		.replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
}

function extractReadableText(html: string): { title: string; text: string } {
	// Grab <title>
	const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : '';

	// Grab meta description for extra context
	const descMatch =
		html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
		html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
	const description = descMatch ? decodeEntities(descMatch[1].trim()) : '';

	// Remove entire sections that are almost never article content.
	// Using [\s\S]*? (non-greedy + multiline) because real-world HTML spans many lines.
	let body = html
		.replace(/<script\b[\s\S]*?<\/script>/gi, '')
		.replace(/<style\b[\s\S]*?<\/style>/gi, '')
		.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
		.replace(/<nav\b[\s\S]*?<\/nav>/gi, '')
		.replace(/<header\b[\s\S]*?<\/header>/gi, '')
		.replace(/<footer\b[\s\S]*?<\/footer>/gi, '')
		.replace(/<aside\b[\s\S]*?<\/aside>/gi, '')
		.replace(/<figure\b[\s\S]*?<\/figure>/gi, '') // captions rarely help
		.replace(/<!--[\s\S]*?-->/g, ''); // HTML comments

	// Turn closing block tags into line breaks before stripping tags,
	// so paragraphs don't run together into one unreadable blob.
	body = body
		.replace(/<\/(p|div|h[1-6]|li|dt|dd|tr|blockquote|section|article)>/gi, '\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, ' ') // strip remaining tags
		.replace(/[ \t]+/g, ' ') // collapse horizontal whitespace
		.replace(/\n[ \t]+/g, '\n') // trim line starts
		.replace(/\n{3,}/g, '\n\n') // max two consecutive blank lines
		.split('\n')
		.map((l) => l.trim())
		.filter(Boolean)
		.join('\n')
		.trim();

	body = decodeEntities(body);

	// Build the final text with a clear header so the AI knows what it's reading.
	const header = [title && `# ${title}`, description].filter(Boolean).join('\n\n');
	const full = [header, body].filter(Boolean).join('\n\n');

	// Cap at ~8 000 chars — plenty of context without blowing the prompt budget.
	const MAX = 8000;
	const text = full.length > MAX ? full.slice(0, MAX) + '\n\n[Article truncated for length]' : full;

	return { title, text };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const POST: RequestHandler = async (event) => {
	const session = await event.locals.auth();
	if (!session?.user) {
		error(401, 'Not authenticated');
	}

	const body = await event.request.json();
	const { url } = body as { url?: string };

	if (!url || typeof url !== 'string') {
		error(400, 'url is required');
	}

	// Validate the URL before making any network request.
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		error(400, 'That doesn\'t look like a valid URL. Make sure it starts with https://');
	}

	if (!['http:', 'https:'].includes(parsed.protocol)) {
		error(400, 'Only http and https URLs are supported');
	}

	// Fetch with a reasonable timeout.
	let response: Response;
	try {
		response = await fetch(url, {
			headers: {
				// A real browser UA improves compatibility with sites that block bots.
				'User-Agent':
					'Mozilla/5.0 (compatible; PostGen/1.0; +https://postgen.app)',
				Accept: 'text/html,application/xhtml+xml'
			},
			signal: AbortSignal.timeout(12_000)
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Network error';
		error(502, `Could not reach that URL: ${message}`);
	}

	if (!response.ok) {
		error(502, `The URL returned an error: ${response.status} ${response.statusText}`);
	}

	const contentType = response.headers.get('content-type') ?? '';
	if (contentType.includes('application/pdf')) {
		error(400, 'PDF files are not supported yet. Try copying the text and using Paste instead.');
	}
	if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
		error(400, `Unsupported content type: ${contentType}. Only HTML pages are supported.`);
	}

	const html = await response.text();
	const { title, text } = extractReadableText(html);

	if (!text || text.length < 50) {
		error(422, 'Could not extract readable content from this page. Try copying the text and using Paste instead.');
	}

	return json({ title, text });
};

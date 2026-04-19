import OpenAI from 'openai';
import { env } from '$env/dynamic/private';
import { FREE_MODELS, DEFAULT_MODEL } from '$lib/models';

export { FREE_MODELS, PAID_MODELS, ALL_MODELS, DEFAULT_MODEL } from '$lib/models';

const SYSTEM_PROMPT = `You are a LinkedIn content writer helping a professional turn their work notes into polished LinkedIn posts.

Guidelines:
- Write in first person, personal and authentic tone
- Keep it human — not corporate, not salesy
- Use short paragraphs and line breaks for readability
- Include a hook in the first line to grab attention
- End with a takeaway, reflection, or call to engage
- Keep posts between 150-300 words unless instructed otherwise
- Do not use hashtags unless asked`;

const TONE_ADDITIONS: Record<string, string> = {
	storytelling:
		'Tone: Use narrative storytelling. Open with a concrete scene or moment, build tension, then land on a lesson or insight.',
	'data-driven':
		'Tone: Lead with a surprising stat or concrete number. Back every claim with evidence. Be precise and specific, not vague.',
	'thought-leader':
		'Tone: Share a contrarian take or non-obvious insight. Challenge conventional wisdom politely but directly. Avoid obvious platitudes.',
	casual:
		'Tone: Write like you are texting a smart friend. Conversational and punchy — zero corporate-speak or buzzwords.',
	inspirational:
		'Tone: Focus on the emotional arc — struggle, turning point, growth. End with a line that resonates and sticks with the reader.'
};

function getClient(apiKey?: string) {
	return new OpenAI({
		baseURL: 'https://openrouter.ai/api/v1',
		// Prefer per-user key when provided; fall back to the server-level env key.
		apiKey: apiKey || env.OPENROUTER_API_KEY
	});
}

function buildMessages(
	content: string,
	conversationHistory: { role: 'user' | 'assistant'; content: string }[],
	tone = ''
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
	const toneAddition = tone && TONE_ADDITIONS[tone] ? `\n\n${TONE_ADDITIONS[tone]}` : '';
	const systemPrompt = SYSTEM_PROMPT + toneAddition;

	return [
		{ role: 'system', content: systemPrompt },
		{
			role: 'user',
			content: `Here are my work notes/journal entries:\n\n---\n${content}\n---\n\nUse these as the source material for the LinkedIn post.`
		},
		...conversationHistory
	];
}

/**
 * Streams the post generation as a Web ReadableStream<Uint8Array>.
 * The caller should pipe this directly into a Response body.
 * Falls back through free models on 429 / 404 before the stream starts.
 */
export async function generatePostStream(
	content: string,
	conversationHistory: { role: 'user' | 'assistant'; content: string }[],
	model: string = DEFAULT_MODEL,
	tone = '',
	apiKey?: string
): Promise<ReadableStream<Uint8Array>> {
	const client = getClient(apiKey);
	const messages = buildMessages(content, conversationHistory, tone);

	const isFreeModel = FREE_MODELS.some((m) => m.id === model);
	const fallbackOrder = isFreeModel
		? [model, ...FREE_MODELS.map((m) => m.id).filter((id) => id !== model)]
		: [model];

	let lastError: unknown;

	for (const candidate of fallbackOrder) {
		try {
			// .create() with stream:true returns an AsyncIterable. If the model is
			// unavailable the SDK throws synchronously before any bytes flow, so the
			// fallback loop still works correctly.
			const openaiStream = await client.chat.completions.create({
				model: candidate,
				messages,
				stream: true
			});

			const encoder = new TextEncoder();

			return new ReadableStream<Uint8Array>({
				async start(controller) {
					try {
						for await (const chunk of openaiStream) {
							const text = chunk.choices[0]?.delta?.content ?? '';
							if (text) controller.enqueue(encoder.encode(text));
						}
						controller.close();
					} catch (err) {
						controller.error(err);
					}
				},
				cancel() {
					// Let the OpenAI SDK abort the underlying fetch when the client disconnects.
					openaiStream.controller.abort();
				}
			});
		} catch (err: unknown) {
			const status = (err as { status?: number })?.status;
			if (status === 429 || status === 404) {
				console.warn(`Model ${candidate} unavailable (${status}), trying next fallback…`);
				lastError = err;
				continue;
			}
			throw err;
		}
	}

	throw lastError;
}

/**
 * Suggest 3-5 relevant hashtags for a generated post.
 * Uses a fast free model and returns a string array (with # prefix).
 */
export async function suggestHashtags(post: string, apiKey?: string): Promise<string[]> {
	const client = getClient(apiKey);

	try {
		const response = await client.chat.completions.create({
			model: 'openrouter/free',
			messages: [
				{
					role: 'system',
					content:
						'You suggest LinkedIn hashtags. Reply ONLY with a valid JSON array of 3-5 hashtag strings including the # symbol. Example: ["#leadership","#tech","#growth"]. No other text, no markdown.'
				},
				{
					role: 'user',
					content: `Suggest 3-5 relevant LinkedIn hashtags for this post:\n\n${post}`
				}
			]
		});

		const raw = response.choices[0]?.message?.content ?? '[]';
		// Extract the JSON array even if the model added surrounding text.
		const match = raw.match(/\[[\s\S]*?\]/);
		if (!match) return [];
		return JSON.parse(match[0]) as string[];
	} catch {
		return [];
	}
}

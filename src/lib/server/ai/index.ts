import OpenAI from 'openai';
import { env } from '$env/dynamic/private';

const SYSTEM_PROMPT = `You are a LinkedIn content writer helping a professional turn their work notes into polished LinkedIn posts.

Guidelines:
- Write in first person, personal and authentic tone
- Keep it human — not corporate, not salesy
- Use short paragraphs and line breaks for readability
- Include a hook in the first line to grab attention
- End with a takeaway, reflection, or call to engage
- Keep posts between 150-300 words unless instructed otherwise
- Do not use hashtags unless asked`;

export const FREE_MODELS = [
	{ id: 'qwen/qwen3.6-plus:free', name: 'Qwen 3.6 Plus (Free)' },
	{ id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)' },
	{ id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B (Free)' },
	{ id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 405B (Free)' }
] as const;

export const PAID_MODELS = [
	{ id: 'openai/gpt-4o', name: 'GPT-4o' },
	{ id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
	{ id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
	{ id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku' }
] as const;

export const ALL_MODELS = [...FREE_MODELS, ...PAID_MODELS];
export const DEFAULT_MODEL = FREE_MODELS[0].id;

function getClient() {
	return new OpenAI({
		baseURL: 'https://openrouter.ai/api/v1',
		apiKey: env.OPENROUTER_API_KEY
	});
}

export async function generatePost(
	content: string,
	conversationHistory: { role: 'user' | 'assistant'; content: string }[],
	model: string = DEFAULT_MODEL
): Promise<string> {
	const client = getClient();

	const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
		{ role: 'system', content: SYSTEM_PROMPT },
		{
			role: 'user',
			content: `Here are my work notes/journal entries:\n\n---\n${content}\n---\n\nUse these as the source material for the LinkedIn post.`
		},
		...conversationHistory
	];

	// Build a list of models to try: the requested model first, then all other
	// free models as fallbacks. Paid models are never used as silent fallbacks.
	const isFreeModel = FREE_MODELS.some((m) => m.id === model);
	const fallbackOrder = isFreeModel
		? [model, ...FREE_MODELS.map((m) => m.id).filter((id) => id !== model)]
		: [model];

	let lastError: unknown;

	for (const candidate of fallbackOrder) {
		try {
			const response = await client.chat.completions.create({
				model: candidate,
				messages
			});
			return response.choices[0]?.message?.content ?? '';
		} catch (err: unknown) {
			const status = (err as { status?: number })?.status;
			// Only fall through to the next model on rate-limit errors
			if (status === 429) {
				console.warn(`Model ${candidate} is rate-limited, trying next fallback…`);
				lastError = err;
				continue;
			}
			throw err;
		}
	}

	throw lastError;
}

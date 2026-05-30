/**
 * Single source of truth for AI model definitions.
 *
 * Imported by both client-side components (InstructionsPanel model selector)
 * and the server-side AI module — so both sides stay in sync automatically.
 *
 * FREE_MODELS  — accessible without a user API key; the server's env key covers them.
 *                When a free model returns 429 (rate-limited) or 404 (unavailable),
 *                generatePostStream() automatically tries the next free model in order.
 *
 * PAID_MODELS  — require the user to have saved their own OpenRouter key in Settings.
 *                They are shown in the model selector only if the user has a key.
 *
 * DEFAULT_MODEL — used when no model is specified in the generation request.
 *                 'openrouter/free' lets OpenRouter pick the best available free model
 *                 automatically, making it the safest zero-config default.
 */

export const FREE_MODELS = [
	{ id: 'openrouter/free', name: 'Auto (Best Available Free)' },
	{ id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B (Free)' },
	{ id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'NVIDIA Nemotron 120B (Free)' },
	{ id: 'openai/gpt-oss-20b:free', name: 'OpenAI OSS 20B (Free)' }
] as const;

export const PAID_MODELS = [
	{ id: 'openai/gpt-4o', name: 'GPT-4o' },
	{ id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
	{ id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
	{ id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku' }
] as const;

export const ALL_MODELS = [...FREE_MODELS, ...PAID_MODELS];
export const DEFAULT_MODEL = FREE_MODELS[0].id;

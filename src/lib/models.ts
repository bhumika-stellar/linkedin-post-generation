// Single source of truth for AI model definitions.
// Imported by both client components and the server AI module.

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

<script lang="ts">
	import { page } from '$app/stores';

	const session = $derived($page.data.session);

	const FREE_MODELS = [
		{ id: 'qwen/qwen3.6-plus:free', name: 'Qwen 3.6 Plus (Free)' },
		{ id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)' },
		{ id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B (Free)' },
		{ id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 405B (Free)' }
	];

	const PAID_MODELS = [
		{ id: 'openai/gpt-4o', name: 'GPT-4o' },
		{ id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
		{ id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
		{ id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku' }
	];

	let selectedModel = $state(FREE_MODELS[0].id);
	let openrouterKey = $state('');
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
</script>

<div class="p-4 lg:p-6">
	<div class="mb-6">
		<h1 class="text-2xl font-semibold">Settings</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Configure your AI model, API key, and integrations.
		</p>
	</div>

	<div class="max-w-2xl space-y-8">
		<!-- Account -->
		<section>
			<h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">Account</h2>
			<div class="mt-3 rounded-xl border border-border p-4">
				<div class="flex items-center gap-3">
					{#if session?.user?.image}
						<img
							src={session.user.image}
							alt={session.user.name ?? 'User'}
							class="h-10 w-10 rounded-full"
						/>
					{/if}
					<div>
						<p class="font-medium">{session?.user?.name ?? 'User'}</p>
						<p class="text-sm text-muted-foreground">{session?.user?.email ?? ''}</p>
					</div>
				</div>
			</div>
		</section>

		<!-- AI Provider -->
		<section>
			<h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
				AI Model
			</h2>
			<div class="mt-3 space-y-4">
				<div>
					<label for="model-select" class="mb-1.5 block text-sm font-medium">
						Preferred Model
					</label>
					<select
						id="model-select"
						bind:value={selectedModel}
						class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<optgroup label="Free Models">
							{#each FREE_MODELS as model}
								<option value={model.id}>{model.name}</option>
							{/each}
						</optgroup>
						<optgroup label="Paid Models (requires OpenRouter key)">
							{#each PAID_MODELS as model}
								<option value={model.id}>{model.name}</option>
							{/each}
						</optgroup>
					</select>
					<p class="mt-1 text-xs text-muted-foreground">
						Free models work without an API key. Paid models require an OpenRouter key below.
					</p>
				</div>

				<div>
					<label for="openrouter-key" class="mb-1.5 block text-sm font-medium">
						OpenRouter API Key
						<span class="font-normal text-muted-foreground">(optional for free models)</span>
					</label>
					<input
						id="openrouter-key"
						type="password"
						bind:value={openrouterKey}
						placeholder="sk-or-v1-..."
						class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					/>
					<p class="mt-1 text-xs text-muted-foreground">
						Get a key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" class="text-primary underline">openrouter.ai/keys</a>.
						Your key is stored encrypted. Saving to your profile will be wired in a later phase.
					</p>
				</div>
			</div>
		</section>

		<!-- Notion -->
		<section>
			<h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
				Notion Integration
			</h2>
			<div class="mt-3 rounded-xl border border-border p-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium">Notion Workspace</p>
						<p class="text-xs text-muted-foreground">Not connected</p>
					</div>
					<button
						class="rounded-lg bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
						disabled
					>
						Connect Notion
					</button>
				</div>
				<p class="mt-2 text-xs text-muted-foreground">
					Notion integration will be available in a future phase.
				</p>
			</div>
		</section>
	</div>
</div>

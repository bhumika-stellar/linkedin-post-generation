<script lang="ts">
	import { page } from '$app/stores';

	const session = $derived($page.data.session);
	const settings = $derived($page.data.settings);

	const FREE_MODELS = [
		{ id: 'openrouter/free', name: 'Auto (Best Available Free)' },
		{ id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B (Free)' },
		{ id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'NVIDIA Nemotron 120B (Free)' },
		{ id: 'openai/gpt-oss-20b:free', name: 'OpenAI OSS 20B (Free)' }
	];

	const PAID_MODELS = [
		{ id: 'openai/gpt-4o', name: 'GPT-4o' },
		{ id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
		{ id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
		{ id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku' }
	];

	let selectedModel = $state($page.data.settings?.preferredModel ?? FREE_MODELS[0].id);
	let openrouterKey = $state('');
	let aiSaveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');

	// Notion state — pre-filled from the server load
	let notionToken = $state('');
	let notionPageId = $state($page.data.settings?.notionJournalPageId ?? '');
	let notionSaveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');

	async function saveNotionSettings() {
		notionSaveStatus = 'saving';
		try {
			const res = await fetch('/api/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					// Only send the token if the user typed a new one
					...(notionToken ? { notionAccessToken: notionToken } : {}),
					notionJournalPageId: notionPageId
				})
			});
			if (!res.ok) throw new Error(await res.text());
			notionSaveStatus = 'saved';
			notionToken = ''; // clear the secret field after saving
			setTimeout(() => (notionSaveStatus = 'idle'), 3000);
		} catch {
			notionSaveStatus = 'error';
		}
	}
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
			<div class="mt-3 space-y-4">
				{#if settings?.hasNotionToken}
					<div class="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
						<svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						Integration token saved. Enter a new one below to rotate it.
					</div>
				{/if}

				<div>
					<label for="notion-token" class="mb-1.5 block text-sm font-medium">
						Integration Token
						{#if settings?.hasNotionToken}
							<span class="font-normal text-muted-foreground">(leave blank to keep existing)</span>
						{/if}
					</label>
					<input
						id="notion-token"
						type="password"
						bind:value={notionToken}
						placeholder="ntn_..."
						class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					/>
					<p class="mt-1 text-xs text-muted-foreground">
						Create an internal integration at
						<a href="https://www.notion.so/my-integrations" target="_blank" rel="noopener" class="text-primary underline">notion.so/my-integrations</a>
						and share your journal page with it.
					</p>
				</div>

				<div>
					<label for="notion-page-id" class="mb-1.5 block text-sm font-medium">
						Journal Page ID
					</label>
					<input
						id="notion-page-id"
						type="text"
						bind:value={notionPageId}
						placeholder="253b1886b5968008acd8d25d12da082d"
						class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					/>
					<p class="mt-1 text-xs text-muted-foreground">
						The ID is the last part of your journal page URL — e.g.
						<code class="rounded bg-muted px-1 py-0.5">notion.so/Work-Journal-<strong>253b1886...</strong></code>
					</p>
				</div>

				<div class="flex items-center gap-3">
					<button
						onclick={saveNotionSettings}
						disabled={notionSaveStatus === 'saving'}
						class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{notionSaveStatus === 'saving' ? 'Saving…' : 'Save Notion Settings'}
					</button>
					{#if notionSaveStatus === 'saved'}
						<span class="text-sm text-green-600 dark:text-green-400">Saved!</span>
					{:else if notionSaveStatus === 'error'}
						<span class="text-sm text-destructive">Failed to save. Try again.</span>
					{/if}
				</div>
			</div>
		</section>
	</div>
</div>

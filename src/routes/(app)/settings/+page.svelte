<script lang="ts">
	import { page } from '$app/stores';

	const session = $derived($page.data.session);

	let aiProvider = $state<'openai' | 'anthropic'>('openai');
	let openaiKey = $state('');
	let anthropicKey = $state('');
</script>

<div class="p-4 lg:p-6">
	<div class="mb-6">
		<h1 class="text-2xl font-semibold">Settings</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Configure your AI provider, API keys, and integrations.
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
			<h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">AI Provider</h2>
			<div class="mt-3 space-y-3">
				<div class="flex rounded-lg border border-border">
					<button
						onclick={() => (aiProvider = 'openai')}
						class="flex-1 rounded-l-lg px-4 py-2.5 text-sm font-medium transition-colors
						{aiProvider === 'openai' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}"
					>
						OpenAI
					</button>
					<button
						onclick={() => (aiProvider = 'anthropic')}
						class="flex-1 rounded-r-lg px-4 py-2.5 text-sm font-medium transition-colors
						{aiProvider === 'anthropic' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}"
					>
						Anthropic
					</button>
				</div>

				{#if aiProvider === 'openai'}
					<div>
						<label for="openai-key" class="mb-1.5 block text-sm font-medium">OpenAI API Key</label>
						<input
							id="openai-key"
							type="password"
							bind:value={openaiKey}
							placeholder="sk-..."
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						/>
						<p class="mt-1 text-xs text-muted-foreground">
							Your key is stored encrypted and never shared. Saving will be wired in a later phase.
						</p>
					</div>
				{:else}
					<div>
						<label for="anthropic-key" class="mb-1.5 block text-sm font-medium">Anthropic API Key</label>
						<input
							id="anthropic-key"
							type="password"
							bind:value={anthropicKey}
							placeholder="sk-ant-..."
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						/>
						<p class="mt-1 text-xs text-muted-foreground">
							Your key is stored encrypted and never shared. Saving will be wired in a later phase.
						</p>
					</div>
				{/if}
			</div>
		</section>

		<!-- Notion -->
		<section>
			<h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">Notion Integration</h2>
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
					Notion integration will be available in Phase 3.
				</p>
			</div>
		</section>
	</div>
</div>

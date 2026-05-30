<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';

	// Reactive views into $page.data — used in the template for live updates
	// (e.g. showing the green "Connected" banner after a save + invalidateAll()).
	const session = $derived($page.data.session);
	const settings = $derived($page.data.settings);
	const notionPages = $derived($page.data.notionPages ?? []);

	// Initial-value snapshots — used to seed the form $state below. We read
	// $page.data directly (not via $derived) to make it explicit that this is
	// a one-time read, not a reactive subscription. After the user starts
	// editing, the $state owns the value.
	const initialSettings = $page.data.settings;
	const initialAutomation = $page.data.automation;

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

	let selectedModel = $state(initialSettings?.preferredModel ?? FREE_MODELS[0].id);
	let openrouterKey = $state('');
	let aiSaveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');

	// Notion state — pre-filled from the initial load.
	let notionToken = $state('');
	let notionPageId = $state(initialSettings?.notionJournalPageId ?? '');
	let notionSaveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');

	// LinkedIn state
	let linkedinToken = $state('');
	let linkedinSaveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let linkedinError = $state('');

	// Automation state — initialise from loader, fall back to sensible defaults.
	const FREQUENCIES = [
		{ id: 'daily', label: 'Daily' },
		{ id: 'weekly', label: 'Weekly' },
		{ id: 'biweekly', label: 'Bi-weekly' },
		{ id: 'monthly', label: 'Monthly' }
	] as const;

	const DAYS = [
		{ id: 0, label: 'Sunday' },
		{ id: 1, label: 'Monday' },
		{ id: 2, label: 'Tuesday' },
		{ id: 3, label: 'Wednesday' },
		{ id: 4, label: 'Thursday' },
		{ id: 5, label: 'Friday' },
		{ id: 6, label: 'Saturday' }
	] as const;

	// Common timezones — keep the list short on purpose; heavy users can pick
	// their browser timezone via the "Use my timezone" button.
	const TIMEZONES = [
		'America/New_York',
		'America/Chicago',
		'America/Denver',
		'America/Los_Angeles',
		'Europe/London',
		'Europe/Berlin',
		'Asia/Kolkata',
		'Asia/Singapore',
		'Asia/Tokyo',
		'Australia/Sydney',
		'UTC'
	];

	let autoEnabled = $state(initialAutomation?.enabled ?? false);
	let autoFrequency = $state<(typeof FREQUENCIES)[number]['id']>(
		(initialAutomation?.frequency as (typeof FREQUENCIES)[number]['id']) ?? 'weekly'
	);
	let autoSourceType = $state<'notion_page' | 'notion_recent'>(
		initialAutomation?.sourceType ?? 'notion_recent'
	);
	let autoSourcePageId = $state(initialAutomation?.sourcePageId ?? '');
	let autoSourceLookback = $state(initialAutomation?.sourceLookbackDays ?? 5);
	let autoPrompt = $state(initialAutomation?.prompt ?? '');
	let autoDraftTime = $state(initialAutomation?.draftTime ?? '08:00');
	let autoPublishDay = $state(initialAutomation?.publishDayOfWeek ?? 1);
	let autoPublishTime = $state(initialAutomation?.publishTime ?? '09:00');
	let autoTimezone = $state(initialAutomation?.timezone ?? 'America/New_York');
	let autoSaveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let autoError = $state('');

	// Prerequisites for enabling automation. We compute these client-side to
	// drive the UI; the server re-checks on save (never trust the client).
	const linkedinReady = $derived(!!settings?.hasLinkedinToken);
	const notionReady = $derived(!!settings?.hasNotionToken && !!settings?.notionJournalPageId);
	const promptReady = $derived(!!autoPrompt && autoPrompt.trim().length > 0);
	const canEnable = $derived(linkedinReady && notionReady && promptReady);

	const linkedinExpiryDate = $derived(
		settings?.linkedinTokenExpiresAt ? new Date(settings.linkedinTokenExpiresAt) : null
	);

	async function saveAiSettings() {
		aiSaveStatus = 'saving';
		try {
			const res = await fetch('/api/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					preferredModel: selectedModel,
					...(openrouterKey ? { openrouterApiKey: openrouterKey } : {})
				})
			});
			if (!res.ok) throw new Error(await res.text());
			aiSaveStatus = 'saved';
			openrouterKey = '';
			setTimeout(() => (aiSaveStatus = 'idle'), 3000);
		} catch {
			aiSaveStatus = 'error';
		}
	}

	async function saveNotionSettings() {
		notionSaveStatus = 'saving';
		try {
			const res = await fetch('/api/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...(notionToken ? { notionAccessToken: notionToken } : {}),
					notionJournalPageId: notionPageId
				})
			});
			if (!res.ok) throw new Error(await res.text());
			notionSaveStatus = 'saved';
			notionToken = '';
			setTimeout(() => (notionSaveStatus = 'idle'), 3000);
			await invalidateAll(); // refresh notionPages list
		} catch {
			notionSaveStatus = 'error';
		}
	}

	async function saveLinkedinToken() {
		linkedinSaveStatus = 'saving';
		linkedinError = '';
		try {
			const res = await fetch('/api/settings/linkedin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ accessToken: linkedinToken })
			});
			if (!res.ok) {
				const msg = await res.text().catch(() => 'Verification failed');
				throw new Error(msg);
			}
			linkedinSaveStatus = 'saved';
			linkedinToken = '';
			setTimeout(() => (linkedinSaveStatus = 'idle'), 3000);
			await invalidateAll();
		} catch (err) {
			linkedinSaveStatus = 'error';
			linkedinError = err instanceof Error ? err.message : 'Failed to verify';
		}
	}

	async function disconnectLinkedin() {
		if (!confirm('Disconnect LinkedIn? Auto-posting will stop until you reconnect.')) return;
		try {
			const res = await fetch('/api/settings/linkedin', { method: 'DELETE' });
			if (!res.ok) throw new Error('Disconnect failed');
			await invalidateAll();
		} catch (err) {
			linkedinError = err instanceof Error ? err.message : 'Failed to disconnect';
		}
	}

	async function saveAutomation() {
		autoSaveStatus = 'saving';
		autoError = '';
		try {
			const payload: Record<string, unknown> = {
				enabled: autoEnabled,
				frequency: autoFrequency,
				sourceType: autoSourceType,
				sourcePageId: autoSourceType === 'notion_page' ? autoSourcePageId || null : null,
				sourceLookbackDays: autoSourceLookback,
				prompt: autoPrompt,
				draftTime: autoDraftTime,
				publishDayOfWeek: autoFrequency === 'daily' ? null : autoPublishDay,
				publishTime: autoPublishTime,
				timezone: autoTimezone
			};
			const res = await fetch('/api/automation/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				const msg = await res.text().catch(() => 'Save failed');
				throw new Error(msg);
			}
			autoSaveStatus = 'saved';
			setTimeout(() => (autoSaveStatus = 'idle'), 3000);
			await invalidateAll();
		} catch (err) {
			autoSaveStatus = 'error';
			autoError = err instanceof Error ? err.message : 'Failed to save';
		}
	}

	function detectTimezone() {
		try {
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (tz) autoTimezone = tz;
		} catch {
			// No-op
		}
	}
</script>

<div class="p-4 lg:p-6">
	<div class="mb-6">
		<h1 class="text-2xl font-semibold">Settings</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Configure your AI model, integrations, and auto-posting workflow.
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
			<h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">AI Model</h2>
			<div class="mt-3 space-y-4">
				<div>
					<label for="model-select" class="mb-1.5 block text-sm font-medium">Preferred Model</label>
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
					</p>
				</div>

				<div class="flex items-center gap-3">
					<button
						onclick={saveAiSettings}
						disabled={aiSaveStatus === 'saving'}
						class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{aiSaveStatus === 'saving' ? 'Saving…' : 'Save AI Settings'}
					</button>
					{#if aiSaveStatus === 'saved'}
						<span class="text-sm text-green-600 dark:text-green-400">Saved!</span>
					{:else if aiSaveStatus === 'error'}
						<span class="text-sm text-destructive">Failed to save. Try again.</span>
					{/if}
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
					<label for="notion-page-id" class="mb-1.5 block text-sm font-medium">Journal Page ID</label>
					<input
						id="notion-page-id"
						type="text"
						bind:value={notionPageId}
						placeholder="253b1886b5968008acd8d25d12da082d"
						class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					/>
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

		<!-- LinkedIn -->
		<section>
			<h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
				LinkedIn Integration
			</h2>

			<div class="mt-3 space-y-4">
				{#if settings?.hasLinkedinToken}
					<div class="flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
						<svg class="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<div class="flex-1">
							<p>Connected.</p>
							<p class="mt-0.5 text-xs opacity-80">
								Member URN: <code class="rounded bg-green-500/10 px-1">{settings.linkedinMemberUrn}</code>
							</p>
							{#if linkedinExpiryDate}
								<p class="mt-0.5 text-xs opacity-80">
									Token expires around {linkedinExpiryDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} — paste a fresh one before then.
								</p>
							{/if}
						</div>
						<button
							onclick={disconnectLinkedin}
							class="shrink-0 text-xs underline hover:text-destructive"
						>
							Disconnect
						</button>
					</div>
				{/if}

				<div>
					<label for="linkedin-token" class="mb-1.5 block text-sm font-medium">
						Access Token
						{#if settings?.hasLinkedinToken}
							<span class="font-normal text-muted-foreground">(paste a fresh one to rotate)</span>
						{/if}
					</label>
					<input
						id="linkedin-token"
						type="password"
						bind:value={linkedinToken}
						placeholder="AQX..."
						class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					/>
					<details class="mt-2 text-xs text-muted-foreground">
						<summary class="cursor-pointer hover:text-foreground">How do I get a token?</summary>
						<ol class="mt-2 ml-4 list-decimal space-y-1 leading-relaxed">
							<li>Go to <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener" class="text-primary underline">linkedin.com/developers/apps</a> and create or open an app.</li>
							<li>Under <strong>Products</strong>, request <em>"Sign In with LinkedIn using OpenID Connect"</em> and <em>"Share on LinkedIn"</em> (both are self-serve, instant approval).</li>
							<li>Open the <strong>Auth</strong> tab → <strong>OAuth 2.0 tools</strong> → <strong>Generate access token</strong>.</li>
							<li>Pick scopes <code class="rounded bg-muted px-1">openid</code>, <code class="rounded bg-muted px-1">profile</code>, <code class="rounded bg-muted px-1">email</code>, <code class="rounded bg-muted px-1">w_member_social</code>.</li>
							<li>Copy the resulting access token and paste it above.</li>
						</ol>
						<p class="mt-2 leading-relaxed">
							The token is valid for 60 days. When it expires, just regenerate it and paste a new one — no other setup needed.
						</p>
					</details>
				</div>

				<div class="flex items-center gap-3">
					<button
						onclick={saveLinkedinToken}
						disabled={!linkedinToken || linkedinSaveStatus === 'saving'}
						class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{linkedinSaveStatus === 'saving' ? 'Verifying…' : 'Verify & Save'}
					</button>
					{#if linkedinSaveStatus === 'saved'}
						<span class="text-sm text-green-600 dark:text-green-400">Saved!</span>
					{:else if linkedinSaveStatus === 'error'}
						<span class="text-sm text-destructive">{linkedinError || 'Failed.'}</span>
					{/if}
				</div>
			</div>
		</section>

		<!-- Automation -->
		<section>
			<div class="flex items-baseline justify-between">
				<h2 class="text-sm font-medium uppercase tracking-wide text-muted-foreground">
					Automation
				</h2>
				{#if $page.data.automation?.lastDraftAt}
					<span class="text-xs text-muted-foreground">
						Last draft: {new Date($page.data.automation.lastDraftAt).toLocaleDateString()}
					</span>
				{/if}
			</div>

			<div class="mt-3 space-y-5 rounded-xl border border-border p-4">
				<!-- Step 1: prerequisites checklist -->
				<div class="rounded-lg bg-muted/40 p-3 text-xs">
					<p class="font-medium text-foreground">Before you can enable auto-posting:</p>
					<ul class="mt-2 space-y-1.5">
						<li class="flex items-center gap-2">
							<span class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full {linkedinReady ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-muted-foreground/15 text-muted-foreground'}">
								{linkedinReady ? '✓' : '·'}
							</span>
							<span class={linkedinReady ? 'text-foreground' : 'text-muted-foreground'}>
								Connect LinkedIn (above)
							</span>
						</li>
						<li class="flex items-center gap-2">
							<span class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full {notionReady ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-muted-foreground/15 text-muted-foreground'}">
								{notionReady ? '✓' : '·'}
							</span>
							<span class={notionReady ? 'text-foreground' : 'text-muted-foreground'}>
								Configure Notion (above)
							</span>
						</li>
						<li class="flex items-center gap-2">
							<span class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full {promptReady ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-muted-foreground/15 text-muted-foreground'}">
								{promptReady ? '✓' : '·'}
							</span>
							<span class={promptReady ? 'text-foreground' : 'text-muted-foreground'}>
								Write a prompt (below)
							</span>
						</li>
					</ul>
				</div>

				<!-- Step 2: configuration -->
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="auto-frequency" class="mb-1.5 block text-sm font-medium">Frequency</label>
						<select
							id="auto-frequency"
							bind:value={autoFrequency}
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							{#each FREQUENCIES as f}
								<option value={f.id}>{f.label}</option>
							{/each}
						</select>
						<p class="mt-1 text-xs text-muted-foreground">How often a fresh draft is created.</p>
					</div>

					<div>
						<label for="auto-source-type" class="mb-1.5 block text-sm font-medium">Source</label>
						<select
							id="auto-source-type"
							bind:value={autoSourceType}
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="notion_recent">Most recently edited Notion page</option>
							<option value="notion_page">A specific Notion page</option>
						</select>
					</div>
				</div>

				{#if autoSourceType === 'notion_page'}
					<div>
						<label for="auto-source-page" class="mb-1.5 block text-sm font-medium">Notion page</label>
						<select
							id="auto-source-page"
							bind:value={autoSourcePageId}
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="">— select a page —</option>
							{#each notionPages as p}
								<option value={p.id}>{p.title}</option>
							{/each}
						</select>
						{#if notionPages.length === 0 && notionReady}
							<p class="mt-1 text-xs text-muted-foreground">
								No sub-pages found under your journal page. Create one in Notion and refresh.
							</p>
						{:else if !notionReady}
							<p class="mt-1 text-xs text-muted-foreground">Configure Notion first.</p>
						{/if}
					</div>
				{:else}
					<div>
						<label for="auto-lookback" class="mb-1.5 block text-sm font-medium">Look back how many days?</label>
						<input
							id="auto-lookback"
							type="number"
							min="1"
							max="90"
							bind:value={autoSourceLookback}
							class="w-32 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
						<p class="mt-1 text-xs text-muted-foreground">
							Pulls the most recently edited journal sub-page within this window.
						</p>
					</div>
				{/if}

				<div>
					<label for="auto-prompt" class="mb-1.5 block text-sm font-medium">Standing prompt</label>
					<textarea
						id="auto-prompt"
						bind:value={autoPrompt}
						rows="4"
						placeholder="Write a LinkedIn post that turns this week's notes into one clear insight, ending with a question. Keep it under 200 words and avoid hashtags."
						class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					></textarea>
					<p class="mt-1 text-xs text-muted-foreground">
						Same kind of instruction you'd type in the Generate chat — saved permanently and applied every run.
					</p>
				</div>

			<div class="grid gap-4 sm:grid-cols-3">
				<div>
					<label for="auto-draft-time" class="mb-1.5 block text-sm font-medium">Draft at</label>
					<input
						id="auto-draft-time"
						type="time"
						bind:value={autoDraftTime}
						class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
					<p class="mt-1 text-xs text-muted-foreground">
						When the AI generates a draft (in your timezone). You'll get an email to review it.
					</p>
				</div>

				{#if autoFrequency !== 'daily'}
					<div>
						<label for="auto-day" class="mb-1.5 block text-sm font-medium">Publish on</label>
							<select
								id="auto-day"
								bind:value={autoPublishDay}
								class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
							>
								{#each DAYS as d}
									<option value={d.id}>{d.label}</option>
								{/each}
							</select>
						</div>
					{/if}

					<div>
						<label for="auto-time" class="mb-1.5 block text-sm font-medium">At time</label>
						<input
							id="auto-time"
							type="time"
							bind:value={autoPublishTime}
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						/>
					</div>

					<div>
						<label for="auto-tz" class="mb-1.5 block text-sm font-medium">
							Timezone
							<button
								type="button"
								onclick={detectTimezone}
								class="ml-1 text-xs font-normal text-primary underline hover:text-primary/80"
							>
								use mine
							</button>
						</label>
						<select
							id="auto-tz"
							bind:value={autoTimezone}
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
						>
							{#if !TIMEZONES.includes(autoTimezone)}
								<option value={autoTimezone}>{autoTimezone}</option>
							{/if}
							{#each TIMEZONES as tz}
								<option value={tz}>{tz}</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Step 3: enable toggle -->
				<div class="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
					<button
						onclick={() => (autoEnabled = !autoEnabled)}
						disabled={!canEnable && !autoEnabled}
						aria-pressed={autoEnabled}
						title={!canEnable && !autoEnabled ? 'Complete the prerequisites first' : ''}
						class="relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50
						{autoEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}"
					>
						<span class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-background transition-transform {autoEnabled ? 'translate-x-5' : ''}"></span>
					</button>
					<div class="flex-1 text-sm">
						<p class="font-medium">Enable auto-posting</p>
						<p class="mt-0.5 text-xs text-muted-foreground">
							When on, drafts appear in <a href="/posts" class="text-primary underline">Posts</a> on your chosen frequency. Approve them and they publish to LinkedIn at your scheduled time.
						</p>
					</div>
				</div>

				<div class="flex items-center gap-3">
					<button
						onclick={saveAutomation}
						disabled={autoSaveStatus === 'saving'}
						class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{autoSaveStatus === 'saving' ? 'Saving…' : 'Save Automation'}
					</button>
					{#if autoSaveStatus === 'saved'}
						<span class="text-sm text-green-600 dark:text-green-400">Saved!</span>
					{:else if autoSaveStatus === 'error'}
						<span class="text-sm text-destructive">{autoError || 'Failed to save.'}</span>
					{/if}
				</div>
			</div>
		</section>
	</div>
</div>

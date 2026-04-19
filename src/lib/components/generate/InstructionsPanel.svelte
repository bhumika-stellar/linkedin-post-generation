<script lang="ts">
	import { FREE_MODELS, PAID_MODELS, DEFAULT_MODEL } from '$lib/models';
	import { tick } from 'svelte';

	interface Template { id: string; name: string; systemPrompt: string }
	interface PromptMessage { role: 'user' | 'ai'; text: string }

	interface Props {
		promptHistory: PromptMessage[];
		templates: Template[];
		currentPrompt?: string;
		selectedTone?: string;
		selectedModel?: string;
		isGenerating: boolean;
		hasSourceContent: boolean;
		postOpen: boolean;
		onSend: () => void;
		onCollapse: () => void;
		onTogglePost: () => void;
	}

	let {
		promptHistory,
		templates,
		currentPrompt = $bindable(''),
		selectedTone = $bindable(''),
		selectedModel = $bindable(''),
		isGenerating,
		hasSourceContent,
		postOpen,
		onSend,
		onCollapse,
		onTogglePost
	}: Props = $props();

	const TONES = [
		{ id: 'storytelling',  label: 'Storytelling' },
		{ id: 'data-driven',   label: 'Data-driven' },
		{ id: 'thought-leader',label: 'Thought Leader' },
		{ id: 'casual',        label: 'Casual' },
		{ id: 'inspirational', label: 'Inspirational' }
	];

	const EXAMPLE_PROMPTS = [
		"Summarise the key insight from my source and write a post sharing my perspective on it.",
		"Write a personal, honest post about what I learned. End with a question.",
		"Turn this into a thought leadership post with one clear, non-obvious takeaway.",
		"Make it short and casual — like I'm talking to a friend."
	];

	const ALL_MODELS = [...FREE_MODELS, ...PAID_MODELS];

	let showSettings = $state(false);
	let writeMode = $state(false);

	const settingsSummary = $derived(() => {
		const parts: string[] = [];
		if (selectedTone) {
			const t = TONES.find((t) => t.id === selectedTone);
			if (t) parts.push(t.label);
		}
		if (selectedModel && selectedModel !== DEFAULT_MODEL) {
			const m = ALL_MODELS.find((m) => m.id === selectedModel);
			if (m) parts.push(m.name);
		}
		return parts.join(' · ');
	});

	const hasCustomSettings = $derived(
		!!selectedTone || (!!selectedModel && selectedModel !== DEFAULT_MODEL)
	);

	const wordCount = $derived(
		currentPrompt.trim() ? currentPrompt.trim().split(/\s+/).length : 0
	);

	let historyEl = $state<HTMLDivElement>();

	$effect(() => {
		// Scroll to bottom when new messages arrive
		if (promptHistory.length && historyEl) {
			tick().then(() => { if (historyEl) historyEl.scrollTop = historyEl.scrollHeight; });
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (writeMode) return;
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			onSend();
		}
	}

	function applyTemplate(e: Event) {
		const id = (e.target as HTMLSelectElement).value;
		const t = templates.find((t) => t.id === id);
		if (t) {
			currentPrompt = t.systemPrompt;
			(e.target as HTMLSelectElement).value = '';
		}
	}
</script>

<div class="flex min-w-0 flex-1 flex-col">

	<!-- ── Header ──────────────────────────────────────────────────────────── -->
	<div class="flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-2.5">
		<!-- Collapse chat -->
		<button
			onclick={onCollapse}
			title="Close chat panel"
			class="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"
				stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="m15 18-6-6 6-6"/>
			</svg>
		</button>

		<span class="flex-1 text-sm font-medium">Instructions</span>

		<!-- Template picker -->
		{#if templates.length > 0}
			<select
				onchange={applyTemplate}
				class="rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
			>
				<option value="">Template…</option>
				{#each templates as t}
					<option value={t.id}>{t.name}</option>
				{/each}
			</select>
		{/if}

		<!-- Expand / collapse Generated Post -->
		<button
			onclick={onTogglePost}
			title={postOpen ? 'Close post panel — expand chat' : 'Open post panel'}
			class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground
			{!postOpen ? 'bg-accent text-foreground' : ''}"
		>
			{#if postOpen}
				<!-- Expand-left: close post, widen chat -->
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect width="18" height="18" x="3" y="3" rx="2"/>
					<path d="M15 3v18"/>
					<path d="m8 9 3 3-3 3"/>
				</svg>
			{:else}
				<!-- Restore split -->
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect width="18" height="18" x="3" y="3" rx="2"/>
					<path d="M15 3v18"/>
					<path d="m12 9-3 3 3 3"/>
				</svg>
			{/if}
		</button>

		<!-- Write mode toggle -->
		<button
			onclick={() => (writeMode = !writeMode)}
			title={writeMode ? 'Switch to quick chat' : 'Expand to write mode'}
			class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground
			{writeMode ? 'bg-accent text-foreground' : ''}"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"
				stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
			</svg>
		</button>
	</div>

	{#if writeMode}
		<!-- ── Write mode: full-height compose ─────────────────────────────── -->
		<div class="flex flex-1 flex-col gap-3 overflow-hidden p-4">
			<p class="shrink-0 text-xs text-muted-foreground">
				Draft your full thoughts — the AI will shape them into a post.
				<span class="text-muted-foreground/50">Shift+Enter for new line · Enter sends.</span>
			</p>
			<textarea
				bind:value={currentPrompt}
				onkeydown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
				placeholder="Describe your angle, opinions, the story you want to tell… be as detailed as you like."
				class="flex-1 w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
			></textarea>
			<div class="flex shrink-0 items-center justify-between">
				<span class="text-[11px] text-muted-foreground/50">{wordCount} word{wordCount === 1 ? '' : 's'}</span>
				<button
					onclick={onSend}
					disabled={!currentPrompt.trim() || isGenerating}
					class="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground
					hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none"
				>
					{isGenerating ? 'Generating…' : 'Generate'}
				</button>
			</div>
		</div>

	{:else}
		<!-- ── Chat mode ────────────────────────────────────────────────────── -->

		<!-- Message history (scrollable, flex-1) -->
		<div bind:this={historyEl} class="flex-1 overflow-y-auto p-4">
			{#if promptHistory.length === 0}
				<div class="flex h-full flex-col justify-center gap-2.5">
					<p class="text-xs text-muted-foreground/70">Tell the AI what post you want. Try one:</p>
					{#each EXAMPLE_PROMPTS as example}
						<button
							onclick={() => (currentPrompt = example)}
							class="rounded-lg border border-dashed border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
						>
							"{example}"
						</button>
					{/each}
					<p class="mt-1 text-[11px] text-muted-foreground/50">
						Or use
						<button onclick={() => (writeMode = true)} class="underline underline-offset-2 hover:text-foreground">
							write mode
						</button>
						to draft longer thoughts.
					</p>
				</div>
			{/if}

			{#each promptHistory as msg}
				<div
					class="mb-2 rounded-lg px-3 py-2 text-sm
					{msg.role === 'user'
						? 'ml-6 bg-primary text-primary-foreground'
						: 'mr-6 bg-muted text-muted-foreground'}"
				>
					{msg.text}
				</div>
			{/each}

			{#if isGenerating}
				<div class="mr-6 mb-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
					<span class="animate-pulse">Generating…</span>
				</div>
			{/if}
		</div>

		<!-- Bottom controls -->
		<div class="shrink-0 border-t border-border p-3 space-y-2">

			<!-- Collapsible settings panel -->
			{#if showSettings}
				<div class="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
					<div>
						<p class="mb-1.5 text-xs font-medium text-muted-foreground">Tone</p>
						<div class="flex flex-wrap gap-1">
							{#each TONES as tone}
								<button
									onclick={() => (selectedTone = selectedTone === tone.id ? '' : tone.id)}
									class="rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors
									{selectedTone === tone.id
										? 'border-primary bg-primary text-primary-foreground'
										: 'border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground'}"
								>
									{tone.label}
								</button>
							{/each}
						</div>
					</div>
					<div>
						<p class="mb-1.5 text-xs font-medium text-muted-foreground">Model</p>
						<select
							bind:value={selectedModel}
							class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
						>
							<optgroup label="Free">
								{#each FREE_MODELS as m}
									<option value={m.id}>{m.name}</option>
								{/each}
							</optgroup>
							<optgroup label="Paid (requires API key)">
								{#each PAID_MODELS as m}
									<option value={m.id}>{m.name}</option>
								{/each}
							</optgroup>
						</select>
					</div>
				</div>
			{/if}

			<!-- Settings toggle row -->
			<button
				onclick={() => (showSettings = !showSettings)}
				class="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				<svg class="h-3 w-3 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
				</svg>
				{#if hasCustomSettings && !showSettings}
					<span class="flex-1 truncate text-left">{settingsSummary()}</span>
					<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"></span>
				{:else}
					<span class="flex-1 text-left">{showSettings ? 'Hide settings' : 'Settings'}</span>
					<svg class="h-3 w-3 shrink-0 transition-transform {showSettings ? 'rotate-180' : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="m6 9 6 6 6-6"/>
					</svg>
				{/if}
			</button>

			<!-- No-source hint -->
			{#if !hasSourceContent}
				<p class="text-xs text-amber-500/80">No sources — AI will generate from your prompt alone.</p>
			{/if}

			<!-- Prompt input -->
			<div class="flex gap-2">
				<textarea
					bind:value={currentPrompt}
					onkeydown={handleKeydown}
					placeholder="What angle, tone, or story do you want?"
					rows="2"
					class="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
				></textarea>
				<button
					onclick={onSend}
					disabled={!currentPrompt.trim() || isGenerating}
					class="self-end rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground
					hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none"
				>
					{isGenerating ? '…' : 'Send'}
				</button>
			</div>
		</div>
	{/if}
</div>

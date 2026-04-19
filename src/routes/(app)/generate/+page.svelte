<script lang="ts">
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import ContentSource from '$lib/components/generate/ContentSource.svelte';
	import PostEditor from '$lib/components/generate/PostEditor.svelte';
	import InstructionsPanel from '$lib/components/generate/InstructionsPanel.svelte';
	import { DEFAULT_MODEL } from '$lib/models';

	const notionConfigured = $derived($page.data.notionConfigured as boolean);
	const templates = $derived(
		$page.data.templates as { id: string; name: string; systemPrompt: string }[]
	);

	// ── Session persistence ────────────────────────────────────────────────────
	// We persist the conversation and generated post to localStorage so a
	// page refresh doesn't wipe an in-progress session. Source content (Notion
	// pages, manual text) is intentionally not persisted — it's cheap to
	// re-select and avoids stale Notion data being resurfaced silently.

	const SESSION_KEY = 'postgen:session';

	type PersistedSession = {
		generatedPost: string;
		promptHistory: { role: 'user' | 'ai'; text: string }[];
		conversationHistory: { role: 'user' | 'assistant'; content: string }[];
		suggestedHashtags: string[];
	};

	function loadSession(): PersistedSession | null {
		if (!browser) return null;
		try {
			const raw = localStorage.getItem(SESSION_KEY);
			return raw ? (JSON.parse(raw) as PersistedSession) : null;
		} catch {
			return null;
		}
	}

	function clearSession() {
		if (browser) localStorage.removeItem(SESSION_KEY);
	}

	const session = loadSession();

	// ── State ─────────────────────────────────────────────────────────────────
	let sourceContent = $state('');
	let hasSourceContent = $state(false);

	// Restore from the persisted session if one exists.
	let generatedPost = $state(session?.generatedPost ?? '');
	let currentPrompt = $state('');
	let selectedTone = $state('');
	let selectedModel = $state(($page.data.preferredModel as string) ?? DEFAULT_MODEL);

	let suggestedHashtags = $state<string[]>(session?.suggestedHashtags ?? []);
	let isLoadingHashtags = $state(false);
	let isGenerating = $state(false);
	let isSaving = $state(false);
	let copied = $state(false);
	let saved = $state(false);

	let promptHistory = $state<{ role: 'user' | 'ai'; text: string }[]>(session?.promptHistory ?? []);
	let conversationHistory = $state<{ role: 'user' | 'assistant'; content: string }[]>(
		session?.conversationHistory ?? []
	);

	// Keep localStorage in sync whenever the session state changes.
	$effect(() => {
		if (!browser) return;
		// Only persist when there's something worth keeping.
		if (conversationHistory.length === 0 && !generatedPost) {
			clearSession();
			return;
		}
		localStorage.setItem(
			SESSION_KEY,
			JSON.stringify({ generatedPost, promptHistory, conversationHistory, suggestedHashtags })
		);
	});

	// Ref to ContentSource so we can call reset() on "New Post"
	let contentSourceRef = $state<ReturnType<typeof ContentSource>>();

	// ── Panel visibility & resize ──────────────────────────────────────────────
	let instructionsOpen = $state(true);
	let postOpen = $state(true);
	let instructionsWidth = $state(340); // px, only used when both panels are open
	let isResizing = $state(false);

	function startResize(e: MouseEvent) {
		const startX = e.clientX;
		const startWidth = instructionsWidth;
		isResizing = true;

		function onMove(ev: MouseEvent) {
			instructionsWidth = Math.max(220, Math.min(640, startWidth + (ev.clientX - startX)));
		}
		function onUp() {
			isResizing = false;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		}
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
		e.preventDefault();
	}

	// ── Actions ───────────────────────────────────────────────────────────────
	async function handleGenerate() {
		if (!currentPrompt.trim()) return;

		const prompt = currentPrompt.trim();
		currentPrompt = '';
		suggestedHashtags = [];

		promptHistory = [...promptHistory, { role: 'user', text: prompt }];

		const isFirst = conversationHistory.length === 0;
		const userMessage = isFirst
			? `Generate a LinkedIn post based on the content I provided. Here are my instructions:\n\n${prompt}`
			: prompt;

		conversationHistory = [...conversationHistory, { role: 'user', content: userMessage }];
		isGenerating = true;
		generatedPost = '';

		try {
			const res = await fetch('/api/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: sourceContent, conversationHistory, model: selectedModel, tone: selectedTone })
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: 'Request failed' }));
				throw new Error(err.message || `HTTP ${res.status}`);
			}

			const reader = res.body!.getReader();
			const decoder = new TextDecoder();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				generatedPost += decoder.decode(value, { stream: true });
			}
			generatedPost += decoder.decode();

			conversationHistory = [...conversationHistory, { role: 'assistant', content: generatedPost }];
			promptHistory = [
				...promptHistory,
				{ role: 'ai', text: isFirst ? 'Post generated! How would you like to refine it?' : 'Updated. Any more changes?' }
			];

			fetchHashtags(generatedPost);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Something went wrong';
			promptHistory = [...promptHistory, { role: 'ai', text: `Error: ${message}` }];
			conversationHistory = conversationHistory.slice(0, -1);
		} finally {
			isGenerating = false;
		}
	}

	async function fetchHashtags(post: string) {
		isLoadingHashtags = true;
		try {
			const res = await fetch('/api/hashtags', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ post })
			});
			if (res.ok) {
				const data = await res.json();
				suggestedHashtags = Array.isArray(data.hashtags) ? data.hashtags : [];
			}
		} catch {
			// Non-critical — fail silently.
		} finally {
			isLoadingHashtags = false;
		}
	}

	function handleNewPost() {
		generatedPost = '';
		promptHistory = [];
		conversationHistory = [];
		currentPrompt = '';
		suggestedHashtags = [];
		saved = false;
		clearSession();
		contentSourceRef?.reset();
	}

	function handleCopy() {
		if (!generatedPost) return;
		navigator.clipboard.writeText(generatedPost);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	async function handleSavePost() {
		if (!generatedPost || isSaving) return;
		isSaving = true;
		try {
			const res = await fetch('/api/posts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ generatedContent: generatedPost, rawInput: sourceContent, conversationHistory, status: 'draft' })
			});
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Save failed');
			saved = true;
			promptHistory = [...promptHistory, { role: 'ai', text: 'Post saved to your library.' }];
		} catch (err) {
			promptHistory = [...promptHistory, { role: 'ai', text: `Error: ${err instanceof Error ? err.message : 'Failed to save'}` }];
		} finally {
			isSaving = false;
		}
	}

	async function handleSaveTemplate() {
		if (conversationHistory.length === 0 || isSaving) return;
		const name = window.prompt('Give this template a name:');
		if (!name?.trim()) return;
		isSaving = true;
		try {
			const res = await fetch('/api/templates', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: name.trim(), conversationHistory })
			});
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Save failed');
			promptHistory = [...promptHistory, { role: 'ai', text: `Template "${name.trim()}" saved!` }];
		} catch (err) {
			promptHistory = [...promptHistory, { role: 'ai', text: `Error: ${err instanceof Error ? err.message : 'Failed'}` }];
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="flex h-full flex-col overflow-hidden">

	<!-- Section 1: Sources (top, collapsible) -->
	<ContentSource
		bind:this={contentSourceRef}
		{notionConfigured}
		bind:sourceContent
		bind:hasSourceContent
	/>

	<!-- Sections 2 & 3: side-by-side below Sources -->
	<div class="flex flex-1 overflow-hidden min-h-0 {isResizing ? 'cursor-col-resize select-none' : ''}">

		<!-- Instructions / Chat (left panel) -->
		{#if instructionsOpen}
			<div
				style={postOpen ? `width: ${instructionsWidth}px` : undefined}
				class="{postOpen ? 'shrink-0' : 'flex-1'} flex flex-col overflow-hidden"
			>
				<InstructionsPanel
					{promptHistory}
					{templates}
					bind:currentPrompt
					bind:selectedTone
					bind:selectedModel
					{isGenerating}
					{hasSourceContent}
					{postOpen}
					onSend={handleGenerate}
					onCollapse={() => (instructionsOpen = false)}
					onTogglePost={() => (postOpen = !postOpen)}
				/>
			</div>
		{:else}
			<button
				onclick={() => (instructionsOpen = true)}
				title="Open instructions"
				class="flex w-9 shrink-0 flex-col items-center justify-center gap-3 border-r border-border py-6 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="m9 18 6-6-6-6"/>
				</svg>
				<span class="text-[10px] font-medium" style="writing-mode: vertical-lr; transform: rotate(180deg)">Chat</span>
			</button>
		{/if}

		<!-- Drag handle — only shown when both panels are open -->
		{#if instructionsOpen && postOpen}
			<button
				aria-label="Drag to resize panels"
				title="Drag to resize · Double-click to reset"
				onmousedown={startResize}
				ondblclick={() => (instructionsWidth = 340)}
				class="group relative w-1 shrink-0 cursor-col-resize select-none border-r border-border transition-colors hover:border-primary/50 {isResizing ? 'border-primary/60' : ''}"
			>
				<!-- wider invisible hit-area so the grab is easy -->
				<div class="absolute inset-y-0 -left-1.5 -right-1.5"></div>
			</button>
		{/if}

		<!-- Generated Post (right, flex-1) -->
		{#if postOpen}
			<div class="flex flex-1 flex-col overflow-hidden min-w-0">
				<PostEditor
					bind:generatedPost
					{suggestedHashtags}
					{isLoadingHashtags}
					{isGenerating}
					{isSaving}
					{saved}
					{copied}
					hasConversation={conversationHistory.length > 0}
					onNewPost={handleNewPost}
					onCopy={handleCopy}
					onSave={handleSavePost}
					onSaveTemplate={handleSaveTemplate}
					onCollapse={() => (postOpen = false)}
				/>
			</div>
		{:else}
			<button
				onclick={() => (postOpen = true)}
				title="Open generated post"
				class="flex w-9 shrink-0 flex-col items-center justify-center gap-3 border-l border-border py-6 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
			>
				<span class="text-[10px] font-medium" style="writing-mode: vertical-lr">Post</span>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="m15 18-6-6 6-6"/>
				</svg>
			</button>
		{/if}

	</div>
</div>

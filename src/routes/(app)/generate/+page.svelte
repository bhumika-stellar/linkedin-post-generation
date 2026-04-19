<script lang="ts">
	import { page } from '$app/stores';

	const notionConfigured = $derived($page.data.notionConfigured);
	const templates = $derived($page.data.templates as { id: string; name: string; systemPrompt: string }[]);

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

	let selectedModel = $state($page.data.preferredModel as string);

	let contentMode = $state<'manual' | 'notion'>('manual');
	let manualContent = $state('');
	let generatedPost = $state('');
	let currentPrompt = $state('');
	let isGenerating = $state(false);
	let isSaving = $state(false);
	let copied = $state(false);
	let saved = $state(false);
	let errorMessage = $state('');

	let promptHistory = $state<{ role: 'user' | 'ai'; text: string }[]>([]);
	let conversationHistory = $state<{ role: 'user' | 'assistant'; content: string }[]>([]);

	// Notion state
	type NotionPage = { id: string; title: string; lastEditedTime: string };
	let notionPages = $state<NotionPage[]>([]);
	let selectedPageId = $state('');
	let notionContent = $state('');
	let isLoadingPages = $state(false);
	let isLoadingContent = $state(false);
	let notionError = $state('');

	// The active source content — whichever mode is active
	const sourceContent = $derived(contentMode === 'notion' ? notionContent : manualContent);
	const hasSourceContent = $derived(sourceContent.trim().length > 0);

	async function loadNotionPages() {
		isLoadingPages = true;
		notionError = '';
		try {
			const res = await fetch('/api/notion/pages');
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message || 'Failed to load pages');
			}
			const data = await res.json();
			notionPages = data.pages;
		} catch (err) {
			notionError = err instanceof Error ? err.message : 'Failed to load Notion pages';
		} finally {
			isLoadingPages = false;
		}
	}

	async function loadPageContent(pageId: string) {
		if (!pageId) return;
		isLoadingContent = true;
		notionContent = '';
		notionError = '';
		try {
			const res = await fetch(`/api/notion/pages/${pageId}`);
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message || 'Failed to load page content');
			}
			const data = await res.json();
			notionContent = data.content;
		} catch (err) {
			notionError = err instanceof Error ? err.message : 'Failed to load page content';
		} finally {
			isLoadingContent = false;
		}
	}

	function switchToNotion() {
		contentMode = 'notion';
		if (notionConfigured && notionPages.length === 0) {
			loadNotionPages();
		}
	}

	async function handleGenerate() {
		if (!currentPrompt.trim()) return;

		const prompt = currentPrompt.trim();
		currentPrompt = '';
		errorMessage = '';

		promptHistory = [...promptHistory, { role: 'user', text: prompt }];

		const isFirstMessage = conversationHistory.length === 0;
		const userMessage = isFirstMessage
			? `Generate a LinkedIn post based on the content I provided. Here are my instructions:\n\n${prompt}`
			: prompt;

		conversationHistory = [...conversationHistory, { role: 'user', content: userMessage }];

		isGenerating = true;

		try {
			const res = await fetch('/api/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: sourceContent,
					conversationHistory,
					model: selectedModel
				})
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: 'Request failed' }));
				throw new Error(err.message || `HTTP ${res.status}`);
			}

			const data = await res.json();
			generatedPost = data.post;

			conversationHistory = [
				...conversationHistory,
				{ role: 'assistant', content: data.post }
			];
			promptHistory = [
				...promptHistory,
				{ role: 'ai', text: isFirstMessage ? 'Post generated! How would you like to refine it?' : 'Updated. Any more changes?' }
			];
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Something went wrong';
			errorMessage = message;
			promptHistory = [...promptHistory, { role: 'ai', text: `Error: ${message}` }];
			conversationHistory = conversationHistory.slice(0, -1);
		} finally {
			isGenerating = false;
		}
	}

	function handleCopy() {
		if (generatedPost) {
			navigator.clipboard.writeText(generatedPost);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleGenerate();
		}
	}

	function handleNewPost() {
		generatedPost = '';
		promptHistory = [];
		conversationHistory = [];
		manualContent = '';
		notionContent = '';
		selectedPageId = '';
		currentPrompt = '';
		errorMessage = '';
		saved = false;
	}

	async function handleSavePost() {
		if (!generatedPost || isSaving) return;

		isSaving = true;
		try {
			const res = await fetch('/api/posts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					generatedContent: generatedPost,
					rawInput: sourceContent,
					conversationHistory,
					status: 'draft'
				})
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: 'Save failed' }));
				throw new Error(err.message || `HTTP ${res.status}`);
			}

			saved = true;
			promptHistory = [...promptHistory, { role: 'ai', text: 'Post saved to your library.' }];
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to save';
			promptHistory = [...promptHistory, { role: 'ai', text: `Error saving: ${message}` }];
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
				body: JSON.stringify({
					name: name.trim(),
					conversationHistory
				})
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: 'Save failed' }));
				throw new Error(err.message || `HTTP ${res.status}`);
			}

			promptHistory = [
				...promptHistory,
				{ role: 'ai', text: `Template "${name.trim()}" saved! Find it in the Templates page.` }
			];
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to save';
			promptHistory = [...promptHistory, { role: 'ai', text: `Error saving template: ${message}` }];
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="flex h-full flex-col">
	<!-- Content Source (top section) -->
	<div class="border-b border-border p-4 lg:p-6">
		<div class="mb-3 flex items-center gap-2">
			<h2 class="text-lg font-semibold">Content Source</h2>
			<div class="ml-auto flex rounded-lg border border-border">
				<button
					onclick={() => (contentMode = 'manual')}
					class="rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors
					{contentMode === 'manual' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}"
				>
					Paste manually
				</button>
				<button
					onclick={switchToNotion}
					class="rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors
					{contentMode === 'notion' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}"
				>
					Pull from Notion
				</button>
			</div>
		</div>

		{#if contentMode === 'manual'}
			<textarea
				bind:value={manualContent}
				placeholder="Paste your work notes, journal entries, or any content you want to transform into a LinkedIn post..."
				class="h-32 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
			></textarea>
		{:else if !notionConfigured}
			<!-- Not configured — direct the user to Settings -->
			<div class="flex h-32 items-center justify-center rounded-lg border border-dashed border-input">
				<div class="text-center">
					<p class="text-sm text-muted-foreground">Notion is not connected yet.</p>
					<a
						href="/settings"
						class="mt-2 inline-block rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
					>
						Go to Settings →
					</a>
				</div>
			</div>
		{:else}
			<!-- Configured — show page picker -->
			<div class="space-y-3">
				{#if notionError}
					<p class="text-xs text-destructive">{notionError}</p>
				{/if}

				<div class="flex items-center gap-3">
					<select
						bind:value={selectedPageId}
						onchange={() => loadPageContent(selectedPageId)}
						disabled={isLoadingPages}
						class="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
					>
						<option value="">
							{isLoadingPages ? 'Loading pages…' : 'Select a journal week…'}
						</option>
						{#each notionPages as p}
							<option value={p.id}>{p.title}</option>
						{/each}
					</select>
					<button
						onclick={loadNotionPages}
						disabled={isLoadingPages}
						class="rounded-lg border border-input px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
						title="Refresh page list"
					>
						{isLoadingPages ? '…' : '↺'}
					</button>
				</div>

				{#if isLoadingContent}
					<p class="text-xs text-muted-foreground animate-pulse">Loading content…</p>
				{:else if notionContent}
					<div class="rounded-lg border border-input bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
						<span class="font-medium text-foreground">{notionPages.find(p => p.id === selectedPageId)?.title}</span>
						— {notionContent.split('\n').filter(Boolean).length} lines loaded.
						<button
							onclick={() => { notionContent = ''; selectedPageId = ''; }}
							class="ml-2 underline hover:text-foreground"
						>Clear</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Editor area (bottom section, split left/right) -->
	<div class="flex flex-1 overflow-hidden">
		<!-- Generated Post (left) -->
		<div class="flex flex-1 flex-col border-r border-border">
			<div class="flex items-center justify-between border-b border-border px-4 py-3 lg:px-6">
				<h3 class="text-sm font-medium">Generated Post</h3>
				<div class="flex gap-2">
					<button
						onclick={handleNewPost}
						disabled={conversationHistory.length === 0}
						class="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
					>
						New Post
					</button>
					<button
						onclick={handleCopy}
						disabled={!generatedPost}
						class="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
					>
						{copied ? 'Copied!' : 'Copy'}
					</button>
					<button
						onclick={handleSavePost}
						disabled={!generatedPost || isSaving || saved}
						class="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
					>
						{saved ? 'Saved!' : isSaving ? 'Saving...' : 'Save Post'}
					</button>
					<button
						onclick={handleSaveTemplate}
						disabled={conversationHistory.length === 0 || isSaving}
						class="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-40"
					>
						{isSaving ? 'Saving...' : 'Save as Template'}
					</button>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto p-4 lg:p-6">
				{#if generatedPost}
					<textarea
						bind:value={generatedPost}
						class="h-full w-full resize-none bg-transparent text-sm leading-relaxed focus:outline-none"
					></textarea>
				{:else}
					<div class="flex h-full items-center justify-center">
						<div class="text-center">
							<p class="text-sm text-muted-foreground">
								Your generated LinkedIn post will appear here.
							</p>
							<p class="mt-1 text-xs text-muted-foreground/60">
								Add content above and write a prompt to get started.
							</p>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Prompt Panel (right) -->
		<div class="flex w-80 flex-col lg:w-96">
			<div class="border-b border-border px-4 py-3">
				<div class="flex items-center justify-between gap-2">
					<h3 class="text-sm font-medium shrink-0">Instructions</h3>
					{#if templates.length > 0}
						<select
							onchange={(e) => {
								const t = templates.find(t => t.id === (e.target as HTMLSelectElement).value);
								if (t) {
									currentPrompt = t.systemPrompt;
									(e.target as HTMLSelectElement).value = '';
								}
							}}
							class="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
						>
							<option value="">Use a template…</option>
							{#each templates as t}
								<option value={t.id}>{t.name}</option>
							{/each}
						</select>
					{/if}
				</div>
			</div>

			<!-- Prompt history -->
			<div class="flex-1 space-y-3 overflow-y-auto p-4">
				{#if promptHistory.length === 0}
					<div class="flex h-full items-center justify-center">
						<p class="text-center text-xs text-muted-foreground">
							Tell the AI how you want your post written. You can refine it with follow-up
							instructions.
						</p>
					</div>
				{/if}

				{#each promptHistory as message}
					<div
						class="rounded-lg px-3 py-2 text-sm
						{message.role === 'user'
							? 'ml-4 bg-primary text-primary-foreground'
							: 'mr-4 bg-muted text-muted-foreground'}"
					>
						{message.text}
					</div>
				{/each}

				{#if isGenerating}
					<div class="mr-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
						<span class="animate-pulse">Generating...</span>
					</div>
				{/if}
			</div>

			<!-- Prompt input -->
			<div class="border-t border-border p-4">
				<div class="mb-2">
					<select
						bind:value={selectedModel}
						class="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
					>
						<optgroup label="Free">
							{#each FREE_MODELS as m}
								<option value={m.id}>{m.name}</option>
							{/each}
						</optgroup>
						<optgroup label="Paid">
							{#each PAID_MODELS as m}
								<option value={m.id}>{m.name}</option>
							{/each}
						</optgroup>
					</select>
				</div>
				{#if !hasSourceContent}
					<p class="mb-2 text-xs text-amber-500">
						{contentMode === 'notion' ? 'Select a journal week above before generating.' : 'Paste your content above before generating.'}
					</p>
				{/if}
				<div class="flex gap-2">
					<textarea
						bind:value={currentPrompt}
						onkeydown={handleKeydown}
						placeholder="Write a personal, human-like post about..."
						rows="2"
						class="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
					></textarea>
					<button
						onclick={handleGenerate}
						disabled={!currentPrompt.trim() || isGenerating || !hasSourceContent}
						class="self-end rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
					>
						{isGenerating ? '...' : 'Send'}
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

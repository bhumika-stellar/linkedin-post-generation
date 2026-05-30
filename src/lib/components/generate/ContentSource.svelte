<script lang="ts">
	import type { PostImage } from '$lib/server/db/schema/app';

	interface NotionPage {
		id: string;
		title: string;
		lastEditedTime: string;
	}

	type FetchStatus = 'idle' | 'fetching' | 'done' | 'error';

	type UrlSource = {
		id: string;
		url: string;
		title: string;
		content: string;
		status: FetchStatus;
		error: string;
	};

	interface Props {
		notionConfigured: boolean;
		sourceContent?: string;
		hasSourceContent?: boolean;
		sourceImages?: PostImage[];
	}

	let {
		notionConfigured,
		sourceContent = $bindable(''),
		hasSourceContent = $bindable(false),
		sourceImages = $bindable<PostImage[]>([])
	}: Props = $props();

	// ── URL sources ───────────────────────────────────────────────────────────
	let urls = $state<UrlSource[]>([newUrl()]);

	// ── Notion (secondary, collapsible) ───────────────────────────────────────
	let showNotion = $state(false);
	let notionPages = $state<NotionPage[]>([]);
	let selectedPageIds = $state<string[]>([]);
	let pageContentsMap = $state<Record<string, string>>({});
	// Images are keyed by page id — each page may have 0-N images.
	let pageImagesMap = $state<Record<string, PostImage[]>>({});
	let loadingPageIds = $state<string[]>([]);
	let isLoadingPages = $state(false);
	let notionError = $state('');

	const notionContent = $derived(
		selectedPageIds
			.map((id) => {
				const page = notionPages.find((p) => p.id === id);
				const text = pageContentsMap[id] ?? '';
				return page ? `## ${page.title}\n\n${text}` : text;
			})
			.filter(Boolean)
			.join('\n\n---\n\n')
	);

	// ── Combined output ───────────────────────────────────────────────────────
	$effect(() => {
		const sourceParts: string[] = [];

		for (const u of urls) {
			if (u.status === 'done' && u.content) {
				sourceParts.push(u.title ? `### ${u.title}\n${u.url}\n\n${u.content}` : u.content);
			}
		}
		if (notionContent) sourceParts.push(notionContent);

		sourceContent = sourceParts.length
			? `## Sources\n\n${sourceParts.join('\n\n---\n\n')}`
			: '';
		hasSourceContent = sourceParts.length > 0;
	});

	// Flatten images from all selected pages into a single array.
	// The PostEditor receives this to show attached-image previews.
	$effect(() => {
		sourceImages = selectedPageIds.flatMap((id) => pageImagesMap[id] ?? []);
	});

	// ── URL helpers ───────────────────────────────────────────────────────────
	function newUrl(): UrlSource {
		return { id: crypto.randomUUID(), url: '', title: '', content: '', status: 'idle', error: '' };
	}

	function patch(id: string, data: Partial<UrlSource>) {
		urls = urls.map((u) => (u.id === id ? { ...u, ...data } : u));
	}

	function addUrl() {
		urls = [...urls, newUrl()];
	}

	function removeUrl(id: string) {
		const next = urls.filter((u) => u.id !== id);
		urls = next.length ? next : [newUrl()];
	}

	function editUrl(id: string) {
		patch(id, { status: 'idle', title: '', content: '', error: '' });
	}

	async function fetchUrl(id: string) {
		const source = urls.find((u) => u.id === id);
		if (!source || !source.url.trim()) return;

		const raw = source.url.trim();
		const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

		patch(id, { status: 'fetching', error: '', title: '', content: '' });

		try {
			const res = await fetch('/api/url', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
			patch(id, { status: 'done', title: data.title ?? '', content: data.text ?? '' });
		} catch (err) {
			patch(id, { status: 'error', error: err instanceof Error ? err.message : 'Failed to fetch' });
		}
	}

	function handleKeydown(e: KeyboardEvent, id: string) {
		if (e.key === 'Enter') {
			e.preventDefault();
			fetchUrl(id);
		}
	}

	// ── Notion helpers ────────────────────────────────────────────────────────
	async function loadNotionPages() {
		isLoadingPages = true;
		notionError = '';
		try {
			const res = await fetch('/api/notion/pages');
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Failed');
			const data = await res.json();
			notionPages = data.pages;
		} catch (err) {
			notionError = err instanceof Error ? err.message : 'Failed to load pages';
		} finally {
			isLoadingPages = false;
		}
	}

	async function loadPageContent(pageId: string) {
		loadingPageIds = [...loadingPageIds, pageId];
		try {
			const res = await fetch(`/api/notion/pages/${pageId}`);
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Failed');
			const data = await res.json();
			// Route now returns { content: string, images: PostImage[] }
			pageContentsMap = { ...pageContentsMap, [pageId]: data.content ?? '' };
			pageImagesMap = { ...pageImagesMap, [pageId]: Array.isArray(data.images) ? data.images : [] };
		} catch {
			// fail silently per page — broken page shouldn't block others
		} finally {
			loadingPageIds = loadingPageIds.filter((id) => id !== pageId);
		}
	}

	async function togglePage(pageId: string) {
		if (selectedPageIds.includes(pageId)) {
			selectedPageIds = selectedPageIds.filter((id) => id !== pageId);
		} else {
			selectedPageIds = [...selectedPageIds, pageId];
			if (!(pageId in pageContentsMap)) await loadPageContent(pageId);
		}
	}

	function openNotion() {
		showNotion = true;
		if (notionConfigured && notionPages.length === 0) loadNotionPages();
	}

	// ── Reset ─────────────────────────────────────────────────────────────────
	export function reset() {
		urls = [newUrl()];
		showNotion = false;
		selectedPageIds = [];
		pageContentsMap = {};
		pageImagesMap = {};
		loadingPageIds = [];
		notionError = '';
	}

	const fetchedCount = $derived(urls.filter((u) => u.status === 'done').length);
	const totalImageCount = $derived(selectedPageIds.reduce((n, id) => n + (pageImagesMap[id]?.length ?? 0), 0));

	// Collapsed summary text
	const collapsedSummary = $derived(() => {
		const parts: string[] = [];
		if (fetchedCount > 0) parts.push(`${fetchedCount} source${fetchedCount > 1 ? 's' : ''}`);
		if (selectedPageIds.length > 0) parts.push(`${selectedPageIds.length} Notion page${selectedPageIds.length > 1 ? 's' : ''}`);
		if (totalImageCount > 0) parts.push(`${totalImageCount} image${totalImageCount > 1 ? 's' : ''}`);
		return parts.length ? parts.join(' · ') : 'No sources added';
	});

	let expanded = $state(true);
</script>

<div class="flex max-h-[40vh] shrink-0 flex-col border-b border-border">
	<!-- ── Section header (always visible) ──────────────────────────────────── -->
	<button
		onclick={() => (expanded = !expanded)}
		class="flex w-full shrink-0 items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-accent/40 lg:px-6"
	>
		<h2 class="text-sm font-semibold">Sources</h2>
		{#if !expanded}
			<span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{collapsedSummary()}</span>
		{:else}
			<span class="flex-1"></span>
		{/if}
		<!-- Chevron -->
		<svg
			class="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150 {expanded ? '' : '-rotate-90'}"
			xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
			stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
		>
			<path d="m6 9 6 6 6-6"/>
		</svg>
	</button>

	{#if expanded}
	<!-- ── URL sources ───────────────────────────────────────────────────────── -->
	<div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1 lg:px-6">
		<div class="mb-3 flex items-baseline justify-between">
			<span class="text-xs text-muted-foreground">Articles, papers, or notes to reference</span>
			{#if fetchedCount > 0}
				<span class="text-xs text-muted-foreground">{fetchedCount} loaded</span>
			{/if}
		</div>

		<div class="space-y-1.5">
			{#each urls as u (u.id)}
				{#if u.status === 'done'}
					<!-- Fetched — compact chip row -->
					<div class="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
						<!-- Green dot -->
						<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500"></span>
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs font-medium leading-tight">
								{u.title || u.url}
							</p>
							<p class="text-[10px] text-muted-foreground">{u.content.length.toLocaleString()} chars</p>
						</div>
						<button
							onclick={() => editUrl(u.id)}
							class="shrink-0 text-[11px] text-muted-foreground hover:text-foreground"
						>
							edit
						</button>
						<button
							onclick={() => removeUrl(u.id)}
							class="shrink-0 text-[11px] text-muted-foreground hover:text-destructive"
						>
							✕
						</button>
					</div>
				{:else}
					<!-- Input row -->
					<div class="flex items-center gap-1.5">
						<!-- Link icon -->
						<svg class="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
							<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
						</svg>
						<input
							value={u.url}
							oninput={(e) => patch(u.id, { url: (e.target as HTMLInputElement).value, error: '' })}
							onkeydown={(e) => handleKeydown(e, u.id)}
							type="url"
							placeholder="Paste a URL and press Enter…"
							class="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground/60
							focus:outline-none focus:ring-2 focus:ring-ring
							{u.status === 'error' ? 'border-destructive' : ''}"
						/>
						{#if u.status === 'fetching'}
							<span class="shrink-0 animate-pulse text-xs text-muted-foreground">Fetching…</span>
						{:else if u.url.trim()}
							<button
								onclick={() => fetchUrl(u.id)}
								class="shrink-0 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
							>
								Load
							</button>
						{/if}
						{#if urls.length > 1}
							<button
								onclick={() => removeUrl(u.id)}
								aria-label="Remove URL"
								class="shrink-0 text-muted-foreground/50 hover:text-destructive"
							>
								<svg class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
							</button>
						{/if}
					</div>
					{#if u.status === 'error'}
						<p class="pl-5 text-xs text-destructive">{u.error}</p>
					{/if}
				{/if}
			{/each}
		</div>

		<!-- Footer actions -->
		<div class="mt-2.5 flex items-center gap-3">
			<button
				onclick={addUrl}
				class="text-xs text-muted-foreground hover:text-foreground"
			>
				+ Add another URL
			</button>
			{#if notionConfigured && !showNotion}
				<span class="text-muted-foreground/30">·</span>
				<button onclick={openNotion} class="text-xs text-muted-foreground hover:text-foreground">
					Pull from Notion
				</button>
			{/if}
		</div>

		<!-- Notion picker (shown inline when toggled) -->
		{#if showNotion}
			<div class="mt-3 rounded-lg border border-border bg-muted/30 p-3">
				<div class="mb-2 flex items-center justify-between">
					<p class="text-xs font-medium text-muted-foreground">Notion pages</p>
					<div class="flex items-center gap-2">
						{#if selectedPageIds.length > 0}
							<span class="text-xs text-foreground">{selectedPageIds.length} selected</span>
							{#if totalImageCount > 0}
								<span class="text-xs text-muted-foreground">· {totalImageCount} image{totalImageCount > 1 ? 's' : ''}</span>
							{/if}
							<button
								onclick={() => { selectedPageIds = []; pageContentsMap = {}; pageImagesMap = {}; }}
								class="text-xs text-muted-foreground hover:text-foreground"
							>
								clear
							</button>
						{/if}
						<button onclick={() => (showNotion = false)} aria-label="Hide Notion picker" class="text-xs text-muted-foreground hover:text-foreground">hide</button>
					</div>
				</div>

				{#if notionError}
					<p class="mb-1 text-xs text-destructive">{notionError}</p>
				{/if}

				<div class="flex gap-2">
					<div class="flex-1 overflow-y-auto rounded-md border border-input bg-background" style="max-height: 100px">
						{#if isLoadingPages}
							<p class="animate-pulse px-3 py-2 text-xs text-muted-foreground">Loading…</p>
						{:else if notionPages.length === 0}
							<p class="px-3 py-2 text-xs text-muted-foreground">No pages found.</p>
						{:else}
							{#each notionPages as p}
								<label class="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-accent">
									<input
										type="checkbox"
										checked={selectedPageIds.includes(p.id)}
										onchange={() => togglePage(p.id)}
										disabled={loadingPageIds.includes(p.id)}
										class="rounded accent-primary"
									/>
									<span class="min-w-0 flex-1 truncate text-xs">{p.title}</span>
									{#if loadingPageIds.includes(p.id)}
										<span class="animate-pulse text-xs text-muted-foreground">…</span>
									{:else if selectedPageIds.includes(p.id) && (pageImagesMap[p.id]?.length ?? 0) > 0}
										<!-- Small image badge next to selected pages that have images -->
										<span class="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
											{pageImagesMap[p.id].length} img
										</span>
									{/if}
								</label>
							{/each}
						{/if}
					</div>
					<button
						onclick={loadNotionPages}
						disabled={isLoadingPages}
						class="rounded-md border border-input px-2 text-xs text-muted-foreground hover:bg-accent disabled:opacity-40"
						title="Refresh"
					>
						↺
					</button>
				</div>

				<!-- Image thumbnails for selected pages -->
				{#if totalImageCount > 0}
					<div class="mt-2.5">
						<p class="mb-1.5 text-[10px] text-muted-foreground">
							Images found — these will be attached to the LinkedIn post
						</p>
						<div class="flex flex-wrap gap-1.5">
							{#each selectedPageIds as pageId}
								{#each (pageImagesMap[pageId] ?? []) as img}
									<div class="group relative">
										<img
											src={img.blobUrl}
											alt={img.altText || 'Notion image'}
											class="h-10 w-10 rounded object-cover ring-1 ring-border"
										/>
										{#if img.altText}
											<!-- Tooltip on hover -->
											<div class="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 rounded bg-popover px-1.5 py-0.5 text-[10px] text-popover-foreground shadow group-hover:block">
												{img.altText}
											</div>
										{/if}
									</div>
								{/each}
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{/if}
</div>

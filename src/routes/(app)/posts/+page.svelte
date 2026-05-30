<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import type { GeneratedPost } from '$lib/server/db/models/types';

	const buckets = $derived(
		$page.data.buckets as {
			pendingReview: GeneratedPost[];
			scheduled: GeneratedPost[];
			published: GeneratedPost[];
			failed: GeneratedPost[];
			drafts: GeneratedPost[];
			archived: GeneratedPost[];
		}
	);

	let copiedId = $state<string | null>(null);
	let actingId = $state<string | null>(null);
	let expandedId = $state<string | null>(null);

	// Inline-edit state per row. Keyed by post id so each card edits its own draft.
	let edits = $state<Record<string, string>>({});

	// Refinement: which row is actively refining + a per-row instruction box.
	let refiningId = $state<string | null>(null);
	let refineInstructions = $state<Record<string, string>>({});
	let refineStreaming = $state(false);

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	function getDraftText(post: GeneratedPost): string {
		// Inline edit takes precedence; then editedContent (server-saved
		// refinement); then the original cron-generated text.
		return edits[post.id] ?? post.editedContent ?? post.generatedContent;
	}

	function handleCopy(content: string, id: string) {
		navigator.clipboard.writeText(content);
		copiedId = id;
		setTimeout(() => (copiedId = null), 2000);
	}

	async function patchPost(id: string, body: Record<string, unknown>) {
		const res = await fetch(`/api/posts/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		if (!res.ok) {
			const msg = await res.text().catch(() => 'Failed');
			throw new Error(msg);
		}
	}

	async function approve(post: GeneratedPost) {
		actingId = post.id;
		try {
			// If the user inline-edited the textarea but didn't save it
			// separately, persist that edit alongside the status flip.
			const body: Record<string, unknown> = { status: 'approved' };
			if (edits[post.id] !== undefined && edits[post.id] !== post.editedContent) {
				body.editedContent = edits[post.id];
			}
			await patchPost(post.id, body);
			delete edits[post.id];
			edits = { ...edits };
			await invalidateAll();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Approve failed');
		} finally {
			actingId = null;
		}
	}

	async function skip(post: GeneratedPost) {
		if (!confirm('Skip this draft? You can still publish it manually later from the archive.')) return;
		actingId = post.id;
		try {
			await patchPost(post.id, { status: 'skipped' });
			await invalidateAll();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Skip failed');
		} finally {
			actingId = null;
		}
	}

	async function unschedule(post: GeneratedPost) {
		if (!confirm('Move this back to pending review? It will not publish until you approve again.')) return;
		actingId = post.id;
		try {
			await patchPost(post.id, { status: 'pending_review' });
			await invalidateAll();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Action failed');
		} finally {
			actingId = null;
		}
	}

	async function retry(post: GeneratedPost) {
		actingId = post.id;
		try {
			await patchPost(post.id, { status: 'approved' });
			await invalidateAll();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Retry failed');
		} finally {
			actingId = null;
		}
	}

	async function deletePost(post: GeneratedPost) {
		if (!confirm('Delete this post permanently? This cannot be undone.')) return;
		actingId = post.id;
		try {
			const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('Delete failed');
			await invalidateAll();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Delete failed');
		} finally {
			actingId = null;
		}
	}

	async function saveInlineEdit(post: GeneratedPost) {
		const text = edits[post.id];
		if (text === undefined || text === post.editedContent) return;
		actingId = post.id;
		try {
			await patchPost(post.id, { editedContent: text });
			await invalidateAll();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Save failed');
		} finally {
			actingId = null;
		}
	}

	async function refine(post: GeneratedPost) {
		const instruction = refineInstructions[post.id]?.trim();
		if (!instruction) return;
		refineStreaming = true;
		try {
			const res = await fetch(`/api/posts/${post.id}/refine`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ instruction })
			});
			if (!res.ok) {
				const msg = await res.text().catch(() => 'Refine failed');
				throw new Error(msg);
			}
			// Stream the response into the row's editable textarea so the user
			// sees it appear in real-time.
			const reader = res.body!.getReader();
			const decoder = new TextDecoder();
			edits[post.id] = '';
			edits = { ...edits };
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				edits[post.id] = (edits[post.id] ?? '') + decoder.decode(value, { stream: true });
				edits = { ...edits };
			}
			edits[post.id] = (edits[post.id] ?? '') + decoder.decode();
			refineInstructions[post.id] = '';
			refineInstructions = { ...refineInstructions };
			refiningId = null;
			await invalidateAll();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Refine failed');
		} finally {
			refineStreaming = false;
		}
	}

	function formatDateTime(date: string | Date | null) {
		if (!date) return '';
		return new Date(date).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function truncate(text: string, maxLength = 200) {
		if (text.length <= maxLength) return text;
		return text.slice(0, maxLength) + '...';
	}

	// LinkedIn URL from a post URN — they look like `urn:li:share:7193...`,
	// the public URL substitutes the share id into the activity-feed URL.
	function linkedinUrl(urn: string | null): string | null {
		if (!urn) return null;
		const id = urn.split(':').pop();
		if (!id) return null;
		return `https://www.linkedin.com/feed/update/urn:li:share:${id}/`;
	}
</script>

<div class="p-4 lg:p-6">

	<!-- Reusable snippet: renders image thumbnails for a post if it has any.
	     Called with {@render postImages(post)} inside each card section. -->
	{#snippet postImages(post: import('$lib/server/db/models/types').GeneratedPost)}
		{@const imgs = (post.images ?? []) as import('$lib/server/db/schema/app').PostImage[]}
		{#if imgs.length > 0}
			<div class="mt-2 flex flex-wrap items-center gap-1.5">
				{#each imgs as img}
					<img
						src={img.blobUrl}
						alt={img.altText || 'Post image'}
						class="h-9 w-9 rounded object-cover ring-1 ring-border"
						title={img.altText || undefined}
					/>
				{/each}
				<span class="text-[10px] text-muted-foreground">
					{imgs.length} image{imgs.length > 1 ? 's' : ''} · will post to LinkedIn
				</span>
			</div>
		{/if}
	{/snippet}

	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold">Posts</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Manual saves and auto-drafts, grouped by stage.
			</p>
		</div>
		<a
			href="/generate"
			class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
		>
			New Post
		</a>
	</div>

	<!-- ── Pending review (auto-drafts awaiting approval) ─────────────────── -->
	{#if buckets.pendingReview.length > 0}
		<section class="mb-8">
			<div class="mb-3 flex items-baseline gap-2">
				<h2 class="text-sm font-semibold uppercase tracking-wide text-foreground">Pending review</h2>
				<span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
					{buckets.pendingReview.length}
				</span>
			</div>
			<div class="space-y-4">
				{#each buckets.pendingReview as post (post.id)}
					<div class="rounded-xl border border-primary/30 bg-primary/[0.02] p-4">
						<!-- Meta row -->
						<div class="mb-3 flex items-center justify-between text-xs text-muted-foreground">
							<span>
								Drafted {formatDateTime(post.createdAt)}
								{#if post.scheduledFor}
									· will publish {formatDateTime(post.scheduledFor)}
								{/if}
							</span>
							<span class="rounded-full border border-border bg-background px-2 py-0.5">auto</span>
						</div>

						<!-- Editable textarea -->
						<textarea
							value={getDraftText(post)}
							oninput={(e) => {
								edits[post.id] = (e.currentTarget as HTMLTextAreaElement).value;
								edits = { ...edits };
							}}
							rows="6"
							class="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
						></textarea>

						{@render postImages(post)}

						<!-- Refinement input -->
						{#if refiningId === post.id}
							<div class="mt-3 rounded-lg border border-border bg-muted/30 p-3">
								<label for="refine-{post.id}" class="mb-1.5 block text-xs font-medium text-muted-foreground">
									What should change?
								</label>
								<div class="flex gap-2">
									<input
										id="refine-{post.id}"
										type="text"
										value={refineInstructions[post.id] ?? ''}
										oninput={(e) => {
											refineInstructions[post.id] = (e.currentTarget as HTMLInputElement).value;
											refineInstructions = { ...refineInstructions };
										}}
										onkeydown={(e) => {
											if (e.key === 'Enter') refine(post);
										}}
										placeholder="e.g. make it shorter, add a hook, end with a question"
										class="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										disabled={refineStreaming}
									/>
									<button
										onclick={() => refine(post)}
										disabled={refineStreaming || !refineInstructions[post.id]?.trim()}
										class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
									>
										{refineStreaming ? 'Refining…' : 'Refine'}
									</button>
									<button
										onclick={() => (refiningId = null)}
										disabled={refineStreaming}
										class="rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
									>
										Cancel
									</button>
								</div>
							</div>
						{/if}

						<!-- Action row -->
						<div class="mt-3 flex flex-wrap items-center gap-2">
							<button
								onclick={() => approve(post)}
								disabled={actingId === post.id}
								class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
							>
								{actingId === post.id ? '…' : 'Approve & schedule'}
							</button>
							<button
								onclick={() => (refiningId = refiningId === post.id ? null : post.id)}
								disabled={actingId === post.id}
								class="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
							>
								Refine
							</button>
							{#if edits[post.id] !== undefined && edits[post.id] !== post.editedContent}
								<button
									onclick={() => saveInlineEdit(post)}
									disabled={actingId === post.id}
									class="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
								>
									Save edit
								</button>
							{/if}
							<button
								onclick={() => skip(post)}
								disabled={actingId === post.id}
								class="ml-auto rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
							>
								Skip
							</button>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- ── Scheduled (approved, awaiting cron's publish phase) ─────────────── -->
	{#if buckets.scheduled.length > 0}
		<section class="mb-8">
			<div class="mb-3 flex items-baseline gap-2">
				<h2 class="text-sm font-semibold uppercase tracking-wide text-foreground">Scheduled</h2>
				<span class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
					{buckets.scheduled.length}
				</span>
			</div>
			<div class="space-y-3">
				{#each buckets.scheduled as post (post.id)}
					<div class="rounded-xl border border-border p-4">
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0 flex-1">
								<p class="whitespace-pre-line text-sm leading-relaxed">
									{expandedId === post.id ? (post.editedContent ?? post.generatedContent) : truncate(post.editedContent ?? post.generatedContent)}
								</p>
								{@render postImages(post)}
								<div class="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
									<span class="rounded-full border border-border bg-background px-2 py-0.5">
										publishes {formatDateTime(post.scheduledFor)}
									</span>
									{#if (post.editedContent ?? post.generatedContent).length > 200}
										<button
											onclick={() => toggleExpand(post.id)}
											class="text-primary hover:underline"
										>
											{expandedId === post.id ? 'Show less' : 'View full post'}
										</button>
									{/if}
								</div>
							</div>
							<div class="flex shrink-0 gap-1">
								<button
									onclick={() => unschedule(post)}
									disabled={actingId === post.id}
									class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
								>
									Unschedule
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- ── Failed (publish error; retryable) ───────────────────────────────── -->
	{#if buckets.failed.length > 0}
		<section class="mb-8">
			<div class="mb-3 flex items-baseline gap-2">
				<h2 class="text-sm font-semibold uppercase tracking-wide text-foreground">Failed</h2>
				<span class="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
					{buckets.failed.length}
				</span>
			</div>
			<div class="space-y-3">
				{#each buckets.failed as post (post.id)}
					<div class="rounded-xl border border-destructive/30 bg-destructive/[0.03] p-4">
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0 flex-1">
								<p class="whitespace-pre-line text-sm leading-relaxed">
									{truncate(post.editedContent ?? post.generatedContent)}
								</p>
								<p class="mt-2 text-xs text-destructive">
									Reason: {post.failureReason ?? 'unknown error'}
								</p>
							</div>
							<div class="flex shrink-0 gap-1">
								<button
									onclick={() => retry(post)}
									disabled={actingId === post.id}
									class="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
								>
									Retry
								</button>
								<a
									href="/settings"
									class="rounded-lg border border-input px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
								>
									Settings
								</a>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- ── Published (success terminal state) ──────────────────────────────── -->
	{#if buckets.published.length > 0}
		<section class="mb-8">
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">Published</h2>
			<div class="space-y-3">
				{#each buckets.published as post (post.id)}
					<div class="rounded-xl border border-border p-4 transition-colors hover:bg-accent/30">
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0 flex-1">
								<p class="whitespace-pre-line text-sm leading-relaxed">
									{expandedId === post.id ? (post.editedContent ?? post.generatedContent) : truncate(post.editedContent ?? post.generatedContent)}
								</p>
								{@render postImages(post)}
								<div class="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
									{#if post.publishedAt}
										<span>published {formatDateTime(post.publishedAt)}</span>
									{:else}
										<span>{formatDateTime(post.createdAt)}</span>
									{/if}
									{#if linkedinUrl(post.linkedinPostUrn)}
										<a
											href={linkedinUrl(post.linkedinPostUrn) ?? '#'}
											target="_blank"
											rel="noopener"
											class="text-primary hover:underline"
										>
											View on LinkedIn ↗
										</a>
									{/if}
									{#if (post.editedContent ?? post.generatedContent).length > 200}
										<button onclick={() => toggleExpand(post.id)} class="text-primary hover:underline">
											{expandedId === post.id ? 'Show less' : 'View full post'}
										</button>
									{/if}
								</div>
							</div>
							<div class="flex shrink-0 gap-1">
								<button
									onclick={() => handleCopy(post.editedContent ?? post.generatedContent, post.id)}
									class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
								>
									{copiedId === post.id ? 'Copied!' : 'Copy'}
								</button>
								<button
									onclick={() => deletePost(post)}
									disabled={actingId === post.id}
									class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-40"
								>
									Delete
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- ── Drafts (manual saves) ───────────────────────────────────────────── -->
	{#if buckets.drafts.length > 0}
		<section class="mb-8">
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">Drafts</h2>
			<div class="space-y-3">
				{#each buckets.drafts as post (post.id)}
					<div class="rounded-xl border border-border p-4 transition-colors hover:bg-accent/30">
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0 flex-1">
								<p class="whitespace-pre-line text-sm leading-relaxed">
									{expandedId === post.id ? post.generatedContent : truncate(post.generatedContent)}
								</p>
								{@render postImages(post)}
								<div class="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
									<span>{formatDateTime(post.createdAt)}</span>
									{#if post.generatedContent.length > 200}
										<button onclick={() => toggleExpand(post.id)} class="text-primary hover:underline">
											{expandedId === post.id ? 'Show less' : 'View full post'}
										</button>
									{/if}
								</div>
							</div>
							<div class="flex shrink-0 gap-1">
								<button
									onclick={() => handleCopy(post.generatedContent, post.id)}
									class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
								>
									{copiedId === post.id ? 'Copied!' : 'Copy'}
								</button>
								<button
									onclick={() => deletePost(post)}
									disabled={actingId === post.id}
									class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-40"
								>
									Delete
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- ── Empty state ─────────────────────────────────────────────────────── -->
	{#if buckets.pendingReview.length === 0 && buckets.scheduled.length === 0 && buckets.published.length === 0 && buckets.drafts.length === 0 && buckets.failed.length === 0}
		<div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
			<svg class="h-10 w-10 text-muted-foreground/30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
			<h3 class="mt-4 text-sm font-medium">Your post library is empty</h3>
			<p class="mt-2 max-w-xs text-xs text-muted-foreground leading-relaxed">
				Generate a post manually from <a href="/generate" class="text-primary underline">Generate</a>, or
				set up <a href="/settings" class="text-primary underline">automation</a> to have drafts created for you on a schedule.
			</p>
		</div>
	{/if}
</div>

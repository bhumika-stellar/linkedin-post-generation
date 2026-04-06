<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';

	const posts = $derived($page.data.posts);

	let copiedId = $state<string | null>(null);
	let deletingId = $state<string | null>(null);
	let expandedId = $state<string | null>(null);

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	function handleCopy(content: string, id: string) {
		navigator.clipboard.writeText(content);
		copiedId = id;
		setTimeout(() => (copiedId = null), 2000);
	}

	async function handleDelete(id: string) {
		if (!confirm('Delete this post?')) return;

		deletingId = id;
		try {
			const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
			if (res.ok) {
				await invalidateAll();
			}
		} finally {
			deletingId = null;
		}
	}

	function formatDate(date: string | Date) {
		return new Date(date).toLocaleDateString('en-US', {
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
</script>

<div class="p-4 lg:p-6">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold">Posts</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Your generated LinkedIn posts.
			</p>
		</div>
		<a
			href="/generate"
			class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
		>
			New Post
		</a>
	</div>

	{#if posts.length === 0}
		<div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
			<svg class="h-10 w-10 text-muted-foreground/40" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
			<h3 class="mt-4 text-sm font-medium">No posts yet</h3>
			<p class="mt-1 max-w-sm text-center text-xs text-muted-foreground">
				Posts you generate and save will appear here. You can review, edit, and copy them anytime.
			</p>
			<a
				href="/generate"
				class="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
			>
				Create Your First Post
			</a>
		</div>
	{:else}
		<div class="space-y-4">
			{#each posts as post (post.id)}
				<div class="rounded-xl border border-border p-4 transition-colors hover:bg-accent/30">
					<div class="flex items-start justify-between gap-4">
						<div class="min-w-0 flex-1">
							<p class="whitespace-pre-line text-sm leading-relaxed">
								{expandedId === post.id ? post.generatedContent : truncate(post.generatedContent)}
							</p>
							<div class="mt-3 flex items-center gap-3">
								<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
									{post.status}
								</span>
								<span class="text-xs text-muted-foreground">
									{formatDate(post.createdAt)}
								</span>
								{#if post.generatedContent.length > 200}
									<button
										onclick={() => toggleExpand(post.id)}
										class="text-xs text-primary hover:underline"
									>
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
								onclick={() => handleDelete(post.id)}
								disabled={deletingId === post.id}
								class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-40"
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

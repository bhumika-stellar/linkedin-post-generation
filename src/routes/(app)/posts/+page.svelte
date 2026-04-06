<script lang="ts">
	// Posts will be loaded from DB in Phase 6
	const posts: unknown[] = [];
</script>

<div class="p-4 lg:p-6">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold">Posts</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Your generated LinkedIn posts.
			</p>
		</div>
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
	{/if}
</div>

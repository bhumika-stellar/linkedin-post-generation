<script lang="ts">
	// Templates will be loaded from DB in Phase 4
	const templates: unknown[] = [];
</script>

<div class="p-4 lg:p-6">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold">Templates</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Reusable prompt guidelines saved from your generation sessions.
			</p>
		</div>
	</div>

	{#if templates.length === 0}
		<div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
			<svg class="h-10 w-10 text-muted-foreground/40" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="7" x="3" y="3" rx="1"/><rect width="9" height="7" x="3" y="14" rx="1"/><rect width="5" height="7" x="16" y="14" rx="1"/></svg>
			<h3 class="mt-4 text-sm font-medium">No templates yet</h3>
			<p class="mt-1 max-w-sm text-center text-xs text-muted-foreground">
				Templates are created when you save your generation instructions. Go to Generate, craft a
				post, and click "Save as Template" to capture your prompting style.
			</p>
			<a
				href="/generate"
				class="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
			>
				Start Generating
			</a>
		</div>
	{/if}
</div>

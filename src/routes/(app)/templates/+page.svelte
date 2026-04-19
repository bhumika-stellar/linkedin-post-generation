<script lang="ts">
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';

	const templates = $derived($page.data.templates);

	let expandedId = $state<string | null>(null);
	let deletingId = $state<string | null>(null);

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? null : id;
	}

	async function handleDelete(id: string) {
		if (!confirm('Delete this template?')) return;

		deletingId = id;
		try {
			const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
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
			year: 'numeric'
		});
	}
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
		<div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
			<svg class="h-10 w-10 text-muted-foreground/30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="7" x="3" y="3" rx="1"/><rect width="9" height="7" x="3" y="14" rx="1"/><rect width="5" height="7" x="16" y="14" rx="1"/></svg>
			<h3 class="mt-4 text-sm font-medium">No templates saved yet</h3>
			<p class="mt-2 max-w-xs text-xs text-muted-foreground leading-relaxed">
				Templates capture your exact prompting instructions — your tone, style, and structure preferences — so you never have to retype them.
			</p>

			<!-- Example template preview -->
			<div class="mt-6 w-full max-w-sm rounded-lg border border-border bg-muted/40 p-4 text-left">
				<div class="flex items-center justify-between">
					<p class="text-xs font-medium">Example template</p>
					<span class="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">saved style</span>
				</div>
				<p class="mt-2 text-xs text-muted-foreground leading-relaxed italic">
					"Write in first person. Keep it under 200 words. Start with a hook — a surprising fact or a short scene. End with one question that invites comments. No hashtags."
				</p>
				<p class="mt-2 text-xs text-muted-foreground/60">
					Next time: open Generate → pick this template → done.
				</p>
			</div>

			<div class="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3 max-w-sm text-left">
				<p class="text-xs font-medium text-muted-foreground">How to save a template</p>
				<ol class="mt-2 space-y-1 text-xs text-muted-foreground">
					<li>1. Go to <span class="font-medium text-foreground">Generate</span> and write a post you like</li>
					<li>2. Click <span class="font-medium text-foreground">Template</span> in the post panel header</li>
					<li>3. Name it — it's saved here for future sessions</li>
				</ol>
			</div>

			<a
				href="/generate"
				class="mt-6 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
			>
				Generate and save a template
			</a>
		</div>
	{:else}
		<div class="space-y-4">
			{#each templates as template (template.id)}
				<div class="rounded-xl border border-border p-4 transition-colors hover:bg-accent/30">
					<div class="flex items-start justify-between gap-4">
						<div class="min-w-0 flex-1">
							<button
								onclick={() => toggleExpand(template.id)}
								class="text-left"
							>
								<h3 class="text-sm font-medium">{template.name}</h3>
								{#if template.description}
									<p class="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
								{/if}
							</button>

							{#if expandedId === template.id}
								<div class="mt-3 rounded-lg bg-muted/50 p-3">
									<p class="mb-1.5 text-xs font-medium text-muted-foreground">Guidelines</p>
									<p class="whitespace-pre-line text-sm leading-relaxed">{template.systemPrompt}</p>
								</div>
							{/if}

							<div class="mt-3 flex items-center gap-3">
								<span class="text-xs text-muted-foreground">
									{formatDate(template.createdAt)}
								</span>
								<button
									onclick={() => toggleExpand(template.id)}
									class="text-xs text-primary hover:underline"
								>
									{expandedId === template.id ? 'Collapse' : 'View guidelines'}
								</button>
							</div>
						</div>
						<div class="flex shrink-0 gap-1">
							<button
								onclick={() => handleDelete(template.id)}
								disabled={deletingId === template.id}
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

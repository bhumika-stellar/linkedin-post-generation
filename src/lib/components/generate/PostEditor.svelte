<script lang="ts">
	import Button from '$lib/components/Button.svelte';

	interface Props {
		generatedPost?: string;
		suggestedHashtags: string[];
		isLoadingHashtags: boolean;
		isGenerating: boolean;
		isSaving: boolean;
		saved: boolean;
		copied: boolean;
		hasConversation: boolean;
		onNewPost: () => void;
		onCopy: () => void;
		onSave: () => void;
		onSaveTemplate: () => void;
		onCollapse: () => void;
	}

	let {
		generatedPost = $bindable(''),
		suggestedHashtags,
		isLoadingHashtags,
		isGenerating,
		isSaving,
		saved,
		copied,
		hasConversation,
		onNewPost,
		onCopy,
		onSave,
		onSaveTemplate,
		onCollapse
	}: Props = $props();

	function appendHashtag(tag: string) {
		if (generatedPost.includes(tag)) return;
		generatedPost = generatedPost.trimEnd() + '\n' + tag;
	}
</script>

<div class="flex flex-1 flex-col border-r border-border overflow-hidden">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-border px-4 py-2.5 lg:px-6">
		<h3 class="text-sm font-medium">Generated Post</h3>
		<div class="flex items-center gap-1">
			<Button onclick={onNewPost} disabled={!hasConversation}>New</Button>
			<Button onclick={onCopy} disabled={!generatedPost}>
				{copied ? 'Copied!' : 'Copy'}
			</Button>
			<Button onclick={onSave} disabled={!generatedPost || isSaving || saved}>
				{saved ? 'Saved!' : isSaving ? 'Saving…' : 'Save'}
			</Button>
			<Button variant="secondary" onclick={onSaveTemplate} disabled={!hasConversation || isSaving}>
				{isSaving ? 'Saving…' : 'Template'}
			</Button>

			<!-- Collapse post panel -->
			<button
				onclick={onCollapse}
				title="Expand chat panel (close post)"
				class="ml-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="m9 18 6-6-6-6"/>
				</svg>
			</button>
		</div>
	</div>

	<!-- Post body -->
	<div class="flex-1 overflow-y-auto p-4 lg:p-6">
		{#if generatedPost || isGenerating}
			<textarea
				bind:value={generatedPost}
				class="h-full w-full resize-none bg-transparent text-sm leading-relaxed focus:outline-none"
			></textarea>
		{:else}
			<!-- Getting started guide — shown only before the first generation -->
			<div class="flex h-full items-start justify-center pt-6">
				<div class="w-full max-w-sm space-y-6">
					<div>
						<h2 class="text-base font-semibold">How PostGen works</h2>
						<p class="mt-1 text-xs text-muted-foreground">
							Turn your work notes into polished LinkedIn posts in three steps.
						</p>
					</div>

					<ol class="space-y-5">
						<li class="flex gap-3">
							<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
							<div>
								<p class="text-sm font-medium">Add sources <span class="text-muted-foreground text-xs font-normal">(optional)</span></p>
								<p class="mt-0.5 text-xs text-muted-foreground">
									Paste a URL to any article, research paper, or blog post in the <span class="font-medium text-foreground">Sources</span> panel above — PostGen extracts the text automatically. You can add multiple URLs. Or connect Notion to pull journal pages directly.
								</p>
							</div>
						</li>

						<li class="flex gap-3">
							<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
							<div>
								<p class="text-sm font-medium">Type your instructions below</p>
								<p class="mt-0.5 text-xs text-muted-foreground">
									In the chat bar at the bottom, tell the AI what post you want — the angle, the tone, what you want readers to feel. Hit <span class="font-medium text-foreground">Send</span> and the post streams here in real-time.
								</p>
							</div>
						</li>

						<li class="flex gap-3">
							<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
							<div>
								<p class="text-sm font-medium">Refine with follow-ups</p>
								<p class="mt-0.5 text-xs text-muted-foreground">
									Edit the post directly here, or send follow-ups — <em>"make it shorter"</em>, <em>"add a hook"</em>, <em>"end with a question"</em> — until it sounds like you.
								</p>
							</div>
						</li>
					</ol>

					<div class="rounded-lg border border-dashed border-border p-3">
						<p class="text-xs font-medium text-muted-foreground">Tip — click the <span class="text-foreground">?</span> button above to open the full guide.</p>
						<p class="mt-0.5 text-xs text-muted-foreground">
							It covers how to connect Notion, get an OpenRouter API key, use templates, and more.
						</p>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Hashtag suggestions -->
	{#if suggestedHashtags.length > 0 || isLoadingHashtags}
		<div class="border-t border-border px-4 py-2">
			<div class="flex flex-wrap items-center gap-1.5">
				<span class="shrink-0 text-xs text-muted-foreground">Hashtags:</span>
				{#if isLoadingHashtags}
					<span class="animate-pulse text-xs text-muted-foreground">Suggesting…</span>
				{:else}
					{#each suggestedHashtags as tag}
						<button
							onclick={() => appendHashtag(tag)}
							disabled={generatedPost.includes(tag)}
							title={generatedPost.includes(tag) ? 'Already in post' : 'Append to post'}
							class="rounded-full border border-input px-2 py-0.5 text-xs text-muted-foreground transition-colors
							hover:border-primary hover:text-primary disabled:cursor-default disabled:opacity-40"
						>
							{tag}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

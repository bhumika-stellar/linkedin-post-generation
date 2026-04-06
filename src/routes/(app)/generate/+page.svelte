<script lang="ts">
	let contentMode = $state<'manual' | 'notion'>('manual');
	let manualContent = $state('');
	let generatedPost = $state('');
	let currentPrompt = $state('');
	let promptHistory = $state<{ role: 'user' | 'ai'; text: string }[]>([]);
	let isGenerating = $state(false);

	function handleGenerate() {
		if (!currentPrompt.trim()) return;

		promptHistory = [...promptHistory, { role: 'user', text: currentPrompt }];

		isGenerating = true;
		// AI integration will be wired in Phase 5
		setTimeout(() => {
			generatedPost =
				'[AI-generated post will appear here once the AI engine is connected in Phase 5]\n\nThis is a placeholder showing where your polished LinkedIn post will be generated based on your content and prompts.';
			promptHistory = [
				...promptHistory,
				{ role: 'ai', text: 'Post generated. How would you like to refine it?' }
			];
			isGenerating = false;
		}, 1000);

		currentPrompt = '';
	}

	function handleCopy() {
		if (generatedPost) {
			navigator.clipboard.writeText(generatedPost);
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleGenerate();
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
					onclick={() => (contentMode = 'notion')}
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
		{:else}
			<div class="flex h-32 items-center justify-center rounded-lg border border-dashed border-input">
				<div class="text-center">
					<p class="text-sm text-muted-foreground">Notion integration coming in Phase 3</p>
					<button
						class="mt-2 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
						disabled
					>
						Connect Notion
					</button>
				</div>
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
						onclick={handleCopy}
						disabled={!generatedPost}
						class="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
					>
						Copy
					</button>
					<button
						disabled={!generatedPost}
						class="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
					>
						Save Post
					</button>
					<button
						disabled={promptHistory.length === 0}
						class="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-40"
					>
						Save as Template
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
				<h3 class="text-sm font-medium">Instructions</h3>
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
						disabled={!currentPrompt.trim() || isGenerating}
						class="self-end rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
					>
						Send
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

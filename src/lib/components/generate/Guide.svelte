<script lang="ts">
	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	type Section = { id: string; title: string };
	const sections: Section[] = [
		{ id: 'what', title: 'What is PostGen?' },
		{ id: 'how', title: 'How to generate a post' },
		{ id: 'sources', title: 'Adding sources' },
		{ id: 'notion', title: 'Connecting Notion' },
		{ id: 'openrouter', title: 'OpenRouter API key' },
		{ id: 'templates', title: 'Templates' },
		{ id: 'posts', title: 'Posts library' },
		{ id: 'tones', title: 'Tones explained' }
	];

	let activeSection = $state('what');

	function scrollTo(id: string) {
		activeSection = id;
		document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<!-- Backdrop -->
<button
	class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
	onclick={onClose}
	aria-label="Close guide"
></button>

<!-- Centered modal -->
<div class="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
<div class="pointer-events-auto flex w-full max-w-2xl flex-col rounded-2xl border border-border bg-background shadow-2xl" style="max-height: min(80vh, 700px)">
	<!-- Header -->
	<div class="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
		<div>
			<h2 class="text-base font-semibold">PostGen Guide</h2>
			<p class="text-xs text-muted-foreground">Everything you need to know</p>
		</div>
		<button
			onclick={onClose}
			class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
			aria-label="Close"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none"
				stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M18 6 6 18"/><path d="m6 6 12 12"/>
			</svg>
		</button>
	</div>

	<div class="flex flex-1 overflow-hidden">
		<!-- Sidebar nav -->
		<nav class="hidden w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border p-3 sm:flex">
			{#each sections as s}
				<button
					onclick={() => scrollTo(s.id)}
					class="rounded-md px-2.5 py-1.5 text-left text-xs transition-colors
					{activeSection === s.id
						? 'bg-accent font-medium text-foreground'
						: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
				>
					{s.title}
				</button>
			{/each}
		</nav>

		<!-- Scrollable content -->
		<div class="flex-1 overflow-y-auto px-6 py-5 space-y-10 text-sm">

			<!-- What is PostGen -->
			<section id="guide-what">
				<h3 class="mb-3 text-sm font-semibold">What is PostGen?</h3>
				<p class="text-muted-foreground leading-relaxed">
					PostGen is an AI-powered LinkedIn post generator. It takes your source material — articles, research papers, Notion journal entries — and turns them into polished, ready-to-publish LinkedIn posts in your voice.
				</p>
				<p class="mt-2 text-muted-foreground leading-relaxed">
					You stay in full control: choose the angle, set the tone, and refine iteratively through a back-and-forth chat until it sounds exactly like you.
				</p>
			</section>

			<hr class="border-border"/>

			<!-- How to generate -->
			<section id="guide-how">
				<h3 class="mb-3 text-sm font-semibold">How to generate a post</h3>
				<ol class="space-y-4">
					<li class="flex gap-3">
						<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>
						<div>
							<p class="font-medium">Add sources <span class="text-muted-foreground font-normal">(optional)</span></p>
							<p class="mt-0.5 text-xs text-muted-foreground leading-relaxed">
								Paste a URL to an article or paper and click <strong class="text-foreground">Load</strong>. Or connect Notion to pull journal pages. Sources give the AI real context to work from.
							</p>
						</div>
					</li>
					<li class="flex gap-3">
						<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>
						<div>
							<p class="font-medium">Type your instructions</p>
							<p class="mt-0.5 text-xs text-muted-foreground leading-relaxed">
								In the chat bar at the bottom, tell the AI what post you want — the angle, the story, what you want readers to feel. Be as specific as you like.
							</p>
						</div>
					</li>
					<li class="flex gap-3">
						<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>
						<div>
							<p class="font-medium">Refine with follow-ups</p>
							<p class="mt-0.5 text-xs text-muted-foreground leading-relaxed">
								The post streams into the editor in real-time. Send follow-ups like <em>"make it shorter"</em>, <em>"add a hook"</em>, or <em>"end with a question"</em> until it's right.
							</p>
						</div>
					</li>
					<li class="flex gap-3">
						<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">4</span>
						<div>
							<p class="font-medium">Copy or save</p>
							<p class="mt-0.5 text-xs text-muted-foreground leading-relaxed">
								Copy straight to clipboard, or Save to your Posts library. Suggested hashtags appear below the post automatically.
							</p>
						</div>
					</li>
				</ol>
			</section>

			<hr class="border-border"/>

			<!-- Sources -->
			<section id="guide-sources">
				<h3 class="mb-3 text-sm font-semibold">Adding sources</h3>
				<p class="mb-3 text-muted-foreground leading-relaxed">
					Sources are the raw material the AI uses to write your post. You can add as many as you like — they're all combined and sent as context.
				</p>

				<div class="space-y-4">
					<div class="rounded-lg border border-border p-3">
						<p class="font-medium text-xs mb-1">🔗 URLs (articles, papers, posts)</p>
						<ol class="text-xs text-muted-foreground space-y-1 leading-relaxed">
							<li>1. In the <strong class="text-foreground">Sources</strong> section at the top, paste any public URL into the input field.</li>
							<li>2. Press <strong class="text-foreground">Enter</strong> or click <strong class="text-foreground">Load</strong>.</li>
							<li>3. PostGen fetches the page and extracts the readable text — the title and a "loaded" chip confirm it worked.</li>
							<li>4. Click <strong class="text-foreground">+ Add another URL</strong> for additional sources.</li>
						</ol>
						<p class="mt-2 text-[11px] text-muted-foreground/70">Note: paywalled articles or pages that block scrapers may not extract fully.</p>
					</div>

					<div class="rounded-lg border border-border p-3">
						<p class="font-medium text-xs mb-1">📓 Notion pages</p>
						<p class="text-xs text-muted-foreground leading-relaxed">
							Once Notion is connected (see below), click <strong class="text-foreground">Pull from Notion</strong> to open a checklist of your journal pages. Select one or more — their content is fetched and added to the sources automatically.
						</p>
					</div>
				</div>
			</section>

			<hr class="border-border"/>

			<!-- Notion -->
			<section id="guide-notion">
				<h3 class="mb-3 text-sm font-semibold">Connecting Notion</h3>

				<div class="space-y-3">
					<div class="rounded-lg border border-border p-3">
						<p class="font-medium text-xs mb-2">Step 1 — Authorise PostGen</p>
						<ol class="text-xs text-muted-foreground space-y-1 leading-relaxed">
							<li>1. Go to <strong class="text-foreground">Settings</strong> (bottom of the left sidebar).</li>
							<li>2. Under <strong class="text-foreground">Notion Integration</strong>, click <strong class="text-foreground">Connect Notion</strong>.</li>
							<li>3. Notion will open an authorisation page — select the pages or databases you want PostGen to access.</li>
							<li>4. You'll be redirected back. The button will change to "Reconnect Notion" confirming it worked.</li>
						</ol>
					</div>

					<div class="rounded-lg border border-border p-3">
						<p class="font-medium text-xs mb-2">Step 2 — Set your Journal Page ID <span class="text-muted-foreground font-normal">(optional)</span></p>
						<p class="text-xs text-muted-foreground leading-relaxed mb-2">
							If you want PostGen to default to a specific Notion page (e.g. your weekly journal), paste its page ID in Settings.
						</p>
						<p class="text-xs font-medium mb-1">How to find the page ID:</p>
						<ol class="text-xs text-muted-foreground space-y-1 leading-relaxed">
							<li>1. Open the page in Notion.</li>
							<li>2. Copy the URL from your browser — it looks like:<br/>
								<code class="mt-1 block rounded bg-muted px-2 py-1 font-mono text-[10px] text-foreground">notion.so/My-Journal-<strong>abc123def456abc123def456abc12345</strong></code>
							</li>
							<li>3. The long string of characters after the last dash is the page ID. Paste that into the <strong class="text-foreground">Journal Page ID</strong> field in Settings and save.</li>
						</ol>
					</div>
				</div>
			</section>

			<hr class="border-border"/>

			<!-- OpenRouter -->
			<section id="guide-openrouter">
				<h3 class="mb-3 text-sm font-semibold">OpenRouter API key</h3>
				<p class="mb-3 text-muted-foreground leading-relaxed">
					PostGen uses <a href="https://openrouter.ai" target="_blank" rel="noopener" class="underline underline-offset-2 hover:text-foreground">OpenRouter</a> to access AI models. By default it uses a shared key which may have rate limits. Adding your own key gives you full control.
				</p>

				<div class="rounded-lg border border-border p-3 space-y-2">
					<p class="font-medium text-xs">How to get your key:</p>
					<ol class="text-xs text-muted-foreground space-y-1 leading-relaxed">
						<li>1. Go to <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" class="underline underline-offset-2 hover:text-foreground">openrouter.ai/keys</a> and sign up (free).</li>
						<li>2. Click <strong class="text-foreground">Create Key</strong> and copy it.</li>
						<li>3. In PostGen, go to <strong class="text-foreground">Settings → AI Settings</strong>, paste the key, and click <strong class="text-foreground">Save AI Settings</strong>.</li>
					</ol>
				</div>

				<div class="mt-3 rounded-lg border border-border p-3">
					<p class="font-medium text-xs mb-1">With your own key you can use paid models:</p>
					<ul class="text-xs text-muted-foreground space-y-0.5">
						<li>• <strong class="text-foreground">GPT-4o</strong> — OpenAI's best, great at following style instructions</li>
						<li>• <strong class="text-foreground">Claude 3.5 Sonnet</strong> — excellent at nuanced, natural writing</li>
						<li>• <strong class="text-foreground">Gemini 1.5 Pro</strong> — handles very long source documents</li>
					</ul>
					<p class="mt-2 text-[11px] text-muted-foreground/70">Free models (Llama, Mistral) are available without a key and work well for most posts.</p>
				</div>
			</section>

			<hr class="border-border"/>

			<!-- Templates -->
			<section id="guide-templates">
				<h3 class="mb-3 text-sm font-semibold">Templates</h3>
				<p class="mb-3 text-muted-foreground leading-relaxed">
					A Template saves a set of instructions so you never have to retype your prompting style. Build a library over time — one for thought leadership posts, one for casual Friday posts, one for sharing research.
				</p>

				<div class="rounded-lg border border-border p-3 space-y-2">
					<p class="font-medium text-xs">How to save a template:</p>
					<ol class="text-xs text-muted-foreground space-y-1 leading-relaxed">
						<li>1. Generate a post you're happy with on the <strong class="text-foreground">Generate</strong> page.</li>
						<li>2. Click <strong class="text-foreground">Template</strong> in the post header.</li>
						<li>3. Give it a name — it's saved to your account permanently.</li>
					</ol>
				</div>
				<div class="mt-3 rounded-lg border border-border p-3">
					<p class="font-medium text-xs mb-1">How to use a template:</p>
					<p class="text-xs text-muted-foreground leading-relaxed">
						In the Instructions chat bar, open the <strong class="text-foreground">Template…</strong> dropdown and pick the one you want. Its instructions are pre-filled — just hit Send.
					</p>
				</div>
				<p class="mt-2 text-xs text-muted-foreground">
					Browse all saved templates on the <a href="/templates" class="underline underline-offset-2 hover:text-foreground">Templates page</a>.
				</p>
			</section>

			<hr class="border-border"/>

			<!-- Posts library -->
			<section id="guide-posts">
				<h3 class="mb-3 text-sm font-semibold">Posts library</h3>
				<p class="mb-3 text-muted-foreground leading-relaxed">
					Every post you save lives in the <a href="/posts" class="underline underline-offset-2 hover:text-foreground">Posts page</a>. It's your personal library of generated LinkedIn content.
				</p>
				<div class="rounded-lg border border-border p-3">
					<p class="font-medium text-xs mb-1">How to save a post:</p>
					<ol class="text-xs text-muted-foreground space-y-1 leading-relaxed">
						<li>1. Generate a post on the Generate page.</li>
						<li>2. Click <strong class="text-foreground">Save</strong> in the post header — the post is saved instantly.</li>
						<li>3. Visit <strong class="text-foreground">Posts</strong> in the sidebar to browse, copy, or reference saved posts.</li>
					</ol>
				</div>
			</section>

			<hr class="border-border"/>

			<!-- Tones -->
			<section id="guide-tones">
				<h3 class="mb-3 text-sm font-semibold">Tones explained</h3>
				<p class="mb-3 text-muted-foreground leading-relaxed">
					Pick a tone in the <strong class="text-foreground">Settings</strong> section of the Instructions bar to shape how the AI writes. You can combine a tone with your own instructions for even more precision.
				</p>
				<div class="space-y-2">
					{#each [
						{ name: 'Storytelling', desc: 'Narrative arc with a beginning, tension, and resolution. Best for personal lessons and career stories.' },
						{ name: 'Data-driven', desc: 'Stats, evidence, and concrete numbers front and centre. Best for research breakdowns and results.' },
						{ name: 'Thought Leader', desc: 'A single non-obvious insight, stated with confidence. Best for industry takes and contrarian views.' },
						{ name: 'Casual', desc: 'Conversational, like texting a friend. Short sentences, no jargon. Best for opinions and quick takes.' },
						{ name: 'Inspirational', desc: 'Uplifting and motivational. Best for sharing milestones, lessons learned, and calls to action.' }
					] as tone}
						<div class="rounded-lg border border-border px-3 py-2">
							<p class="text-xs font-medium">{tone.name}</p>
							<p class="mt-0.5 text-xs text-muted-foreground leading-relaxed">{tone.desc}</p>
						</div>
					{/each}
				</div>

				<div class="mt-4 pb-6"></div>
			</section>

		</div>
	</div>
</div>
</div>

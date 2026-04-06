<script lang="ts">
	import { page } from '$app/stores';

	const session = $derived($page.data.session);
</script>

<div class="flex min-h-screen flex-col items-center justify-center px-4">
	<div class="mx-auto max-w-2xl text-center">
		<h1 class="text-4xl font-bold tracking-tight sm:text-5xl">
			Turn your work journal into LinkedIn posts
		</h1>
		<p class="mt-4 text-lg text-muted-foreground">
			Pull your notes from Notion, give the AI your instructions, and iterate until you have a
			polished post. Save your prompting style as a template for next time.
		</p>

		<div class="mt-8">
			{#if session?.user}
				<a
					href="/generate"
					class="inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				>
					Go to Generate
				</a>
			{:else}
				<form method="POST" action="/auth/signin/google">
					<button
						type="submit"
						class="inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90"
					>
						Sign in with Google
					</button>
				</form>
			{/if}
		</div>
	</div>
</div>

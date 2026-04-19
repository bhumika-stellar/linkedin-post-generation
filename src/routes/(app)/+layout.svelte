<script lang="ts">
	import { page } from '$app/stores';
	import Guide from '$lib/components/generate/Guide.svelte';

	let { children } = $props();
	let sidebarOpen = $state(false);      // mobile slide-in
	let sidebarCollapsed = $state(false); // desktop icon-only mode
	let guideOpen = $state(false);

	const session = $derived($page.data.session);

	const navItems = [
		{ href: '/generate',   label: 'Generate',   icon: 'sparkles' },
		{ href: '/templates',  label: 'Templates',  icon: 'layout-template' },
		{ href: '/posts',      label: 'Posts',      icon: 'file-text' }
	];

	function isActive(href: string): boolean {
		return $page.url.pathname.startsWith(href);
	}

	const sc = $derived(sidebarCollapsed);
</script>

<!-- Mobile overlay -->
{#if sidebarOpen}
	<button
		class="fixed inset-0 z-40 bg-black/50 lg:hidden"
		onclick={() => (sidebarOpen = false)}
		aria-label="Close sidebar"
	></button>
{/if}

<!-- Guide modal -->
{#if guideOpen}
	<Guide onClose={() => (guideOpen = false)} />
{/if}

<div class="relative flex h-screen overflow-hidden">

	<!-- ── Sidebar ──────────────────────────────────────────────────────────── -->
	<aside
		class="fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar
		overflow-hidden transition-transform duration-200
		{sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
		w-64 lg:static lg:translate-x-0 lg:transition-[width] lg:duration-200
		{sc ? 'lg:w-14' : 'lg:w-64'}"
	>
		<!-- Logo row -->
		<div class="flex h-14 shrink-0 items-center border-b border-sidebar-border
			{sc ? 'justify-center px-0' : 'justify-between px-4'}">

			{#if sc}
				<!-- Icon-only brand mark -->
				<a href="/generate" title="PostGen" class="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground text-xs font-bold">
					P
				</a>
			{:else}
				<a href="/generate" class="text-lg font-semibold text-sidebar-foreground">PostGen</a>
				<div class="flex items-center gap-1">
					<!-- Guide -->
					<button
						onclick={() => (guideOpen = true)}
						title="Open guide"
						class="flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border text-xs font-semibold text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
					>?</button>
				</div>
			{/if}
		</div>

		<!-- Main nav -->
		<nav class="flex-1 overflow-y-auto py-3 {sc ? 'px-2' : 'px-3'}">
			<div class="space-y-0.5">
				{#each navItems as item}
					<a
						href={item.href}
						onclick={() => (sidebarOpen = false)}
						title={sc ? item.label : undefined}
						class="flex items-center rounded-lg py-2 text-sm font-medium transition-colors
						{sc ? 'justify-center px-2' : 'gap-3 px-3'}
						{isActive(item.href)
							? 'bg-sidebar-accent text-sidebar-accent-foreground'
							: 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}"
					>
						<!-- Icon -->
						{#if item.icon === 'sparkles'}
							<svg class="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
						{:else if item.icon === 'layout-template'}
							<svg class="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="7" x="3" y="3" rx="1"/><rect width="9" height="7" x="3" y="14" rx="1"/><rect width="5" height="7" x="16" y="14" rx="1"/></svg>
						{:else if item.icon === 'file-text'}
							<svg class="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
						{/if}
						{#if !sc}
							<span>{item.label}</span>
						{/if}
					</a>
				{/each}
			</div>
		</nav>

		<!-- Bottom section: user + settings + toggle -->
		<div class="shrink-0 border-t border-sidebar-border {sc ? 'px-2 py-3' : 'p-3'} space-y-0.5">

			{#if session?.user}
				<!-- User avatar row -->
				{#if sc}
					<div class="flex justify-center py-1.5">
						{#if session.user.image}
							<img src={session.user.image} alt={session.user.name ?? 'User'} title={session.user.name ?? 'User'} class="h-7 w-7 rounded-full" />
						{:else}
							<div class="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground" title={session.user.name ?? 'User'}>
								{session.user.name?.charAt(0) ?? '?'}
							</div>
						{/if}
					</div>
				{:else}
					<div class="flex items-center gap-3 rounded-lg px-3 py-2">
						{#if session.user.image}
							<img src={session.user.image} alt={session.user.name ?? 'User'} class="h-7 w-7 rounded-full shrink-0" />
						{:else}
							<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
								{session.user.name?.charAt(0) ?? '?'}
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs font-medium text-sidebar-foreground">{session.user.name ?? 'User'}</p>
							<p class="truncate text-[11px] text-sidebar-foreground/50">{session.user.email ?? ''}</p>
						</div>
					</div>
				{/if}

				<!-- Settings -->
				<a
					href="/settings"
					onclick={() => (sidebarOpen = false)}
					title={sc ? 'Settings' : undefined}
					class="flex items-center rounded-lg py-2 text-sm font-medium transition-colors
					{sc ? 'justify-center px-2' : 'gap-3 px-3'}
					{isActive('/settings')
						? 'bg-sidebar-accent text-sidebar-accent-foreground'
						: 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}"
				>
					<svg class="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
					{#if !sc}<span>Settings</span>{/if}
				</a>

				<!-- Sign out -->
				<form method="POST" action="/auth/signout">
					<button
						type="submit"
						title={sc ? 'Sign out' : undefined}
						class="flex w-full items-center rounded-lg py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground
						{sc ? 'justify-center px-2' : 'gap-3 px-3'}"
					>
						<svg class="h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
						{#if !sc}<span>Sign out</span>{/if}
					</button>
				</form>
			{/if}

			<!-- Desktop toggle (always at the very bottom) -->
			<button
				onclick={() => (sidebarCollapsed = !sidebarCollapsed)}
				title={sc ? 'Expand sidebar' : 'Collapse sidebar'}
				class="hidden lg:flex w-full items-center rounded-lg py-2 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground
				{sc ? 'justify-center px-2' : 'gap-3 px-3'}"
			>
				<!-- Panel-left icon — arrow flips based on state -->
				<svg class="h-4 w-4 shrink-0 transition-transform duration-200 {sc ? 'rotate-180' : ''}"
					xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect width="18" height="18" x="3" y="3" rx="2"/>
					<path d="M9 3v18"/>
					<path d="m16 15-3-3 3-3"/>
				</svg>
				{#if !sc}<span class="text-sm font-medium">Collapse</span>{/if}
			</button>
		</div>
	</aside>

	<!-- Border-line collapse toggle (sits on the sidebar edge) -->
	<button
		onclick={() => (sidebarCollapsed = !sidebarCollapsed)}
		title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		style="left: {sidebarCollapsed ? 56 : 256}px"
		class="absolute top-[62px] z-50 hidden -translate-x-1/2 lg:flex
		h-5 w-5 items-center justify-center
		rounded-full border border-border bg-background shadow-sm
		text-muted-foreground transition-[left] duration-200
		hover:bg-accent hover:text-foreground"
	>
		<svg
			class="h-3 w-3 transition-transform duration-200 {sidebarCollapsed ? 'rotate-180' : ''}"
			xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
			stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
		>
			<path d="m15 18-6-6 6-6"/>
		</svg>
	</button>

	<!-- ── Main content ─────────────────────────────────────────────────────── -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Mobile header -->
		<header class="flex h-14 items-center border-b border-border px-4 lg:hidden">
			<button
				onclick={() => (sidebarOpen = true)}
				class="rounded-lg p-2 hover:bg-accent"
				aria-label="Open sidebar"
			>
				<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
			</button>
			<span class="ml-3 text-lg font-semibold">PostGen</span>
		</header>

		<!-- Page content -->
		<main class="flex-1 overflow-y-auto">
			{@render children()}
		</main>
	</div>
</div>

<script lang="ts">
	import { page } from '$app/stores';

	let { children } = $props();
	let sidebarOpen = $state(false);

	const session = $derived($page.data.session);

	const navItems = [
		{ href: '/generate', label: 'Generate', icon: 'sparkles' },
		{ href: '/templates', label: 'Templates', icon: 'layout-template' },
		{ href: '/posts', label: 'Posts', icon: 'file-text' },
		{ href: '/settings', label: 'Settings', icon: 'settings' }
	];

	function isActive(href: string): boolean {
		return $page.url.pathname.startsWith(href);
	}
</script>

<!-- Mobile overlay -->
{#if sidebarOpen}
	<button
		class="fixed inset-0 z-40 bg-black/50 lg:hidden"
		onclick={() => (sidebarOpen = false)}
		aria-label="Close sidebar"
	></button>
{/if}

<div class="flex h-screen overflow-hidden">
	<!-- Sidebar -->
	<aside
		class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:static lg:translate-x-0
		{sidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
	>
		<!-- Logo -->
		<div class="flex h-14 items-center border-b border-sidebar-border px-4">
			<a href="/generate" class="text-lg font-semibold text-sidebar-foreground">
				PostGen
			</a>
		</div>

		<!-- Navigation -->
		<nav class="flex-1 space-y-1 p-3">
			{#each navItems as item}
				<a
					href={item.href}
					onclick={() => (sidebarOpen = false)}
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
					{isActive(item.href)
						? 'bg-sidebar-accent text-sidebar-accent-foreground'
						: 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}"
				>
					{#if item.icon === 'sparkles'}
						<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
					{:else if item.icon === 'layout-template'}
						<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="7" x="3" y="3" rx="1"/><rect width="9" height="7" x="3" y="14" rx="1"/><rect width="5" height="7" x="16" y="14" rx="1"/></svg>
					{:else if item.icon === 'file-text'}
						<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
					{:else if item.icon === 'settings'}
						<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
					{/if}
					{item.label}
				</a>
			{/each}
		</nav>

		<!-- User section -->
		<div class="border-t border-sidebar-border p-3">
			{#if session?.user}
				<div class="flex items-center gap-3 rounded-lg px-3 py-2">
					{#if session.user.image}
						<img
							src={session.user.image}
							alt={session.user.name ?? 'User'}
							class="h-8 w-8 rounded-full"
						/>
					{:else}
						<div class="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium">
							{session.user.name?.charAt(0) ?? '?'}
						</div>
					{/if}
					<div class="flex-1 truncate">
						<p class="truncate text-sm font-medium text-sidebar-foreground">
							{session.user.name ?? 'User'}
						</p>
						<p class="truncate text-xs text-sidebar-foreground/60">
							{session.user.email ?? ''}
						</p>
					</div>
				</div>
				<form method="POST" action="/auth/signout" class="mt-1">
					<button
						type="submit"
						class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
					>
						<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
						Sign out
					</button>
				</form>
			{/if}
		</div>
	</aside>

	<!-- Main content -->
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

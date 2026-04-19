<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'ghost';
		size?: 'sm' | 'md';
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		title?: string;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	}

	let {
		variant = 'ghost',
		size = 'sm',
		disabled = false,
		type = 'button',
		title,
		onclick,
		children
	}: Props = $props();

	const base =
		'inline-flex items-center justify-center font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

	const variants: Record<string, string> = {
		primary: 'rounded-lg bg-primary text-primary-foreground hover:bg-primary/90',
		secondary: 'rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80',
		ghost: 'rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground'
	};

	const sizes: Record<string, string> = {
		sm: 'px-3 py-1.5 text-xs',
		md: 'px-4 py-2 text-sm'
	};
</script>

<button {type} {disabled} {title} {onclick} class="{base} {variants[variant]} {sizes[size]}">
	{@render children()}
</button>

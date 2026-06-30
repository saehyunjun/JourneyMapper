<!--
	AppCard — the consolidated card primitive (DESIGN_SYSTEM_AUDIT.md §2.2, Wave 3).

	Replaces the .card / .card-sm / .card-lg / .card-quote / .card-body /
	.persona-card family in app.css, plus the per-component card patterns
	in KeyQuoteCard / KeyFindingCard / BentoCard / JourneyStep / CapabilityTile /
	CodedFragmentCard.

	The visual rules live here (not in app.css) so the primitive stays
	self-contained and is easy to delete or replace later. Tokens it depends
	on (--radius-md, --radius-lg, --elev-1, --elev-2, --border-subtle,
	--surface-panel, --dur-fast) all live in :root in app.css.

	Variants are filled in as cards migrate — when adding a new variant,
	also add the consumer to DESIGN_SYSTEM_AUDIT.md §3.1 Wave 3.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'default' | 'quote' | 'fragment' | 'finding' | 'metric';

	let {
		variant = 'default',
		tag = 'div',
		selected = false,
		interactive = false,
		class: classProp = '',
		children,
		onclick
	}: {
		variant?: Variant;
		/** Semantic element to render. Use 'article' for self-contained cards
		 * (quotes, findings) or 'figure' for media-with-caption tiles. */
		tag?: 'div' | 'article' | 'figure' | 'section';
		/** Applies the selected/active state styling (border accent + tint). */
		selected?: boolean;
		/** Adds hover lift + cursor:pointer. Independent from onclick so non-click
		 * cards (e.g. selectable via parent click delegation) can still hint. */
		interactive?: boolean;
		class?: string;
		children: Snippet;
		onclick?: (e: MouseEvent) => void;
	} = $props();

	const variantClass = $derived(`app-card--${variant}`);
	const klass = $derived(
		`app-card ${variantClass} ${selected ? 'app-card--selected' : ''} ${interactive ? 'app-card--interactive' : ''} ${classProp}`
	);
	function onKey(e: KeyboardEvent) {
		if (!onclick) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onclick(e as unknown as MouseEvent);
		}
	}
</script>

{#if tag === 'article'}
	<article
		class={klass}
		{onclick}
		role={onclick ? 'button' : undefined}
		tabindex={onclick ? 0 : undefined}
		onkeydown={onclick ? onKey : undefined}
	>
		{@render children()}
	</article>
{:else if tag === 'figure'}
	<figure
		class={klass}
		{onclick}
		role={onclick ? 'button' : undefined}
		tabindex={onclick ? 0 : undefined}
		onkeydown={onclick ? onKey : undefined}
	>
		{@render children()}
	</figure>
{:else if tag === 'section'}
	<section
		class={klass}
		{onclick}
		role={onclick ? 'button' : undefined}
		tabindex={onclick ? 0 : undefined}
		onkeydown={onclick ? onKey : undefined}
	>
		{@render children()}
	</section>
{:else}
	<div
		class={klass}
		{onclick}
		role={onclick ? 'button' : undefined}
		tabindex={onclick ? 0 : undefined}
		onkeydown={onclick ? onKey : undefined}
	>
		{@render children()}
	</div>
{/if}

<style>
	.app-card {
		background: oklch(1 0 0);
		border-radius: var(--radius-md);
		border: 1px solid var(--border-subtle);
	}

	/* ── fragment: minimal callout used inside drawers ─────────────── */
	.app-card--fragment {
		background: transparent;
		border-width: 2px;
		border-color: color-mix(in srgb, var(--muted-foreground) 40%, transparent);
		border-radius: 0;
		padding: 12px;
		transition: border-color var(--dur-fast) ease, background-color var(--dur-fast) ease;
	}
	.app-card--fragment.app-card--selected {
		border-color: var(--color-accent-mint);
		background: color-mix(in srgb, var(--color-accent-mint) 5%, transparent);
	}

	/* ── quote: white pull-quote tile (KeyQuoteCard family) ────────── */
	/* Padding intentionally not set — consumers vary (size-driven). */
	.app-card--quote {
		background: oklch(1 0 0);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
	}

	/* ── finding: key-finding summary tile ─────────────────────────── */
	.app-card--finding {
		background: oklch(1 0 0);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: var(--elev-1);
	}

	/* ── metric: stat block / bento tile / capability tile ─────────── */
	/* Padding intentionally not set — consumers vary. */
	.app-card--metric {
		background: var(--surface-panel);
		border: 1px solid color-mix(in srgb, var(--ink) 10%, transparent);
		border-radius: var(--radius-md);
	}

	/* ── interactive lift (any variant) ────────────────────────────── */
	.app-card--interactive {
		cursor: pointer;
		transition:
			transform var(--dur-fast) ease,
			box-shadow var(--dur-fast) ease,
			border-color var(--dur-fast) ease;
	}
	.app-card--interactive:hover {
		transform: translateY(-2px);
		box-shadow: var(--elev-2);
	}
	.app-card--interactive:focus-visible {
		outline: none;
		box-shadow: var(--ring-focus);
	}
</style>

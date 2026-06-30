<!--
	BentoBoard — the grid container for a bento layout.

	Owns the `expandedId` state and provides a context object to descendant
	`BentoCell`s so they can:
	  - render at their natural size when nothing is expanded
	  - render dimmed + inert when a sibling is expanded
	  - render expanded (taking most of the board) when this is the chosen one

	State transitions go through `document.startViewTransition()` when the
	browser supports it (Chromium 111+, Safari 18+). The animation is the
	browser's automatic morph between old and new layouts; each cell carries
	a `view-transition-name` so the morph follows the right cell across the
	size change. Falls back to a plain Svelte reactivity update when VT isn't
	available — the cells still resize, just snap rather than morph.

	Escape collapses; clicking the dimmed backdrop collapses. Sibling-click
	while expanded re-expands the new cell (chained transition).
-->
<script lang="ts">
	import { setContext, type Snippet } from 'svelte';
	import type { BentoContext, BentoSize } from './types';

	type Props = {
		children: Snippet;
		/** Size every cell takes when nothing is expanded. Defaults to 'md'. */
		baseSize?: BentoSize;
		/** Size the expanded cell takes. Defaults to 'lg'. */
		expandedSize?: BentoSize;
		/** Size sibling cells take when something else is expanded. */
		dimmedSize?: BentoSize;
		/** Grid columns. 12 maps cleanly to spans of 3/4/6/12. */
		columns?: number;
		/** Archive/static mode — click-to-expand disabled, no hit target,
		 *  no cursor pointer. The expand/collapse code is preserved so a
		 *  single prop flip restores the behaviour. */
		staticBoard?: boolean;
	};

	let {
		children,
		baseSize = 'md',
		expandedSize = 'lg',
		dimmedSize = 'sm',
		columns = 12,
		staticBoard = false
	}: Props = $props();

	let expandedId = $state<string | null>(null);

	function withTransition(fn: () => void) {
		const doc = typeof document !== 'undefined' ? document : null;
		// startViewTransition is the modern path; the fallback is just running
		// the state change directly so the layout still updates (without the
		// morph) on browsers that lack VT.
		if (doc && 'startViewTransition' in doc) {
			(doc as Document & { startViewTransition: (cb: () => void) => void })
				.startViewTransition(fn);
		} else {
			fn();
		}
	}

	function expand(id: string) {
		if (staticBoard) return; // archived
		withTransition(() => {
			expandedId = id;
		});
	}
	function collapse() {
		if (staticBoard) return;
		withTransition(() => {
			expandedId = null;
		});
	}

	setContext<BentoContext>('bento', {
		expandedId: () => expandedId,
		expand,
		collapse,
		expandedSize,
		dimmedSize,
		staticBoard
	});

	// Escape collapses — global keydown listener that's only active while
	// something is expanded, so we don't fight other Escape handlers when
	// the bento is in its resting state.
	$effect(() => {
		if (expandedId === null) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.preventDefault();
				collapse();
			}
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	// CSS custom property for the grid so consumers can adjust if they want
	// a 16-col board for a wider page, etc.
	const gridStyle = $derived(`--bento-cols: ${columns};`);
</script>

<div class="bento-board" style={gridStyle} data-expanded={expandedId !== null}>
	{@render children()}

	{#if expandedId !== null}
		<!-- Dim backdrop. Catches outside-clicks to collapse, sits below the
			 expanded cell but above all dimmed siblings via z-index. -->
		<button
			type="button"
			class="bento-backdrop"
			aria-label="Collapse"
			onclick={collapse}
		></button>
	{/if}
</div>

<style>
	.bento-board {
		display: grid;
		grid-template-columns: repeat(var(--bento-cols, 12), minmax(0, 1fr));
		grid-auto-rows: minmax(7rem, auto);
		gap: 0.875rem;
		position: relative;
	}
	.bento-backdrop {
		position: absolute;
		inset: -2rem;
		background: rgba(48, 47, 40, 0.18);
		backdrop-filter: blur(2px);
		border: none;
		cursor: pointer;
		/* Sits below the expanded cell (z=2) but above dimmed siblings (z=0). */
		z-index: 1;
		border-radius: 16px;
	}
	/* The View Transitions API automatically morphs each ::view-transition
	   pair. Tune the duration so the size morph feels responsive but
	   noticeable — too fast looks janky, too slow feels sluggish. */
	:global(::view-transition-group(*)) {
		animation-duration: 280ms;
		animation-timing-function: cubic-bezier(0.2, 0, 0, 1);
	}
	/* Italic firewall: app.css ships global utility classes (.caption,
	   .cite, .footer, …) with `font-style: italic` baked in, and our
	   scoped class names collide by accident. Aaron's standing rule is
	   no italic unless explicitly requested, so we kill italics anywhere
	   in the bento subtree as a hammer. Cheaper than namespacing every
	   class name; any legitimate italic need has to be a deliberate
	   override at the call site, which forces the conversation. */
	.bento-board :global(*) {
		font-style: normal;
	}
</style>

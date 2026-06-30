<!--
	BentoCell — a grid cell on a BentoBoard.

	Owns its own id + natural grid span. Reads the board's expanded state from
	context to decide which size to render its child at:

	  - nothing expanded   → natural size (the `size` prop you passed)
	  - this expanded      → the board's expandedSize (default 'xl'),
	                         span jumps to fill the board (col: full, row: 8)
	  - other expanded     → the board's dimmedSize (default 'sm'),
	                         dimmed + inert so clicks land on the backdrop

	The child component reads the size via the snippet param — call site:

	    <BentoCell id="stat-fragments" size="md" span={{ col: 4, row: 2 }}>
	        {#snippet child(size)}
	            <StatCard {size} figure="78" label="Fragments" ... />
	        {/snippet}
	    </BentoCell>

	The `view-transition-name` is set per-cell, which is what lets the View
	Transitions API morph each cell across its size change.
-->
<script lang="ts">
	import { getContext, type Snippet } from 'svelte';
	import type { BentoContext, BentoSize, CellSpan } from './types';

	type WidthPreset = '1/3' | '2/3' | 'full';

	type Props = {
		id: string;
		size?: BentoSize;
		span?: CellSpan;
		/** Width preset — the canonical bento widths on a 12-col board.
		 *  Overrides `span.col` when set. `1/3` = 4 cols, `2/3` = 8 cols,
		 *  `full` = 12 cols. The lg cap is `2/3` per Aaron's convention;
		 *  reach for `full` only for hero bands. */
		width?: WidthPreset;
		/** Row span shorthand. When `width` is used, this replaces
		 *  `span.row`. Defaults to 3 (matches the canonical lg height). */
		height?: number;
		/** Child snippet receives the effective size (which may differ from
		 *  the `size` prop when this cell is expanded or another is). */
		child: Snippet<[BentoSize]>;
		/** Render-only override if a cell shouldn't expand on click (e.g. a
		 *  pure decoration card). Defaults to expandable. */
		expandable?: boolean;
		/** Page-level click handler. When set, takes precedence over the
		 *  default expand/collapse behavior — the parent owns what happens
		 *  on activation (typically opening a drawer keyed by cell id). */
		onCellClick?: (id: string) => void;
	};

	let {
		id,
		size = 'md',
		span = { col: 3, row: 2 },
		width,
		height,
		child,
		expandable = true,
		onCellClick
	}: Props = $props();

	const WIDTH_MAP: Record<WidthPreset, number> = {
		'1/3': 4,
		'2/3': 8,
		'full': 12
	};
	const effectiveColSpan = $derived(width ? WIDTH_MAP[width] : span.col);
	const effectiveRowSpan = $derived(height ?? span.row);

	const ctx = getContext<BentoContext>('bento');
	const expandedId = $derived(ctx.expandedId());
	const isExpanded = $derived(expandedId === id);
	const isDimmed = $derived(expandedId !== null && expandedId !== id);
	const isStatic = $derived(ctx.staticBoard);

	const effectiveSize = $derived<BentoSize>(
		isExpanded ? ctx.expandedSize : isDimmed ? ctx.dimmedSize : size
	);

	// Grid placement. When expanded, take the full width and a moderate
	// row span. The expanded variant tops out at `lg` (Aaron's call —
	// `xl` felt overwhelming), so 5 rows comfortably fits chart + brief
	// interpretation without dominating the viewport.
	const cellStyle = $derived(
		isExpanded
			? `grid-column: 1 / -1; grid-row: span 5;`
			: `grid-column: span ${effectiveColSpan};${effectiveRowSpan ? ` grid-row: span ${effectiveRowSpan};` : ''}`
	);

	const vtName = `bento-cell-${id}`;

	function handleClick() {
		// Page-level handler wins — used by the bento-spike redesign to open a
		// drawer instead of expanding inline. Without it, fall back to the
		// classic expand/collapse behavior.
		if (onCellClick) {
			onCellClick(id);
			return;
		}
		if (!expandable) return;
		if (isExpanded) ctx.collapse();
		else ctx.expand(id);
	}
</script>

<!-- Hit target uses a div+role=button (not <button>) because some child
	 components (e.g. KeyQuoteCard via AppCard) render their own <button>
	 for participant chips; nested <button> is invalid HTML and triggers
	 the browser to repair the DOM at parse time, which breaks Svelte
	 hydration (the server-rendered tree no longer matches the client tree
	 and Svelte falls back to a full re-render alongside the SSR'd tree).
	 div+role=button + keydown handler is the idiomatic workaround. -->
<div
	class="bento-cell"
	class:is-expanded={isExpanded}
	class:is-dimmed={isDimmed}
	class:is-static={isStatic}
	style={`${cellStyle} view-transition-name: ${vtName};`}
	inert={isDimmed}
>
	{#if isStatic && !onCellClick}
		<!-- Static / archived mode: no hit target, no role=button. The
			 expand/collapse code path still exists upstream but is not
			 reachable through the UI. Flip BentoBoard.staticBoard=false,
			 or pass `onCellClick`, to restore interactivity. -->
		<div class="bento-hit bento-hit--static">
			{@render child(effectiveSize)}
		</div>
	{:else}
		<div
			class="bento-hit"
			role="button"
			tabindex={isDimmed ? -1 : 0}
			onclick={handleClick}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					handleClick();
				}
			}}
			aria-expanded={isExpanded}
			aria-label={isExpanded ? 'Collapse card' : 'Expand card'}
		>
			{@render child(effectiveSize)}
		</div>
	{/if}
</div>

<style>
	.bento-cell {
		position: relative;
		min-height: 7rem;
		transition: opacity 200ms ease, filter 200ms ease;
	}
	.bento-cell.is-expanded {
		z-index: 2;
	}
	.bento-cell.is-dimmed {
		opacity: 0.35;
		filter: saturate(0.6);
		pointer-events: none;
	}
	.bento-hit {
		display: block;
		width: 100%;
		height: 100%;
		padding: 0;
		border: none;
		background: transparent;
		text-align: left;
		cursor: pointer;
		font: inherit;
		color: inherit;
	}
	.bento-hit--static {
		cursor: default;
	}
</style>

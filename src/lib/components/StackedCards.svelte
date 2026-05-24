<!--
	StackedCards — stacked, swipable card carousel with expand-to-grid.

	Renders N items as a deck: the active card is on top; the rest peek
	behind, slightly offset and scaled. Swipe / drag the top card to advance
	or retreat, or use the prev/next buttons. Click the expand button — or
	grab and shake the front card — to fan all cards out into a grid view.
	Click any grid cell to restack with that card on top.

	The component is layout-agnostic: it positions cards absolutely inside an
	aspect-ratio'd frame in stack mode, and switches to a CSS grid in
	expanded mode. Callers provide an `item` snippet that renders one entry.
-->
<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { ChevronLeft, ChevronRight, Grid2x2, Layers } from '@lucide/svelte';

	type Props = {
		items: T[];
		/** Currently focused index (the one on top in stack mode). */
		activeIndex?: number;
		/** Stack vs. grid view. */
		expanded?: boolean;
		/** Show the expand-to-grid button + enable shake-to-expand. */
		expandable?: boolean;
		/** Aspect ratio for each slot in stack mode (e.g. '1 / 1', '16 / 10'). */
		aspect?: string;
		/** Columns when expanded into a grid. */
		gridCols?: number;
		/** Render prev/next/counter/expand controls below the stack. */
		showControls?: boolean;
		/** Optional key getter for stable identity across reorders. */
		getKey?: (item: T, index: number) => string | number;
		/** Class merged onto the outer wrapper. */
		class?: string;
		ariaLabel?: string;
		/** Snippet that renders one card. */
		item: Snippet<[T, number]>;
	};

	let {
		items,
		activeIndex = $bindable(0),
		expanded = $bindable(false),
		expandable = true,
		aspect,
		gridCols = 3,
		showControls = true,
		getKey,
		class: klass = '',
		ariaLabel,
		item
	}: Props = $props();

	// Clamp activeIndex if the items list shrinks under us.
	$effect(() => {
		if (items.length === 0) {
			if (activeIndex !== 0) activeIndex = 0;
		} else if (activeIndex >= items.length) {
			activeIndex = items.length - 1;
		}
	});

	function keyFor(it: T, i: number) {
		return getKey ? getKey(it, i) : i;
	}

	function step(delta: number) {
		if (items.length === 0) return;
		activeIndex = ((activeIndex + delta) % items.length + items.length) % items.length;
	}
	function selectAndCollapse(i: number) {
		activeIndex = i;
		expanded = false;
	}

	// ---- Drag / swipe on the top card -------------------------------------
	let dragX = $state(0);
	let dragging = $state(false);
	let dragStartX = 0;
	let dragStartY = 0;
	let pointerId: number | null = null;
	let suppressClick = false;

	// Shake detection: rapid x-velocity sign flips while dragging.
	let velocitySamples: { t: number; vx: number }[] = [];
	let lastSampleT = 0;
	let lastSampleX = 0;
	let shakeBuffer = $state(0); // visual feedback intensity

	function resetDrag() {
		dragX = 0;
		dragging = false;
		velocitySamples = [];
		shakeBuffer = 0;
		pointerId = null;
	}

	function onPointerDown(e: PointerEvent) {
		if (expanded || items.length <= 1) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		// Don't hijack drags that start on something the inner card handles
		// itself (a button, a link, an editable text node, etc).
		const t = e.target as HTMLElement;
		if (t.closest('button, a, [contenteditable=""], [contenteditable="true"], input, textarea, select')) {
			return;
		}
		pointerId = e.pointerId;
		dragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		lastSampleT = performance.now();
		lastSampleX = e.clientX;
		velocitySamples = [];
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging || e.pointerId !== pointerId) return;
		const dx = e.clientX - dragStartX;
		const dy = e.clientY - dragStartY;
		// Bail out of horizontal handling if the gesture is clearly vertical
		// (lets the page scroll instead of swiping cards).
		if (Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dy) > 18) {
			resetDrag();
			return;
		}
		dragX = dx;
		if (Math.abs(dx) > 4) suppressClick = true;

		const now = performance.now();
		const dt = now - lastSampleT;
		if (dt >= 12) {
			const vx = (e.clientX - lastSampleX) / Math.max(dt, 1);
			velocitySamples.push({ t: now, vx });
			while (velocitySamples.length && now - velocitySamples[0].t > 500) velocitySamples.shift();
			lastSampleT = now;
			lastSampleX = e.clientX;

			if (expandable && velocitySamples.length >= 4) {
				let flips = 0;
				let peak = 0;
				for (let i = 1; i < velocitySamples.length; i++) {
					const a = velocitySamples[i - 1].vx;
					const b = velocitySamples[i].vx;
					if (Math.abs(a) > 0.6 && Math.abs(b) > 0.6 && Math.sign(a) !== Math.sign(b)) flips++;
					peak = Math.max(peak, Math.abs(b));
				}
				shakeBuffer = Math.min(1, flips / 3);
				if (flips >= 3 && peak > 0.8) {
					expanded = true;
					resetDrag();
				}
			}
		}
	}

	function onPointerUp(e: PointerEvent) {
		if (!dragging) return;
		const THRESHOLD = 70;
		const finalX = dragX;
		try { (e.currentTarget as HTMLElement).releasePointerCapture?.(pointerId!); } catch {}
		resetDrag();
		if (finalX > THRESHOLD) step(-1);
		else if (finalX < -THRESHOLD) step(1);
		// Click should be suppressed only when we actually moved; clear next frame.
		queueMicrotask(() => (suppressClick = false));
	}

	function onTopClick(e: MouseEvent) {
		if (suppressClick) {
			e.preventDefault();
			e.stopPropagation();
		}
	}

	// ---- Per-card transform in stack mode ---------------------------------
	const VISIBLE_BEHIND = 3;
	// Rotation and horizontal nudge for layers 0 (top) → 3 (deepest visible).
	// Alternating direction gives a natural fanned-deck look.
	const BEHIND_ROT = [0, -6, 9, -11] as const;
	const BEHIND_TX  = [0, -12, 16, -10] as const;

	function layerFor(idx: number) {
		if (items.length === 0) return 0;
		return (idx - activeIndex + items.length) % items.length;
	}
	function slotStyle(idx: number) {
		const l = layerFor(idx);
		const isTop = l === 0;
		const clamped = Math.min(l, VISIBLE_BEHIND);
		const ty = clamped * 26;
		const sc = 1 - clamped * 0.06;
		const op = l > VISIBLE_BEHIND ? 0 : Math.max(0, 1 - clamped * 0.15);
		const z = items.length - l;
		const wiggle = shakeBuffer * (Math.sin(performance.now() / 24) * 4);
		const tx = isTop ? dragX + (shakeBuffer ? wiggle : 0) : BEHIND_TX[clamped] ?? 0;
		const rot = isTop
			? dragX * 0.025 + (shakeBuffer ? wiggle * 0.4 : 0)
			: BEHIND_ROT[clamped] ?? 0;
		const transition = (isTop && dragging) || shakeBuffer
			? 'opacity 300ms ease'
			: 'transform 350ms cubic-bezier(.2,.7,.2,1), opacity 300ms ease';
		return `transform: translate3d(${tx}px, ${ty}px, 0) scale(${sc}) rotate(${rot}deg); opacity: ${op}; z-index: ${z}; transition: ${transition}; pointer-events: ${isTop && l === 0 ? 'auto' : 'none'};`;
	}

	function onKeydown(e: KeyboardEvent) {
		if (expanded) {
			if (e.key === 'Escape') { expanded = false; e.preventDefault(); }
			return;
		}
		if (items.length <= 1) return;
		if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
		else if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
		else if (expandable && (e.key === 'g' || e.key === 'G')) { expanded = true; e.preventDefault(); }
	}
</script>

{#if items.length > 0}
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		class="sc-root {klass}"
		aria-label={ariaLabel}
		tabindex="0"
		role="group"
		onkeydown={onKeydown}
	>
		{#if !expanded}
			<div
				class="sc-stack"
				data-aspect={aspect ? '' : undefined}
				style={aspect ? `aspect-ratio: ${aspect};` : ''}
				data-shaking={shakeBuffer > 0 ? '' : undefined}
			>
				{#each items as it, i (keyFor(it, i))}
					{@const top = layerFor(i) === 0}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						class="sc-slot"
						class:sc-top={top}
						style={slotStyle(i)}
						onpointerdown={top ? onPointerDown : null}
						onpointermove={top ? onPointerMove : null}
						onpointerup={top ? onPointerUp : null}
						onpointercancel={top ? onPointerUp : null}
						onclickcapture={top ? onTopClick : null}
					>
						{@render item(it, i)}
					</div>
				{/each}
			</div>
		{:else}
			<div
				class="sc-grid"
				style="grid-template-columns: repeat({gridCols}, minmax(0, 1fr));"
				in:fade={{ duration: 160 }}
			>
				{#each items as it, i (keyFor(it, i))}
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
					<div
						class="sc-grid-cell"
						class:sc-current={i === activeIndex}
						style={aspect ? `aspect-ratio: ${aspect};` : ''}
						in:scale={{ duration: 240, start: 0.6, opacity: 0, delay: i * 28, easing: cubicOut }}
						onclick={() => selectAndCollapse(i)}
						role="button"
						tabindex="0"
						aria-label="Show card {i + 1}"
						aria-current={i === activeIndex ? 'true' : undefined}
					>
						{@render item(it, i)}
					</div>
				{/each}
			</div>
		{/if}

		{#if showControls && items.length > 1}
			<div class="sc-controls" data-kf-no-deselect>
				{#if !expanded}
					<button type="button" class="sc-btn" onclick={() => step(-1)} aria-label="Previous card"><ChevronLeft class="size-4" /></button>
					<span class="sc-counter">{activeIndex + 1} / {items.length}</span>
					<button type="button" class="sc-btn" onclick={() => step(1)} aria-label="Next card"><ChevronRight class="size-4" /></button>
					{#if expandable}
						<button
							type="button"
							class="sc-btn sc-btn-grid"
							onclick={() => (expanded = true)}
							title="Expand to grid — or grab the card and shake"
							aria-label="Expand to grid"
						>
							<Grid2x2 class="size-4" />
						</button>
					{/if}
				{:else}
					<button type="button" class="sc-btn" onclick={() => (expanded = false)} aria-label="Back to stack">
						<Layers class="size-4" /> Restack
					</button>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.sc-root {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		min-height: 0;
		outline: none;
	}
	.sc-stack {
		position: relative;
		width: 100%;
	}
	/* When no aspect is provided, fill the parent's remaining vertical space. */
	.sc-stack:not([data-aspect]) {
		flex: 1 1 auto;
		min-height: 0;
	}
	.sc-slot {
		position: absolute;
		inset: 0;
		will-change: transform, opacity;
	}
	.sc-slot.sc-top {
		cursor: grab;
	}
	.sc-slot.sc-top:active {
		cursor: grabbing;
	}
	.sc-grid {
		display: grid;
		gap: 1rem;
		width: 100%;
	}
	.sc-grid-cell {
		position: relative;
		cursor: pointer;
		border-radius: 1rem;
		transition: transform 0.15s ease;
	}
	.sc-grid-cell:hover {
		transform: translateY(-3px);
	}
	.sc-grid-cell.sc-current {
		outline: 2px solid var(--accent-mint, #6ec6a1);
		outline-offset: 4px;
		border-radius: 1rem;
	}
	.sc-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.sc-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.55rem;
		border-radius: 0.5rem;
		border: 1px solid rgb(226 232 240);
		background: white;
		color: rgb(71 85 105);
		font-size: 0.75rem;
		transition: background 0.12s ease, color 0.12s ease;
	}
	.sc-btn:hover {
		background: rgb(241 245 249);
		color: rgb(15 23 42);
	}
	.sc-btn-grid {
		margin-left: 0.4rem;
	}
	.sc-counter {
		font-variant-numeric: tabular-nums;
		font-size: 0.75rem;
		color: rgb(100 116 139);
		min-width: 3.5em;
		text-align: center;
	}
	@media (prefers-reduced-motion: reduce) {
		.sc-slot {
			transition: none !important;
		}
		.sc-grid-cell {
			transition: none !important;
		}
	}
</style>

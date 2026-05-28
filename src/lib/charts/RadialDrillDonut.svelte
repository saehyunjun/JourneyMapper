<!--
	RadialDrillDonut — concentric two-level donut for drill-down hierarchies.

	Outer ring shows the top-level slices (parents); the inner ring fills with
	the children of whichever parent is focused. Clicking a parent swaps the
	inner ring. Clicking a child fires `onselect(childId, parentId)` for the
	consumer to act on (filter a fragment list, open a drawer, etc.).

	The chart is intentionally generic — it does not know about sentiment or
	emotions. Feed it any 2-level hierarchy of {id, label, value, color,
	children} nodes and it draws the same picture. The first concrete use is
	sentiment → emotion in the AskPatientlyAI viz panel, but theme → subtheme
	or stage → step would work the same way.

	Sizing: the SVG is square and uses `size` as both width and height. The
	outer ring's outer radius is size/2; the inner ring sits `gap` pixels
	inside the outer ring with the same thickness by default.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { pie, arc, type PieArcDatum } from 'd3-shape';
	import { reveal, animateProgress } from '$lib/charts/reveal';
	import type { DrillNode } from './RadialDrillDonut.types';

	export type { DrillNode };

	let {
		data,
		size = 220,
		outerThickness = 22,
		innerThickness = 18,
		gap = 6,
		animate = false,
		selectedId = $bindable<string | null>(null),
		emptyLabel = 'No detail to drill into',
		showLegend = true,
		formatValue = (v: number) => String(v),
		onselect
	}: {
		data: DrillNode[];
		size?: number;
		outerThickness?: number;
		innerThickness?: number;
		/** Pixels between the outer and inner rings. */
		gap?: number;
		animate?: boolean;
		/** Controlled focused-parent id. Bindable so consumers can react. */
		selectedId?: string | null;
		/** Center copy shown when the focused parent has no children. */
		emptyLabel?: string;
		/** Hide the chip legend under the chart. The arcs still carry hover
		 *  tooltips and aria-labels so it remains accessible without it. */
		showLegend?: boolean;
		/** Format a numeric value for the legend / center / tooltip. */
		formatValue?: (v: number) => string;
		/** Fires when a child slice in the inner ring is clicked. Inner arcs
		 *  fall back to a default cursor when this is omitted so the chart
		 *  reads as informational rather than navigational. */
		onselect?: (childId: string, parentId: string) => void;
	} = $props();

	const innerInteractive = $derived(typeof onselect === 'function');

	const total = $derived(data.reduce((s, d) => s + Math.max(0, d.value), 0));
	const radius = $derived(size / 2);

	// Default the focus to the first parent that actually has children — saves
	// the user a click on first reveal. Updates if data changes and the prior
	// selection no longer exists in the dataset.
	$effect(() => {
		if (selectedId && data.some((d) => d.id === selectedId)) return;
		const firstWithChildren = data.find((d) => (d.children?.length ?? 0) > 0);
		selectedId = firstWithChildren?.id ?? data[0]?.id ?? null;
	});

	const focused = $derived(data.find((d) => d.id === selectedId) ?? null);
	const focusedChildren = $derived(focused?.children ?? []);
	const focusedChildTotal = $derived(focusedChildren.reduce((s, c) => s + Math.max(0, c.value), 0));

	const outerSlices = $derived(
		pie<DrillNode>()
			.sort(null)
			.value((d) => Math.max(0, d.value))(data)
	);
	const innerSlices = $derived(
		pie<DrillNode>()
			.sort(null)
			.value((d) => Math.max(0, d.value))(focusedChildren)
	);

	// Single intro-progress value drives a clockwise sweep across both rings.
	// `replayKey` isn't exposed yet because the chart is short-lived (in the
	// answer pane); easy to add later by mirroring MiniDonut.
	let progress = $state(untrack(() => (animate ? 0 : 1)));
	function play() {
		if (animate) animateProgress(900, (t) => (progress = t));
		else progress = 1;
	}
	$effect(() => {
		// Restart the sweep when the focused parent changes so the inner-ring
		// arcs sweep in too, even after the intro has finished.
		void selectedId;
		if (!animate) return;
		progress = 0;
		animateProgress(700, (t) => (progress = t));
	});

	function arcPath(
		slice: PieArcDatum<DrillNode>,
		innerR: number,
		outerR: number
	): string {
		const sweep = 2 * Math.PI * progress;
		const end = Math.min(slice.endAngle, sweep);
		if (end <= slice.startAngle) return '';
		const g = arc()
			.innerRadius(innerR)
			.outerRadius(outerR)
			.startAngle(slice.startAngle)
			.endAngle(end);
		return g(null as never) ?? '';
	}

	// Radii: outer ring sits flush with size/2, inner ring is inset by the
	// outer thickness + gap. Clamping keeps a sensible donut even at small
	// sizes where the user-requested thicknesses would collapse the hole.
	const outerR = $derived(radius);
	const outerInnerR = $derived(Math.max(0, outerR - outerThickness));
	const innerR = $derived(Math.max(0, outerInnerR - gap));
	const innerInnerR = $derived(Math.max(0, innerR - innerThickness));

	let hoveredOuter = $state<string | null>(null);
	let hoveredInner = $state<string | null>(null);

	function arcOpacity(id: string, kind: 'outer' | 'inner'): number {
		const focus = focused?.id ?? null;
		if (kind === 'outer') {
			if (hoveredOuter && hoveredOuter !== id) return 0.45;
			if (focus && focus !== id) return 0.55;
			return 1;
		}
		if (hoveredInner && hoveredInner !== id) return 0.45;
		return 1;
	}

	function selectParent(id: string) {
		selectedId = id;
	}
	function clickChild(childId: string) {
		if (focused) onselect?.(childId, focused.id);
	}
	function onArcKeydown(e: KeyboardEvent, fn: () => void) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			fn();
		}
	}
</script>

<div
	class="radial-drill-donut flex flex-col items-center gap-3"
	use:reveal={{ onReveal: play, once: true }}
>
	<svg
		width={size}
		height={size}
		viewBox="0 0 {size} {size}"
		role="img"
		aria-label="Drill-down donut chart"
	>
		<g transform="translate({radius},{radius})">
			<!-- Outer ring: parent slices. Clicking one focuses the inner ring. -->
			{#each outerSlices as s (s.data.id)}
				{@const isFocus = focused?.id === s.data.id}
				<path
					d={arcPath(s, outerInnerR, outerR)}
					fill={s.data.color ?? '#cbd5e1'}
					opacity={arcOpacity(s.data.id, 'outer')}
					stroke={isFocus ? 'rgba(15,23,42,0.6)' : 'transparent'}
					stroke-width={isFocus ? 1.5 : 0}
					class="cursor-pointer transition-opacity duration-150"
					onclick={() => selectParent(s.data.id)}
					onkeydown={(e) => onArcKeydown(e, () => selectParent(s.data.id))}
					onpointerenter={() => (hoveredOuter = s.data.id)}
					onpointerleave={() => (hoveredOuter = null)}
					role="button"
					tabindex="0"
					aria-label="{s.data.label}: {formatValue(s.data.value)}"
				>
					<title>{s.data.label} · {formatValue(s.data.value)}</title>
				</path>
			{/each}

			<!-- Inner ring: children of the focused parent. Empty if none.
			     Arcs are only "clickable" (cursor + role=button) when the
			     consumer supplied an onselect — otherwise the ring is purely
			     informational, which is the typical case for drill-to-detail
			     readers (e.g. "what emotions sit inside this sentiment?"). -->
			{#each innerSlices as s (s.data.id)}
				<path
					d={arcPath(s, innerInnerR, innerR)}
					fill={s.data.color ?? '#94a3b8'}
					opacity={arcOpacity(s.data.id, 'inner')}
					class="transition-opacity duration-150 {innerInteractive
						? 'cursor-pointer'
						: 'cursor-default'}"
					onclick={() => clickChild(s.data.id)}
					onkeydown={(e) => onArcKeydown(e, () => clickChild(s.data.id))}
					onpointerenter={() => (hoveredInner = s.data.id)}
					onpointerleave={() => (hoveredInner = null)}
					role={innerInteractive ? 'button' : 'img'}
					tabindex={innerInteractive ? 0 : -1}
					aria-label="{s.data.label}: {formatValue(s.data.value)}"
				>
					<title>{s.data.label} · {formatValue(s.data.value)}</title>
				</path>
			{/each}

			<!-- Center label: focused parent label + value, or instructional copy
			     when the focused parent has no children. Click to clear focus. -->
			{#if focused}
				<text
					text-anchor="middle"
					dominant-baseline="middle"
					dy="-6"
					class="fill-slate-800"
					style="font-size: 0.75rem; font-weight: 600; font-family: var(--font-body);"
				>
					{focused.label}
				</text>
				<text
					text-anchor="middle"
					dominant-baseline="middle"
					dy="10"
					class="fill-slate-400"
					style="font-size: 0.65rem;"
				>
					{focusedChildren.length > 0
						? formatValue(focusedChildTotal) + ' tagged'
						: emptyLabel}
				</text>
			{:else if total > 0}
				<text
					text-anchor="middle"
					dominant-baseline="middle"
					class="fill-slate-400"
					style="font-size: 0.7rem;"
				>
					Click a slice
				</text>
			{/if}
		</g>
	</svg>

	{#if showLegend}
		<!-- Legend: outer-ring parents on top, focused parent's children below.
		     Clicking a parent chip is the same affordance as clicking its arc. -->
		<div class="flex w-full flex-col gap-2 text-xs">
			<ul class="flex flex-wrap justify-center gap-x-3 gap-y-1 text-slate-600">
				{#each data as d (d.id)}
					{@const isFocus = focused?.id === d.id}
					<li>
						<button
							type="button"
							onclick={() => selectParent(d.id)}
							class="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 transition-colors hover:bg-slate-100 {isFocus
								? 'font-semibold text-slate-900'
								: ''}"
							aria-pressed={isFocus}
						>
							<span
								class="inline-block size-2.5 rounded-full"
								style="background: {d.color ?? '#cbd5e1'};"
							></span>
							{d.label}
							<span class="text-slate-400">({formatValue(d.value)})</span>
						</button>
					</li>
				{/each}
			</ul>
			{#if focusedChildren.length > 0}
				<ul class="flex flex-wrap justify-center gap-x-3 gap-y-1 text-slate-500">
					{#each focusedChildren as c (c.id)}
						<li>
							{#if innerInteractive}
								<button
									type="button"
									onclick={() => clickChild(c.id)}
									class="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 transition-colors hover:bg-slate-100 hover:text-slate-800"
								>
									<span
										class="inline-block size-2 rounded-full"
										style="background: {c.color ?? '#94a3b8'};"
									></span>
									{c.label}
									<span class="text-slate-400">({formatValue(c.value)})</span>
								</button>
							{:else}
								<span class="inline-flex items-center gap-1.5 px-1.5 py-0.5">
									<span
										class="inline-block size-2 rounded-full"
										style="background: {c.color ?? '#94a3b8'};"
									></span>
									{c.label}
									<span class="text-slate-400">({formatValue(c.value)})</span>
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* The path role=button focus ring isn't visible by default on an SVG path —
	   draw an explicit ring so keyboard users still get a focus affordance
	   when tabbing through arcs. */
	.radial-drill-donut :global(path[role='button']:focus-visible) {
		outline: 2px solid rgb(99 102 241 / 0.7);
		outline-offset: 2px;
	}
</style>

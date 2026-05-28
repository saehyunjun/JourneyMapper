
<!--
	SearchInterviewAlignment — two-column ranked alignment of what people SEARCH
	for vs. what they TALK ABOUT in interviews, for a single indication.

	Layout: left column ranks search queries by monthly volume; right column
	ranks interview clusters by mention count. A SVG overlay between the
	columns draws curved connectors linking matched pairs (same treatment on
	both sides). Unmatched rows stay in their column and read as gaps —
	search queries with no interview echo on the left, interview clusters
	with no search demand on the right.

	The matched palette is the corpus orange (#CC6324) so the viz reads as a
	continuation of the existing chart vocabulary; gap rows fade back.
	Hovering any row scales it up (taller, bolder) and emits `onActiveChange`
	with a synthetic `RowFocus` describing what was hit — the slide wrapper
	uses this to swap its right-hand narrative pane in sync with the focus.

	Row ids are namespaced to disambiguate the three populations:
	  - match:<matchKey>       → matched pair (both columns)
	  - search:<query>         → search-only gap (left column)
	  - interview:<clusterId>  → interview-only gap (right column)
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type {
		SearchInterviewAlignment,
		MatchedPair,
		SearchItem,
		InterviewItem
	} from '$lib/content/wctglpdemo-data/search-interview-alignment';

	export type RowFocus =
		| { kind: 'matched'; pair: MatchedPair }
		| { kind: 'search'; item: SearchItem }
		| { kind: 'interview'; item: InterviewItem };

	let {
		data,
		activeId = null,
		onActiveChange = () => {},
		barWidthBase = 96,
		barHeightBase = 8,
		barHeightActive = 12,
		rowHeightBase = 32,
		rowHeightActive = 46,
		rowGap = 6,
		gutterWidth = 140,
		matchedColor = '#CC6324',
		gapColor = '#94a3b8'
	}: {
		data: SearchInterviewAlignment;
		/** Externally-controlled active row id (e.g. driven by the slide). */
		activeId?: string | null;
		/** Fires when local hover changes — slide observes for narrative sync. */
		onActiveChange?: (focus: RowFocus | null) => void;
		barWidthBase?: number;
		barHeightBase?: number;
		barHeightActive?: number;
		rowHeightBase?: number;
		rowHeightActive?: number;
		rowGap?: number;
		gutterWidth?: number;
		matchedColor?: string;
		gapColor?: string;
	} = $props();

	let containerEl: HTMLDivElement | null = $state(null);
	let gutterEl: HTMLDivElement | null = $state(null);
	const leftRowEls = new Map<string, HTMLDivElement>();
	const rightRowEls = new Map<string, HTMLDivElement>();
	let hoveredId = $state<string | null>(null);
	let measureToken = $state(0);

	const focusedId = $derived(activeId ?? hoveredId);
	const anyFocused = $derived(focusedId !== null);

	/** Action that keys a row's DOM node into a map by matchKey. Only matched
	 *  rows opt in — gap rows have no partner, so they don't need to be
	 *  measured for connector drawing. */
	function rowRef(map: Map<string, HTMLDivElement>) {
		return (node: HTMLDivElement, key: string | undefined) => {
			let current = key;
			if (current) map.set(current, node);
			return {
				update(next: string | undefined) {
					if (current && current !== next) map.delete(current);
					current = next;
					if (current) map.set(current, node);
					measureToken++;
				},
				destroy() {
					if (current) map.delete(current);
					measureToken++;
				}
			};
		};
	}
	const leftRow = rowRef(leftRowEls);
	const rightRow = rowRef(rightRowEls);

	// Max values for proportional bar sizing within each column.
	const maxSearchVolume = $derived(
		Math.max(1, ...data.leftColumn.map((r) => r.item.volume))
	);
	const maxInterviewCount = $derived(
		Math.max(1, ...data.rightColumn.map((r) => r.item.count))
	);

	type Connector = {
		matchKey: string;
		path: string;
	};
	let connectors = $state<Connector[]>([]);
	let gutterHeight = $state(0);

	function measure() {
		if (!gutterEl) return;
		const gRect = gutterEl.getBoundingClientRect();
		gutterHeight = gRect.height;
		const cs: Connector[] = [];
		for (const m of data.matched) {
			const leftEl = leftRowEls.get(m.matchKey);
			const rightEl = rightRowEls.get(m.matchKey);
			if (!leftEl || !rightEl) continue;
			const l = leftEl.getBoundingClientRect();
			const r = rightEl.getBoundingClientRect();
			const y1 = l.top - gRect.top + l.height / 2;
			const y2 = r.top - gRect.top + r.height / 2;
			const x1 = 0;
			const x2 = gRect.width;
			const cx1 = gRect.width * 0.5;
			const cx2 = gRect.width * 0.5;
			cs.push({
				matchKey: m.matchKey,
				path: `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`
			});
		}
		connectors = cs;
	}

	onMount(() => {
		measure();
		const ro = new ResizeObserver(() => measure());
		if (containerEl) ro.observe(containerEl);
		return () => ro.disconnect();
	});

	// Re-measure when data changes or token bumps. Defer one tick for reflow.
	$effect(() => {
		void data;
		void measureToken;
		untrack(() => requestAnimationFrame(measure));
	});

	// Active-row hover height changes — re-measure connectors so curves track
	// the row's actual y-center after the grow animation settles.
	$effect(() => {
		void focusedId;
		untrack(() => {
			// Two frames: one for the height transition to begin, one to settle.
			requestAnimationFrame(() => requestAnimationFrame(measure));
		});
	});

	function fmtVolume(v: number): string {
		if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
		return String(v);
	}

	function focusForId(id: string | null): RowFocus | null {
		if (!id) return null;
		if (id.startsWith('match:')) {
			const k = id.slice('match:'.length);
			const pair = data.matched.find((m) => m.matchKey === k);
			return pair ? { kind: 'matched', pair } : null;
		}
		if (id.startsWith('search:')) {
			const q = id.slice('search:'.length);
			const item = data.searchOnly.find((s) => s.query === q);
			return item ? { kind: 'search', item } : null;
		}
		if (id.startsWith('interview:')) {
			const c = id.slice('interview:'.length);
			const item = data.interviewOnly.find((iv) => iv.clusterId === c);
			return item ? { kind: 'interview', item } : null;
		}
		return null;
	}

	// Surface local hover changes upward as resolved RowFocus payloads.
	$effect(() => {
		const id = hoveredId;
		untrack(() => onActiveChange(focusForId(id)));
	});

	function leftRowId(row: { matchKey?: string; item: { query: string } }): string {
		return row.matchKey ? `match:${row.matchKey}` : `search:${row.item.query}`;
	}
	function rightRowId(row: { matchKey?: string; item: { clusterId: string } }): string {
		return row.matchKey ? `match:${row.matchKey}` : `interview:${row.item.clusterId}`;
	}
</script>

<div class="alignment" bind:this={containerEl}>
	<div class="cols">
		<!-- LEFT: search queries ranked by volume -->
		<div class="col left">
			<div class="col-head">
				<span class="col-eyebrow font-mono">Search</span>
				<span class="col-sub font-mono">monthly volume · US</span>
			</div>
			{#each data.leftColumn as row, i (row.item.query + i)}
				{@const id = leftRowId(row)}
				{@const isMatched = Boolean(row.matchKey)}
				{@const isActive = focusedId === id}
				{@const isDim = anyFocused && !isActive}
				{@const widthPct = (row.item.volume / maxSearchVolume) * 100}
				{@const barH = isActive ? barHeightActive : barHeightBase}
				{@const rowH = isActive ? rowHeightActive : rowHeightBase}
				<div
					class="row left-row"
					class:matched={isMatched}
					class:active={isActive}
					class:dim={isDim}
					style="min-height: {rowH}px; margin-bottom: {rowGap}px;"
					use:leftRow={row.matchKey}
					onmouseenter={() => (hoveredId = id)}
					onmouseleave={() => (hoveredId = null)}
					role="listitem"
				>
					<div class="row-inner">
						<div class="bar-wrap" style="width: {barWidthBase}px;">
							<div
								class="bar bar-right"
								style="
									width: {widthPct}%;
									height: {barH}px;
									background: {isMatched ? matchedColor : gapColor};
								"
							></div>
						</div>
						<div class="count font-mono">{fmtVolume(row.item.volume)}</div>
						<div class="label">{row.item.query}</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- GUTTER: connector SVG -->
		<div class="gutter" style="width: {gutterWidth}px;" bind:this={gutterEl}>
			<svg
				class="connectors"
				width="100%"
				height={gutterHeight || 0}
				viewBox="0 0 {gutterWidth} {gutterHeight || 0}"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				{#each connectors as c (c.matchKey)}
					{@const id = `match:${c.matchKey}`}
					{@const isActive = focusedId === id}
					{@const isDim = anyFocused && !isActive}
					<path
						d={c.path}
						fill="none"
						stroke={matchedColor}
						stroke-width={isActive ? 2.6 : 1.4}
						stroke-opacity={isDim ? 0.15 : isActive ? 1 : 0.55}
						class="connector-path"
					/>
				{/each}
			</svg>
		</div>

		<!-- RIGHT: interview clusters ranked by mention count -->
		<div class="col right">
			<div class="col-head">
				<span class="col-eyebrow font-mono">Interviews</span>
				<span class="col-sub font-mono">cluster mentions</span>
			</div>
			{#each data.rightColumn as row, i (row.item.clusterId + i)}
				{@const id = rightRowId(row)}
				{@const isMatched = Boolean(row.matchKey)}
				{@const isActive = focusedId === id}
				{@const isDim = anyFocused && !isActive}
				{@const widthPct = (row.item.count / maxInterviewCount) * 100}
				{@const barH = isActive ? barHeightActive : barHeightBase}
				{@const rowH = isActive ? rowHeightActive : rowHeightBase}
				<div
					class="row right-row"
					class:matched={isMatched}
					class:active={isActive}
					class:dim={isDim}
					style="min-height: {rowH}px; margin-bottom: {rowGap}px;"
					use:rightRow={row.matchKey}
					onmouseenter={() => (hoveredId = id)}
					onmouseleave={() => (hoveredId = null)}
					role="listitem"
				>
					<div class="row-inner">
						<div class="label label-right">{row.item.label}</div>
						<div class="count count-right font-mono">{row.item.count}</div>
						<div class="bar-wrap bar-wrap-right" style="width: {barWidthBase}px;">
							<div
								class="bar bar-left"
								style="
									width: {widthPct}%;
									height: {barH}px;
									background: {isMatched ? matchedColor : gapColor};
								"
							></div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Caption / legend -->
	<div class="legend font-mono">
		<span class="legend-item">
			<span class="legend-swatch" style="background: {matchedColor};"></span>
			Matched ({data.totals.matchedCount} of {data.totals.searchItems})
		</span>
		<span class="legend-item">
			<span class="legend-swatch" style="background: {gapColor};"></span>
			Gap (no counterpart)
		</span>
		<span class="legend-hint">Hover any row.</span>
	</div>
</div>

<style>
	.alignment {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		width: 100%;
	}
	.cols {
		display: grid;
		grid-template-columns: minmax(240px, 1fr) auto minmax(240px, 1fr);
		align-items: start;
		gap: 0;
		width: 100%;
	}
	.col {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.col-head {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding-bottom: 0.625rem;
		margin-bottom: 0.5rem;
		border-bottom: 1px solid rgba(48, 47, 40, 0.1);
	}
	.left .col-head { align-items: flex-end; text-align: right; }
	.right .col-head { align-items: flex-start; text-align: left; }
	.col-eyebrow {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--ink, #312f28);
		font-weight: 600;
	}
	.col-sub {
		font-size: 0.68rem;
		color: var(--muted-foreground, #64748b);
		letter-spacing: 0.08em;
	}

	.gutter {
		position: relative;
		display: flex;
		justify-content: center;
		align-items: stretch;
		margin-top: calc(0.625rem + 0.5rem + 1px + 1.5rem);
	}
	.connectors {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
	.connector-path {
		transition: stroke-opacity 220ms ease, stroke-width 220ms ease;
	}

	.row {
		display: flex;
		align-items: center;
		cursor: default;
		padding: 0 0.5rem;
		border-radius: 6px;
		transition:
			opacity 220ms ease,
			min-height 280ms cubic-bezier(0.19, 1, 0.22, 1),
			background 220ms ease;
	}
	.row.dim { opacity: 0.35; }
	.row.active {
		background: rgba(48, 47, 40, 0.04);
	}

	.row-inner {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		min-width: 0;
	}
	.left-row .row-inner { justify-content: flex-end; text-align: right; }
	.right-row .row-inner { justify-content: flex-start; text-align: left; }

	.bar-wrap {
		flex-shrink: 0;
		display: flex;
		align-items: center;
	}
	.bar-wrap-right { justify-content: flex-start; }
	.left-row .bar-wrap { justify-content: flex-end; }
	.bar {
		border-radius: 999px;
		background: rgba(48, 47, 40, 0.06);
		transition:
			background 220ms ease,
			height 280ms cubic-bezier(0.19, 1, 0.22, 1),
			width 220ms ease;
	}

	.count {
		font-size: 0.95rem;
		color: var(--ink, #312f28);
		font-variant-numeric: tabular-nums;
		min-width: 3rem;
		transition: font-size 220ms ease;
	}
	.row.active .count {
		font-size: 1.15rem;
	}
	.left-row .count { text-align: right; }
	.count-right { text-align: left; }

	.label {
		font-size: 0.92rem;
		color: var(--muted-foreground, #64748b);
		line-height: 1.25;
		flex: 1 1 auto;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: color 220ms ease, font-size 220ms ease, font-weight 220ms ease;
	}
	.row.matched .label { color: var(--ink, #312f28); }
	.row.active .label {
		color: var(--ink, #312f28);
		font-size: 1.05rem;
		font-weight: 500;
	}

	.legend {
		display: flex;
		gap: 1.5rem;
		font-size: 0.72rem;
		color: var(--muted-foreground, #64748b);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(48, 47, 40, 0.08);
		flex-wrap: wrap;
		align-items: center;
	}
	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}
	.legend-swatch {
		width: 10px;
		height: 10px;
		border-radius: 999px;
	}
	.legend-hint {
		margin-left: auto;
		text-transform: none;
		letter-spacing: 0.04em;
		font-size: 0.7rem;
		color: var(--muted-foreground, #94a3b8);
	}

	@media (max-width: 720px) {
		.cols {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}
		.gutter { display: none; }
		.left .col-head { align-items: flex-start; text-align: left; }
		.left-row .row-inner { justify-content: flex-start; text-align: left; flex-direction: row-reverse; }
	}
</style>

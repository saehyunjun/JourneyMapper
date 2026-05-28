
<!--
	TopicAlignment — categorical mirror chart aligning search demand with
	interview mention volume, one row per canonical topic category.

	Layout: each row is a horizontal mirror — the search bar grows from a
	center axis leftward, the interview bar grows rightward. Both sides are
	normalized to their side-specific max so the visual reads as "which
	categories dominate this signal" within each side. Absolute totals sit
	on the inner edge of each bar so the magnitude difference between sides
	(search in thousands, interview in tens) is still legible.

	Each row carries a status chip — Both sides / Search only / Interview
	only / Low signal — so the gap pattern is scannable without reading the
	bars. The chip is the "category gap" insight the categorical view
	exists for.

	The active row (driven by `activeId` prop or local hover) scales up to
	emphasize the focus — larger bars, larger label, additional detail
	(top-contributing search query and interview cluster) underneath.
	Inactive rows shrink and dim so the focus is unambiguous. When no row
	is active the chart renders in baseline scale across all rows.

	The slide wrapper drives `activeId` so the right-hand pane can swap its
	narrative to match the focused row. `onActiveChange` fires when local
	hover changes, letting the slide observe focus even when it's not
	driving it externally.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { animateProgress } from '$lib/charts/reveal';
	import type { TopicAlignment, TopicRow } from '$lib/content/wctglpdemo-data/topic-alignment';

	let {
		data,
		activeId = null,
		onActiveChange = () => {},
		searchColor = '#CC6324',
		interviewColor = '#599077',
		gapBadgeColor = '#94a3b8',
		barHeightBase = 22,
		barHeightActive = 34,
		rowGap = 14,
		duration = 1000,
		stagger = 90,
		replayKey = 0
	}: {
		data: TopicAlignment;
		/** Externally-controlled active row id. When non-null, overrides local hover. */
		activeId?: string | null;
		/** Fires when local hover changes — the slide observes to keep its right
		 *  pane in sync even when it isn't driving the focus externally. */
		onActiveChange?: (row: TopicRow | null) => void;
		searchColor?: string;
		interviewColor?: string;
		gapBadgeColor?: string;
		barHeightBase?: number;
		barHeightActive?: number;
		rowGap?: number;
		duration?: number;
		stagger?: number;
		replayKey?: number;
	} = $props();

	const maxSearch = $derived(
		Math.max(1, ...data.rows.map((r) => r.searchVolume))
	);
	const maxInterview = $derived(
		Math.max(1, ...data.rows.map((r) => r.interviewMentions))
	);

	let progress = $state(0);
	let hoveredId = $state<string | null>(null);

	// Effective focus: external activeId wins; otherwise local hover.
	const focusedId = $derived(activeId ?? hoveredId);
	const anyFocused = $derived(focusedId !== null);

	function play() {
		progress = 0;
		animateProgress(duration, (t) => {
			progress = t;
		});
	}

	onMount(play);

	$effect(() => {
		void replayKey;
		untrack(play);
	});

	// Surface local hover changes upward so the slide narrative can react
	// even without driving activeId externally.
	$effect(() => {
		const id = hoveredId;
		untrack(() => {
			if (!id) {
				onActiveChange(null);
				return;
			}
			const row = data.rows.find((r) => r.category.id === id) ?? null;
			onActiveChange(row);
		});
	});

	function fmtVol(v: number): string {
		if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
		return String(v);
	}

	type Status = 'aligned' | 'search-only' | 'interview-only' | 'low-signal';

	function statusOf(r: TopicRow): Status {
		if (r.searchVolume > 0 && r.interviewMentions > 0) return 'aligned';
		if (r.searchVolume > 0) return 'search-only';
		if (r.interviewMentions > 0) return 'interview-only';
		return 'low-signal';
	}

	function statusLabel(s: Status): string {
		switch (s) {
			case 'aligned':
				return 'Both sides';
			case 'search-only':
				return 'Search only';
			case 'interview-only':
				return 'Interview only';
			case 'low-signal':
				return 'Low signal';
		}
	}

	function statusColor(s: Status): string {
		switch (s) {
			case 'aligned':
				return '#1f2937';
			case 'search-only':
				return searchColor;
			case 'interview-only':
				return interviewColor;
			case 'low-signal':
				return gapBadgeColor;
		}
	}
</script>

<div class="topic-alignment" style="--gap: {rowGap}px;">
	<div class="col-head">
		<div class="head-cell head-left font-mono">
			<span class="head-eyebrow">Search</span>
			<span class="head-sub">monthly volume · US</span>
		</div>
		<div class="head-cell head-center"></div>
		<div class="head-cell head-right font-mono">
			<span class="head-eyebrow">Interviews</span>
			<span class="head-sub">cluster mentions</span>
		</div>
	</div>

	{#each data.rows as row, i (row.category.id)}
		{@const status = statusOf(row)}
		{@const isActive = focusedId === row.category.id}
		{@const isDim = anyFocused && !isActive}
		{@const delay = i * stagger}
		{@const phase = Math.max(0, Math.min(1, (progress * duration - delay) / duration))}
		{@const searchPct = (row.searchVolume / maxSearch) * 100 * phase}
		{@const interviewPct = (row.interviewMentions / maxInterview) * 100 * phase}
		{@const barH = isActive ? barHeightActive : barHeightBase}
		<div
			class="row"
			class:active={isActive}
			class:dim={isDim}
			onmouseenter={() => (hoveredId = row.category.id)}
			onmouseleave={() => (hoveredId = null)}
			role="listitem"
		>
			<div class="row-label">
				<div class="label-main font-heading">{row.category.label}</div>
				<div class="label-blurb">{row.category.blurb}</div>
			</div>

			<div class="mirror">
				<!-- LEFT: search bar growing leftward from center axis -->
				<div class="side side-left">
					<div class="side-total font-mono">
						{row.searchVolume > 0 ? fmtVol(row.searchVolume) : '—'}
						{#if row.searchQueries > 0}
							<span class="side-sub">· {row.searchQueries} queries</span>
						{/if}
					</div>
					<div class="bar-track" style="height: {barH}px;">
						<div
							class="bar bar-left-fill"
							style="
								width: {searchPct}%;
								background: {searchColor};
								opacity: {row.searchVolume > 0 ? 1 : 0};
							"
						></div>
					</div>
				</div>

				<!-- CENTER: status chip -->
				<div class="axis">
					<span
						class="status-chip font-mono"
						class:status-chip-active={isActive}
						style="
							border-color: {statusColor(status)};
							color: {statusColor(status)};
							background: {isActive ? statusColor(status) : 'white'};
						"
					>
						<span style:color={isActive ? 'white' : statusColor(status)}>
							{statusLabel(status)}
						</span>
					</span>
				</div>

				<!-- RIGHT: interview bar growing rightward -->
				<div class="side side-right">
					<div class="bar-track" style="height: {barH}px;">
						<div
							class="bar bar-right-fill"
							style="
								width: {interviewPct}%;
								background: {interviewColor};
								opacity: {row.interviewMentions > 0 ? 1 : 0};
							"
						></div>
					</div>
					<div class="side-total font-mono">
						{row.interviewMentions > 0 ? row.interviewMentions : '—'}
						{#if row.interviewClusters > 0}
							<span class="side-sub">· {row.interviewClusters} clusters</span>
						{/if}
					</div>
				</div>
			</div>

			{#if isActive}
				<div class="row-detail font-mono">
					{#if row.topSearch}
						<span class="detail-item detail-search">
							<span class="detail-tag">top search</span>
							"{row.topSearch.query}" · {fmtVol(row.topSearch.volume)}/mo
						</span>
					{/if}
					{#if row.topCluster}
						<span class="detail-item detail-interview">
							<span class="detail-tag">top cluster</span>
							{row.topCluster.label} · {row.topCluster.count}
						</span>
					{/if}
				</div>
			{/if}
		</div>
	{/each}

	<!-- Totals footer -->
	<div class="totals font-mono">
		<span class="total-item">
			<span class="total-label">Search total</span>
			<span class="total-value">{fmtVol(data.totals.searchVolume)} <span class="total-unit">/mo</span></span>
		</span>
		<span class="total-item">
			<span class="total-label">Interview total</span>
			<span class="total-value">{data.totals.interviewMentions} <span class="total-unit">mentions</span></span>
		</span>
		<span class="total-item">
			<span class="total-label">Coverage</span>
			<span class="total-value">
				{data.totals.categoriesWithBoth} / {data.rows.length}
				<span class="total-unit">categories aligned</span>
			</span>
		</span>
	</div>
</div>

<style>
	.topic-alignment {
		display: flex;
		flex-direction: column;
		gap: var(--gap, 14px);
		width: 100%;
	}

	.col-head {
		display: grid;
		grid-template-columns: 220px 1fr 1fr;
		gap: 1rem;
		padding-bottom: 0.625rem;
		border-bottom: 1px solid rgba(48, 47, 40, 0.1);
	}
	.head-cell {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.head-left { grid-column: 2; align-items: flex-end; text-align: right; }
	.head-right { grid-column: 3; align-items: flex-start; text-align: left; }
	.head-eyebrow {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--ink, #312f28);
		font-weight: 600;
	}
	.head-sub {
		font-size: 0.68rem;
		color: var(--muted-foreground, #64748b);
		letter-spacing: 0.08em;
	}

	.row {
		display: grid;
		grid-template-columns: 220px 1fr;
		gap: 1rem;
		align-items: start;
		padding: 0.625rem 0.625rem;
		margin: 0 -0.625rem;
		border-radius: 8px;
		transition:
			opacity 240ms ease,
			background 240ms ease,
			transform 280ms cubic-bezier(0.19, 1, 0.22, 1);
	}
	.row.dim {
		opacity: 0.35;
	}
	.row.active {
		background: rgba(48, 47, 40, 0.04);
		transform: scale(1.015);
		transform-origin: left center;
	}

	.row-label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding-top: 4px;
		transition: transform 280ms cubic-bezier(0.19, 1, 0.22, 1);
	}
	.row.active .row-label {
		transform: translateX(-2px);
	}
	.label-main {
		font-size: 1rem;
		font-weight: 500;
		color: var(--ink, #312f28);
		line-height: 1.2;
		letter-spacing: -0.005em;
		transition: font-size 240ms ease, color 240ms ease;
	}
	.row.active .label-main {
		font-size: 1.15rem;
		color: var(--ink, #312f28);
	}
	.label-blurb {
		font-size: 0.78rem;
		color: var(--muted-foreground, #64748b);
		line-height: 1.35;
	}

	.mirror {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 0.875rem;
		align-items: center;
	}

	.side {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.side-left { align-items: flex-end; }
	.side-right { align-items: flex-start; }

	.side-total {
		font-size: 0.95rem;
		color: var(--ink, #312f28);
		font-variant-numeric: tabular-nums;
		display: inline-flex;
		gap: 0.375rem;
		align-items: baseline;
		transition: font-size 240ms ease;
	}
	.row.active .side-total {
		font-size: 1.1rem;
	}
	.side-sub {
		font-size: 0.7rem;
		color: var(--muted-foreground, #64748b);
		letter-spacing: 0.04em;
	}

	.bar-track {
		width: 100%;
		background: rgba(48, 47, 40, 0.05);
		border-radius: 4px;
		overflow: hidden;
		display: flex;
		transition: height 280ms cubic-bezier(0.19, 1, 0.22, 1);
	}
	.side-left .bar-track { justify-content: flex-end; }
	.side-right .bar-track { justify-content: flex-start; }
	.bar {
		height: 100%;
		border-radius: 4px;
		transition: width 240ms linear, opacity 240ms ease;
	}

	.axis {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 130px;
	}
	.status-chip {
		display: inline-flex;
		align-items: center;
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		padding: 0.3rem 0.6rem;
		border-radius: 999px;
		border: 1px solid;
		background: white;
		white-space: nowrap;
		font-weight: 600;
		transition: background 240ms ease, transform 240ms ease;
	}
	.status-chip-active {
		transform: scale(1.05);
	}

	.row-detail {
		grid-column: 2;
		display: flex;
		flex-wrap: wrap;
		gap: 1.5rem;
		padding-top: 0.5rem;
		font-size: 0.76rem;
		color: var(--muted-foreground, #64748b);
		letter-spacing: 0.02em;
		line-height: 1.4;
	}
	.detail-item {
		display: inline-flex;
		gap: 0.5rem;
		align-items: baseline;
		color: var(--ink, #312f28);
	}
	.detail-tag {
		font-size: 0.64rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--muted-foreground, #64748b);
		font-weight: 600;
	}
	.detail-search .detail-tag { color: #CC6324; }
	.detail-interview .detail-tag { color: #599077; }

	.totals {
		display: flex;
		gap: 2rem;
		padding-top: 1rem;
		margin-top: 0.5rem;
		border-top: 1px solid rgba(48, 47, 40, 0.08);
		font-size: 0.7rem;
		flex-wrap: wrap;
	}
	.total-item {
		display: inline-flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.total-label {
		font-size: 0.65rem;
		color: var(--muted-foreground, #64748b);
		text-transform: uppercase;
		letter-spacing: 0.12em;
	}
	.total-value {
		font-size: 1rem;
		color: var(--ink, #312f28);
		font-variant-numeric: tabular-nums;
	}
	.total-unit {
		font-size: 0.68rem;
		color: var(--muted-foreground, #64748b);
		text-transform: lowercase;
		letter-spacing: 0.04em;
	}

	@media (max-width: 720px) {
		.col-head { grid-template-columns: 1fr; }
		.head-left, .head-right { align-items: flex-start; text-align: left; grid-column: 1; }
		.row { grid-template-columns: 1fr; }
		.mirror { grid-template-columns: 1fr; }
		.side-left { align-items: flex-start; }
		.side-left .bar-track { justify-content: flex-start; }
		.axis { justify-content: flex-start; min-width: 0; }
	}
</style>

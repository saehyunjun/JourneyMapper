<script lang="ts" module>
	export type SegmentTensionDatum = {
		id: string;
		label: string;
		group?: string;
		description?: string;
		total: number;
		positive: number;
		neutral: number;
		negative: number;
		sentimentScore?: number;
		intensity?: number;
		color?: string;
		href?: string;
	};
</script>

<script lang="ts">
	import {
		getVizMotionPreset,
		getStaggerDelay,
		getIntroTotalDuration,
		resolveMotionMode,
		prefersReducedMotion,
		type VizMotionMode
	} from '$lib/motion/viz';

	// ── Sentiment classification ─────────────────────────────────────────────

	type SentimentClass = 'negative' | 'mixed' | 'positive';

	const SENTIMENT_COLORS: Record<SentimentClass, string> = {
		negative: '#fb7185',
		mixed: '#94a3b8',
		positive: '#34d399'
	};

	function sentimentClass(score: number): SentimentClass {
		if (score < -0.15) return 'negative';
		if (score > 0.15) return 'positive';
		return 'mixed';
	}

	function deriveScore(d: SegmentTensionDatum): number {
		return d.sentimentScore ?? (d.positive - d.negative) / Math.max(1, d.total);
	}

	// ── Internal types ───────────────────────────────────────────────────────

	type EnrichedDatum = SegmentTensionDatum & {
		_score: number;
		_class: SentimentClass;
	};

	type GroupBlock = { group: string; items: EnrichedDatum[] };

	// ── Props ────────────────────────────────────────────────────────────────

	type Props = {
		data: SegmentTensionDatum[];
		title?: string;
		subtitle?: string;
		groupBy?: 'none' | 'group';
		sortBy?: 'total' | 'sentiment' | 'negative' | 'positive' | 'label';
		maxItems?: number;
		motionMode?: VizMotionMode;
		replayKey?: number;
		selectedId?: string | null;
		onselect?: (datum: SegmentTensionDatum) => void;
	};

	let {
		data,
		title,
		subtitle,
		groupBy = 'none',
		sortBy = 'total',
		maxItems,
		motionMode = 'dashboard',
		replayKey = 0,
		selectedId = null,
		onselect
	}: Props = $props();

	// ── Data derivation ──────────────────────────────────────────────────────

	const enriched = $derived(
		data.map((d): EnrichedDatum => {
			const score = deriveScore(d);
			return { ...d, _score: score, _class: sentimentClass(score) };
		})
	);

	function sortItems(items: EnrichedDatum[]): EnrichedDatum[] {
		const copy = [...items];
		switch (sortBy) {
			case 'total':     copy.sort((a, b) => b.total - a.total); break;
			case 'sentiment': copy.sort((a, b) => b._score - a._score); break;
			case 'negative':  copy.sort((a, b) => b.negative - a.negative); break;
			case 'positive':  copy.sort((a, b) => b.positive - a.positive); break;
			case 'label':     copy.sort((a, b) => a.label.localeCompare(b.label)); break;
		}
		return copy;
	}

	const groups = $derived.by((): GroupBlock[] => {
		const sorted = sortItems(enriched);
		const limited = maxItems != null ? sorted.slice(0, maxItems) : sorted;

		if (groupBy === 'group') {
			const map = new Map<string, EnrichedDatum[]>();
			for (const d of limited) {
				const key = d.group ?? 'Other';
				if (!map.has(key)) map.set(key, []);
				map.get(key)!.push(d);
			}
			return [...map.entries()].map(([group, items]) => ({ group, items }));
		}
		return [{ group: '', items: limited }];
	});

	const flatItems = $derived(groups.flatMap((g) => g.items));
	const maxTotal = $derived(Math.max(1, ...flatItems.map((d) => d.total)));

	// ── Reveal indices (story mode paces groups with a gap between them) ──────

	const revealMap = $derived.by(() => {
		const map = new Map<string, number>();
		let ri = 0;
		for (let gi = 0; gi < groups.length; gi++) {
			if (effectiveMode === 'story' && groupBy === 'group' && gi > 0) {
				ri += 3; // silence between groups
			}
			for (const d of groups[gi].items) {
				map.set(d.id, ri++);
			}
		}
		return map;
	});

	// ── Motion ───────────────────────────────────────────────────────────────

	const effectiveMode = $derived(resolveMotionMode(motionMode, prefersReducedMotion()));

	let elapsedMs = $state(0);

	$effect(() => {
		void replayKey;
		const mode = effectiveMode;
		const count = flatItems.length;

		let running = true;
		let t0 = 0;
		let rafId = 0;

		if (mode === 'none') {
			elapsedMs = Infinity;
			return () => {};
		}

		const totalDuration = getIntroTotalDuration(mode, count + 6); // +6 for group gaps
		elapsedMs = 0;

		const tick = (now: number) => {
			if (!running) return;
			if (!t0) t0 = now;
			elapsedMs = now - t0;
			if (elapsedMs < totalDuration) {
				rafId = requestAnimationFrame(tick);
			} else {
				elapsedMs = totalDuration + 200;
			}
		};

		rafId = requestAnimationFrame(tick);

		return () => {
			running = false;
			cancelAnimationFrame(rafId);
		};
	});

	// ── Per-glyph progress ───────────────────────────────────────────────────

	function glyphProg(id: string): number {
		const mode = effectiveMode;
		if (mode === 'none') return 1;
		const preset = getVizMotionPreset(mode);
		const index = revealMap.get(id) ?? 0;
		const delay = getStaggerDelay(index, mode);
		if (elapsedMs <= delay) return 0;
		const t = Math.min(1, (elapsedMs - delay) / preset.duration);
		return preset.ease(t);
	}

	// Within a glyph the bar grows first, then the slope draws, then labels fade in.
	// Story mode sequences these phases explicitly; dashboard is uniform.

	function wedgeProg(gp: number): number {
		if (effectiveMode !== 'story') return gp;
		return Math.min(1, gp * 2);
	}

	function slopeProg(gp: number): number {
		if (effectiveMode !== 'story') return gp;
		return Math.max(0, Math.min(1, (gp - 0.3) / 0.7));
	}

	function labelAlpha(gp: number): number {
		if (effectiveMode === 'none') return 1;
		if (effectiveMode === 'story') return Math.max(0, Math.min(1, (gp - 0.7) / 0.3));
		return Math.max(0, Math.min(1, (gp - 0.5) / 0.5));
	}

	// ── Glyph geometry ────────────────────────────────────────────────────────
	//
	//  ┌─────────────────────────────────────────────────────────┐
	//  │  [LX..LX+LW]    gap    [GR..GR+TW]                     │
	//  │                                                         │
	//  │  ████████       /·····  ▬▬▬▬  ← right tick at sentY   │
	//  │  ████████      /                                        │
	//  │  ████████     / ← slope line                           │
	//  └─────────────────────────────────────────────────────────┘
	//   left bar (vol)         right tick = sentiment position

	const CW = 96;  // cell width
	const CH = 56;  // cell height
	const LX = 4;   // left bar x
	const LW = 20;  // left bar width
	const GL = 24;  // gap left  (slope line starts here)
	const GR = 58;  // gap right (slope line ends / right tick starts)
	const TW = 16;  // right tick width
	const TH = 4;   // right tick height
	const BPAD = 4; // bottom padding inside cell
	const MAX_BH = CH - 10; // max bar height (4px top + 6px bottom breathing room)

	function barH(d: EnrichedDatum, gp: number): number {
		return (d.total / maxTotal) * MAX_BH * wedgeProg(gp);
	}

	// sentimentScore 1 → near top; 0 → mid; -1 → near bottom
	function sentY(score: number): number {
		const halfRange = (CH - 12) / 2; // 22px each side of centre
		return CH / 2 - score * halfRange;
	}

	function lineLen(bh: number, score: number): number {
		const x1 = GL, y1 = CH - BPAD - bh;
		const x2 = GR, y2 = sentY(score);
		return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
	}

	function glyphColor(d: EnrichedDatum): string {
		return d.color ?? SENTIMENT_COLORS[d._class];
	}

	// ── Tooltip ───────────────────────────────────────────────────────────────

	type TooltipState = { datum: EnrichedDatum; x: number; y: number } | null;
	let tooltip = $state<TooltipState>(null);
	let rootEl: HTMLElement;

	function pointerEnter(datum: EnrichedDatum, e: MouseEvent) {
		const r = rootEl.getBoundingClientRect();
		tooltip = { datum, x: e.clientX - r.left, y: e.clientY - r.top };
	}

	function pointerMove(datum: EnrichedDatum, e: MouseEvent) {
		if (!tooltip) return;
		const r = rootEl.getBoundingClientRect();
		tooltip = { datum, x: e.clientX - r.left, y: e.clientY - r.top };
	}

	function select(datum: SegmentTensionDatum) {
		onselect?.(datum);
	}

	function keydown(datum: SegmentTensionDatum, e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			select(datum);
		}
	}

	function fmtScore(score: number): string {
		const pct = Math.round(Math.abs(score) * 100);
		if (score > 0.15) return `+${pct}% positive`;
		if (score < -0.15) return `−${pct}% negative`;
		return `${pct}% mixed`;
	}
</script>

<div class="stm-root" bind:this={rootEl}>
	{#if title}
		<div class="stm-header">
			<h2 class="stm-title">{title}</h2>
			{#if subtitle}
				<p class="stm-subtitle">{subtitle}</p>
			{/if}
		</div>
	{/if}

	{#each groups as block, gi (block.group || gi)}
		{#if groupBy === 'group' && block.group}
			<h3 class="stm-group-label">{block.group}</h3>
		{/if}

		<div class="stm-grid" role="group" aria-label={block.group || 'Keyword clusters'}>
			{#each block.items as datum (datum.id)}
				{@const gp   = glyphProg(datum.id)}
				{@const bh   = barH(datum, gp)}
				{@const sp   = slopeProg(gp)}
				{@const la   = labelAlpha(gp)}
				{@const sy   = sentY(datum._score)}
				{@const ll   = lineLen(bh, datum._score)}
				{@const col  = glyphColor(datum)}
				{@const isSel = datum.id === selectedId}
				{@const lineY1 = CH - BPAD - bh}

				<button
					type="button"
					class="stm-glyph"
					class:stm-selected={isSel}
					aria-label="{datum.label}: {datum.total} tagged quotes, sentiment {datum._class} ({fmtScore(datum._score)})"
					aria-pressed={isSel}
					onmouseenter={(e) => pointerEnter(datum, e)}
					onmousemove={(e) => pointerMove(datum, e)}
					onmouseleave={() => (tooltip = null)}
					onclick={() => select(datum)}
				>
					<svg
						viewBox="0 0 {CW} {CH}"
						width={CW}
						height={CH}
						aria-hidden="true"
						class="stm-svg"
						style="opacity: {effectiveMode !== 'none' ? Math.max(0.08, gp) : 1}"
					>
						<!-- Cell background -->
						<rect
							x="0.5" y="0.5"
							width={CW - 1}
							height={CH - 1}
							rx="2"
							fill="var(--paper, #F4F4FF)"
							stroke={isSel ? col : 'var(--midgrayblue, #6a99c2)'}
							stroke-width={isSel ? 1.5 : 0.5}
						/>

						<!-- Volume bar — grows from bottom -->
						{#if bh > 0.5}
							<rect
								x={LX}
								y={CH - BPAD - bh}
								width={LW}
								height={bh}
								rx="1.5"
								fill={col}
								opacity="0.65"
							/>
						{/if}

						<!-- Slope line — draws left to right via dashoffset -->
						{#if sp > 0.01 && bh > 0.5}
							<line
								x1={GL} y1={lineY1}
								x2={GR} y2={sy}
								stroke={col}
								stroke-width="1.5"
								stroke-linecap="round"
								stroke-dasharray={ll}
								stroke-dashoffset={ll * (1 - sp)}
							/>
						{/if}

						<!-- Right endpoint tick — appears as slope completes -->
						{#if sp > 0.4}
							<rect
								x={GR}
								y={sy - TH / 2}
								width={TW}
								height={TH}
								rx="1"
								fill={col}
								opacity={(sp - 0.4) / 0.6}
							/>
						{/if}

						<!-- Total count — top-right corner -->
						<text
							x={CW - 5}
							y="12"
							text-anchor="end"
							class="stm-count"
							opacity={la * 0.55}
						>{datum.total}</text>
					</svg>

					<span class="stm-label" style="opacity: {la}">
						{datum.label}
					</span>
				</button>
			{/each}
		</div>
	{/each}

	<!-- Legend -->
	<div class="stm-legend" role="note" aria-label="How to read this chart">
		<span class="stm-legend-item">
			<svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true">
				<rect x="2" y="4" width="8" height="8" rx="1" fill="#94a3b8" opacity="0.65" />
			</svg>
			Left bar = segment volume
		</span>
		<span class="stm-legend-item">
			<svg width="32" height="16" viewBox="0 0 32 16" aria-hidden="true">
				<line x1="2" y1="13" x2="20" y2="3" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" />
				<rect x="20" y="6" width="10" height="4" rx="1" fill="#94a3b8" />
			</svg>
			Slope = sentiment balance
		</span>
		<span class="stm-legend-item">
			<svg width="52" height="16" viewBox="0 0 52 16" aria-hidden="true">
				<rect x="1"  y="5" width="12" height="6" rx="1" fill="#fb7185" opacity="0.8" />
				<rect x="20" y="5" width="12" height="6" rx="1" fill="#94a3b8" opacity="0.8" />
				<rect x="39" y="5" width="12" height="6" rx="1" fill="#34d399" opacity="0.8" />
			</svg>
			neg / mixed / pos
		</span>
	</div>

	<!-- Tooltip -->
	{#if tooltip}
		{@const d = tooltip.datum}
		{@const col = glyphColor(d)}
		<div
			class="stm-tooltip"
			style="left: {tooltip.x}px; top: {tooltip.y}px"
			role="tooltip"
		>
			<div class="stm-tt-title">{d.label}</div>
			{#if d.group}
				<div class="stm-tt-meta">{d.group}</div>
			{/if}
			<div class="stm-tt-row">
				<span class="stm-tt-swatch" style="background: {col}"></span>
				<span class="stm-tt-class">{d._class}</span>
				<span class="stm-tt-score">({fmtScore(d._score)})</span>
			</div>
			<div class="stm-tt-counts">
				<span class="tt-total">Total: {d.total}</span>
				<span class="tt-pos">+{d.positive}</span>
				<span class="tt-neu">~{d.neutral}</span>
				<span class="tt-neg">−{d.negative}</span>
			</div>
			{#if d.description}
				<div class="stm-tt-desc">{d.description}</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.stm-root {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.stm-header {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 0.25rem;
	}

	.stm-title {
		font-family: var(--font-heading-alt, 'Space Grotesk', sans-serif);
		font-size: 1rem;
		font-weight: 600;
		color: var(--ink, #312F28);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.stm-subtitle {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.7rem;
		color: var(--gray, #707070);
	}

	.stm-group-label {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.68rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--grayblue, #446079);
		padding: 0.125rem 0;
		border-bottom: 0.5px solid var(--midgrayblue, #6a99c2);
		margin-top: 0.25rem;
	}

	.stm-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 0.625rem;
	}

	.stm-glyph {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		cursor: pointer;
		border-radius: 3px;
		outline: none;
		background: none;
		border: none;
		padding: 0;
		text-align: left;
	}

	.stm-glyph:focus-visible {
		outline: 2px solid var(--midgrayblue, #6a99c2);
		outline-offset: 2px;
	}

	.stm-glyph:hover .stm-svg {
		filter: brightness(0.96);
	}

	.stm-selected .stm-svg {
		filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.14));
	}

	.stm-svg {
		display: block;
		width: 100%;
		height: auto;
		transition: filter 150ms ease;
	}

	.stm-label {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.62rem;
		line-height: 1.3;
		color: var(--ink, #312F28);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.stm-count {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 9px;
		fill: var(--ink, #312F28);
	}

	/* Legend */
	.stm-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.25rem;
		margin-top: 0.25rem;
		padding-top: 0.5rem;
		border-top: 0.5px solid var(--panel-mid, #D9DACF);
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.65rem;
		color: var(--gray, #707070);
	}

	.stm-legend-item {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	/* Tooltip */
	.stm-tooltip {
		position: absolute;
		pointer-events: none;
		background: var(--ink, #312F28);
		color: var(--paper, #F4F4FF);
		padding: 0.5rem 0.625rem;
		border-radius: 4px;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.68rem;
		line-height: 1.45;
		transform: translate(12px, -100%);
		box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
		z-index: 20;
		min-width: 11rem;
		max-width: 16rem;
		animation: stm-fade 120ms ease-out;
	}

	.stm-tt-title {
		font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
		font-weight: 600;
		font-size: 0.75rem;
		margin-bottom: 0.15rem;
	}

	.stm-tt-meta {
		opacity: 0.6;
		font-size: 0.65rem;
		margin-bottom: 0.3rem;
	}

	.stm-tt-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-bottom: 0.25rem;
	}

	.stm-tt-swatch {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.stm-tt-class {
		font-weight: 600;
		text-transform: capitalize;
	}

	.stm-tt-score {
		opacity: 0.65;
	}

	.stm-tt-counts {
		display: flex;
		gap: 0.5rem;
		font-size: 0.65rem;
		opacity: 0.85;
	}

	.tt-total { opacity: 0.7; }
	.tt-pos   { color: #34d399; }
	.tt-neu   { color: #94a3b8; }
	.tt-neg   { color: #fb7185; }

	.stm-tt-desc {
		margin-top: 0.3rem;
		opacity: 0.6;
		font-size: 0.65rem;
		line-height: 1.4;
	}

	@keyframes stm-fade {
		from { opacity: 0; transform: translate(12px, calc(-100% + 4px)); }
		to   { opacity: 1; transform: translate(12px, -100%); }
	}

	@media (prefers-reduced-motion: reduce) {
		.stm-svg {
			transition: none;
		}
		@keyframes stm-fade {
			from { opacity: 1; }
		}
	}
</style>

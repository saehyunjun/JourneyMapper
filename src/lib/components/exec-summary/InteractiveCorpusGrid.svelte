
<!--
	InteractiveCorpusGrid — morphing dot grid that regroups by an active axis.

	Each tagged moment is one dot. Color is sentiment (5-band palette, stable
	per dot regardless of mode). Position is laid out per the active `mode`:

	  mode='none'       → one packed square grid (corpus-wide read)
	  mode='theme'      → K mini-grids, one per theme, labeled
	  mode='interview'  → K mini-grids, one per interview, labeled
	  mode='starred'    → 2 mini-grids: starred / not-starred

	The morph is the whole trick. Every dot has a stable DOM identity keyed by
	`dot.id`; layout changes only the dot's `transform: translate(x, y)`, so
	CSS `transition: transform` slides circles from their old grid position to
	their new group position. We never recreate dots — that would crossfade
	instead of morph.

	Layout math runs in a $derived from {mode, dots, groups, containerWidth}.
	Bin-pack each group into a roughly square sub-grid; flow groups left-to-
	right with line wrapping; label each group below its dots. Container height
	is reactive to the layout — the parent should let it grow.
-->
<script lang="ts">
	import type { SentimentBucket } from '$lib/story/types';

	export type Dot = {
		id: string;
		sentiment: number;
		interview_id?: string;
		theme_id?: string;
		subtheme_id?: string;
		finding_id?: string;
		starred?: boolean;
	};

	export type GroupMode = 'none' | 'theme' | 'subtheme' | 'interview' | 'finding' | 'starred';
	export type GroupSpec = { id: string; label: string };

	let {
		dots,
		mode = 'none',
		themeGroups = [],
		subthemeGroups = [],
		interviewGroups = [],
		findingGroups = [],
		cellSize = 9,
		intraGap = 3,
		interGap = 22,
		rowGap = 32,
		labelHeight = 30,
		minHeight = 180,
		onSelectGroup
	}: {
		dots: Dot[];
		mode?: GroupMode;
		themeGroups?: GroupSpec[];
		subthemeGroups?: GroupSpec[];
		interviewGroups?: GroupSpec[];
		findingGroups?: GroupSpec[];
		cellSize?: number;
		intraGap?: number;
		interGap?: number;
		rowGap?: number;
		labelHeight?: number;
		minHeight?: number;
		/**
		 * Fires when the user clicks a group label in any non-'none' mode.
		 * `mode` reflects the active lens at click time; `id` is the group's
		 * raw id (e.g. theme_id, finding_id, interview_id, '__no_subtheme',
		 * '__unassigned_finding').
		 */
		onSelectGroup?: (payload: { mode: GroupMode; id: string }) => void;
	} = $props();

	const SENTIMENT_PALETTE: Record<SentimentBucket, string> = {
		'-2': '#e11d48',
		'-1': '#fb7185',
		'0': '#cbd5e1',
		'1': '#34d399',
		'2': '#059669'
	};

	function sentimentColor(s: number): string {
		const k = String(Math.max(-2, Math.min(2, Math.round(s)))) as SentimentBucket;
		return SENTIMENT_PALETTE[k];
	}

	// Container width — bound below; drives wrap behavior. Falls back to a
	// sensible default for SSR / pre-mount so the first paint isn't a single
	// vertical strip.
	let containerWidth = $state(960);

	type LayoutDot = { id: string; x: number; y: number; color: string };
	type LayoutGroup = { id: string; label: string; count: number; x: number; y: number; w: number; h: number };
	type Layout = { dots: LayoutDot[]; groups: LayoutGroup[]; height: number };

	function assignedGroupId(dot: Dot, m: GroupMode): string {
		if (m === 'none') return '__all';
		if (m === 'theme') return dot.theme_id ?? '__unk';
		if (m === 'subtheme') return dot.subtheme_id ?? '__no_subtheme';
		if (m === 'interview') return dot.interview_id ?? '__unk';
		if (m === 'finding') return dot.finding_id ?? '__unassigned_finding';
		if (m === 'starred') return dot.starred ? '__starred' : '__other';
		return '__all';
	}

	function groupOrder(m: GroupMode): { id: string; label: string }[] {
		if (m === 'none') return [{ id: '__all', label: 'All tagged moments' }];
		if (m === 'theme') return themeGroups.map((g) => ({ id: g.id, label: g.label }));
		if (m === 'subtheme')
			return [
				...subthemeGroups.map((g) => ({ id: g.id, label: g.label })),
				{ id: '__no_subtheme', label: 'No subtheme' }
			];
		if (m === 'interview') return interviewGroups.map((g) => ({ id: g.id, label: g.label }));
		if (m === 'finding')
			return [
				...findingGroups.map((g) => ({ id: g.id, label: g.label })),
				{ id: '__unassigned_finding', label: 'Not in a finding' }
			];
		if (m === 'starred')
			return [
				{ id: '__starred', label: 'Starred quotes' },
				{ id: '__other', label: 'Not starred' }
			];
		return [];
	}

	const layout = $derived.by<Layout>(() => {
		const groups = groupOrder(mode);
		// Bucket dots into groups; preserve declared group order, then any
		// orphan groups (dots that mapped to an unknown id) get appended.
		const dotsByGroup = new Map<string, Dot[]>();
		for (const g of groups) dotsByGroup.set(g.id, []);
		const labelById = new Map(groups.map((g) => [g.id, g.label]));
		for (const d of dots) {
			const gid = assignedGroupId(d, mode);
			let list = dotsByGroup.get(gid);
			if (!list) {
				list = [];
				dotsByGroup.set(gid, list);
				if (!labelById.has(gid)) labelById.set(gid, gid);
			}
			list.push(d);
		}

		// Sort each group's dots by sentiment so reds → greys → greens flow
		// left-to-right within every mini-grid. Stable secondary key on dot.id
		// keeps the order deterministic across re-renders (and lets specific
		// dots morph to consistent slots).
		for (const list of dotsByGroup.values()) {
			list.sort((a, b) => {
				if (a.sentiment !== b.sentiment) return a.sentiment - b.sentiment;
				return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
			});
		}

		const orderedGroupIds = [
			...groups.map((g) => g.id),
			...[...dotsByGroup.keys()].filter((id) => !labelById.has(id) || !groups.find((g) => g.id === id))
		];

		// In 'none' mode, prefer a wider single group so the corpus reads as one
		// landscape band instead of a vertical column. Cap target width to the
		// container.
		const singleMode = mode === 'none';

		const layoutDots: LayoutDot[] = [];
		const layoutGroups: LayoutGroup[] = [];

		let cursorX = 0;
		let cursorY = 0;
		let rowMaxH = 0;

		for (const gid of orderedGroupIds) {
			const list = dotsByGroup.get(gid);
			if (!list || !list.length) continue;
			const n = list.length;
			let cols = Math.max(1, Math.ceil(Math.sqrt(n)));
			if (singleMode) {
				// Single-grid mode: pick cols so the grid takes most of the available
				// width without overflowing. Floor to keep cells aligned.
				const maxCols = Math.max(
					4,
					Math.floor((containerWidth + intraGap) / (cellSize + intraGap))
				);
				cols = Math.min(maxCols, Math.max(cols, Math.ceil(n / 8)));
			}
			const rows = Math.ceil(n / cols);
			const w = cols * cellSize + (cols - 1) * intraGap;
			const h = rows * cellSize + (rows - 1) * intraGap;

			// Wrap to next row when this group would overflow the container width.
			if (!singleMode && cursorX > 0 && cursorX + w > containerWidth) {
				cursorX = 0;
				cursorY += rowMaxH + labelHeight + rowGap;
				rowMaxH = 0;
			}

			layoutGroups.push({
				id: gid,
				label: labelById.get(gid) ?? gid,
				count: n,
				x: cursorX,
				y: cursorY,
				w,
				h
			});

			for (let i = 0; i < list.length; i++) {
				const col = i % cols;
				const row = Math.floor(i / cols);
				const dx = cursorX + col * (cellSize + intraGap);
				const dy = cursorY + row * (cellSize + intraGap);
				layoutDots.push({
					id: list[i].id,
					x: dx,
					y: dy,
					color: sentimentColor(list[i].sentiment)
				});
			}

			cursorX += w + interGap;
			rowMaxH = Math.max(rowMaxH, h);
		}

		const totalHeight = cursorY + rowMaxH + (mode === 'none' ? 0 : labelHeight) + 8;
		return {
			dots: layoutDots,
			groups: layoutGroups,
			height: Math.max(minHeight, totalHeight)
		};
	});

	// Dot positions keyed by id — Svelte's keyed each over dots[] pairs each
	// span with the same DOM node across mode changes, so transform-transitions
	// fire instead of mount-pop. We render *every* dot in the input array (even
	// orphans) so a dot that's missing a theme_id still has a place to sit when
	// mode flips to theme.
	const positionById = $derived.by(() => {
		const m = new Map<string, LayoutDot>();
		for (const d of layout.dots) m.set(d.id, d);
		return m;
	});

	// --- Initial pop-in animation -------------------------------------------
	// Each dot scales from 0 → 1 once on mount, with a stable per-dot random
	// delay so the field "fills in" rather than appearing as a single beat.
	// The delay range shrinks if the grid is taller than the viewport — past
	// that point later-popping dots would land below the fold and the visible
	// portion would feel sluggish.
	const POP_MAX_DELAY = 1100;
	const POP_MIN_DELAY_RANGE = 350;

	let viewportHeight = $state(900);
	$effect(() => {
		if (typeof window === 'undefined') return;
		const sync = () => { viewportHeight = window.innerHeight; };
		sync();
		window.addEventListener('resize', sync);
		return () => window.removeEventListener('resize', sync);
	});

	const popDelayRange = $derived.by(() => {
		if (layout.height <= viewportHeight) return POP_MAX_DELAY;
		const ratio = viewportHeight / layout.height;
		return Math.max(POP_MIN_DELAY_RANGE, Math.round(POP_MAX_DELAY * ratio));
	});

	function hashUnit(id: string): number {
		let h = 2166136261 >>> 0;
		for (let i = 0; i < id.length; i++) {
			h ^= id.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return ((h >>> 0) % 10000) / 10000;
	}

	function popDelay(id: string): number {
		return Math.round(hashUnit(id) * popDelayRange);
	}
</script>

<div
	class="icg-wrap"
	bind:clientWidth={containerWidth}
	style="height: {layout.height}px;"
>
	<!-- Dot layer: every dot is an outer wrapper (handles position morph) with
	     an inner circle (handles one-shot pop-in scale). Keyed by stable id so
	     DOM nodes survive mode changes — that's what makes the transform-
	     transition morph instead of crossfade. The split is necessary because
	     translate and scale both live on `transform`; if we shared one
	     element, the pop-in scale would conflict with the position morph. -->
	<div class="dots-layer">
		{#each dots as d (d.id)}
			{@const p = positionById.get(d.id)}
			{#if p}
				<span
					class="dot-pos"
					style="
						width: {cellSize}px;
						height: {cellSize}px;
						transform: translate3d({p.x}px, {p.y}px, 0);
					"
				>
					<span
						class="dot"
						style="
							background: {p.color};
							animation-delay: {popDelay(d.id)}ms;
						"
					></span>
				</span>
			{/if}
		{/each}
	</div>

	<!-- Label layer: one per group, positioned below the group's dot block.
	     Animates in/out when mode changes (groups appear and disappear). When
	     `onSelectGroup` is wired, each label becomes a button that calls back
	     with the group id — that's the grid-as-navigation path. -->
	<div class="labels-layer">
		{#each layout.groups as g (g.id)}
			{#if mode !== 'none'}
				{#if onSelectGroup}
					<button
						type="button"
						class="group-label is-clickable"
						style="
							transform: translate3d({g.x}px, {g.y + g.h + 6}px, 0);
							max-width: {Math.max(g.w + 4, 60)}px;
						"
						onclick={() => onSelectGroup?.({ mode, id: g.id })}
						aria-label="Open {g.label}"
					>
						<span class="label-count font-heading tabular-nums">{g.count}</span>
						<span class="label-text">{g.label}</span>
					</button>
				{:else}
					<div
						class="group-label"
						style="
							transform: translate3d({g.x}px, {g.y + g.h + 6}px, 0);
							max-width: {Math.max(g.w + 4, 60)}px;
						"
					>
						<span class="label-count font-heading tabular-nums">{g.count}</span>
						<span class="label-text">{g.label}</span>
					</div>
				{/if}
			{/if}
		{/each}
	</div>
</div>

<style>
	.icg-wrap {
		position: relative;
		width: 100%;
		transition: height 600ms cubic-bezier(0.65, 0, 0.35, 1);
	}
	.dots-layer,
	.labels-layer {
		position: absolute;
		inset: 0;
	}
	.labels-layer {
		pointer-events: none;
	}
	.labels-layer > * {
		pointer-events: auto;
	}
	.dot-pos {
		position: absolute;
		top: 0;
		left: 0;
		display: block;
		will-change: transform, width, height;
		transition:
			transform 800ms cubic-bezier(0.65, 0, 0.35, 1),
			width 600ms cubic-bezier(0.65, 0, 0.35, 1),
			height 600ms cubic-bezier(0.65, 0, 0.35, 1);
	}
	.dot {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		transform: scale(0);
		transform-origin: center;
		animation: pop-in 480ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
		transition: background-color 400ms cubic-bezier(0.4, 0, 0.2, 1);
	}
	@keyframes pop-in {
		from { transform: scale(0); }
		to   { transform: scale(1); }
	}
	.group-label {
		position: absolute;
		top: 0;
		left: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
		line-height: 1.15;
		font-size: 0.7rem;
		color: var(--ink, #312f28);
		opacity: 0;
		animation: label-rise 500ms cubic-bezier(0.19, 1, 0.22, 1) 350ms forwards;
		text-align: left;
	}
	.group-label.is-clickable {
		border: 0;
		background: transparent;
		padding: 0;
		cursor: pointer;
		border-radius: 4px;
		transition: background 160ms ease;
	}
	.group-label.is-clickable:hover,
	.group-label.is-clickable:focus-visible {
		background: rgba(48, 47, 40, 0.06);
		outline: none;
	}
	.label-count {
		font-size: 0.85rem;
		font-weight: 600;
	}
	.label-text {
		font-size: 0.65rem;
		color: var(--muted-foreground, #64748b);
		text-transform: lowercase;
		letter-spacing: 0.02em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	@keyframes label-rise {
		from { opacity: 0; transform: translate3d(var(--lx, 0px), calc(var(--ly, 0px) + 4px), 0); }
		to   { opacity: 1; }
	}
	@media (prefers-reduced-motion: reduce) {
		.dot-pos {
			transition: none;
			will-change: auto;
		}
		.dot {
			animation: none;
			transform: scale(1);
			transition: background-color 200ms linear;
		}
		.group-label { animation: none; opacity: 1; }
	}
</style>

<script lang="ts">
	/**
	 * ThemeHeatmap.svelte
	 *
	 * Themes (rows) against either interviewees or interview questions (columns).
	 * Each cell is coloured by one of two metrics:
	 *   - Segments   — how many coded segments carried that theme there
	 *   - Sentiment  — the average sentiment (-2..2) of those segments
	 *
	 * Where the radial tree and sunburst make you flip between one question or
	 * one participant at a time, this lays every facet out at once so they can
	 * be compared directly — and surfaces sentiment, which neither hierarchy
	 * view shows.
	 */
	import * as d3 from 'd3';
	import {
		annotations,
		quotes,
		segmentsForTheme,
		themeTags,
		titleCase,
		participantLabel,
		questionLabel,
		themedParticipantIds,
		themedQuestionIds,
		SENTIMENT_LABELS
	} from '$lib/content/wctglpdemo-data/analysis';
	import { themePalette } from '$lib/content/wctglpdemo-data/topicTree';
	import { keywordBlocks } from '$lib/content/wctglpdemo-data/keywords';
	import KeywordText from '$lib/components/KeywordText.svelte';
	import CodedFragmentCard from '$lib/components/CodedFragmentCard.svelte';
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import SentimentBar from '$lib/components/SentimentBar.svelte';

	type Axis = 'participant' | 'question';
	type Metric = 'count' | 'sentiment';

	let axis = $state<Axis>('participant');
	let metric = $state<Metric>('count');

	const themed = annotations.filter(
		(a) => a.review_status !== 'discarded' && a.themes.length > 0
	);

	// Theme rows that actually occur, most-tagged first.
	const rows = themeTags
		.map((t) => ({ t, n: themed.filter((a) => a.themes.includes(t.id)).length }))
		.filter((x) => x.n > 0)
		.sort((a, b) => b.n - a.n)
		.map((x) => x.t);

	const cols = $derived(axis === 'participant' ? themedParticipantIds : themedQuestionIds);
	const colLabel = (id: string) =>
		axis === 'participant' ? participantLabel(id) : titleCase(id);
	const colTitle = (id: string) =>
		axis === 'participant' ? participantLabel(id) : questionLabel(id);

	type Cell = { count: number; sentiment: number | null };

	const matrix = $derived.by<{ theme: (typeof rows)[number]; cells: Cell[] }[]>(() =>
		rows.map((theme) => ({
			theme,
			cells: cols.map((col) => {
				const ms = themed.filter(
					(a) =>
						a.themes.includes(theme.id) &&
						(axis === 'participant' ? a.interview_id === col : a.question_id === col)
				);
				return {
					count: ms.length,
					sentiment: ms.length ? (d3.mean(ms, (a) => a.sentiment) ?? 0) : null
				};
			})
		}))
	);

	const maxCount = $derived(
		Math.max(1, ...matrix.flatMap((r) => r.cells.map((c) => c.count)))
	);

	const countScale = $derived(
		d3
			.scaleSequential<string>()
			.domain([0, maxCount])
			.interpolator(d3.interpolateRgb('#EEF1EC', '#294457'))
	);
	const sentimentScale = d3
		.scaleDiverging<string>()
		.domain([-2, 0, 2])
		.interpolator(d3.interpolateRdYlGn);

	function cellFill(c: Cell): string {
		if (metric === 'count') return c.count === 0 ? 'transparent' : countScale(c.count);
		return c.sentiment === null ? 'transparent' : sentimentScale(c.sentiment);
	}

	/** Dark fills get light text. */
	function cellInk(c: Cell): string {
		const fill = cellFill(c);
		if (fill === 'transparent') return 'var(--ink)';
		const hsl = d3.hsl(fill);
		return hsl.l < 0.62 ? '#F4F4FF' : 'var(--ink)';
	}

	function cellText(c: Cell): string {
		if (metric === 'count') return c.count === 0 ? '' : String(c.count);
		if (c.sentiment === null) return '';
		const s = c.sentiment;
		return (s > 0 ? '+' : '') + s.toFixed(1);
	}

	let hovered = $state<{ x: number; y: number; theme: string; col: string; c: Cell } | null>(
		null
	);
	let wrapEl = $state<HTMLDivElement>();

	function showTip(e: PointerEvent, theme: string, col: string, c: Cell) {
		const r = wrapEl?.getBoundingClientRect();
		if (!r) return;
		hovered = { x: e.clientX - r.left, y: e.clientY - r.top, theme, col, c };
	}

	// --- Cell drawer: word usage + quotes/fragments behind a theme × facet ---
	let drawerOpen = $state(false);
	let drawerCell = $state<{ themeId: string; colId: string } | null>(null);

	/** Annotation predicate for the open cell's column. */
	const drawerPredicate = $derived(
		drawerCell
			? axis === 'participant'
				? (a: { interview_id: string }) => a.interview_id === drawerCell!.colId
				: (a: { question_id: string }) => a.question_id === drawerCell!.colId
			: () => false
	);

	const drawerFragments = $derived(
		drawerCell ? segmentsForTheme(drawerCell.themeId, drawerPredicate as never) : []
	);

	const drawerQuotes = $derived.by(() => {
		if (!drawerCell) return [];
		const { themeId, colId } = drawerCell;
		return quotes
			.filter(
				(q) =>
					q.themes.includes(themeId) &&
					(axis === 'participant' ? q.interview_id === colId : q.question_id === colId)
			)
			.sort((a, b) => b.quote_score.overall - a.quote_score.overall);
	});

	const drawerKeywordBlocks = $derived(keywordBlocks(drawerFragments));
	const maxKeywordCount = $derived(
		Math.max(1, ...drawerKeywordBlocks.map((k) => k.blocks.length))
	);

	const drawerThemeLabel = $derived(drawerCell ? titleCase(drawerCell.themeId) : '');
	const drawerContextLabel = $derived(
		drawerCell
			? axis === 'participant'
				? participantLabel(drawerCell.colId)
				: questionLabel(drawerCell.colId)
			: ''
	);

	function openCell(themeId: string, colId: string, c: Cell) {
		if (c.count === 0) return;
		drawerCell = { themeId, colId };
		drawerOpen = true;
	}

	function sentimentClass(s: number): string {
		if (s > 0) return 'bg-emerald-100 text-emerald-800';
		if (s < 0) return 'bg-rose-100 text-rose-800';
		return 'bg-slate-100 text-slate-700';
	}
</script>

<div class="relative flex flex-col gap-4" bind:this={wrapEl}>
	<div class="flex flex-wrap items-center gap-4">
		<div class="flex gap-1.5">
			<span class="self-center text-xs uppercase tracking-wide text-(--ink)/45">Columns</span>
			<button
				type="button"
				class="rounded-md border px-2.5 py-1 text-xs transition-colors
					{axis === 'participant'
					? 'border-(--darkgrayblue) bg-(--darkgrayblue) text-(--paper)'
					: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
				onclick={() => (axis = 'participant')}
			>
				By participant
			</button>
			<button
				type="button"
				class="rounded-md border px-2.5 py-1 text-xs transition-colors
					{axis === 'question'
					? 'border-(--darkgrayblue) bg-(--darkgrayblue) text-(--paper)'
					: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
				onclick={() => (axis = 'question')}
			>
				By question
			</button>
		</div>
		<div class="flex gap-1.5">
			<span class="self-center text-xs uppercase tracking-wide text-(--ink)/45">Metric</span>
			<button
				type="button"
				class="rounded-md border px-2.5 py-1 text-xs transition-colors
					{metric === 'count'
					? 'border-(--orange) bg-(--orange) text-(--paper)'
					: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
				onclick={() => (metric = 'count')}
			>
				Segments
			</button>
			<button
				type="button"
				class="rounded-md border px-2.5 py-1 text-xs transition-colors
					{metric === 'sentiment'
					? 'border-(--orange) bg-(--orange) text-(--paper)'
					: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
				onclick={() => (metric = 'sentiment')}
			>
				Avg sentiment
			</button>
		</div>
	</div>

	<div class="overflow-x-auto rounded-xl border border-(--ink)/10 bg-(--panel) p-3">
		<div
			class="grid gap-1"
			style="grid-template-columns: 190px repeat({cols.length}, minmax(68px, 1fr))"
		>
			<!-- Header row -->
			<div></div>
			{#each cols as col (col)}
				<div
					class="truncate px-1 pb-1 text-center text-[11px] font-medium text-(--ink)/70"
					title={colTitle(col)}
				>
					{colLabel(col)}
				</div>
			{/each}

			<!-- Theme rows -->
			{#each matrix as row (row.theme.id)}
				<div class="flex items-center gap-1.5 pr-2 text-xs text-foreground">
					<span
						class="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
						style="background: {themePalette[row.theme.id]}"
					></span>
					<span class="truncate" title={row.theme.description}>{titleCase(row.theme.id)}</span>
				</div>
				{#each row.cells as c, i (cols[i])}
					<button
						type="button"
						disabled={c.count === 0}
						class="flex h-9 items-center justify-center rounded-sm text-xs tabular-nums ring-1 ring-inset ring-black/5 transition-[box-shadow,transform]
							enabled:cursor-pointer enabled:hover:z-10 enabled:hover:ring-2 enabled:hover:ring-(--ink)/40
							disabled:cursor-default"
						style="background: {cellFill(c)}; color: {cellInk(c)};"
						aria-label="{titleCase(row.theme.id)}, {colTitle(cols[i])}: {c.count} segments{c.count
							? ' — open quotes'
							: ''}"
						onclick={() => openCell(row.theme.id, cols[i], c)}
						onpointerenter={(e) => showTip(e, titleCase(row.theme.id), colTitle(cols[i]), c)}
						onpointermove={(e) => showTip(e, titleCase(row.theme.id), colTitle(cols[i]), c)}
						onpointerleave={() => (hovered = null)}
					>
						{cellText(c)}
					</button>
				{/each}
			{/each}
		</div>
	</div>

	<!-- Legend -->
	<div class="flex items-center gap-3 text-xs text-muted-foreground">
		{#if metric === 'count'}
			<span>Fewer segments</span>
			<div
				class="h-3 w-40 rounded-sm"
				style="background: linear-gradient(to right, #EEF1EC, #294457)"
			></div>
			<span>More ({maxCount})</span>
		{:else}
			<span>Negative</span>
			<div
				class="h-3 w-40 rounded-sm"
				style="background: linear-gradient(to right,
					{sentimentScale(-2)}, {sentimentScale(-1)}, {sentimentScale(0)},
					{sentimentScale(1)}, {sentimentScale(2)})"
			></div>
			<span>Positive</span>
		{/if}
		<span class="text-(--ink)/40">· click a cell for its quotes</span>
	</div>

	{#if hovered}
		<div
			class="pointer-events-none absolute z-20 max-w-64 rounded-md border border-(--ink)/15 bg-(--paper) px-2.5 py-1.5 text-xs shadow-md"
			style="left: {hovered.x + 14}px; top: {hovered.y + 14}px"
		>
			<div class="font-semibold text-foreground">{hovered.theme}</div>
			<div class="text-(--ink)/55">{hovered.col}</div>
			<div class="mt-0.5 text-muted-foreground">
				{hovered.c.count} tagged {hovered.c.count === 1 ? 'segment' : 'segments'}
				{#if hovered.c.sentiment !== null}
					· avg sentiment {hovered.c.sentiment.toFixed(2)}
					({SENTIMENT_LABELS[Math.round(hovered.c.sentiment)]})
				{/if}
			</div>
			{#if hovered.c.count > 0}
				<div class="mt-0.5 text-(--ink)/40">Click to open quotes</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Cell drawer — word usage + quotes/fragments for one theme × facet -->
<RightDrawer bind:open={drawerOpen}>
	<div class="flex h-full flex-col">
		<div class="flex flex-col gap-1 border-b border-slate-200 p-6">
			<span class="caption uppercase text-accent-mint">
				{axis === 'participant' ? 'Participant' : 'Question'} · {drawerContextLabel}
			</span>
			<h2 class="font-heading text-3xl font-light uppercase text-primary">
				{drawerThemeLabel}
			</h2>
			<p class="text-sm text-muted-foreground">
				{drawerQuotes.length} pull {drawerQuotes.length === 1 ? 'quote' : 'quotes'} ·
				{drawerFragments.length} coded
				{drawerFragments.length === 1 ? 'fragment' : 'fragments'}
			</p>
		</div>

		<div class="flex flex-1 flex-col gap-7 overflow-y-auto p-6">
			<!-- Keyword usage across this cell's coded fragments -->
			{#if drawerKeywordBlocks.length}
				<section class="flex flex-col gap-2">
					<h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Word usage · {drawerKeywordBlocks.length}
						{drawerKeywordBlocks.length === 1 ? 'keyword' : 'keywords'}
					</h3>
					<p class="text-xs text-muted-foreground">
						Lexicon keywords found in the {drawerFragments.length} coded
						{drawerFragments.length === 1 ? 'fragment' : 'fragments'} for this theme here, by
						mention count.
					</p>
					<div class="mt-1 flex flex-col gap-1.5">
						{#each drawerKeywordBlocks.slice(0, 12) as kb (kb.keywordId)}
							<div title={kb.categoryLabel}>
								<SentimentBar
									label={kb.keywordLabel}
									blocks={kb.blocks}
									max={maxKeywordCount}
									labelClass="w-36"
								/>
							</div>
						{/each}
					</div>
					{#if drawerKeywordBlocks.length > 12}
						<p class="text-xs text-slate-400">
							+{drawerKeywordBlocks.length - 12} more
						</p>
					{/if}
				</section>
			{/if}

			<!-- Pull quotes -->
			{#if drawerQuotes.length}
				<section class="flex flex-col gap-3">
					<h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Pull quotes · {drawerQuotes.length}
					</h3>
					{#each drawerQuotes as q (q.quote_id)}
						<article class="rounded-lg border border-slate-200 bg-white p-4">
							<div class="flex items-center justify-between gap-3">
								<span class="font-mono text-xs text-slate-400">{q.quote_id}</span>
								<span class="text-xs text-slate-400">
									score
									<span class="ml-1 text-base font-light text-accent-mint">
										{q.quote_score.overall}
									</span>
								</span>
							</div>
							<blockquote
								class="mt-2 border-l-2 border-accent-mint pl-3 text-base leading-relaxed text-slate-800"
							>
								<KeywordText text={q.text} />
							</blockquote>
							<div class="mt-2 flex flex-wrap gap-1">
								{#each q.emotions as e (e)}
									<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
										{titleCase(e)}
									</span>
								{/each}
								<span class="rounded-full px-2 py-0.5 text-xs {sentimentClass(q.sentiment)}">
									{SENTIMENT_LABELS[q.sentiment]}
								</span>
							</div>
						</article>
					{/each}
				</section>
			{/if}

			<!-- All coded fragments -->
			<section class="flex flex-col gap-2">
				<h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
					Coded fragments · {drawerFragments.length}
				</h3>
				<p class="text-xs text-muted-foreground">
					Every response segment tagged with this theme here. Tinted rows are already part of a
					pull quote above.
				</p>
				{#each drawerFragments as f (f.segment_id)}
					<CodedFragmentCard fragment={f} />
				{:else}
					<p
						class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500"
					>
						No coded fragments for this cell.
					</p>
				{/each}
			</section>
		</div>
	</div>
</RightDrawer>

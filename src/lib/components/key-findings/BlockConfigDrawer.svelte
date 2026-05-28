<!--
	BlockConfigDrawer — the contextual right drawer for configuring non-text blocks.

	Opens for quote / distribution / word-cloud blocks (rich text is edited inline
	and never opens it). It edits a *draft* copy of the block so changes can be
	previewed and either Applied or Cancelled. Contextual content:
	  - quote        — starred-first quote picker with search/sort/filters, a
	                   "write your own" option, and attribution fields.
	  - distribution — bar/donut + sentiment/theme + title/caption + filters.
	  - wordcloud    — presets + filters + title/caption.
	Each exposes the shared filter dropdowns the spec calls for and a live preview.
-->
<script lang="ts">
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import MiniDonut from './blocks/MiniDonut.svelte';
	import SemiArcChart from './blocks/SemiArcChart.svelte';
	import WordCloud from '$lib/charts/glp/WordCloud.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Search, RotateCcw, Check, Star } from '@lucide/svelte';
	import {
		quotes,
		questionLabel,
		participantLabel,
		titleCase,
		SENTIMENT_LABELS
	} from '$lib/content/wctglpdemo-data/analysis';
	import { profileName, type ParticipantProfile } from '$lib/types/participant-profile';
	import {
		buildDistribution,
		buildWordCloud,
		WORDCLOUD_PRESETS,
		PERSONA_OPTIONS,
		THEME_OPTIONS,
		QUESTION_OPTIONS,
		SENTIMENT_OPTIONS
	} from '$lib/key-findings/widgets';
	import {
		emptyFilters,
		type Block,
		type BlockFilters,
		type QuoteBlock,
		type DistributionBlock,
		type WordCloudBlock,
		type QuoteLayout,
		type QuoteReveal,
		type ComparisonBlock,
		type ComparisonMicroKind,
		type ComparisonLayout,
		type CohortSpecJSON,
		type HeroStatBlock,
		type HeroStatMicro,
		type HeroStatLayout,
		type QuotePullBlock,
		type QuotePullBackground,
		type QuotePullReveal
	} from '$lib/key-findings/types';
	import { buildCohort, THEME_PALETTE } from '$lib/key-findings/data-shapes';

	let {
		open = $bindable(false),
		block,
		profiles,
		starredQuoteIds = [],
		onApply
	}: {
		open?: boolean;
		block: Block | null;
		profiles: Record<string, ParticipantProfile>;
		starredQuoteIds?: string[];
		onApply: (patch: Partial<Block>) => void;
	} = $props();

	// Draft copy — edited freely, committed only on Apply.
	let draft = $state<Block | null>(null);
	let lastId = $state<string | null>(null);
	$effect(() => {
		if (open && block && block.id !== lastId) {
			draft = structuredClone($state.snapshot(block)) as Block;
			lastId = block.id;
		}
		// Re-clone on the next open (so cancel-then-reopen starts fresh).
		if (!open) lastId = null;
	});

	// Each change applies to the card immediately and the drawer stays open, so
	// the analyst can keep trying options. (No staged draft / Apply step.)
	function commit() {
		if (draft) onApply(structuredClone($state.snapshot(draft)) as Partial<Block>);
	}
	function patch(p: Record<string, unknown>) {
		if (draft) {
			Object.assign(draft, p);
			commit();
		}
	}
	function setFilter(key: keyof BlockFilters, value: unknown) {
		if (draft && 'filters' in draft) {
			(draft.filters as BlockFilters)[key] = value as never;
			commit();
		}
	}
	function resetFilters() {
		if (draft && 'filters' in draft) {
			draft.filters = emptyFilters();
			commit();
		}
	}
	function done() {
		open = false;
	}

	// ---- Quote picker state -------------------------------------------------
	let query = $state('');
	let sort = $state<'score' | 'sentiment' | 'participant'>('score');

	const quoteResults = $derived.by(() => {
		const q = draft as QuoteBlock | null;
		const f = q?.filters ?? emptyFilters();
		const needle = query.trim().toLowerCase();
		let list = quotes.filter((quote) => {
			if (f.participantId && quote.interview_id !== f.participantId) return false;
			if (f.theme && !quote.themes.includes(f.theme)) return false;
			if (f.sentiment != null && quote.sentiment !== f.sentiment) return false;
			if (f.questionId && quote.question_id !== f.questionId) return false;
			if (needle && !quote.text.toLowerCase().includes(needle) && !participantLabel(quote.interview_id).toLowerCase().includes(needle)) return false;
			return true;
		});
		const starred = new Set(starredQuoteIds);
		list = [...list].sort((a, b) => {
			// Starred quotes always float to the top.
			const sa = starred.has(a.quote_id) ? 1 : 0;
			const sb = starred.has(b.quote_id) ? 1 : 0;
			if (sa !== sb) return sb - sa;
			if (sort === 'sentiment') return b.sentiment - a.sentiment;
			if (sort === 'participant') return a.interview_id.localeCompare(b.interview_id);
			return b.quote_score.overall - a.quote_score.overall;
		});
		return list.slice(0, 80);
	});

	function selectQuote(quoteId: string) {
		const quote = quotes.find((x) => x.quote_id === quoteId);
		if (!quote) return;
		patch({
			quoteId: quote.quote_id,
			text: quote.text,
			sentiment: quote.sentiment,
			interviewId: quote.interview_id,
			questionId: quote.question_id,
			themes: quote.themes,
			attribution: profileName(profiles[quote.interview_id], participantLabel(quote.interview_id))
		});
	}
	function writeOwn() {
		patch({ quoteId: null, text: 'Type the quote here…', sentiment: 0, interviewId: '', questionId: '', themes: [] });
	}

	const LAYOUTS: { id: QuoteLayout; label: string }[] = [
		{ id: 'pull', label: 'Pull quote' },
		{ id: 'card', label: 'Quote card' },
		{ id: 'banner', label: 'Banner' }
	];
	const REVEALS: { id: QuoteReveal; label: string }[] = [
		{ id: 'none', label: 'None' },
		{ id: 'fade', label: 'Fade' },
		{ id: 'word', label: 'Word' },
		{ id: 'typewriter', label: 'Typewriter' }
	];

	// ---- Comparison editor -------------------------------------------------
	const COMPARISON_LAYOUTS: { id: ComparisonLayout; label: string }[] = [
		{ id: 'split', label: 'Side by side' },
		{ id: 'stacked', label: 'Stacked' }
	];
	const COMPARISON_MICROS: { id: ComparisonMicroKind; label: string }[] = [
		{ id: 'topThemes', label: 'Top themes' },
		{ id: 'sentiment', label: 'Sentiment' },
		{ id: 'none', label: 'None' }
	];
	const COHORT_KINDS: { id: CohortSpecJSON['kind']; label: string }[] = [
		{ id: 'custom', label: 'Custom' },
		{ id: 'theme', label: 'Theme' },
		{ id: 'sentiment', label: 'Sentiment' }
	];
	const COMPARISON_PALETTE = THEME_PALETTE;

	/** Build a fresh spec when the analyst switches a side's `kind`. */
	function blankCohort(kind: CohortSpecJSON['kind'], color: string): CohortSpecJSON {
		if (kind === 'custom') return { kind: 'custom', label: 'Group', value: 0, unit: '%', color };
		if (kind === 'theme') return { kind: 'theme', themeId: THEME_OPTIONS[0]?.id ?? '', color, filters: emptyFilters() };
		return { kind: 'sentiment', sentimentBucket: 2, color, filters: emptyFilters() };
	}

	function patchSide(side: 'left' | 'right', next: Partial<CohortSpecJSON>) {
		const c = draft as ComparisonBlock | null;
		if (!c) return;
		const merged = { ...(c[side] as CohortSpecJSON), ...next } as CohortSpecJSON;
		// First real edit promotes the block out of placeholder state.
		patch({ [side]: merged, configured: true });
	}

	function setSideKind(side: 'left' | 'right', kind: CohortSpecJSON['kind']) {
		const c = draft as ComparisonBlock | null;
		if (!c) return;
		const existing = c[side] as CohortSpecJSON;
		patch({ [side]: blankCohort(kind, existing.color ?? COMPARISON_PALETTE[side === 'left' ? 0 : 2]), configured: true });
	}

	// ---- HeroStat editor ---------------------------------------------------
	const HEROSTAT_LAYOUTS: { id: HeroStatLayout; label: string }[] = [
		{ id: 'centered', label: 'Centered' },
		{ id: 'corner', label: 'Corner' }
	];
	const HEROSTAT_MICROS: { id: HeroStatMicro; label: string }[] = COMPARISON_MICROS as { id: HeroStatMicro; label: string }[];

	function patchCohort(next: Partial<CohortSpecJSON>) {
		const h = draft as HeroStatBlock | null;
		if (!h) return;
		const merged = { ...(h.cohort as CohortSpecJSON), ...next } as CohortSpecJSON;
		patch({ cohort: merged, configured: true });
	}

	function setCohortKind(kind: CohortSpecJSON['kind']) {
		const h = draft as HeroStatBlock | null;
		if (!h) return;
		patch({ cohort: blankCohort(kind, h.cohort.color ?? COMPARISON_PALETTE[0]), configured: true });
	}

	// ---- QuotePull editor --------------------------------------------------
	const QUOTEPULL_BACKGROUNDS: { id: QuotePullBackground; label: string }[] = [
		{ id: 'light', label: 'Light' },
		{ id: 'dark', label: 'Dark' },
		{ id: 'accent', label: 'Accent' }
	];
	const QUOTEPULL_REVEALS: { id: QuotePullReveal; label: string }[] = [
		{ id: 'none', label: 'None' },
		{ id: 'fade', label: 'Fade' },
		{ id: 'word', label: 'Word' },
		{ id: 'typewriter', label: 'Typewriter' }
	];

	function patchQuotePull(p: Partial<QuotePullBlock>) {
		patch({ ...p, configured: true });
	}

	// ---- Live previews ------------------------------------------------------
	const distPreview = $derived.by(() => {
		const d = draft as DistributionBlock | null;
		return d ? buildDistribution(d.metric, d.filters) : [];
	});
	const distMax = $derived(Math.max(1, ...distPreview.map((d) => d.value)));
	const wcPreview = $derived.by(() => {
		const w = draft as WordCloudBlock | null;
		return w ? buildWordCloud(w.filters, 60) : [];
	});
</script>

{#snippet filterRow(label: string, value: string, options: { id: string; label: string }[], onChange: (v: string) => void, placeholder = 'All')}
	<label class="flex items-center justify-between gap-3 text-sm">
		<span class="shrink-0 text-slate-600">{label}</span>
		<select class="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm" value={value} onchange={(e) => onChange(e.currentTarget.value)}>
			<option value="">{placeholder}</option>
			{#each options as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
		</select>
	</label>
{/snippet}

<RightDrawer bind:open>
	<div class="flex h-full flex-col">
		<header class="border-b border-slate-200 px-5 py-4">
			<h2 class="text-lg font-semibold text-slate-800" style="font-family: var(--font-body);">
				{#if draft?.kind === 'quote'}Configure quote{:else if draft?.kind === 'distribution'}Configure distribution{:else if draft?.kind === 'wordcloud'}Configure word cloud{:else if draft?.kind === 'comparison'}Configure comparison{:else if draft?.kind === 'herostat'}Configure hero stat{:else if draft?.kind === 'quotepull'}Configure quote pull{/if}
			</h2>
		</header>

		<div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
			{#if draft?.kind === 'quote'}
				{@const q = draft as QuoteBlock}
				<!-- Filters + search -->
				<div class="mb-3 space-y-2">
					<div class="flex items-center gap-2 rounded-md border border-slate-200 px-2">
						<Search class="size-4 text-slate-400" />
						<input class="w-full bg-transparent py-1.5 text-sm outline-none" placeholder="Search quotes or participants…" bind:value={query} />
					</div>
					<div class="grid grid-cols-2 gap-2">
						{@render filterRow('Persona', q.filters.participantId ?? '', PERSONA_OPTIONS, (v) => setFilter('participantId', v || null))}
						{@render filterRow('Theme', q.filters.theme ?? '', THEME_OPTIONS, (v) => setFilter('theme', v || null))}
						{@render filterRow('Question', q.filters.questionId ?? '', QUESTION_OPTIONS, (v) => setFilter('questionId', v || null))}
						{@render filterRow('Sentiment', q.filters.sentiment != null ? String(q.filters.sentiment) : '', SENTIMENT_OPTIONS, (v) => setFilter('sentiment', v === '' ? null : Number(v)))}
					</div>
					<div class="flex items-center justify-between">
						<label class="flex items-center gap-2 text-xs text-slate-500">
							Sort
							<select class="rounded-md border border-slate-200 px-1.5 py-1 text-xs" bind:value={sort}>
								<option value="score">Strategic value</option>
								<option value="sentiment">Sentiment</option>
								<option value="participant">Participant</option>
							</select>
						</label>
						<Button variant="ghost" size="xs" class="text-xs text-slate-500 hover:text-slate-800" onclick={resetFilters}><RotateCcw class="size-3.5" /> Reset filters</Button>
					</div>
				</div>

				<Button variant="outline" size="default" class="mb-2 w-full border-dashed border-slate-300 text-slate-600 hover:border-accent-mint hover:bg-slate-50" onclick={writeOwn}>
					+ Write your own quote
				</Button>

				<ul class="space-y-1.5">
					{#each quoteResults as quote (quote.quote_id)}
						{@const selected = q.quoteId === quote.quote_id}
						<li>
							<Button
								variant="outline"
								pressed={selected}
								activeClass="border-accent-mint bg-accent-mint/5"
								class="h-auto w-full flex-col items-start gap-1 rounded-lg border-slate-150 p-3 text-left hover:border-slate-300 hover:bg-slate-50"
								onclick={() => selectQuote(quote.quote_id)}
							>
								<p class="line-clamp-3 text-sm text-slate-700">"{quote.text}"</p>
								<div class="flex w-full items-center gap-2 text-xs text-slate-500">
									{#if starredQuoteIds.includes(quote.quote_id)}<Star class="size-3 fill-amber-400 text-amber-400" />{/if}
									<span class="font-medium">{profileName(profiles[quote.interview_id], participantLabel(quote.interview_id))}</span>
									<span class="text-slate-300">·</span>
									<span class="truncate">{questionLabel(quote.question_id)}</span>
									<span class="ml-auto shrink-0">{SENTIMENT_LABELS[quote.sentiment]}</span>
									{#if selected}<Check class="size-4 text-accent-mint" />{/if}
								</div>
							</Button>
						</li>
					{:else}
						<li class="py-8 text-center text-sm text-slate-400">No quotes match these filters.</li>
					{/each}
				</ul>

				<!-- Attribution + style -->
				<div class="mt-4 space-y-2 rounded-lg bg-slate-50 p-3">
					<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Attribution & style</p>
					<div class="grid grid-cols-2 gap-2">
						<label class="text-xs text-slate-600">Attribution<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={q.attribution} oninput={(e) => patch({ attribution: e.currentTarget.value })} /></label>
						<label class="text-xs text-slate-600">Persona<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" placeholder="e.g. Patient" value={q.persona} oninput={(e) => patch({ persona: e.currentTarget.value })} /></label>
						<label class="text-xs text-slate-600">Role<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" placeholder="e.g. Caregiver" value={q.role} oninput={(e) => patch({ role: e.currentTarget.value })} /></label>
						<label class="text-xs text-slate-600">Source<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" placeholder="e.g. Interview 06" value={q.source} oninput={(e) => patch({ source: e.currentTarget.value })} /></label>
					</div>
					<div class="flex flex-wrap gap-3">
						<div>
							<span class="text-xs text-slate-500">Layout</span>
							<div class="mt-0.5 flex gap-1">
								{#each LAYOUTS as l (l.id)}<Button variant="outline" size="xs" pressed={q.layout === l.id} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => patch({ layout: l.id })}>{l.label}</Button>{/each}
							</div>
						</div>
						<div>
							<span class="text-xs text-slate-500">Reveal</span>
							<div class="mt-0.5 flex gap-1">
								{#each REVEALS as r (r.id)}<Button variant="outline" size="xs" pressed={q.reveal === r.id} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => patch({ reveal: r.id })}>{r.label}</Button>{/each}
							</div>
						</div>
					</div>
				</div>
			{:else if draft?.kind === 'distribution'}
				{@const d = draft as DistributionBlock}
				<div class="space-y-3">
					<div class="flex gap-4">
						<div>
							<span class="text-xs text-slate-500">Metric</span>
							<div class="mt-0.5 flex gap-1">
								<Button variant="outline" size="sm" pressed={d.metric === 'sentiment'} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => patch({ metric: 'sentiment' })}>Sentiment</Button>
								<Button variant="outline" size="sm" pressed={d.metric === 'theme'} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => patch({ metric: 'theme' })}>Theme</Button>
							</div>
						</div>
						<div>
							<span class="text-xs text-slate-500">Chart</span>
							<div class="mt-0.5 flex gap-1">
								<Button variant="outline" size="sm" pressed={d.chartType === 'bar'} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => patch({ chartType: 'bar' })}>Bar</Button>
								<Button variant="outline" size="sm" pressed={d.chartType === 'donut'} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => patch({ chartType: 'donut' })}>Donut</Button>
								<Button variant="outline" size="sm" pressed={d.chartType === 'semi-arc'} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => patch({ chartType: 'semi-arc' })}>Arc</Button>
							</div>
						</div>
					</div>
					<label class="block text-xs text-slate-600">Title<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={d.title} oninput={(e) => patch({ title: e.currentTarget.value })} /></label>
					<label class="block text-xs text-slate-600">Caption<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={d.caption} oninput={(e) => patch({ caption: e.currentTarget.value })} /></label>

					<div class="space-y-2 rounded-lg bg-slate-50 p-3">
						<div class="flex items-center justify-between">
							<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Filters</p>
							<Button variant="ghost" size="xs" class="text-xs text-slate-500 hover:text-slate-800" onclick={resetFilters}><RotateCcw class="size-3.5" /> Reset</Button>
						</div>
						{@render filterRow('Persona', d.filters.participantId ?? '', PERSONA_OPTIONS, (v) => setFilter('participantId', v || null))}
						{@render filterRow('Theme', d.filters.theme ?? '', THEME_OPTIONS, (v) => setFilter('theme', v || null))}
						{@render filterRow('Question', d.filters.questionId ?? '', QUESTION_OPTIONS, (v) => setFilter('questionId', v || null))}
						{@render filterRow('Sentiment', d.filters.sentiment != null ? String(d.filters.sentiment) : '', SENTIMENT_OPTIONS, (v) => setFilter('sentiment', v === '' ? null : Number(v)))}
					</div>

					<!-- Preview -->
					<div class="rounded-lg border border-slate-200 p-3">
						<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</p>
						{#if d.chartType === 'donut'}
							<div class="flex justify-center"><MiniDonut data={distPreview} size={160} /></div>
						{:else if d.chartType === 'semi-arc'}
							<div class="flex justify-center"><SemiArcChart data={distPreview} size={200} /></div>
						{:else}
							<ul class="space-y-1.5">
								{#each distPreview as row (row.label)}
									<li class="flex items-center gap-2 text-xs">
										<span class="w-28 shrink-0 truncate text-slate-600">{row.label}</span>
										<span class="h-3 rounded-sm" style="width: {(row.value / distMax) * 100}%; min-width: 2px; background: {row.color};"></span>
										<span class="text-slate-400">{row.value}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			{:else if draft?.kind === 'wordcloud'}
				{@const w = draft as WordCloudBlock}
				<div class="space-y-3">
					<div>
						<span class="text-xs text-slate-500">Preset</span>
						<div class="mt-0.5 flex flex-wrap gap-1">
							{#each WORDCLOUD_PRESETS as p (p.id)}
								<Button variant="outline" size="sm" pressed={w.preset === p.id} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => { patch({ preset: p.id, filters: p.apply(w.filters) }); }}>{p.label}</Button>
							{/each}
						</div>
					</div>
					<label class="block text-xs text-slate-600">Title<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={w.title} oninput={(e) => patch({ title: e.currentTarget.value })} /></label>
					<label class="block text-xs text-slate-600">Caption<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={w.caption} oninput={(e) => patch({ caption: e.currentTarget.value })} /></label>

					<div class="space-y-2 rounded-lg bg-slate-50 p-3">
						<div class="flex items-center justify-between">
							<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Filters</p>
							<Button variant="ghost" size="xs" class="text-xs text-slate-500 hover:text-slate-800" onclick={resetFilters}><RotateCcw class="size-3.5" /> Reset</Button>
						</div>
						{@render filterRow('Persona', w.filters.participantId ?? '', PERSONA_OPTIONS, (v) => setFilter('participantId', v || null))}
						{@render filterRow('Theme', w.filters.theme ?? '', THEME_OPTIONS, (v) => setFilter('theme', v || null))}
						{@render filterRow('Question', w.filters.questionId ?? '', QUESTION_OPTIONS, (v) => setFilter('questionId', v || null))}
						{@render filterRow('Sentiment', w.filters.sentiment != null ? String(w.filters.sentiment) : '', SENTIMENT_OPTIONS, (v) => setFilter('sentiment', v === '' ? null : Number(v)))}
					</div>

					<div class="rounded-lg border border-slate-200 p-3">
						<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</p>
						{#key `${w.filters.participantId}:${w.filters.theme}:${w.filters.sentiment}:${w.filters.questionId}`}
							<WordCloud words={wcPreview} width={360} height={220} interactive={false} editable={false} />
						{/key}
					</div>
				</div>
			{:else if draft?.kind === 'comparison'}
				{@const c = draft as ComparisonBlock}
				{@const leftPreview = buildCohort(c.left, undefined, c.micro)}
				{@const rightPreview = buildCohort(c.right, undefined, c.micro)}
				<div class="space-y-3">
					<div class="flex flex-wrap gap-4">
						<div>
							<span class="text-xs text-slate-500">Layout</span>
							<div class="mt-0.5 flex gap-1">
								{#each COMPARISON_LAYOUTS as l (l.id)}
									<Button variant="outline" size="sm" pressed={c.layout === l.id} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => patch({ layout: l.id })}>{l.label}</Button>
								{/each}
							</div>
						</div>
						<div>
							<span class="text-xs text-slate-500">Micro-viz</span>
							<div class="mt-0.5 flex gap-1">
								{#each COMPARISON_MICROS as m (m.id)}
									<Button variant="outline" size="sm" pressed={c.micro === m.id} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => patch({ micro: m.id })}>{m.label}</Button>
								{/each}
							</div>
						</div>
					</div>
					<label class="block text-xs text-slate-600">Title<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={c.title} oninput={(e) => patch({ title: e.currentTarget.value })} /></label>
					<label class="block text-xs text-slate-600">Caption<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={c.caption} oninput={(e) => patch({ caption: e.currentTarget.value })} /></label>

					{#each ['left', 'right'] as const as side (side)}
						{@const spec = side === 'left' ? c.left : c.right}
						<div class="space-y-2 rounded-lg bg-slate-50 p-3">
							<div class="flex items-center justify-between">
								<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">{side === 'left' ? 'Left' : 'Right'} cohort</p>
								<div class="flex gap-1">
									{#each COHORT_KINDS as k (k.id)}
										<Button variant="outline" size="xs" pressed={spec.kind === k.id} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => setSideKind(side, k.id)}>{k.label}</Button>
									{/each}
								</div>
							</div>

							<div>
								<span class="text-xs text-slate-500">Accent</span>
								<div class="mt-0.5 flex flex-wrap gap-1">
									{#each COMPARISON_PALETTE as hex (hex)}
										<button
											type="button"
											class="size-5 rounded-full border-2 {spec.color === hex ? 'border-slate-700' : 'border-transparent'} transition"
											style="background: {hex};"
											aria-label="Pick accent {hex}"
											onclick={() => patchSide(side, { color: hex })}
										></button>
									{/each}
								</div>
							</div>

							{#if spec.kind === 'custom'}
								<div class="grid grid-cols-2 gap-2">
									<label class="text-xs text-slate-600">Label
										<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={spec.label} oninput={(e) => patchSide(side, { label: e.currentTarget.value })} />
									</label>
									<label class="text-xs text-slate-600">Sublabel
										<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={spec.sublabel ?? ''} placeholder="e.g. of 12 participants" oninput={(e) => patchSide(side, { sublabel: e.currentTarget.value })} />
									</label>
									<label class="text-xs text-slate-600">Value
										<input type="number" class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm tabular-nums" value={spec.value} oninput={(e) => patchSide(side, { value: Number(e.currentTarget.value) || 0 })} />
									</label>
									<label class="text-xs text-slate-600">Unit
										<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={spec.unit ?? ''} placeholder="% / M / mentions" oninput={(e) => patchSide(side, { unit: e.currentTarget.value })} />
									</label>
									<label class="col-span-2 text-xs text-slate-600">Caption
										<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={spec.caption ?? ''} placeholder="e.g. RENEWABLES" oninput={(e) => patchSide(side, { caption: e.currentTarget.value })} />
									</label>
								</div>
							{:else if spec.kind === 'theme'}
								<label class="block text-xs text-slate-600">Theme
									<select class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={spec.themeId} onchange={(e) => patchSide(side, { themeId: e.currentTarget.value })}>
										{#each THEME_OPTIONS as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
									</select>
								</label>
								<label class="block text-xs text-slate-600">Override label
									<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={spec.label ?? ''} placeholder="(use theme name)" oninput={(e) => patchSide(side, { label: e.currentTarget.value })} />
								</label>
							{:else}
								<label class="block text-xs text-slate-600">Sentiment
									<select class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={String(spec.sentimentBucket)} onchange={(e) => patchSide(side, { sentimentBucket: Number(e.currentTarget.value) as -2 | -1 | 0 | 1 | 2 })}>
										{#each SENTIMENT_OPTIONS as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
									</select>
								</label>
								<label class="block text-xs text-slate-600">Override label
									<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={spec.label ?? ''} placeholder="(use sentiment name)" oninput={(e) => patchSide(side, { label: e.currentTarget.value })} />
								</label>
							{/if}
						</div>
					{/each}

					<div class="rounded-lg border border-slate-200 p-3">
						<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</p>
						<div class="flex items-stretch gap-3 text-sm">
							<div class="flex-1 rounded-md p-2" style="border-left: 3px solid {leftPreview.color ?? '#cbd5e1'};">
								<p class="text-xs font-semibold" style="color: {leftPreview.color};">{leftPreview.label}</p>
								<p class="font-heading text-2xl font-bold tabular-nums text-slate-900">{leftPreview.value}{leftPreview.unit ?? ''}</p>
								{#if leftPreview.sublabel}<p class="text-[11px] text-slate-500">{leftPreview.sublabel}</p>{/if}
							</div>
							<div class="flex-1 rounded-md p-2" style="border-left: 3px solid {rightPreview.color ?? '#cbd5e1'};">
								<p class="text-xs font-semibold" style="color: {rightPreview.color};">{rightPreview.label}</p>
								<p class="font-heading text-2xl font-bold tabular-nums text-slate-900">{rightPreview.value}{rightPreview.unit ?? ''}</p>
								{#if rightPreview.sublabel}<p class="text-[11px] text-slate-500">{rightPreview.sublabel}</p>{/if}
							</div>
						</div>
					</div>
				</div>
			{:else if draft?.kind === 'herostat'}
				{@const h = draft as HeroStatBlock}
				{@const heroPreview = buildCohort(h.cohort, undefined, h.micro)}
				<div class="space-y-3">
					<div class="flex flex-wrap gap-4">
						<div>
							<span class="text-xs text-slate-500">Layout</span>
							<div class="mt-0.5 flex gap-1">
								{#each HEROSTAT_LAYOUTS as l (l.id)}
									<Button variant="outline" size="sm" pressed={h.layout === l.id} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => patch({ layout: l.id })}>{l.label}</Button>
								{/each}
							</div>
						</div>
						<div>
							<span class="text-xs text-slate-500">Micro-viz</span>
							<div class="mt-0.5 flex gap-1">
								{#each HEROSTAT_MICROS as m (m.id)}
									<Button variant="outline" size="sm" pressed={h.micro === m.id} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => patch({ micro: m.id })}>{m.label}</Button>
								{/each}
							</div>
						</div>
					</div>
					<label class="block text-xs text-slate-600">Title<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={h.title} oninput={(e) => patch({ title: e.currentTarget.value })} /></label>
					<label class="block text-xs text-slate-600">Caption<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={h.caption} oninput={(e) => patch({ caption: e.currentTarget.value })} /></label>

					<div class="space-y-2 rounded-lg bg-slate-50 p-3">
						<div class="flex items-center justify-between">
							<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Cohort</p>
							<div class="flex gap-1">
								{#each COHORT_KINDS as k (k.id)}
									<Button variant="outline" size="xs" pressed={h.cohort.kind === k.id} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => setCohortKind(k.id)}>{k.label}</Button>
								{/each}
							</div>
						</div>

						<div>
							<span class="text-xs text-slate-500">Accent</span>
							<div class="mt-0.5 flex flex-wrap gap-1">
								{#each COMPARISON_PALETTE as hex (hex)}
									<button type="button" class="size-5 rounded-full border-2 {h.cohort.color === hex ? 'border-slate-700' : 'border-transparent'} transition" style="background: {hex};" aria-label="Pick accent {hex}" onclick={() => patchCohort({ color: hex })}></button>
								{/each}
							</div>
						</div>

						{#if h.cohort.kind === 'custom'}
							{@const cust = h.cohort}
							<div class="grid grid-cols-2 gap-2">
								<label class="text-xs text-slate-600">Label<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={cust.label} oninput={(e) => patchCohort({ label: e.currentTarget.value })} /></label>
								<label class="text-xs text-slate-600">Sublabel<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={cust.sublabel ?? ''} placeholder="e.g. of 12 participants" oninput={(e) => patchCohort({ sublabel: e.currentTarget.value })} /></label>
								<label class="text-xs text-slate-600">Value<input type="number" class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm tabular-nums" value={cust.value} oninput={(e) => patchCohort({ value: Number(e.currentTarget.value) || 0 })} /></label>
								<label class="text-xs text-slate-600">Unit<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={cust.unit ?? ''} placeholder="% / M / mentions" oninput={(e) => patchCohort({ unit: e.currentTarget.value })} /></label>
								<label class="col-span-2 text-xs text-slate-600">Caption<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={cust.caption ?? ''} placeholder="e.g. RENEWABLES" oninput={(e) => patchCohort({ caption: e.currentTarget.value })} /></label>
							</div>
						{:else if h.cohort.kind === 'theme'}
							{@const tspec = h.cohort}
							<label class="block text-xs text-slate-600">Theme<select class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={tspec.themeId} onchange={(e) => patchCohort({ themeId: e.currentTarget.value })}>{#each THEME_OPTIONS as o (o.id)}<option value={o.id}>{o.label}</option>{/each}</select></label>
							<label class="block text-xs text-slate-600">Override label<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={tspec.label ?? ''} placeholder="(use theme name)" oninput={(e) => patchCohort({ label: e.currentTarget.value })} /></label>
						{:else}
							{@const sspec = h.cohort}
							<label class="block text-xs text-slate-600">Sentiment<select class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={String(sspec.sentimentBucket)} onchange={(e) => patchCohort({ sentimentBucket: Number(e.currentTarget.value) as -2 | -1 | 0 | 1 | 2 })}>{#each SENTIMENT_OPTIONS as o (o.id)}<option value={o.id}>{o.label}</option>{/each}</select></label>
							<label class="block text-xs text-slate-600">Override label<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={sspec.label ?? ''} placeholder="(use sentiment name)" oninput={(e) => patchCohort({ label: e.currentTarget.value })} /></label>
						{/if}
					</div>

					<div class="rounded-lg border border-slate-200 p-3">
						<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Preview</p>
						<div class="rounded-md p-3" style="border-left: 3px solid {heroPreview.color ?? '#cbd5e1'};">
							<p class="text-xs font-semibold" style="color: {heroPreview.color};">{heroPreview.label}</p>
							<p class="font-heading text-3xl font-bold tabular-nums text-slate-900">{heroPreview.value}{heroPreview.unit ?? ''}</p>
							{#if heroPreview.sublabel}<p class="text-[11px] text-slate-500">{heroPreview.sublabel}</p>{/if}
							{#if heroPreview.caption}<p class="text-[11px] font-semibold uppercase tracking-wider" style="color: {heroPreview.color};">{heroPreview.caption}</p>{/if}
						</div>
					</div>
				</div>
			{:else if draft?.kind === 'quotepull'}
				{@const qp = draft as QuotePullBlock}
				<div class="space-y-3">
					<label class="block text-xs text-slate-600">Quote
						<textarea
							class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm leading-snug"
							rows="4"
							placeholder="Paste the quote here…"
							value={qp.text}
							oninput={(e) => patchQuotePull({ text: e.currentTarget.value })}
						></textarea>
					</label>
					<div class="grid grid-cols-2 gap-2">
						<label class="text-xs text-slate-600">Attribution<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={qp.attribution} placeholder="e.g. Patient, age 42" oninput={(e) => patchQuotePull({ attribution: e.currentTarget.value })} /></label>
						<label class="text-xs text-slate-600">Context<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={qp.context} placeholder="e.g. Interview 06" oninput={(e) => patchQuotePull({ context: e.currentTarget.value })} /></label>
						<label class="text-xs text-slate-600">Theme chip<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={qp.themeLabel} placeholder="Optional" oninput={(e) => patchQuotePull({ themeLabel: e.currentTarget.value })} /></label>
						<label class="text-xs text-slate-600">Sentiment
							<select class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={String(qp.sentiment)} onchange={(e) => patchQuotePull({ sentiment: Number(e.currentTarget.value) })}>
								{#each SENTIMENT_OPTIONS as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
							</select>
						</label>
					</div>

					<div>
						<span class="text-xs text-slate-500">Background</span>
						<div class="mt-0.5 flex gap-1">
							{#each QUOTEPULL_BACKGROUNDS as b (b.id)}
								<Button variant="outline" size="sm" pressed={qp.background === b.id} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => patchQuotePull({ background: b.id })}>{b.label}</Button>
							{/each}
						</div>
					</div>

					<div>
						<span class="text-xs text-slate-500">Accent</span>
						<div class="mt-0.5 flex flex-wrap gap-1">
							{#each COMPARISON_PALETTE as hex (hex)}
								<button type="button" class="size-5 rounded-full border-2 {qp.accentColor === hex ? 'border-slate-700' : 'border-transparent'} transition" style="background: {hex};" aria-label="Pick accent {hex}" onclick={() => patchQuotePull({ accentColor: hex })}></button>
							{/each}
						</div>
					</div>

					<div>
						<span class="text-xs text-slate-500">Reveal</span>
						<div class="mt-0.5 flex gap-1">
							{#each QUOTEPULL_REVEALS as r (r.id)}
								<Button variant="outline" size="sm" pressed={qp.reveal === r.id} activeClass="border-accent-mint bg-accent-mint/10" class="rounded-md border-slate-200 text-slate-600" onclick={() => patchQuotePull({ reveal: r.id })}>{r.label}</Button>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		</div>

		<footer class="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
			<span class="text-xs text-slate-400">Selections apply to the card as you go.</span>
			<Button variant="secondary" size="sm" onclick={done}>Done</Button>
		</footer>
	</div>
</RightDrawer>

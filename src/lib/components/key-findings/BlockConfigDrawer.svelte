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
	import WordCloud from '$lib/charts/glp/WordCloud.svelte';
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
		type QuoteReveal
	} from '$lib/key-findings/types';

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
				{#if draft?.kind === 'quote'}Configure quote{:else if draft?.kind === 'distribution'}Configure distribution{:else if draft?.kind === 'wordcloud'}Configure word cloud{/if}
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
						<button class="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800" onclick={resetFilters}><RotateCcw class="size-3.5" /> Reset filters</button>
					</div>
				</div>

				<button class="mb-2 w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm text-slate-600 hover:border-accent-mint hover:bg-slate-50" onclick={writeOwn}>
					+ Write your own quote
				</button>

				<ul class="space-y-1.5">
					{#each quoteResults as quote (quote.quote_id)}
						{@const selected = q.quoteId === quote.quote_id}
						<li>
							<button
								type="button"
								class="flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition-colors {selected ? 'border-accent-mint bg-accent-mint/5' : 'border-slate-150 hover:border-slate-300 hover:bg-slate-50'}"
								onclick={() => selectQuote(quote.quote_id)}
							>
								<p class="line-clamp-3 text-sm text-slate-700">"{quote.text}"</p>
								<div class="flex items-center gap-2 text-xs text-slate-500">
									{#if starredQuoteIds.includes(quote.quote_id)}<Star class="size-3 fill-amber-400 text-amber-400" />{/if}
									<span class="font-medium">{profileName(profiles[quote.interview_id], participantLabel(quote.interview_id))}</span>
									<span class="text-slate-300">·</span>
									<span class="truncate">{questionLabel(quote.question_id)}</span>
									<span class="ml-auto shrink-0">{SENTIMENT_LABELS[quote.sentiment]}</span>
									{#if selected}<Check class="size-4 text-accent-mint" />{/if}
								</div>
							</button>
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
								{#each LAYOUTS as l (l.id)}<button class="rounded-md border px-2 py-1 text-xs {q.layout === l.id ? 'border-accent-mint bg-accent-mint/10' : 'border-slate-200 text-slate-600'}" onclick={() => patch({ layout: l.id })}>{l.label}</button>{/each}
							</div>
						</div>
						<div>
							<span class="text-xs text-slate-500">Reveal</span>
							<div class="mt-0.5 flex gap-1">
								{#each REVEALS as r (r.id)}<button class="rounded-md border px-2 py-1 text-xs {q.reveal === r.id ? 'border-accent-mint bg-accent-mint/10' : 'border-slate-200 text-slate-600'}" onclick={() => patch({ reveal: r.id })}>{r.label}</button>{/each}
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
								<button class="rounded-md border px-2.5 py-1 text-sm {d.metric === 'sentiment' ? 'border-accent-mint bg-accent-mint/10' : 'border-slate-200 text-slate-600'}" onclick={() => patch({ metric: 'sentiment' })}>Sentiment</button>
								<button class="rounded-md border px-2.5 py-1 text-sm {d.metric === 'theme' ? 'border-accent-mint bg-accent-mint/10' : 'border-slate-200 text-slate-600'}" onclick={() => patch({ metric: 'theme' })}>Theme</button>
							</div>
						</div>
						<div>
							<span class="text-xs text-slate-500">Chart</span>
							<div class="mt-0.5 flex gap-1">
								<button class="rounded-md border px-2.5 py-1 text-sm {d.chartType === 'bar' ? 'border-accent-mint bg-accent-mint/10' : 'border-slate-200 text-slate-600'}" onclick={() => patch({ chartType: 'bar' })}>Bar</button>
								<button class="rounded-md border px-2.5 py-1 text-sm {d.chartType === 'donut' ? 'border-accent-mint bg-accent-mint/10' : 'border-slate-200 text-slate-600'}" onclick={() => patch({ chartType: 'donut' })}>Donut</button>
							</div>
						</div>
					</div>
					<label class="block text-xs text-slate-600">Title<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={d.title} oninput={(e) => patch({ title: e.currentTarget.value })} /></label>
					<label class="block text-xs text-slate-600">Caption<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={d.caption} oninput={(e) => patch({ caption: e.currentTarget.value })} /></label>

					<div class="space-y-2 rounded-lg bg-slate-50 p-3">
						<div class="flex items-center justify-between">
							<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Filters</p>
							<button class="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800" onclick={resetFilters}><RotateCcw class="size-3.5" /> Reset</button>
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
								<button class="rounded-md border px-2.5 py-1 text-sm {w.preset === p.id ? 'border-accent-mint bg-accent-mint/10' : 'border-slate-200 text-slate-600'}" onclick={() => { patch({ preset: p.id, filters: p.apply(w.filters) }); }}>{p.label}</button>
							{/each}
						</div>
					</div>
					<label class="block text-xs text-slate-600">Title<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={w.title} oninput={(e) => patch({ title: e.currentTarget.value })} /></label>
					<label class="block text-xs text-slate-600">Caption<input class="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1 text-sm" value={w.caption} oninput={(e) => patch({ caption: e.currentTarget.value })} /></label>

					<div class="space-y-2 rounded-lg bg-slate-50 p-3">
						<div class="flex items-center justify-between">
							<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Filters</p>
							<button class="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800" onclick={resetFilters}><RotateCcw class="size-3.5" /> Reset</button>
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
			{/if}
		</div>

		<footer class="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
			<span class="text-xs text-slate-400">Selections apply to the card as you go.</span>
			<button class="rounded-md bg-(--accent-mint-foreground) px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90" onclick={done}>Done</button>
		</footer>
	</div>
</RightDrawer>

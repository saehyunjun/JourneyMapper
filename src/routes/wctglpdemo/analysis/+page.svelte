<script lang="ts">
	import { untrack } from 'svelte';
	import StarIcon from '@lucide/svelte/icons/star';
	import {
		quotes,
		wordUsage,
		questionLabel,
		titleCase,
		participantLabel,
		studyStats,
		themeFrequency,
		emotionFrequency,
		sentimentDistribution,
		pendingInterviews,
		SENTIMENT_LABELS
	} from '$lib/content/wctglpdemo-data/analysis';
	import { keywordTags, categories as keywordCategories } from '$lib/content/wctglpdemo-data/keywords';
	import KeywordText from '$lib/components/KeywordText.svelte';
	import StatBar from '$lib/components/StatBar.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Tab = 'quotes' | 'themes' | 'words';
	let activeTab = $state<Tab>('quotes');

	// Analyst-starred quotes — seeded once from the server, then updated
	// locally on each toggle.
	let starredQuotes = $state(new Set<string>(untrack(() => data.starredQuoteIds)));
	let togglingQuote = $state('');

	async function toggleStar(quoteId: string) {
		if (togglingQuote) return;
		togglingQuote = quoteId;
		try {
			const res = await fetch('/wctglpdemo/highlights', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ kind: 'quote', id: quoteId })
			});
			if (res.ok) {
				const { starredQuoteIds } = await res.json();
				starredQuotes = new Set<string>(starredQuoteIds);
			}
		} finally {
			togglingQuote = '';
		}
	}

	// Analyst review decisions — quote_id -> 'approved' | 'rejected'. A quote
	// missing from the map is still 'pending'.
	//
	// Edits are staged: approve/reject mutate the working copy only, and an
	// explicit Save commits the whole diff to the server in one request. That
	// keeps "unsaved" visible — `savedReviews` is the last-persisted snapshot,
	// `quoteReviews` is what the analyst is editing.
	type ReviewStatus = 'pending' | 'approved' | 'rejected';
	let savedReviews = $state<Record<string, 'approved' | 'rejected'>>(
		untrack(() => data.quoteReviews)
	);
	let quoteReviews = $state<Record<string, 'approved' | 'rejected'>>(
		untrack(() => ({ ...data.quoteReviews }))
	);
	let saving = $state(false);
	let showSavedDialog = $state(false);
	let savedSummary = $state({ approved: 0, rejected: 0, cleared: 0 });

	const reviewOf = (quoteId: string): ReviewStatus => quoteReviews[quoteId] ?? 'pending';
	const savedReviewOf = (quoteId: string): ReviewStatus => savedReviews[quoteId] ?? 'pending';

	// Quote ids whose working decision differs from the last saved snapshot.
	const dirtyIds = $derived(
		quotes.map((q) => q.quote_id).filter((id) => reviewOf(id) !== savedReviewOf(id))
	);
	const dirtySet = $derived(new Set(dirtyIds));

	// Stage one decision locally — no network call until Save.
	function setReview(quoteId: string, status: ReviewStatus) {
		const next = { ...quoteReviews };
		if (status === 'pending') delete next[quoteId];
		else next[quoteId] = status;
		quoteReviews = next;
	}

	// Stage an approval for every quote in the current filtered view.
	function approveAllFiltered() {
		const next = { ...quoteReviews };
		for (const q of filteredQuotes) next[q.quote_id] = 'approved';
		quoteReviews = next;
	}

	// Drop every staged edit, reverting to the last saved snapshot.
	function discardReviewChanges() {
		quoteReviews = { ...savedReviews };
	}

	// Commit the staged diff to the server, then surface the saved-confirmation.
	async function saveReviews() {
		if (saving || dirtyIds.length === 0) return;
		saving = true;
		const updates: Record<string, ReviewStatus> = {};
		const summary = { approved: 0, rejected: 0, cleared: 0 };
		for (const id of dirtyIds) {
			const status = reviewOf(id);
			updates[id] = status;
			if (status === 'approved') summary.approved++;
			else if (status === 'rejected') summary.rejected++;
			else summary.cleared++;
		}
		try {
			const res = await fetch('/wctglpdemo/quote-reviews', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ updates })
			});
			if (res.ok) {
				const { reviews } = await res.json();
				quoteReviews = reviews;
				savedReviews = { ...reviews };
				savedSummary = summary;
				showSavedDialog = true;
			}
		} finally {
			saving = false;
		}
	}

	function reviewChipClass(s: ReviewStatus) {
		if (s === 'approved') return 'bg-emerald-100 text-emerald-800';
		if (s === 'rejected') return 'bg-rose-100 text-rose-800';
		return 'bg-amber-100 text-amber-800';
	}

	// --- Quote-bank filters ---
	let fParticipant = $state('all');
	let fQuestion = $state('all');
	let fTheme = $state('all');
	let fCategory = $state('all');
	let fSentiment = $state('all');
	let fReview = $state('all');
	let fMinScore = $state(1);

	const participantIds = [...new Set(quotes.map((q) => q.interview_id))].sort();
	const questionIds = [...new Set(quotes.map((q) => q.question_id))];
	const themeIds = [...new Set(quotes.flatMap((q) => q.themes))].sort();

	// Deterministic keyword tags per quote, derived from the keyword lexicon —
	// computed once and reused by both the filter and the quote cards.
	const quoteKeywordTags = new Map(quotes.map((q) => [q.quote_id, keywordTags(q.text)]));

	const filteredQuotes = $derived(
		quotes
			.filter((q) => {
				if (fParticipant !== 'all' && q.interview_id !== fParticipant) return false;
				if (fQuestion !== 'all' && q.question_id !== fQuestion) return false;
				if (fTheme !== 'all' && !q.themes.includes(fTheme)) return false;
				if (
					fCategory !== 'all' &&
					!quoteKeywordTags.get(q.quote_id)?.categories.some((c) => c.id === fCategory)
				)
					return false;
				if (fSentiment === 'positive' && q.sentiment <= 0) return false;
				if (fSentiment === 'neutral' && q.sentiment !== 0) return false;
				if (fSentiment === 'negative' && q.sentiment >= 0) return false;
				if (fReview !== 'all' && reviewOf(q.quote_id) !== fReview) return false;
				if (q.quote_score.overall < fMinScore) return false;
				return true;
			})
			.sort((a, b) => b.quote_score.overall - a.quote_score.overall)
	);

	function resetFilters() {
		fParticipant = 'all';
		fQuestion = 'all';
		fTheme = 'all';
		fCategory = 'all';
		fSentiment = 'all';
		fReview = 'all';
		fMinScore = 1;
	}

	// --- Themes & emotions ---
	const themeRows = themeFrequency();
	const maxTheme = Math.max(...themeRows.map((t) => t.count));
	const emotionRows = emotionFrequency();
	const maxEmotion = Math.max(...emotionRows.map((e) => e.count));
	const sentimentRows = sentimentDistribution();
	const maxSentiment = Math.max(...sentimentRows.map((s) => s.count));

	// --- Word usage ---
	let wordScope = $state('overall');
	const wordRows = $derived(
		wordScope === 'overall'
			? wordUsage.overall_word_usage
			: (wordUsage.by_participant[wordScope]?.word_usage ?? [])
	);
	const topWords = $derived(wordRows.slice(0, 30));
	const maxWord = $derived(Math.max(1, ...topWords.map((w) => w.count)));

	function sentimentClass(s: number) {
		if (s > 0) return 'bg-emerald-100 text-emerald-800';
		if (s < 0) return 'bg-rose-100 text-rose-800';
		return 'bg-slate-100 text-slate-700';
	}

	const scoreDims = [
		['clarity', 'Clarity'],
		['emotional_intensity', 'Emotion'],
		['strategic_value', 'Strategy'],
		['specificity', 'Specificity']
	] as const;
</script>

{#snippet statTile(label: string, value: number)}
	<div class="flex flex-col px-5 py-4">
		<span class="text-3xl font-medium text-primary-foreground">{value}</span>
		<span class="text-sm uppercase tracking-wide text-primary-foreground/70">{label}</span>
	</div>
{/snippet}

{#snippet pendingNotice(what: string)}
	{#if pendingInterviews.length > 0}
		<div class=" border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
			<p class="font-semibold">
				{pendingInterviews.length}
				{pendingInterviews.length === 1 ? 'interview is' : 'interviews are'} pending tagging
			</p>
			<p class="mt-1 text-amber-800">
				{pendingInterviews.map(participantLabel).join(', ')}
				{pendingInterviews.length === 1 ? 'has' : 'have'} been parsed and segmented but not yet run
				through the tagging and quote-bank stages, so {pendingInterviews.length === 1
					? 'it does'
					: 'they do'} not appear in {what} below.
			</p>
			<div class="mt-3 flex flex-wrap gap-2">
				{#each pendingInterviews as id (id)}
					<a
						href="/wctglpdemo/upload?interview={id}"
						class="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700"
					>
						Review {participantLabel(id)} →
					</a>
				{/each}
			</div>
		</div>
	{/if}
{/snippet}


<div class="flex flex-1 flex-col bg-slate-50">
	<!-- Hero -->
	<div
		class="flex h-72 w-full flex-col justify-center bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten"
	>
		<div class="mx-auto flex w-full max-w-7xl flex-col gap-3 px-8">
			<span class="figcaption text-white">GLP-1 Interviews · Analysis workspace</span>
			<h1 class="font-heading text-5xl font-light uppercase text-primary-foreground md:text-6xl">
				Interview analysis
			</h1>
			<p class="max-w-2xl text-lg leading-7 text-primary-foreground">
				Review-stage workspace over the structured pipeline outputs — every quote, tag, and count
				is AI-proposed and pending analyst review.
			</p>
		</div>
	</div>

	<!-- Stat bar -->
	<div class="w-full bg-accent-mint">
		<div class="mx-auto flex flex-wrap divide-x divide-white/15 px-4">
			{@render statTile('Interviews', studyStats.interviews)}
			{@render statTile('Segments', studyStats.segments)}
			{@render statTile('Tagged', studyStats.annotations)}
			{@render statTile('Quotes', studyStats.quotes)}
			{@render statTile('Themes', studyStats.themes)}
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-8 py-10">
		<!-- Tabs -->
		<nav class="flex gap-1 border-b border-slate-200">
			{#each [['quotes', 'Quote bank'], ['themes', 'Themes & emotions'], ['words', 'Word usage']] as [id, label] (id)}
				<button
					class="border-b-2 px-4 py-2 text-sm font-medium transition-colors
					{activeTab === id
						? 'border-accent-mint text-accent-mint'
						: 'border-transparent text-slate-500 hover:text-slate-800'}"
					onclick={() => (activeTab = id as Tab)}
				>
					{label}
				</button>
			{/each}
		</nav>

		{#if activeTab === 'quotes'}
			{@render pendingNotice('the quote bank')}
			<!-- Filters -->
			<div class="flex flex-wrap items-end gap-4  border border-slate-200 bg-white p-4">
				<label class="flex flex-col gap-1 text-xs font-semibold text-slate-500">
					Participant
					<select bind:value={fParticipant} class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800">
						<option value="all">All</option>
						{#each participantIds as id (id)}<option value={id}>{participantLabel(id)}</option>{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
					Question
					<select bind:value={fQuestion} class="max-w-xs rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800">
						<option value="all">All</option>
						{#each questionIds as id (id)}<option value={id}>{titleCase(id)}</option>{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
					Theme <span class="font-normal text-slate-400">· AI</span>
					<select bind:value={fTheme} class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800">
						<option value="all">All</option>
						{#each themeIds as id (id)}<option value={id}>{titleCase(id)}</option>{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
					Keyword category <span class="font-normal text-slate-400">· deterministic</span>
					<select bind:value={fCategory} class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800">
						<option value="all">All</option>
						{#each keywordCategories as c (c.id)}<option value={c.id}>{c.label}</option>{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
					Sentiment
					<select bind:value={fSentiment} class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800">
						<option value="all">All</option>
						<option value="positive">Positive</option>
						<option value="neutral">Neutral / mixed</option>
						<option value="negative">Negative</option>
					</select>
				</label>
				<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
					Review status
					<select bind:value={fReview} class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800">
						<option value="all">All</option>
						<option value="pending">Pending</option>
						<option value="approved">Approved</option>
						<option value="rejected">Rejected</option>
					</select>
				</label>
				<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
					Min. overall score · {fMinScore}
					<input type="range" min="1" max="5" step="0.25" bind:value={fMinScore} class="w-40 accent-accent-mint" />
				</label>
				<div class="ml-auto flex items-center gap-2">
					<span class="mr-1 text-sm text-slate-500">{filteredQuotes.length} of {quotes.length}</span>
					<button
						class="rounded border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-40"
						onclick={approveAllFiltered}
						disabled={saving || filteredQuotes.length === 0}
					>
						Approve all {filteredQuotes.length}
					</button>
					<button class="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100" onclick={resetFilters}>
						Reset
					</button>
					{#if dirtyIds.length > 0}
						<button
							class="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
							onclick={discardReviewChanges}
							disabled={saving}
						>
							Discard
						</button>
					{/if}
					<button
						class="rounded bg-accent-mint px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-mint/90 disabled:opacity-40"
						onclick={saveReviews}
						disabled={saving || dirtyIds.length === 0}
					>
						{#if saving}
							Saving…
						{:else if dirtyIds.length > 0}
							Save {dirtyIds.length} change{dirtyIds.length === 1 ? '' : 's'}
						{:else}
							All changes saved
						{/if}
					</button>
				</div>
			</div>

			<!-- Quote cards -->
			<div class="flex flex-col gap-4">
				{#each filteredQuotes as q (q.quote_id)}
					{@const kw = quoteKeywordTags.get(q.quote_id)}
					{@const review = reviewOf(q.quote_id)}
					<article class=" border border-gray-100 bg-white p-4">

						<div class="flex flex-row w-full border-b justify-between items-center gap-2">
						<div class="flex flex-row gap-1">
							{#if q.verbatim_verified}
							<span class="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">✓ verbatim</span>
							{/if}
							<span class="rounded px-2 py-0.5 text-xs font-medium capitalize {reviewChipClass(review)}">
								{review}
							</span>
							{#if dirtySet.has(q.quote_id)}
								<span
									class="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
									title="Unsaved change — use Save to persist it"
								>
									● Unsaved
								</span>
							{/if}
							<div class="flex items-center overflow-hidden rounded border border-slate-200">
								<button
									type="button"
									onclick={() => setReview(q.quote_id, review === 'approved' ? 'pending' : 'approved')}
									disabled={saving}
									title={review === 'approved'
										? 'Approved — click to revert to pending'
										: 'Approve this quote'}
									class="px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-40
										{review === 'approved'
										? 'bg-emerald-600 text-white'
										: 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}"
								>
									Approve
								</button>
								<button
									type="button"
									onclick={() => setReview(q.quote_id, review === 'rejected' ? 'pending' : 'rejected')}
									disabled={saving}
									title={review === 'rejected'
										? 'Rejected — click to revert to pending'
										: 'Reject this quote'}
									class="border-l border-slate-200 px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-40
										{review === 'rejected'
										? 'bg-rose-600 text-white'
										: 'text-slate-500 hover:bg-rose-50 hover:text-rose-700'}"
								>
									Reject
								</button>
							</div>
						</div>
							<button
								type="button"
								onclick={() => toggleStar(q.quote_id)}
								disabled={togglingQuote === q.quote_id}
								aria-pressed={starredQuotes.has(q.quote_id)}
								title={starredQuotes.has(q.quote_id)
									? 'Starred highlight — click to unstar'
									: 'Star as an important highlight'}
								class="rounded p-1 transition-colors hover:bg-amber-50 disabled:opacity-40
									{starredQuotes.has(q.quote_id)
									? 'text-amber-400'
									: 'text-slate-300 hover:text-amber-400'}"
							>
								<StarIcon
									size={18}
									fill={starredQuotes.has(q.quote_id) ? 'currentColor' : 'none'}
								/>
							</button>
						</div>
					<!-- Sentiment + Emotion -->
					<div class="flex flex-wrap items-center gap-1.5">
						<span class="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
							Sentiment / Emotion
						</span>
						<span class="rounded-full px-2.5 py-0.5 text-xs {sentimentClass(q.sentiment)}">
							{SENTIMENT_LABELS[q.sentiment]}		
						</span>
						{#each q.emotions as e (e)}
							<span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
								{titleCase(e)}
							</span>
						{/each}
					</div>
						<div class="flex items-center justify-between gap-4">
							<span class="font-medium text-muted-foreground text-sm uppercase">{participantLabel(q.interview_id)}</span>
						</div>

					<div class="mt-3 text-sm text-slate-500">
						 {questionLabel(q.question_id)}
					</div>

						<blockquote class="my-4 border-l-2 border-accent-mint pl-4 text-xl text-slate-800">
							"<KeywordText text={q.text} />"
						</blockquote>

					<!-- Tags -->

<div class="mt-4 flex flex-col gap-3">

	<!-- Themes -->
	{#if q.themes.length || q.subthemes.length}
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
				Themes
			</span>
			{#each q.themes as t (t)}
				<span class="rounded-full bg-accent-mint/15 px-2.5 py-0.5 text-xs text-accent-mint">
					{titleCase(t)}
				</span>
			{/each}
			{#each q.subthemes as s (s)}
				<span class="rounded-full border border-accent-mint/30 px-2.5 py-0.5 text-xs text-accent-mint/80">
					{titleCase(s)}
				</span>
			{/each}
		</div>
	{/if}
	
	<!-- Keywords -->
	{#if kw && kw.categories.length}
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
				Keywords
			</span>
			{#each kw.categories as c (c.id)}
				<span class="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
					{c.label}
				</span>
			{/each}
			<!-- {#each kw.keywords as k (k.id)}
				<span class="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-500">
					{k.label}
				</span>
			{/each} -->
		</div>
	{/if}

</div>
						<!-- Scores -->
						<div class="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
							{#each scoreDims as [key, label] (key)}
								<div class="flex flex-col gap-1">
									<span class="text-xs text-slate-500">{label}</span>
									<div class="flex items-center gap-1.5">
										<div class="h-1.5 w-16 rounded-full bg-slate-100">
											<div class="h-full rounded-full bg-accent-mint" style="width: {(q.quote_score[key] / 5) * 100}%"></div>
										</div>
										<span class="text-xs tabular-nums text-slate-500">{q.quote_score[key]}</span>
									</div>
								</div>
							{/each}
							<div class="ml-auto flex items-baseline gap-1.5">
								<span class="text-xs uppercase tracking-wide text-slate-400">Overall</span>
								<span class="text-2xl font-light text-accent-mint">{q.quote_score.overall}</span>
							</div>
						</div>

						<!-- Uses + traceability -->
						<div class="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
							{#each q.recommended_uses as use (use)}
								<span class="rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-500">{use}</span>
							{/each}
						</div>
						<div class="mt-2 font-mono text-xs text-slate-400">
							chars {q.char_start}–{q.char_end} · {q.segment_ids.join(', ')}
						</div>
					</article>
				{:else}
					<p class=" border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
						No quotes match the current filters.
					</p>
				{/each}
			</div>
		{:else if activeTab === 'themes'}
			{@render pendingNotice('the theme and emotion counts')}
			<div class="grid gap-8 lg:grid-cols-2">
				<!-- Theme frequency -->
				<section class="flex flex-col gap-3">
					<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
						Theme frequency · {studyStats.annotations} tagged segments
					</h2>
					<div class="flex flex-col gap-3  border border-slate-200 bg-white p-5">
						{#each themeRows as t (t.id)}
							<div class="flex flex-col gap-1.5">
								<StatBar label={titleCase(t.id)} count={t.count} max={maxTheme} />
								{#if t.subthemes.length}
									<div class="ml-4 flex flex-col gap-1">
										{#each t.subthemes as s (s.id)}
											<StatBar
												label={titleCase(s.id)}
												count={s.count}
												max={maxTheme}
												tint="bg-accent-mint/45"
											/>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</section>

				<div class="flex flex-col gap-8">
					<!-- Emotions -->
					<section class="flex flex-col gap-3">
						<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Emotion frequency</h2>
						<div class="flex flex-col gap-2  border border-slate-200 bg-white p-5">
							{#each emotionRows as e (e.id)}
								<StatBar label={titleCase(e.id)} count={e.count} max={maxEmotion} tint="bg-slate-400" />
							{/each}
						</div>
					</section>

					<!-- Sentiment -->
					<section class="flex flex-col gap-3">
						<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Sentiment distribution</h2>
						<div class="flex flex-col gap-2  border border-slate-200 bg-white p-5">
							{#each sentimentRows as s (s.value)}
								<StatBar
									label={SENTIMENT_LABELS[s.value]}
									count={s.count}
									max={maxSentiment}
									tint={s.value > 0
										? 'bg-emerald-400'
										: s.value < 0
											? 'bg-rose-400'
											: 'bg-slate-300'}
								/>
							{/each}
						</div>
					</section>
				</div>
			</div>
		{:else}
			<!-- Word usage -->
			<section class="flex flex-col gap-3">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
						Top words · deterministic counts
					</h2>
					<select bind:value={wordScope} class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800">
						<option value="overall">All participants</option>
						{#each Object.keys(wordUsage.by_participant) as id (id)}
							<option value={id}>{participantLabel(id)}</option>
						{/each}
					</select>
				</div>
				<div class="grid gap-x-8 gap-y-2  border border-slate-200 bg-white p-5 sm:grid-cols-2">
					{#each topWords as w (w.word)}
						<StatBar label={w.word} count={w.count} max={maxWord} />
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>

<!-- Surfaced after a save so the analyst sees their decisions were persisted. -->
<AlertDialog.Root bind:open={showSavedDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Review decisions saved</AlertDialog.Title>
			<AlertDialog.Description>
				{@const total =
					savedSummary.approved + savedSummary.rejected + savedSummary.cleared}
				{total}
				{total === 1 ? 'quote was' : 'quotes were'} updated in the review log —
				{[
					savedSummary.approved ? `${savedSummary.approved} approved` : '',
					savedSummary.rejected ? `${savedSummary.rejected} rejected` : '',
					savedSummary.cleared ? `${savedSummary.cleared} reset to pending` : ''
				]
					.filter(Boolean)
					.join(', ')}. These decisions are stored separately from the quote bank, so
				they survive a quote-bank rebuild.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Action>Done</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

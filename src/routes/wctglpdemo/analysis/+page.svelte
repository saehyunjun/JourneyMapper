<script lang="ts">
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
		SENTIMENT_LABELS
	} from '$lib/content/wctglpdemo-data/analysis';

	type Tab = 'quotes' | 'themes' | 'words';
	let activeTab = $state<Tab>('quotes');

	// --- Quote-bank filters ---
	let fParticipant = $state('all');
	let fQuestion = $state('all');
	let fTheme = $state('all');
	let fSentiment = $state('all');
	let fMinScore = $state(1);

	const participantIds = [...new Set(quotes.map((q) => q.interview_id))].sort();
	const questionIds = [...new Set(quotes.map((q) => q.question_id))];
	const themeIds = [...new Set(quotes.flatMap((q) => q.themes))].sort();

	const filteredQuotes = $derived(
		quotes
			.filter((q) => {
				if (fParticipant !== 'all' && q.interview_id !== fParticipant) return false;
				if (fQuestion !== 'all' && q.question_id !== fQuestion) return false;
				if (fTheme !== 'all' && !q.themes.includes(fTheme)) return false;
				if (fSentiment === 'positive' && q.sentiment <= 0) return false;
				if (fSentiment === 'neutral' && q.sentiment !== 0) return false;
				if (fSentiment === 'negative' && q.sentiment >= 0) return false;
				if (q.quote_score.overall < fMinScore) return false;
				return true;
			})
			.sort((a, b) => b.quote_score.overall - a.quote_score.overall)
	);

	function resetFilters() {
		fParticipant = 'all';
		fQuestion = 'all';
		fTheme = 'all';
		fSentiment = 'all';
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
	<div class="flex flex-col gap-1 px-5 py-4">
		<span class="text-3xl font-light text-primary-foreground">{value}</span>
		<span class="text-xs uppercase tracking-wide text-primary-foreground/70">{label}</span>
	</div>
{/snippet}

{#snippet bar(label: string, count: number, max: number, tint: string)}
	<div class="flex items-center gap-3 text-sm">
		<span class="w-44 shrink-0 truncate text-slate-700">{label}</span>
		<div class="h-4 flex-1 rounded-sm bg-slate-100">
			<div class="h-full rounded-sm {tint}" style="width: {(count / max) * 100}%"></div>
		</div>
		<span class="w-8 shrink-0 text-right tabular-nums text-slate-500">{count}</span>
	</div>
{/snippet}

<div class="flex flex-1 flex-col bg-slate-50">
	<!-- Hero -->
	<div
		class="flex h-72 w-full flex-col justify-center bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten"
	>
		<div class="mx-auto flex w-full max-w-7xl flex-col gap-3 px-8">
			<span class="figcaption text-white">WCT GLP-1 Interviews · Analysis workspace</span>
			<h1 class="font-heading text-5xl font-light uppercase text-primary-foreground md:text-6xl">
				Interview analysis
			</h1>
			<p class="max-w-2xl text-lg leading-7 text-primary-foreground/85">
				Review-stage workspace over the structured pipeline outputs — every quote, tag, and count
				is AI-proposed and pending analyst review.
			</p>
		</div>
	</div>

	<!-- Stat bar -->
	<div class="w-full bg-primary">
		<div class="mx-auto flex max-w-7xl flex-wrap divide-x divide-white/15 px-4">
			{@render statTile('Interviews', studyStats.interviews)}
			{@render statTile('Turns', studyStats.turns)}
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
			<!-- Filters -->
			<div class="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
				<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
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
					Theme
					<select bind:value={fTheme} class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800">
						<option value="all">All</option>
						{#each themeIds as id (id)}<option value={id}>{titleCase(id)}</option>{/each}
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
					Min. overall score · {fMinScore}
					<input type="range" min="1" max="5" step="0.25" bind:value={fMinScore} class="w-40 accent-accent-mint" />
				</label>
				<div class="ml-auto flex items-center gap-3">
					<span class="text-sm text-slate-500">{filteredQuotes.length} of {quotes.length}</span>
					<button class="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100" onclick={resetFilters}>
						Reset
					</button>
				</div>
			</div>

			<!-- Quote cards -->
			<div class="flex flex-col gap-4">
				{#each filteredQuotes as q (q.quote_id)}
					<article class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
						<div class="flex items-center justify-between gap-4">
							<span class="font-mono text-xs text-slate-400">{q.quote_id}</span>
							<div class="flex items-center gap-2">
								{#if q.verbatim_verified}
									<span class="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">✓ verbatim</span>
								{/if}
								<span class="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{q.review_status}</span>
							</div>
						</div>

						<blockquote class="mt-3 border-l-2 border-accent-mint pl-4 text-lg leading-relaxed text-slate-800">
							{q.text}
						</blockquote>

						<div class="mt-3 text-sm text-slate-500">
							<span class="font-medium text-slate-700">{participantLabel(q.interview_id)}</span>
							· {questionLabel(q.question_id)}
						</div>

						<!-- Tag chips -->
						<div class="mt-3 flex flex-wrap gap-1.5">
							{#each q.themes as t (t)}
								<span class="rounded-full bg-accent-mint/15 px-2.5 py-0.5 text-xs text-accent-mint">{titleCase(t)}</span>
							{/each}
							{#each q.subthemes as s (s)}
								<span class="rounded-full border border-accent-mint/30 px-2.5 py-0.5 text-xs text-accent-mint/80">{titleCase(s)}</span>
							{/each}
							{#each q.emotions as e (e)}
								<span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">{titleCase(e)}</span>
							{/each}
							<span class="rounded-full px-2.5 py-0.5 text-xs {sentimentClass(q.sentiment)}">
								{SENTIMENT_LABELS[q.sentiment]}
							</span>
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
					<p class="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
						No quotes match the current filters.
					</p>
				{/each}
			</div>
		{:else if activeTab === 'themes'}
			<div class="grid gap-8 lg:grid-cols-2">
				<!-- Theme frequency -->
				<section class="flex flex-col gap-3">
					<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
						Theme frequency · {studyStats.annotations} tagged segments
					</h2>
					<div class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5">
						{#each themeRows as t (t.id)}
							<div class="flex flex-col gap-1.5">
								{@render bar(titleCase(t.id), t.count, maxTheme, 'bg-accent-mint')}
								{#if t.subthemes.length}
									<div class="ml-4 flex flex-col gap-1">
										{#each t.subthemes as s (s.id)}
											{@render bar(titleCase(s.id), s.count, maxTheme, 'bg-accent-mint/45')}
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
						<div class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-5">
							{#each emotionRows as e (e.id)}
								{@render bar(titleCase(e.id), e.count, maxEmotion, 'bg-slate-400')}
							{/each}
						</div>
					</section>

					<!-- Sentiment -->
					<section class="flex flex-col gap-3">
						<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Sentiment distribution</h2>
						<div class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-5">
							{#each sentimentRows as s (s.value)}
								{@render bar(
									SENTIMENT_LABELS[s.value],
									s.count,
									maxSentiment,
									s.value > 0 ? 'bg-emerald-400' : s.value < 0 ? 'bg-rose-400' : 'bg-slate-300'
								)}
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
				<div class="grid gap-x-8 gap-y-2 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2">
					{#each topWords as w (w.word)}
						{@render bar(w.word, w.count, maxWord, 'bg-accent-mint')}
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>

<script lang="ts">
	import {
		quotes,
		themeTags,
		themeCounts,
		themedQuestionIds,
		themedParticipantIds,
		questionLabel,
		titleCase,
		participantLabel,
		SENTIMENT_LABELS,
		type WordCount
	} from '$lib/content/wctglpdemo-data/analysis';
	import SortableBarChart from '$lib/charts/glp/SortableBarChart.svelte';
	import * as Sheet from '$lib/components/ui/sheet/index.js';

	/** {id,count} theme rows -> the {word,count} shape SortableBarChart expects. */
	const toBars = (rows: { id: string; count: number }[]) =>
		rows.map((r) => ({ word: titleCase(r.id), count: r.count }));

	const overallThemes = toBars(themeCounts());
	const participantCount = themedParticipantIds.length;

	let selectedQuestion = $state(themedQuestionIds[0]);
	let selectedParticipant = $state(themedParticipantIds[0]);

	const questionThemes = $derived(toBars(themeCounts((a) => a.question_id === selectedQuestion)));
	const participantThemes = $derived(
		toBars(themeCounts((a) => a.interview_id === selectedParticipant))
	);

	// --- Quote drawer ---
	type DrawerContext =
		| { kind: 'overall' }
		| { kind: 'question'; id: string }
		| { kind: 'participant'; id: string };

	const labelToTheme = new Map(themeTags.map((t) => [titleCase(t.id), t.id]));

	let drawerOpen = $state(false);
	let drawerTheme = $state<string | null>(null);
	let drawerContext = $state<DrawerContext>({ kind: 'overall' });

	function openDrawer(datum: WordCount, context: DrawerContext) {
		const themeId = labelToTheme.get(datum.word);
		if (!themeId) return;
		drawerTheme = themeId;
		drawerContext = context;
		drawerOpen = true;
	}

	const drawerQuotes = $derived.by(() => {
		const theme = drawerTheme;
		if (!theme) return [];
		return quotes
			.filter((q) => {
				if (!q.themes.includes(theme)) return false;
				if (drawerContext.kind === 'question') return q.question_id === drawerContext.id;
				if (drawerContext.kind === 'participant') return q.interview_id === drawerContext.id;
				return true;
			})
			.sort((a, b) => b.quote_score.overall - a.quote_score.overall);
	});

	const drawerContextLabel = $derived(
		drawerContext.kind === 'question'
			? questionLabel(drawerContext.id)
			: drawerContext.kind === 'participant'
				? participantLabel(drawerContext.id)
				: 'All interviews'
	);

	// Highlight the active row in whichever chart the drawer was opened from.
	const overallSelected = $derived(
		drawerOpen && drawerContext.kind === 'overall' && drawerTheme ? titleCase(drawerTheme) : null
	);
	const questionSelected = $derived(
		drawerOpen && drawerContext.kind === 'question' && drawerTheme ? titleCase(drawerTheme) : null
	);
	const participantSelected = $derived(
		drawerOpen && drawerContext.kind === 'participant' && drawerTheme ? titleCase(drawerTheme) : null
	);

	function sentimentClass(s: number) {
		if (s > 0) return 'bg-emerald-100 text-emerald-800';
		if (s < 0) return 'bg-rose-100 text-rose-800';
		return 'bg-slate-100 text-slate-700';
	}
</script>

<div class="flex flex-1 flex-col">
	<!-- Hero -->
	<div
		class="flex h-80 w-full flex-col justify-center bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten"
	>
		<div class="mx-auto flex w-full max-w-7xl flex-col gap-3 px-8">
			<span class="figcaption text-white">WCT GLP-1 Interviews</span>
			<h1 class="font-heading text-5xl font-light uppercase text-primary-foreground md:text-7xl">
				What patients said
			</h1>
			<p class="max-w-2xl text-lg leading-7 text-primary-foreground/85">
				The analytical themes that surfaced across {participantCount} GLP-1 patient interviews,
				counted from coded response segments. Sort the bars to re-read the data — or click any
				theme to see the quotes behind it.
			</p>
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-7xl flex-col gap-20 px-8 py-16">
		<!-- Viz 1 — Overall theme frequency -->
		<section class="flex flex-col gap-5">
			<div class="flex flex-col gap-2 border-b border-(--ink)/15 pb-4">
				<span class="caption uppercase text-accent-mint">01 · Across all interviews</span>
				<h2 class="font-heading text-4xl font-light uppercase text-primary">
					The shared themes
				</h2>
				<p class="max-w-2xl text-base text-muted-foreground">
					How many response segments carried each theme across all {participantCount} interviews.
					Click a theme to open the quotes behind it.
				</p>
			</div>

			<SortableBarChart
				data={overallThemes}
				color="var(--darkgrayblue)"
				unitLabel="tagged segments"
				itemNoun="themes"
				blockLabel="tagged segment"
				selected={overallSelected}
				onselect={(d) => openDrawer(d, { kind: 'overall' })}
			/>
		</section>

		<!-- Viz 2 — By interview question -->
		<section class="flex flex-col gap-5">
			<div class="flex flex-col gap-2 border-b border-(--ink)/15 pb-4">
				<span class="caption uppercase text-accent-mint">02 · By interview question</span>
				<h2 class="font-heading text-4xl font-light uppercase text-primary">
					What each question surfaced
				</h2>
				<p class="max-w-2xl text-base text-muted-foreground">
					Pick a question to see the themes that came up when patients answered it.
				</p>
			</div>

			<div class="flex flex-wrap gap-2">
				{#each themedQuestionIds as id (id)}
					<button
						type="button"
						class="rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-150
							{selectedQuestion === id
							? 'border-(--darkgrayblue) bg-(--darkgrayblue) text-(--paper)'
							: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
						aria-pressed={selectedQuestion === id}
						onclick={() => (selectedQuestion = id)}
					>
						{questionLabel(id)}
					</button>
				{/each}
			</div>

			<p class="text-lg italic text-foreground">“{questionLabel(selectedQuestion)}”</p>

			{#if questionThemes.length}
				<SortableBarChart
					data={questionThemes}
					color="var(--midgreen)"
					unitLabel="segments for this question"
					itemNoun="themes"
					blockLabel="tagged segment"
					rowHeight={38}
					selected={questionSelected}
					onselect={(d) => openDrawer(d, { kind: 'question', id: selectedQuestion })}
				/>
			{:else}
				<p class="text-muted-foreground">No themes tagged for this question.</p>
			{/if}
		</section>

		<!-- Viz 3 — Participant fingerprint -->
		<section class="flex flex-col gap-5">
			<div class="flex flex-col gap-2 border-b border-(--ink)/15 pb-4">
				<span class="caption uppercase text-accent-mint">03 · By participant</span>
				<h2 class="font-heading text-4xl font-light uppercase text-primary">
					Each patient's fingerprint
				</h2>
				<p class="max-w-2xl text-base text-muted-foreground">
					The themes each participant raised, pooled across every question. Switch
					participants to compare what mattered most to each person.
				</p>
			</div>

			<div class="flex flex-wrap gap-2">
				{#each themedParticipantIds as id (id)}
					<button
						type="button"
						class="rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-150
							{selectedParticipant === id
							? 'border-(--orange) bg-(--orange) text-(--paper)'
							: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
						aria-pressed={selectedParticipant === id}
						onclick={() => (selectedParticipant = id)}
					>
						{participantLabel(id)}
					</button>
				{/each}
			</div>

			{#if participantThemes.length}
				<SortableBarChart
					data={participantThemes}
					color="var(--orange)"
					unitLabel="segments tagged for {participantLabel(selectedParticipant)}"
					itemNoun="themes"
					blockLabel="tagged segment"
					rowHeight={36}
					selected={participantSelected}
					onselect={(d) => openDrawer(d, { kind: 'participant', id: selectedParticipant })}
				/>
			{:else}
				<p class="text-muted-foreground">No themes tagged for this participant.</p>
			{/if}
		</section>
	</div>
</div>

<!-- Related-quotes drawer -->
<Sheet.Root bind:open={drawerOpen}>
	<Sheet.Content side="right" class="data-[side=right]:sm:max-w-xl">
		<div class="flex h-full flex-col">
			<div class="flex flex-col gap-1 border-b border-slate-200 p-6">
				<span class="caption uppercase text-accent-mint">Quotes · {drawerContextLabel}</span>
				<h2 class="font-heading text-3xl font-light uppercase text-primary">
					{drawerTheme ? titleCase(drawerTheme) : ''}
				</h2>
				<p class="text-sm text-muted-foreground">
					{drawerQuotes.length}
					{drawerQuotes.length === 1 ? 'quote' : 'quotes'} pulled for this theme.
				</p>
			</div>

			<div class="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
				{#each drawerQuotes as q (q.quote_id)}
					<article class="rounded-lg border border-slate-200 bg-white p-4">
						<div class="flex items-center justify-between gap-3">
							<span class="font-mono text-xs text-slate-400">{q.quote_id}</span>
							<span class="text-xs text-slate-400">
								score
								<span class="ml-1 text-base font-light text-accent-mint">{q.quote_score.overall}</span>
							</span>
						</div>
						<blockquote class="mt-2 border-l-2 border-accent-mint pl-3 text-sm leading-relaxed text-slate-800">
							{q.text}
						</blockquote>
						<div class="mt-2 text-xs text-slate-500">
							<span class="font-medium text-slate-700">{participantLabel(q.interview_id)}</span>
							· {questionLabel(q.question_id)}
						</div>
						<div class="mt-2 flex flex-wrap gap-1">
							{#each q.themes as t (t)}
								<span class="rounded-full bg-accent-mint/15 px-2 py-0.5 text-xs text-accent-mint">
									{titleCase(t)}
								</span>
							{/each}
							{#each q.emotions as e (e)}
								<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
									{titleCase(e)}
								</span>
							{/each}
							<span class="rounded-full px-2 py-0.5 text-xs {sentimentClass(q.sentiment)}">
								{SENTIMENT_LABELS[q.sentiment]}
							</span>
						</div>
						<div class="mt-2 font-mono text-xs text-slate-400">
							chars {q.char_start}–{q.char_end}
						</div>
					</article>
				{:else}
					<p class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
						No quotes have been pulled for this theme in this view. The quote bank is a curated
						subset of the coded segments — the theme may still appear in segments that weren't
						selected as pull quotes.
					</p>
				{/each}
			</div>
		</div>
	</Sheet.Content>
</Sheet.Root>

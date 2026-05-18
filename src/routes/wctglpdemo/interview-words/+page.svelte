<script lang="ts">
	import { Button } from '$lib/components/ui/Button/index.ts';
	import {
		quotes,
		themeTags,
		themeBreakdown,
		segmentsForTheme,
		themedQuestionIds,
		themedParticipantIds,
		questionLabel,
		titleCase,
		participantLabel,
		SENTIMENT_LABELS,
		type ThemeBlock
	} from '$lib/content/wctglpdemo-data/analysis';
	import SortableBarChart from '$lib/charts/glp/SortableBarChart.svelte';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import KeywordText from '$lib/components/KeywordText.svelte';
	import { keywordCounts } from '$lib/content/wctglpdemo-data/keywords';

	/** Theme breakdown rows -> the {word,count,blocks} shape SortableBarChart expects. */
	const toBars = (rows: { id: string; count: number; blocks: ThemeBlock[] }[]) =>
		rows.map((r) => ({ word: titleCase(r.id), count: r.count, blocks: r.blocks }));

	const overallThemes = toBars(themeBreakdown());
	const participantCount = themedParticipantIds.length;

	// --- Question groups (Viz 2) ---
	// Broader buckets the interview-guide questions fall into; the question row
	// below shows only the questions belonging to the selected group.
	const QUESTION_GROUPS: { id: string; label: string; ids: string[] }[] = [
		{
			id: 'medication',
			label: 'Medication preferences',
			ids: [
				'stopping_glp1',
				'try_different_medication',
				'compounded_vs_approved',
				'oral_glp_awareness',
				'oral_vs_injectable'
			]
		},
		{
			id: 'trial-interest',
			label: 'Clinical trials interest',
			ids: ['trial_unapproved_medication', 'trial_motivation', 'considered_trials_before']
		},
		{
			id: 'trial-barriers',
			label: 'Clinical trial barriers',
			ids: [
				'placebo_controlled_appeal',
				'monthly_injection_barrier',
				'trial_barriers',
				'trial_concerns'
			]
		},
		{
			id: 'support',
			label: 'Lifestyle & support',
			ids: ['weight_loss_history', 'educational_support']
		}
	];

	// Keep only questions that actually have themed annotations, in guide order;
	// sweep any uncategorized ones into a trailing group so nothing is hidden.
	const questionGroups = (() => {
		const groups = QUESTION_GROUPS.map((g) => ({
			id: g.id,
			label: g.label,
			ids: g.ids.filter((id) => themedQuestionIds.includes(id))
		})).filter((g) => g.ids.length);
		const placed = new Set(groups.flatMap((g) => g.ids));
		const rest = themedQuestionIds.filter((id) => !placed.has(id));
		if (rest.length) groups.push({ id: 'other', label: 'Other questions', ids: rest });
		return groups;
	})();

	let selectedGroup = $state(questionGroups[0]?.id);
	const activeGroup = $derived(
		questionGroups.find((g) => g.id === selectedGroup) ?? questionGroups[0]
	);
	const groupQuestionIds = $derived(activeGroup?.ids ?? []);

	let selectedQuestion = $state(questionGroups[0]?.ids[0] ?? themedQuestionIds[0]);
	let selectedParticipant = $state(themedParticipantIds[0]);

	// When the group changes, keep the selected question valid for it.
	$effect(() => {
		if (groupQuestionIds.length && !groupQuestionIds.includes(selectedQuestion)) {
			selectedQuestion = groupQuestionIds[0];
		}
	});

	const questionThemes = $derived(toBars(themeBreakdown((a) => a.question_id === selectedQuestion)));
	const participantThemes = $derived(
		toBars(themeBreakdown((a) => a.interview_id === selectedParticipant))
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

	function openDrawer(datum: { word: string }, context: DrawerContext) {
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

	const drawerFragments = $derived.by(() => {
		const theme = drawerTheme;
		if (!theme) return [];
		const ctx = drawerContext;
		return segmentsForTheme(theme, (a) =>
			ctx.kind === 'question'
				? a.question_id === ctx.id
				: ctx.kind === 'participant'
					? a.interview_id === ctx.id
					: true
		);
	});

	// Deterministic keyword usage across the coded fragments in the drawer —
	// a word-usage tally for whatever theme/context is currently open.
	const drawerKeywordCounts = $derived(keywordCounts(drawerFragments.map((f) => f.text)));
	const maxKeywordCount = $derived(Math.max(1, ...drawerKeywordCounts.map((k) => k.count)));

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
			<span class="figcaption text-white">
				WCT GLP-1 Interviews
			</span>
			<h1 class="font-heading text-5xl font-light capitalize text-primary-foreground md:text-7xl">
				What patients said
			</h1>
			<p class="max-w-2xl text-lg leading-7 text-primary-foreground/85">
				The analytical themes that surfaced across {participantCount} GLP-1 patient interviews,
				counted from coded response segments. Sort the bars to re-read the data — or click any
				theme to see the quotes behind it.
			</p>
		</div>
	</div>

	<div class="mx-auto flex w-full flex-col gap-20 px-8 py-16">
		<!-- Viz 1 — Overall theme frequency -->
		<section class="flex flex-col gap-5">
			<div class="flex flex-col gap-2 border-b border-(--primary)/15 pb-4">
				<span class="figcaption text-accent-mint">01 · Across all interviews</span>
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
				<span class="figcaption text-accent-mint">02 · By interview question</span>
				<h2 class="font-heading text-4xl font-light uppercase text-primary">
					What each question surfaced
				</h2>
				<p class="max-w-2xl text-base text-muted-foreground">
					Pick a topic group, then a question within it, to see the themes that came up
					when patients answered it.
				</p>
			</div>

			<!-- Topic groups -->
			<div class="flex flex-wrap gap-2">
				{#each questionGroups as group (group.id)}
					<Button
						type="button"
						class="rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-150 capitalize
							{selectedGroup === group.id
							? 'border-accent-mint bg-accent-mint text-accent-mint-foreground'
							: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
						aria-pressed={selectedGroup === group.id}
						onclick={() => (selectedGroup = group.id)}
					>
						{group.label}
						<span class="ml-1.5 opacity-60">{group.ids.length}</span>
					</Button>
				{/each}
			</div>

			<!-- Questions within the selected group -->
			<div class="flex flex-row gap-2 overflow-x-scroll pb-4">
				{#each groupQuestionIds as id (id)}
					<Button
						class="rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-150
							{selectedQuestion === id
							? 'border-(--darkgrayblue) bg-(--darkgrayblue) text-(--paper)'
							: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
						aria-pressed={selectedQuestion === id}
						onclick={() => (selectedQuestion = id)}
					>
						{questionLabel(id)}
					</Button>
				{/each}
			</div>

			<p class="text-lg italic text-foreground">“{questionLabel(selectedQuestion)}”</p>

			{#if questionThemes.length}
				<SortableBarChart
					data={questionThemes}
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
				<span class="figcaption text-accent-mint">03 · By participant</span>
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
					<Button
						type="button"
						class="rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-150
							{selectedParticipant === id
							? 'border-(--orange) bg-(--orange) text-(--paper)'
							: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
						aria-pressed={selectedParticipant === id}
						onclick={() => (selectedParticipant = id)}
					>
						{participantLabel(id)}
					</Button>
				{/each}
			</div>

			{#if participantThemes.length}
				<SortableBarChart
					data={participantThemes}
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
				<span class="figcaption text-accent-mint">Quotes · {drawerContextLabel}</span>
				<h2 class="font-heading text-3xl font-light uppercase text-primary">
					{drawerTheme ? titleCase(drawerTheme) : ''}
				</h2>
				<p class="text-sm text-muted-foreground">
					{drawerQuotes.length} pull {drawerQuotes.length === 1 ? 'quote' : 'quotes'} ·
					{drawerFragments.length} coded {drawerFragments.length === 1 ? 'fragment' : 'fragments'}
				</p>
			</div>

			<div class="flex flex-1 flex-col gap-7 overflow-y-auto p-6">
				<!-- Keyword usage — deterministic word counts across this theme's fragments -->
				{#if drawerKeywordCounts.length}
					<section class="flex flex-col gap-2">
						<h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
							Keyword usage · {drawerKeywordCounts.length}
							{drawerKeywordCounts.length === 1 ? 'keyword' : 'keywords'}
						</h3>
						<p class="text-xs text-muted-foreground">
							Lexicon keywords found in the {drawerFragments.length} coded
							{drawerFragments.length === 1 ? 'fragment' : 'fragments'} for this theme, by mention count.
						</p>
						<div class="mt-1 flex flex-col gap-1.5">
							{#each drawerKeywordCounts.slice(0, 12) as kc (kc.keywordId)}
								<div class="flex items-center gap-2 text-xs">
									<span class="w-36 shrink-0 truncate text-slate-700" title={kc.categoryLabel}>
										{kc.keywordLabel}
									</span>
									<div class="h-3 flex-1 rounded-sm bg-slate-100">
										<div
											class="h-full rounded-sm bg-accent-mint"
											style="width: {(kc.count / maxKeywordCount) * 100}%"
										></div>
									</div>
									<span class="w-5 shrink-0 text-right tabular-nums text-slate-500">{kc.count}</span>
								</div>
							{/each}
						</div>
						{#if drawerKeywordCounts.length > 12}
							<p class="text-xs text-slate-400">
								+{drawerKeywordCounts.length - 12} more {drawerKeywordCounts.length - 12 === 1
									? 'keyword'
									: 'keywords'}
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
								<div class="mt-2 text-xs text-slate-500">
									<span class="font-medium text-slate-700">
										{participantLabel(q.interview_id)}
									</span>
									· {questionLabel(q.question_id)}
								</div>
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
								<div class="mt-2 font-mono text-xs text-slate-400">
									{q.segment_ids.length}
									{q.segment_ids.length === 1 ? 'fragment' : 'fragments'} · chars {q.char_start}–{q.char_end}
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
						Every response segment tagged with this theme. Tinted rows are already part of a pull
						quote above; the rest are coded but not pulled.
					</p>
					{#each drawerFragments as f (f.segment_id)}
						<div
							class="rounded-md border-l-2 py-1.5 pr-2 pl-3
								{f.in_pull_quote ? 'border-accent-mint bg-accent-mint/5' : 'border-muted-foreground'}"
						>
							<p class="text-sm leading-relaxed text-slate-700">
								<KeywordText text={f.text} />
							</p>
							<div class="mt-1 text-xs text-slate-500">
								<span class="font-medium text-slate-700">{participantLabel(f.interview_id)}</span>
								· {questionLabel(f.question_id)}
							</div>
							<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
								<span class="rounded-full px-1.5 py-0.5 {sentimentClass(f.sentiment)}">
									{SENTIMENT_LABELS[f.sentiment]}
								</span>
								{#if f.in_pull_quote}
									<span class="font-mono text-accent-mint">↑ in {f.quote_id}</span>
								{/if}
								<span class="font-mono">chars {f.char_start}–{f.char_end}</span>
							</div>
						</div>
					{:else}
						<p
							class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500"
						>
							No coded fragments for this theme in this view.
						</p>
					{/each}
				</section>
			</div>
		</div>
	</Sheet.Content>
</Sheet.Root>

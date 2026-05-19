<script lang="ts">
	import { untrack } from 'svelte';
	import {
		quotes,
		themeTags,
		themeBreakdown,
		segmentsForTheme,
		themedQuestionIds,
		themedParticipantIds,
		tagGroups,
		themeGroupOf,
		questionLabel,
		titleCase,
		participantLabel,
		SENTIMENT_LABELS,
		type ThemeBlock
	} from '$lib/content/wctglpdemo-data/analysis';
	import { Button } from "$lib/components/ui/button/index.js";
	import RadialThemeChart from '$lib/charts/glp/RadialThemeChart.svelte';
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import KeywordText from '$lib/components/KeywordText.svelte';
	import CodedFragmentCard from '$lib/components/CodedFragmentCard.svelte';
	import KeyQuotesSection from '$lib/components/KeyQuotesSection.svelte';
	import ParticipantDrawer from '$lib/components/ParticipantDrawer.svelte';
	import { keywordCounts } from '$lib/content/wctglpdemo-data/keywords';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Participant profiles, seeded from the server load and updated locally
	// when the drawer persists an edit.
	let profiles = $state(untrack(() => data.participantProfiles));

	// --- Participant details drawer ---
	let participantDrawerOpen = $state(false);
	let participantDrawerId = $state<string | null>(null);

	function openParticipant(id: string) {
		participantDrawerId = id;
		participantDrawerOpen = true;
	}

	/** themeBreakdown rows -> the {word,count,group,blocks} shape RadialThemeChart expects. */
	const toRadial = (rows: { id: string; count: number; blocks: ThemeBlock[] }[]) =>
		rows.map((r) => ({
			word: titleCase(r.id),
			count: r.count,
			blocks: r.blocks,
			group: themeGroupOf.get(r.id) ?? 'other'
		}));

	const participantCount = themedParticipantIds.length;

	// One radial chart, many views: an "all interviews" view plus one per themed
	// question, in interview-guide order. The all view is the default.
	const views: { id: string; label: string }[] = [
		{ id: 'all', label: 'Across all interviews' },
		...themedQuestionIds.map((id) => ({ id, label: questionLabel(id) }))
	];
	let selectedView = $state('all');
	const selectedIndex = $derived(
		Math.max(0, views.findIndex((v) => v.id === selectedView))
	);

	const overallThemes = toRadial(themeBreakdown());

	// Themes for whichever view is selected — recomputed when the user refines.
	const currentThemes = $derived(
		selectedView === 'all'
			? overallThemes
			: toRadial(themeBreakdown((a) => a.question_id === selectedView))
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

	// Highlight the active theme in the radial chart when its drawer is open and
	// the drawer's context still matches the view on screen.
	const chartSelected = $derived(
		drawerOpen && drawerTheme &&
			((selectedView === 'all' && drawerContext.kind === 'overall') ||
				(drawerContext.kind === 'question' && drawerContext.id === selectedView))
			? titleCase(drawerTheme)
			: null
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
				counted from coded response segments. Click any theme to see the quotes behind it.
			</p>
		</div>
	</div>

	<div class="mx-auto flex w-full flex-col gap-20 px-8 py-16">
		<!-- Key quotes — analyst-starred highlights -->
		<KeyQuotesSection
			starredQuoteIds={data.starredQuoteIds}
			starredSegmentIds={data.starredSegmentIds}
			{profiles}
			onparticipant={openParticipant}
		/>

		<!-- Theme frequency — one radial chart, all interviews or one question -->
		<section class="flex flex-col gap-5">
			<div class="flex flex-col gap-2 border-b border-(--primary)/15 pb-4">
				<span class="figcaption text-accent-mint">
					{String(selectedIndex + 1).padStart(2, '0')} · {views[selectedIndex].label}
				</span>
				<h2 class="font-heading text-4xl font-light uppercase text-primary">
					The themes that surfaced
				</h2>
				<p class="max-w-2xl text-base text-muted-foreground">
					{#if selectedView === 'all'}
						How many response segments carried each theme across all {participantCount}
						interviews. Click a theme to open the quotes behind it.
					{:else}
						The themes patients raised when answering this question. Click a theme to open
						the quotes behind it.
					{/if}
				</p>
			</div>

			<!-- View selector — start with all interviews, refine to one question -->
			<div class="flex flex-row gap-2 overflow-x-scroll pb-4">
				{#each views as v, i (v.id)}
					<Button
						variant="default"
						class="shrink-0 rounded-full px-2.5 py-1.5 text-sm transition-colors duration-150
							{selectedView === v.id
							? 'border-(--darkgrayblue) bg-(--darkgrayblue) text-(--paper)'
							: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
						aria-pressed={selectedView === v.id}
						onclick={() => (selectedView = v.id)}
					>
						{String(i + 1).padStart(2, '0')} · {v.label}
					</Button>
				{/each}
			</div>

			{#if currentThemes.length}
				<RadialThemeChart
					data={currentThemes}
					groups={tagGroups}
					unitLabel="tagged segments"
					itemNoun="themes"
					blockLabel="tagged segment"
					selected={chartSelected}
					onselect={(d) =>
						openDrawer(
							d,
							selectedView === 'all'
								? { kind: 'overall' }
								: { kind: 'question', id: selectedView }
						)}
				/>
			{:else}
				<p class="text-muted-foreground">No themes tagged for this question.</p>
			{/if}
		</section>
	</div>
</div>

<!-- Related-quotes drawer -->
<RightDrawer bind:open={drawerOpen}>
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
						<article class="rounded border border-slate-200 bg-white p-4">
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
								class="mt-2 border-l-2 border-accent-mint pl-3 text-base text-slate-800"
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
				<h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
					Coded fragments · {drawerFragments.length}
				</h3>
				<p class="text-xs text-muted-foreground">
					Every response segment tagged with this theme. Tinted rows are already part of a pull
					quote above; the rest are coded but not pulled.
				</p>
				{#each drawerFragments as f (f.segment_id)}
					<CodedFragmentCard fragment={f} {profiles} />
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
</RightDrawer>

<!-- Participant details drawer -->
<ParticipantDrawer
	bind:open={participantDrawerOpen}
	interviewId={participantDrawerId}
	bind:profiles
/>

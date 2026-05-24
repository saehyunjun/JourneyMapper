<script lang="ts">
	import { untrack } from 'svelte';
	import {
		quotes,
		buildRadialTree,
		segmentsForTheme,
		segmentsForSubtheme,
		segmentsForKeyword,
		themedQuestionIds,
		themedParticipantIds,
		questionLabel,
		titleCase,
		participantLabel,
		SENTIMENT_LABELS,
		type RadialNode
	} from '$lib/content/wctglpdemo-data/analysis';
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import RadialThemeChart from '$lib/charts/glp/RadialThemeChart.svelte';
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import KeywordText from '$lib/components/KeywordText.svelte';
	import CodedFragmentCard from '$lib/components/CodedFragmentCard.svelte';
	import KeyQuotesSection from '$lib/components/KeyQuotesSection.svelte';
	import ParticipantDrawer from '$lib/components/ParticipantDrawer.svelte';
	import SentimentBar from '$lib/components/SentimentBar.svelte';
	import StatBlock from '$lib/components/StatBlock.svelte';
	import { keywordBlocks } from '$lib/content/wctglpdemo-data/keywords';
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

	const participantCount = themedParticipantIds.length;

	// Three tabs: key quotes, all-interview themes, per-question themes.
	let activeTab = $state<'quotes' | 'overview' | 'questions'>('quotes');

	const questionViews = themedQuestionIds.map((id) => ({ id, label: questionLabel(id) }));
	let selectedQuestionId = $state(questionViews[0]?.id ?? '');

	// Overview — unfiltered radial across every themed segment.
	const overviewTree = $derived(buildRadialTree());

	// By question — same builder, filtered to the active question.
	const questionTree = $derived(
		selectedQuestionId
			? buildRadialTree(
					(a) => a.question_id === selectedQuestionId,
					(m) => m.question_id === selectedQuestionId
				)
			: []
	);

	// --- Quote drawer — works for themes, subthemes, or keywords ---
	type DrawerContext =
		| { kind: 'overall' }
		| { kind: 'question'; id: string }
		| { kind: 'participant'; id: string };

	let drawerOpen = $state(false);
	let drawerNode = $state<RadialNode | null>(null);
	let drawerContext = $state<DrawerContext>({ kind: 'overall' });

	function openDrawer(node: RadialNode, context: DrawerContext) {
		drawerNode = node;
		drawerContext = context;
		drawerOpen = true;
	}

	const drawerQuotes = $derived.by(() => {
		const n = drawerNode;
		if (!n || n.kind === 'keyword') return [];
		const matchField = n.kind === 'theme' ? 'themes' : 'subthemes';
		return quotes
			.filter((q) => {
				if (!q[matchField].includes(n.id)) return false;
				if (drawerContext.kind === 'question') return q.question_id === drawerContext.id;
				if (drawerContext.kind === 'participant') return q.interview_id === drawerContext.id;
				return true;
			})
			.sort((a, b) => b.quote_score.overall - a.quote_score.overall);
	});

	const drawerFragments = $derived.by(() => {
		const n = drawerNode;
		if (!n) return [];
		const ctx = drawerContext;
		const annPred = (a: { question_id: string; interview_id: string }) =>
			ctx.kind === 'question'
				? a.question_id === ctx.id
				: ctx.kind === 'participant'
					? a.interview_id === ctx.id
					: true;
		if (n.kind === 'theme') return segmentsForTheme(n.id, annPred);
		if (n.kind === 'subtheme') return segmentsForSubtheme(n.id, annPred);
		return segmentsForKeyword(n.id, (m) =>
			ctx.kind === 'question'
				? m.question_id === ctx.id
				: ctx.kind === 'participant'
					? m.interview_id === ctx.id
					: true
		);
	});

	const drawerLabel = $derived(drawerNode?.label ?? '');
	const drawerKindLabel = $derived(
		drawerNode?.kind === 'keyword'
			? 'Keyword'
			: drawerNode?.kind === 'subtheme'
				? 'Subtheme'
				: drawerNode?.kind === 'theme'
					? 'Theme'
					: ''
	);

	// Deterministic keyword usage across the coded fragments in the drawer —
	// one sentiment-coloured block per fragment that mentions each keyword.
	const drawerKeywordBlocks = $derived(keywordBlocks(drawerFragments));
	const maxKeywordCount = $derived(
		Math.max(1, ...drawerKeywordBlocks.map((k) => k.blocks.length))
	);

	const drawerContextLabel = $derived(
		drawerContext.kind === 'question'
			? questionLabel(drawerContext.id)
			: drawerContext.kind === 'participant'
				? participantLabel(drawerContext.id)
				: 'All interviews'
	);

	// Highlight the active node on whichever chart's tab opened the drawer.
	const overviewSelected = $derived(
		drawerOpen && drawerNode && drawerContext.kind === 'overall' ? drawerNode.id : null
	);
	const questionSelected = $derived(
		drawerOpen &&
			drawerNode &&
			drawerContext.kind === 'question' &&
			drawerContext.id === selectedQuestionId
			? drawerNode.id
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
		class="flex h-48 w-full flex-col justify-center bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten"
	>
		<div class="mx-auto flex w-full max-w-7xl flex-col gap-2 px-8">
			<span class="figcaption text-white">
				GLP-1 Interviews
			</span>
			<h1 class="font-heading text-4xl font-light capitalize text-primary-foreground md:text-5xl">
				What patients said
			</h1>
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 py-12">
		<Tabs.Root value={activeTab} onValueChange={(v) => (activeTab = v as typeof activeTab)}>
			<Tabs.List variant="line" class="w-full justify-start gap-4 border-b border-(--ink)/15">
				<Tabs.Trigger value="quotes">Key Quotes</Tabs.Trigger>
				<Tabs.Trigger value="overview">Themes</Tabs.Trigger>
				<Tabs.Trigger value="questions">By question</Tabs.Trigger>
			</Tabs.List>

			<!-- Key Quotes tab — analyst-starred highlights -->
			<Tabs.Content value="quotes" class="flex flex-col gap-6 pt-10">
				<KeyQuotesSection
					starredQuoteIds={data.starredQuoteIds}
					starredSegmentIds={data.starredSegmentIds}
					{profiles}
					onparticipant={openParticipant}
				/>
			</Tabs.Content>

			<!-- Themes tab — radial across every interview -->
			<Tabs.Content value="overview" class="flex flex-col gap-5 pt-10">
				<div class="flex flex-col gap-2 border-b border-(--primary)/15 pb-4">
					<span class="figcaption text-accent-mint">Across all interviews</span>
					<h2 class="font-heading text-4xl font-light uppercase text-primary">
						The themes that surfaced
					</h2>
					<p class="max-w-2xl text-base text-muted-foreground">
						How many response segments carried each theme across all {participantCount}
						interviews. Click a theme to open the quotes behind it.
					</p>
				</div>

				<!-- Summary stats -->
				{#if overviewTree.length}
					{@const totalSegments = overviewTree.reduce((n, t) => n + t.count, 0)}
					<div class="grid grid-cols-3 gap-px overflow-hidden rounded-md bg-(--ink)/15">
						<StatBlock value={participantCount} label={participantCount === 1 ? 'interviewee' : 'interviewees'} />
						<StatBlock value={totalSegments} label="tagged quotes" />
						<StatBlock value={overviewTree.length} label="themes" />
					</div>
				{/if}

				{#if overviewTree.length}
					<RadialThemeChart
						tree={overviewTree}
						unitLabel="tagged segments"
						blockLabel="tagged segment"
						selected={overviewSelected}
						onselect={(node) => openDrawer(node, { kind: 'overall' })}
					/>

					<!-- Per-theme sentiment breakdown -->
					<div class="flex flex-col gap-3 border-t border-(--ink)/10 pt-6">
						<h3 class="figcaption text-accent-mint">Sentiment by theme</h3>
						<p class="text-xs text-muted-foreground">
							One block per tagged quote — click a theme above to see the quotes behind it.
						</p>
						<div class="flex flex-col gap-2">
							{#each overviewTree as theme (theme.id)}
								<SentimentBar
									label={theme.label}
									blocks={theme.blocks}
									labelClass="w-44"
								/>
							{/each}
						</div>
					</div>
				{:else}
					<p class="text-muted-foreground">No themes tagged yet.</p>
				{/if}
			</Tabs.Content>

			<Tabs.Content value="questions" class="flex flex-col gap-8 pt-10">
				<section class="flex flex-col gap-5">
					<div class="flex flex-col gap-2 border-b border-(--primary)/15 pb-4">
						<span class="figcaption text-accent-mint">
							{questionViews.find((v) => v.id === selectedQuestionId)?.label ?? 'By question'}
						</span>
						<h2 class="font-heading text-4xl font-light uppercase text-primary">
							The themes that surfaced
						</h2>
						<p class="max-w-2xl text-base text-muted-foreground">
							The themes patients raised when answering this question. Click a theme to open
							the quotes behind it.
						</p>
					</div>

					<!-- Per-question selector -->
					<div class="flex flex-row gap-1 overflow-x-auto pb-3">
						{#each questionViews as v (v.id)}
							<Button
								variant="default"
								class="shrink-0 rounded-full px-2.5 py-1 text-xs transition-colors duration-150
									{selectedQuestionId === v.id
									? 'border-(--darkgrayblue) bg-(--darkgrayblue) text-(--paper)'
									: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
								aria-pressed={selectedQuestionId === v.id}
								onclick={() => (selectedQuestionId = v.id)}
							>
								{v.label}
							</Button>
						{/each}
					</div>

					{#if questionTree.length}
						<RadialThemeChart
							tree={questionTree}
							unitLabel="tagged segments"
							blockLabel="tagged segment"
							selected={questionSelected}
							onselect={(node) =>
								openDrawer(node, { kind: 'question', id: selectedQuestionId })}
						/>
					{:else}
						<p class="text-muted-foreground">No themes tagged for this question.</p>
					{/if}
				</section>
			</Tabs.Content>
		</Tabs.Root>
	</div>
</div>

<!-- Related-quotes drawer -->
<RightDrawer bind:open={drawerOpen}>
	<div class="flex h-full flex-col">
		<div class="flex flex-col gap-1 border-b border-slate-200 p-6">
			<span class="figcaption text-accent-mint">
				{drawerKindLabel} · {drawerContextLabel}
			</span>
			<h2 class="font-heading text-3xl font-light uppercase text-primary">
				{drawerLabel}
			</h2>
			<p class="text-sm text-muted-foreground">
				{#if drawerNode?.kind === 'keyword'}
					{drawerFragments.length} matched
					{drawerFragments.length === 1 ? 'fragment' : 'fragments'}
				{:else}
					{drawerQuotes.length} pull {drawerQuotes.length === 1 ? 'quote' : 'quotes'} ·
					{drawerFragments.length} coded
					{drawerFragments.length === 1 ? 'fragment' : 'fragments'}
				{/if}
			</p>
		</div>

		<div class="flex flex-1 flex-col gap-7 overflow-y-auto p-6">
			<!-- Keyword usage — deterministic word counts across this theme's fragments -->
			{#if drawerKeywordBlocks.length}
				<section class="flex flex-col gap-2">
					<h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Keyword usage · {drawerKeywordBlocks.length}
						{drawerKeywordBlocks.length === 1 ? 'keyword' : 'keywords'}
					</h3>
					<p class="text-xs text-muted-foreground">
						Lexicon keywords found in the {drawerFragments.length} coded
						{drawerFragments.length === 1 ? 'fragment' : 'fragments'} for this theme, by mention count.
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
							+{drawerKeywordBlocks.length - 12} more {drawerKeywordBlocks.length - 12 === 1
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

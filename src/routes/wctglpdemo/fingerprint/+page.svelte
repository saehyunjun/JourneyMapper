<!--
	Fingerprint — one interviewee's distinctive theme profile.

	The themes a single participant raised, pooled across every interview
	question, drawn as a SortableBarChart, plus a word cloud of their spoken
	vocabulary. Reached from the upload page's post-tag modal; the participant
	row lets you browse the other interviewees.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from "$lib/components/ui/button/index.ts";
	import {
		annotations,
		themeBreakdown,
		themeTags,
		segmentsForTheme,
		themedParticipantIds,
		participantLabel,
		titleCase,
		tagGroups,
		themeGroupOf,
		type ThemeBlock
	} from '$lib/content/wctglpdemo-data/analysis';
	import RadialThemeChart from '$lib/charts/glp/RadialThemeChart.svelte';
	import WordCloud from '$lib/charts/glp/WordCloud.svelte';
	import { participantWords } from '$lib/content/wctglpdemo-data/word-frequency';
	import { scaleLinear } from 'd3-scale';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import KeyQuotesSection from '$lib/components/KeyQuotesSection.svelte';
	import ParticipantDrawer from '$lib/components/ParticipantDrawer.svelte';
	import CodedFragmentCard from '$lib/components/CodedFragmentCard.svelte';
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import { profileName, participantBio } from '$lib/types/participant-profile';
	import type { PageProps } from './$types';
	import { ArrowRight } from '@lucide/svelte';

	let { data }: PageProps = $props();

	// Participant profiles, seeded from the server load and updated locally
	// when the drawer persists an edit.
	let profiles = $state(untrack(() => data.participantProfiles));

	// Analyst-starred segments — seeded from the server, updated on each toggle.
	let starredSegments = $state(new Set<string>(untrack(() => data.starredSegmentIds)));
	let togglingSegment = $state('');

	async function toggleSegmentStar(segmentId: string) {
		if (togglingSegment) return;
		togglingSegment = segmentId;
		try {
			const res = await fetch('/wctglpdemo/highlights', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ kind: 'segment', id: segmentId })
			});
			if (res.ok) {
				const { starredSegmentIds } = await res.json();
				starredSegments = new Set<string>(starredSegmentIds);
			}
		} finally {
			togglingSegment = '';
		}
	}

	// --- Participant details drawer ---
	let participantDrawerOpen = $state(false);
	let participantDrawerId = $state<string | null>(null);

	function openParticipant(id: string) {
		participantDrawerId = id;
		participantDrawerOpen = true;
	}

	/** Theme breakdown rows -> the {word,count,group,blocks} shape RadialThemeChart expects. */
	const toRadial = (rows: { id: string; count: number; blocks: ThemeBlock[] }[]) =>
		rows.map((r) => ({
			word: titleCase(r.id),
			count: r.count,
			blocks: r.blocks,
			group: themeGroupOf.get(r.id) ?? 'other'
		}));

	let selectedParticipant = $state(
		data.interview ?? themedParticipantIds[themedParticipantIds.length - 1] ?? ''
	);

	const fingerprint = $derived(
		toRadial(themeBreakdown((a) => a.interview_id === selectedParticipant))
	);
	const themeCount = $derived(fingerprint.length);
	const segmentCount = $derived(fingerprint.reduce((n, b) => n + b.count, 0));

	// Programmatic prose bio — demographics plus the participant's top themes.
	const bio = $derived(
		participantBio(
			profiles[selectedParticipant],
			participantLabel(selectedParticipant),
			fingerprint.map((b) => b.word),
			segmentCount
		)
	);

	// --- Word cloud — the participant's spoken vocabulary ---
	// 'common' sizes by raw frequency; 'distinctive' surfaces the words this
	// participant over-indexes on versus the other interviewees.
	let wordMode = $state<'common' | 'distinctive'>('common');
	const participantCloud = $derived(
		participantWords(selectedParticipant, { mode: wordMode, limit: 60 })
	);
	const WORD_MODES: { id: 'common' | 'distinctive'; label: string }[] = [
		{ id: 'common', label: 'Most common' },
		{ id: 'distinctive', label: 'Most distinctive' }
	];

	// Diverging colour for a word's average sentiment: rose (negative) →
	// slate (neutral) → emerald (positive), echoing the bar chart's palette.
	const sentimentColor = scaleLinear<string>()
		.domain([-2, 0, 2])
		.range(['#e11d48', '#94a3b8', '#059669'])
		.clamp(true);

	// Negative / neutral / positive tagged-segment counts for the selected
	// participant, taken from the per-segment annotations.
	const sentimentCounts = $derived.by(() => {
		const counts = { negative: 0, neutral: 0, positive: 0 };
		for (const a of annotations) {
			if (a.interview_id !== selectedParticipant) continue;
			if (a.sentiment < 0) counts.negative++;
			else if (a.sentiment > 0) counts.positive++;
			else counts.neutral++;
		}
		return counts;
	});

	function select(id: string) {
		selectedParticipant = id;
		// Keep the URL shareable/refreshable without a full navigation.
		goto(`?interview=${id}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	// --- Theme drawer — the selected participant's segments for one theme ---
	const labelToTheme = new Map(themeTags.map((t) => [titleCase(t.id), t.id]));

	let themeDrawerOpen = $state(false);
	let drawerTheme = $state<string | null>(null);

	function openThemeDrawer(datum: { word: string }) {
		const themeId = labelToTheme.get(datum.word);
		if (!themeId) return;
		drawerTheme = themeId;
		themeDrawerOpen = true;
	}

	// Every segment the selected participant has tagged with the open theme.
	const drawerFragments = $derived.by(() => {
		if (!drawerTheme) return [];
		return segmentsForTheme(drawerTheme, (a) => a.interview_id === selectedParticipant);
	});

	// `word` of the chart row whose drawer is open, so it stays highlighted.
	const selectedRow = $derived(
		themeDrawerOpen && drawerTheme ? titleCase(drawerTheme) : null
	);

</script>

<div class="flex flex-1 flex-col">
	<!-- Hero -->
	<div
		class="flex h-80 w-full flex-col justify-center bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten"
	>
		<div class="mx-auto flex w-full max-w-7xl flex-col gap-3 px-8">
			<span class="figcaption text-white">WCT GLP-1 Interviews · Fingerprint</span>
			<h1 class="font-heading text-5xl font-light capitalize text-primary-foreground md:text-7xl">
				Each patient's fingerprint
			</h1>
			<p class="max-w-2xl text-lg leading-7 text-primary-foreground/85">
				The analytical themes one patient raised, pooled across every interview question. Switch
				participants to compare what mattered most to each person.
			</p>
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 py-14">
		{#if themedParticipantIds.length}
			<!-- Participant browser -->
			<div class="flex flex-col gap-3 border-b border-(--ink)/15 pb-5">
				<span class="figcaption text-accent-mint">
					Narrative Explorer
				</span>
				<div class="flex flex-wrap gap-2">
					{#each themedParticipantIds as id (id)}
						<Button
							variant="secondary"
							class="flex items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm transition-colors duration-350
								{selectedParticipant === id
								? 'border-(--orange) bg-(--orange) text-(--paper)'
								: 'border-(-muted) bg-(-muted) text-foreground hover:bg-(--ink)/5'}"
							aria-pressed={selectedParticipant === id}
							onclick={() => select(id)}
						>
							<ParticipantAvatar interviewId={id} size="sm" />
							{profileName(profiles[id], participantLabel(id))}
						</Button>
					{/each}
				</div>
			</div>

			<!-- The selected participant -->
			<section class="flex flex-col gap-6">
				<!-- Identity header — avatar, name, generated bio, and details link -->
				<header class="flex flex-col gap-4 border-b border-(--ink)/15 pb-6">
					<div class="flex items-start gap-5">
						<ParticipantAvatar
							interviewId={selectedParticipant}
							size="lg"
							src={profiles[selectedParticipant]?.avatar_url}
						/>
						<div class="flex min-w-0 flex-1 flex-col gap-2">
							<h2 class="font-heading text-3xl font-light uppercase text-primary">
								{profileName(profiles[selectedParticipant], participantLabel(selectedParticipant))}
							</h2>
							<p class="max-w-2xl text-base leading-7 text-muted-foreground">
								{bio}
							</p>
						</div>
						<Button
							variant="default"
							class="shrink-0"
							onclick={() => openParticipant(selectedParticipant)}
							title="View participant details"
						>
							View Participant Details
							<ArrowRight />
						</Button>
					</div>

					<!-- At-a-glance stats — theme / segment counts and sentiment mix -->
					<div class="flex flex-wrap items-center gap-1.5">
						<span class="rounded-full bg-(--ink)/5 px-2.5 py-0.5 text-xs text-foreground">
							{themeCount} {themeCount === 1 ? 'theme' : 'themes'}
						</span>
						<span class="rounded-full bg-(--ink)/5 px-2.5 py-0.5 text-xs text-foreground">
							{segmentCount} tagged {segmentCount === 1 ? 'segment' : 'segments'}
						</span>
						<span class="mx-1 text-(--ink)/25">·</span>
						<span class="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs text-rose-800">
							{sentimentCounts.negative} negative
						</span>
						<span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
							{sentimentCounts.neutral} neutral
						</span>
						<span class="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs text-emerald-800">
							{sentimentCounts.positive} positive
						</span>
					</div>
				</header>

				<!-- Key quotes — analyst-starred highlights for this participant -->
				<KeyQuotesSection
					starredQuoteIds={data.starredQuoteIds}
					starredSegmentIds={[...starredSegments]}
					{profiles}
					onparticipant={openParticipant}
					participantId={selectedParticipant}
				/>

				<!-- Word cloud — the participant's spoken vocabulary -->
				<div class="flex flex-col gap-3 rounded-xl border border-(--ink)/10 bg-(--paper) p-5">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div class="flex flex-col gap-0.5">
							<span class="figcaption text-accent-mint">
								In their own words
							</span>
							
							<p class="caption text-muted-foreground">
								{participantCloud.totalWords} counted words · {participantCloud.uniqueWords} unique ·
								{participantCloud.hapaxWords.length} said just once
							</p>
						</div>
						<div class="flex flex-row gap-1" role="group">
							{#each WORD_MODES as opt (opt.id)}
								<Button
									variant="secondary"
									class="px-2.5 py-1.5 text-xs font-medium transition-colors duration-150
										{wordMode === opt.id
										? 'bg-(--darkgrayblue) text-(--paper)'
										: 'bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
									aria-pressed={wordMode === opt.id}
									onclick={() => (wordMode = opt.id)}
								>
									{opt.label}
								</Button>
							{/each}
						</div>
					</div>

					<!-- Sentiment legend -->
					<div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						<span>Word colour = average sentiment of its segments</span>
						<span class="flex items-center gap-1.5">
							<span>negative</span>
							<span
								class="h-2 w-24 rounded-full"
								style="background: linear-gradient(to right, #e11d48, #94a3b8, #059669)"
							></span>
							<span>positive</span>
						</span>
					</div>

					{#if participantCloud.words.length}
						<WordCloud
							words={participantCloud.words}
							color={(d) => sentimentColor(d.sentiment ?? 0)}
						/>
					{:else}
						<p class="text-sm text-muted-foreground">No words to show for this participant.</p>
					{/if}

					<p class="caption text-xs text-muted-foreground">
						{#if wordMode === 'common'}
							Word size = times spoken; function words and speech fillers are removed before
							counting.
						{:else}
							Word size = how strongly {participantLabel(selectedParticipant)} over-indexes on the
							word versus the other participants — their distinctive voice.
						{/if}
					</p>
				</div>

				{#if fingerprint.length}
					<RadialThemeChart
						data={fingerprint}
						groups={tagGroups}
						unitLabel="segments tagged for {participantLabel(selectedParticipant)}"
						itemNoun="themes"
						blockLabel="tagged segment"
						onselect={openThemeDrawer}
						selected={selectedRow}
					/>
				{:else}
					<p
						class="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500"
					>
						No themes tagged for {participantLabel(selectedParticipant)} yet. Tag its segments on the
						upload review page first.
					</p>
				{/if}
			</section>
		{:else}
			<p
				class="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500"
			>
				No tagged interviews yet.
			</p>
		{/if}
	</div>
</div>

<!-- Participant details drawer -->
<ParticipantDrawer
	bind:open={participantDrawerOpen}
	interviewId={participantDrawerId}
	bind:profiles
/>

<!-- Theme drawer — the selected participant's segments for one theme -->
<RightDrawer bind:open={themeDrawerOpen}>
	<div class="flex h-full flex-col">
		<div class="flex flex-col gap-1 border-b border-slate-200 p-6">
			<span class="figcaption text-accent-mint">
				Theme · {profileName(profiles[selectedParticipant], participantLabel(selectedParticipant))}
			</span>
			<h2 class="font-heading text-3xl font-light uppercase text-primary">
				{drawerTheme ? titleCase(drawerTheme) : ''}
			</h2>
			<p class="text-sm text-muted-foreground">
				{drawerFragments.length} coded
				{drawerFragments.length === 1 ? 'segment' : 'segments'} · Starring segments will highlight them as key quotes across the Lab Book.
			</p>
		</div>

		<div class="flex flex-1 flex-col gap-3 overflow-y-auto p-6">
			{#each drawerFragments as f (f.segment_id)}
				<CodedFragmentCard
					fragment={f}
					{profiles}
					starred={starredSegments.has(f.segment_id)}
					togglingStar={togglingSegment === f.segment_id}
					onToggleStar={toggleSegmentStar}
				/>
			{:else}
				<p
					class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500"
				>
					No coded segments for this theme.
				</p>
			{/each}
		</div>
	</div>
</RightDrawer>

<!--
	Fingerprint — one interviewee's distinctive theme profile.

	The themes a single participant raised, pooled across every interview
	question, drawn with the same SortableBarChart as the "fingerprint" section
	of /wctglpdemo/interview-words. Reached from the upload page's post-tag
	modal; the participant row lets you browse the other interviewees.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from "$lib/components/ui/button/index.ts";
	import StarIcon from '@lucide/svelte/icons/star';
	import {
		annotations,
		themeBreakdown,
		themeTags,
		segmentsForTheme,
		themedParticipantIds,
		participantLabel,
		questionLabel,
		titleCase,
		SENTIMENT_LABELS,
		type ThemeBlock
	} from '$lib/content/wctglpdemo-data/analysis';
	import SortableBarChart from '$lib/charts/glp/SortableBarChart.svelte';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import KeyQuotesSection from '$lib/components/KeyQuotesSection.svelte';
	import ParticipantDrawer from '$lib/components/ParticipantDrawer.svelte';
	import KeywordText from '$lib/components/KeywordText.svelte';
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import { profileName } from '$lib/types/participant-profile';
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

	/** Theme breakdown rows -> the {word,count,blocks} shape SortableBarChart expects. */
	const toBars = (rows: { id: string; count: number; blocks: ThemeBlock[] }[]) =>
		rows.map((r) => ({ word: titleCase(r.id), count: r.count, blocks: r.blocks }));

	let selectedParticipant = $state(
		data.interview ?? themedParticipantIds[themedParticipantIds.length - 1] ?? ''
	);

	const fingerprint = $derived(
		toBars(themeBreakdown((a) => a.interview_id === selectedParticipant))
	);
	const themeCount = $derived(fingerprint.length);
	const segmentCount = $derived(fingerprint.reduce((n, b) => n + b.count, 0));

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
				<span class="figcaption text-accent-mint">Narrative Explorer</span>
				<div class="flex flex-wrap gap-2">
					{#each themedParticipantIds as id (id)}
						<Button
							variant="secondary"
							class="flex items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm transition-colors duration-150
								{selectedParticipant === id
								? 'border-(--orange) bg-(--orange) text-(--paper)'
								: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
							aria-pressed={selectedParticipant === id}
							onclick={() => select(id)}
						>
							<ParticipantAvatar interviewId={id} size="sm" />
							{participantLabel(id)}
						</Button>
					{/each}
				</div>
			</div>

			<!-- The selected participant -->
			<section class="flex flex-col gap-6">
			<div class="flex flex-row w-full justify-between">
				<ParticipantAvatar
				interviewId={selectedParticipant}
				size="lg"
				src={profiles[selectedParticipant]?.avatar_url}
			/>
				<Button
					variant="default"
					onclick={() => openParticipant(selectedParticipant)}
					title="View participant details"
				>
				View Participant Details
				<ArrowRight />
				</Button>
			</div>
					<div class="flex flex-col gap-1.5">
						<h2 class="font-heading text-3xl font-light uppercase text-primary">
							{profileName(profiles[selectedParticipant], participantLabel(selectedParticipant))}
						</h2>
						<p class="text-sm text-muted-foreground">
							{themeCount}
							{themeCount === 1 ? 'theme' : 'themes'} ·
							{segmentCount} tagged {segmentCount === 1 ? 'segment' : 'segments'} ·
							
						</p>
						<div class="flex flex-wrap gap-1.5">
							<span class="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">
								{sentimentCounts.negative} negative
							</span>
							<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
								{sentimentCounts.neutral} neutral
							</span>
							<span class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
								{sentimentCounts.positive} positive
							</span>
						</div>
					</div>


				<!-- Key quotes — analyst-starred highlights for this participant -->
				<KeyQuotesSection
					starredQuoteIds={data.starredQuoteIds}
					starredSegmentIds={[...starredSegments]}
					{profiles}
					onparticipant={openParticipant}
					participantId={selectedParticipant}
				/>

				{#if fingerprint.length}
					<SortableBarChart
						data={fingerprint}
						unitLabel="segments tagged for {participantLabel(selectedParticipant)}"
						itemNoun="themes"
						blockLabel="tagged segment"
						rowHeight={36}
						colorModeOptions={['sentiment']}
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
				<div
					class="border-2 p-3
						{f.in_pull_quote ? 'border-accent-mint bg-accent-mint/5' : 'border-muted-foreground/40'}"
				>
					<div class="flex items-start justify-between gap-3">
						<p class="text-sm leading-relaxed text-slate-700">
							<KeywordText text={f.text} />
						</p>
						<button
							type="button"
							onclick={() => toggleSegmentStar(f.segment_id)}
							disabled={togglingSegment === f.segment_id}
							aria-pressed={starredSegments.has(f.segment_id)}
							title={starredSegments.has(f.segment_id)
								? 'Starred — click to unstar'
								: 'Star this segment'}
							class="shrink-0 rounded p-1 transition-colors hover:bg-amber-50 disabled:opacity-40
								{starredSegments.has(f.segment_id)
								? 'text-amber-400'
								: 'text-slate-300 hover:text-amber-400'}"
						>
							<StarIcon
								size={18}
								fill={starredSegments.has(f.segment_id) ? 'currentColor' : 'none'}
							/>
						</button>
					</div>
					<div class="mt-1 text-xs text-slate-500">{questionLabel(f.question_id)}</div>
					<div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
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
					No coded segments for this theme.
				</p>
			{/each}
		</div>
	</div>
</RightDrawer>

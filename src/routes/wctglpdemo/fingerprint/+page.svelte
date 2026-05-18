<!--
	Fingerprint — one interviewee's distinctive theme profile.

	The themes a single participant raised, pooled across every interview
	question, drawn with the same SortableBarChart as the "fingerprint" section
	of /wctglpdemo/interview-words. Reached from the upload page's post-tag
	modal; the participant row lets you browse the other interviewees.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		themeBreakdown,
		themedParticipantIds,
		participantLabel,
		titleCase,
		type ThemeBlock
	} from '$lib/content/wctglpdemo-data/analysis';
	import SortableBarChart from '$lib/charts/glp/SortableBarChart.svelte';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

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

	function select(id: string) {
		selectedParticipant = id;
		// Keep the URL shareable/refreshable without a full navigation.
		goto(`?interview=${id}`, { replaceState: true, keepFocus: true, noScroll: true });
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

	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 py-14">
		{#if themedParticipantIds.length}
			<!-- Participant browser -->
			<div class="flex flex-col gap-3 border-b border-(--ink)/15 pb-5">
				<span class="figcaption text-accent-mint">Browse participants</span>
				<div class="flex flex-wrap gap-2">
					{#each themedParticipantIds as id (id)}
						<button
							type="button"
							class="flex items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm transition-colors duration-150
								{selectedParticipant === id
								? 'border-(--orange) bg-(--orange) text-(--paper)'
								: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
							aria-pressed={selectedParticipant === id}
							onclick={() => select(id)}
						>
							<ParticipantAvatar interviewId={id} size="sm" />
							{participantLabel(id)}
						</button>
					{/each}
				</div>
			</div>

			<!-- The selected participant's fingerprint -->
			<section class="flex flex-col gap-4">
				<div class="flex items-center gap-4">
					<ParticipantAvatar interviewId={selectedParticipant} size="lg" preview />
					<div class="flex flex-col gap-1">
						<h2 class="font-heading text-3xl font-light uppercase text-primary">
							{participantLabel(selectedParticipant)}
						</h2>
						<p class="text-sm text-muted-foreground">
							{themeCount}
							{themeCount === 1 ? 'theme' : 'themes'} ·
							{segmentCount} tagged {segmentCount === 1 ? 'segment' : 'segments'}
						</p>
					</div>
				</div>

				{#if fingerprint.length}
					<SortableBarChart
						data={fingerprint}
						unitLabel="segments tagged for {participantLabel(selectedParticipant)}"
						itemNoun="themes"
						blockLabel="tagged segment"
						rowHeight={36}
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

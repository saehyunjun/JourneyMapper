<script lang="ts">
	import {
		glpWordData,
		participantLabel,
		wordsForParticipant
	} from '$lib/content/wctglpdemo-data/index.js';
	import SortableBarChart from '$lib/charts/glp/SortableBarChart.svelte';

	const questionEntries = Object.entries(glpWordData.question_groups);
	const participants = glpWordData.meta.participants;

	let selectedQuestion = $state(questionEntries[0][0]);
	let selectedParticipant = $state(participants[0]);

	const activeGroup = $derived(glpWordData.question_groups[selectedQuestion]);
	const participantWords = $derived(wordsForParticipant(selectedParticipant));
</script>

<div class="flex flex-1 flex-col">
	<!-- Hero -->
	<div
		class="flex h-80 w-full flex-col justify-center bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten"
	>
		<div class="mx-auto flex w-full max-w-7xl flex-col gap-3 px-8">
			<span class="figcaption text-white">{glpWordData.meta.study}</span>
			<h1 class="font-heading text-5xl font-light uppercase text-primary-foreground md:text-7xl">
				What patients said
			</h1>
			<p class="max-w-2xl text-lg leading-7 text-primary-foreground/85">
				Deterministic, code-counted word usage across {participants.length} GLP-1 patient
				interviews. Every chart below is sortable — re-order the bars to read the data a
				different way.
			</p>
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-7xl flex-col gap-20 px-8 py-16">
		<!-- Viz 1 — Overall word frequency -->
		<section class="flex flex-col gap-5">
			<div class="flex flex-col gap-2 border-b border-(--ink)/15 pb-4">
				<span class="caption uppercase text-accent-mint">01 · Across all interviews</span>
				<h2 class="font-heading text-4xl font-light uppercase text-primary">
					The shared vocabulary
				</h2>
				<p class="max-w-2xl text-base text-muted-foreground">
					How often each theme surfaced across all {participants.length} interviews. Sort by frequency
					to find what dominated the conversation, or alphabetically to scan for a term.
				</p>
			</div>

			<SortableBarChart
				data={glpWordData.overall_word_usage}
				color="var(--darkgrayblue)"
				unitLabel="mentions overall"
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
					Pick a question to see the words patients reached for when answering it.
				</p>
			</div>

			<div class="flex flex-wrap gap-2">
				{#each questionEntries as [id, group] (id)}
					<button
						type="button"
						class="rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-150
							{selectedQuestion === id
							? 'border-(--darkgrayblue) bg-(--darkgrayblue) text-(--paper)'
							: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
						aria-pressed={selectedQuestion === id}
						onclick={() => (selectedQuestion = id)}
					>
						{group.question}
					</button>
				{/each}
			</div>

			<p class="text-lg italic text-foreground">“{activeGroup.question}”</p>

			<SortableBarChart
				data={activeGroup.top_words}
				color="var(--midgreen)"
				unitLabel="mentions for this question"
				rowHeight={38}
			/>
		</section>

		<!-- Viz 3 — Participant fingerprint -->
		<section class="flex flex-col gap-5">
			<div class="flex flex-col gap-2 border-b border-(--ink)/15 pb-4">
				<span class="caption uppercase text-accent-mint">03 · By participant</span>
				<h2 class="font-heading text-4xl font-light uppercase text-primary">
					Each patient's fingerprint
				</h2>
				<p class="max-w-2xl text-base text-muted-foreground">
					The distinctive words each participant used, pooled across every question. Switch
					participants to compare what mattered most to each person.
				</p>
			</div>

			<div class="flex flex-wrap gap-2">
				{#each participants as id (id)}
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

			{#if participantWords.length}
				<SortableBarChart
					data={participantWords}
					color="var(--orange)"
					unitLabel="mentions by {participantLabel(selectedParticipant)}"
					rowHeight={36}
				/>
			{:else}
				<p class="text-muted-foreground">No word data recorded for this participant.</p>
			{/if}
		</section>
	</div>
</div>

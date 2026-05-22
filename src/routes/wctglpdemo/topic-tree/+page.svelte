<script lang="ts">
	import RadialTree from '$lib/charts/glp/RadialTree.svelte';
	import Sunburst from '$lib/charts/glp/Sunburst.svelte';
	import ThemeHeatmap from '$lib/charts/glp/ThemeHeatmap.svelte';
	import { buildTopicTree, themePalette } from '$lib/content/wctglpdemo-data/topicTree';
	import {
		themedQuestionIds,
		themedParticipantIds,
		questionLabel,
		participantLabel
	} from '$lib/content/wctglpdemo-data/analysis';

	type Scope = 'all' | 'question' | 'participant';
	type View = 'tree' | 'sunburst';

	let scope = $state<Scope>('all');
	let view = $state<View>('tree');
	let selectedQuestion = $state(themedQuestionIds[0]);
	let selectedParticipant = $state(themedParticipantIds[0]);

	// The radial tree is reusable: same component, differently-filtered hierarchy.
	const root = $derived.by(() => {
		if (scope === 'question')
			return buildTopicTree((a) => a.question_id === selectedQuestion);
		if (scope === 'participant')
			return buildTopicTree((a) => a.interview_id === selectedParticipant);
		return buildTopicTree();
	});

	const scopeLabel = $derived(
		scope === 'question'
			? questionLabel(selectedQuestion)
			: scope === 'participant'
				? participantLabel(selectedParticipant)
				: 'All interviews'
	);

	const themesPresent = $derived(root.children ?? []);
	const subthemeCount = $derived(
		themesPresent.reduce(
			(n, t) => n + (t.children?.filter((c) => c.kind === 'subtheme').length ?? 0),
			0
		)
	);

	const SCOPES: { id: Scope; label: string }[] = [
		{ id: 'all', label: 'All interviews' },
		{ id: 'question', label: 'By question' },
		{ id: 'participant', label: 'By participant' }
	];
</script>

<div class="flex flex-1 flex-col">
	<!-- Hero -->
	<div
		class="flex h-80 w-full flex-col justify-center bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten"
	>
		<div class="mx-auto flex w-full max-w-7xl flex-col gap-3 px-8">
			<span class="figcaption text-white">GLP-1 Interviews</span>
			<h1 class="font-heading text-5xl font-light capitalize text-primary-foreground md:text-7xl">
				The shape of a theme
			</h1>
			<p class="max-w-2xl text-lg leading-7 text-primary-foreground/85">
				From theme to subtheme to the words participants actually used inside it — explored
				three ways: a radial tree, a zoomable sunburst, and a heatmap that lays every
				participant and question side by side.
			</p>
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 py-16">
		<section class="flex flex-col gap-5">
			<div class="flex flex-col gap-2 border-b border-(--primary)/15 pb-4">
				<span class="caption uppercase text-accent-mint">Theme → subtheme → word</span>
				<h2 class="font-heading text-4xl font-light uppercase text-primary">
					The vocabulary inside each theme
				</h2>
				<p class="max-w-2xl text-base text-muted-foreground">
					Each branch runs from a coded theme out to its subthemes and then to the
					keyword-lexicon words found in those segments. Re-scope the whole tree to a single
					interview question or one participant.
				</p>
			</div>

			<div class="flex flex-wrap items-center justify-between gap-3">
				<!-- Scope: the chart is reused with a differently-filtered dataset -->
				<div class="flex flex-wrap gap-2">
					{#each SCOPES as s (s.id)}
						<button
							type="button"
							class="rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-150
								{scope === s.id
								? 'border-(--darkgrayblue) bg-(--darkgrayblue) text-(--paper)'
								: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
							aria-pressed={scope === s.id}
							onclick={() => (scope = s.id)}
						>
							{s.label}
						</button>
					{/each}
				</div>

				<!-- View: the same hierarchy, two layouts -->
				<div class="flex gap-1.5">
					<button
						type="button"
						class="rounded-md border px-3 py-1.5 text-sm transition-colors
							{view === 'tree'
							? 'border-(--ink) bg-(--ink) text-(--paper)'
							: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
						aria-pressed={view === 'tree'}
						onclick={() => (view = 'tree')}
					>
						Radial tree
					</button>
					<button
						type="button"
						class="rounded-md border px-3 py-1.5 text-sm transition-colors
							{view === 'sunburst'
							? 'border-(--ink) bg-(--ink) text-(--paper)'
							: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
						aria-pressed={view === 'sunburst'}
						onclick={() => (view = 'sunburst')}
					>
						Sunburst
					</button>
				</div>
			</div>

			{#if scope === 'question'}
				<div class="flex flex-row gap-2 overflow-x-auto pb-2">
					{#each themedQuestionIds as id (id)}
						<button
							type="button"
							class="shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-150
								{selectedQuestion === id
								? 'border-(--orange) bg-(--orange) text-(--paper)'
								: 'border-(--ink)/20 bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
							aria-pressed={selectedQuestion === id}
							onclick={() => (selectedQuestion = id)}
						>
							{questionLabel(id)}
						</button>
					{/each}
				</div>
			{:else if scope === 'participant'}
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
			{/if}

			<p class="text-sm text-muted-foreground">
				<span class="font-medium text-foreground">{scopeLabel}</span>
				· {themesPresent.length}
				{themesPresent.length === 1 ? 'theme' : 'themes'}
				· {subthemeCount}
				{subthemeCount === 1 ? 'subtheme' : 'subthemes'}
				· {root.count} tagged {root.count === 1 ? 'segment' : 'segments'}
			</p>

			{#if themesPresent.length}
				{#key scope}
					{#if view === 'tree'}
						<RadialTree {root} />
					{:else}
						<Sunburst {root} />
					{/if}
				{/key}
			{:else}
				<p
					class="rounded-lg border border-dashed border-(--ink)/25 p-10 text-center text-sm text-muted-foreground"
				>
					No coded themes for this {scope === 'question' ? 'question' : 'participant'}.
				</p>
			{/if}

			<!-- Theme colour legend -->
			{#if themesPresent.length}
				<div class="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
					{#each themesPresent as t (t.id)}
						<span class="flex items-center gap-1.5 text-xs text-muted-foreground">
							<span
								class="inline-block h-2.5 w-2.5 rounded-full"
								style="background: {themePalette[t.themeId]}"
							></span>
							{t.name}
						</span>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Section 2 — facets compared side by side -->
		<section class="flex flex-col gap-5">
			<div class="flex flex-col gap-2 border-b border-(--primary)/15 pb-4">
				<span class="caption uppercase text-accent-mint">Every facet at once</span>
				<h2 class="font-heading text-4xl font-light uppercase text-primary">
					Where the themes land
				</h2>
				<p class="max-w-2xl text-base text-muted-foreground">
					The radial tree and sunburst show one scope at a time. This heatmap holds them all —
					every theme against every participant or question — and colours each cell by segment
					count or by average sentiment.
				</p>
			</div>

			<ThemeHeatmap />
		</section>
	</div>
</div>

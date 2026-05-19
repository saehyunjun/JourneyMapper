<!--
	Trial-experience journey map.

	A vertical timeline of three curated phases — Awareness & Education,
	Decision to Apply, Trial Participation — each split into steps. Every step
	is a quiz: the user sorts its sentiment drivers (themes + keywords) into
	"pulled people toward the trial" vs "pushed them away" before the real
	average sentiment is revealed. A results summary lands once every step is
	revealed. Data is derived in journey.ts from the interview-analysis outputs.
-->
<script lang="ts">
	import { phases, journeyStats } from '$lib/content/wctglpdemo-data/journey';
	import JourneyStep from '$lib/components/journey/JourneyStep.svelte';
	import { Trophy, TrendingUp, TrendingDown, MessageSquare } from '@lucide/svelte';

	// Visual tone per phase — literal classes so Tailwind keeps them.
	const TONE = {
		emerald: {
			badge: 'bg-emerald-500 text-white',
			label: 'text-emerald-600',
			rail: 'bg-emerald-400',
			soft: 'bg-emerald-50 border-emerald-200',
			border: 'border-emerald-200',
			head: 'text-emerald-700',
			circle: 'bg-emerald-500 text-white'
		},
		amber: {
			badge: 'bg-amber-500 text-white',
			label: 'text-amber-600',
			rail: 'bg-amber-400',
			soft: 'bg-amber-50 border-amber-200',
			border: 'border-amber-200',
			head: 'text-amber-700',
			circle: 'bg-amber-500 text-white'
		},
		sky: {
			badge: 'bg-sky-500 text-white',
			label: 'text-sky-600',
			rail: 'bg-sky-400',
			soft: 'bg-sky-50 border-sky-200',
			border: 'border-sky-200',
			head: 'text-sky-700',
			circle: 'bg-sky-500 text-white'
		}
	} as const;

	// step id -> the score JourneyStep reported when it was revealed.
	let results = $state<Record<string, { correct: number; total: number }>>({});

	function recordResult(stepId: string, result: { correct: number; total: number }) {
		results = { ...results, [stepId]: result };
	}

	const revealedCount = $derived(Object.keys(results).length);
	const allRevealed = $derived(revealedCount === journeyStats.steps);
	const correct = $derived(Object.values(results).reduce((n, r) => n + r.correct, 0));
	const graded = $derived(Object.values(results).reduce((n, r) => n + r.total, 0));
	const accuracy = $derived(graded ? Math.round((correct / graded) * 100) : 0);

	// Standout drivers for the closing summary — only ones with real support.
	const flatDrivers = phases.flatMap((p) =>
		p.steps.flatMap((s) => s.drivers.map((d) => ({ ...d, stepTitle: s.title })))
	);
	const supported = flatDrivers.filter((d) => d.count >= 3);
	const topPositive = [...supported].sort((a, b) => b.avgSentiment - a.avgSentiment)[0];
	const topNegative = [...supported].sort((a, b) => a.avgSentiment - b.avgSentiment)[0];
	const mostMentioned = [...flatDrivers].sort((a, b) => b.count - a.count)[0];

	const verdict = $derived(
		accuracy >= 80
			? 'Sharp read — you have a real feel for what moves trial participants.'
			: accuracy >= 55
				? 'Solid instincts, with a few surprises in the mix.'
				: 'The data had some surprises — worth a closer look at what drives sentiment.'
	);
</script>

<div class="mx-auto w-full max-w-3xl px-6 py-10">
	<header class="mb-8">
		<h1 class="text-2xl font-bold text-slate-900">The trial-experience journey</h1>
		<p class="mt-2 text-slate-600">
			Three phases, {journeyStats.steps} steps. In each step, guess which themes and words pulled
			GLP-1 interview participants <em>toward</em> joining a trial — and which pushed them
			<em>away</em> — then reveal what the coded sentiment actually shows.
		</p>
		<p class="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
			These interviews are attitudinal — participants reacting to a <em>hypothetical</em> trial — so
			the three phases are a narrative recut of the interview guide, not a lived timeline.
		</p>
		<!-- Progress across all steps. -->
		<div class="mt-4 flex items-center gap-3">
			<div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
				<div
					class="h-full rounded-full bg-slate-900 transition-all duration-300"
					style="width: {(revealedCount / journeyStats.steps) * 100}%"
				></div>
			</div>
			<span class="text-xs tabular-nums text-slate-500"
				>{revealedCount} / {journeyStats.steps} revealed</span
			>
		</div>
	</header>

	{#each phases as phase, pi (phase.id)}
		{@const tone = TONE[phase.accent]}
		<section class="mb-6">
			<div class="flex items-start gap-3">
				<span
					class="grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold {tone.circle}"
				>
					{pi + 1}
				</span>
				<div class="pt-0.5">
					<h2 class="text-lg font-semibold {tone.head}">{phase.title}</h2>
					<p class="mt-0.5 text-sm text-slate-500">{phase.blurb}</p>
				</div>
			</div>

			<div class="mt-3 ml-4 space-y-4 border-l-2 {tone.border} pt-1 pb-2 pl-7">
				{#each phase.steps as step, si (step.id)}
					<JourneyStep
						{step}
						label="{pi + 1}.{si + 1}"
						tone={{ badge: tone.badge, label: tone.label, rail: tone.rail, soft: tone.soft }}
						onreveal={(r) => recordResult(step.id, r)}
					/>
				{/each}
			</div>
		</section>
	{/each}

	{#if allRevealed}
		<section class="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white shadow-lg">
			<div class="flex items-center gap-2">
				<Trophy class="size-5 text-amber-300" />
				<h2 class="text-lg font-semibold">Journey complete</h2>
			</div>
			<p class="mt-3 text-3xl font-bold tabular-nums">
				{accuracy}<span class="text-lg font-medium text-slate-400">% read correctly</span>
			</p>
			<p class="mt-1 text-sm text-slate-300">
				{correct} of {graded} sentiment drivers sorted the right way. {verdict}
			</p>

			<div class="mt-5 grid gap-3 sm:grid-cols-3">
				{#if topPositive}
					<div class="rounded-xl bg-white/5 p-3">
						<div class="flex items-center gap-1.5 text-emerald-300">
							<TrendingUp class="size-4" />
							<span class="text-xs font-semibold uppercase tracking-wide">Strongest pull in</span>
						</div>
						<p class="mt-1.5 text-sm font-semibold">{topPositive.label}</p>
						<p class="text-xs text-slate-400">
							{topPositive.stepTitle} · +{topPositive.avgSentiment.toFixed(2)} avg
						</p>
					</div>
				{/if}
				{#if topNegative}
					<div class="rounded-xl bg-white/5 p-3">
						<div class="flex items-center gap-1.5 text-rose-300">
							<TrendingDown class="size-4" />
							<span class="text-xs font-semibold uppercase tracking-wide">Strongest push back</span>
						</div>
						<p class="mt-1.5 text-sm font-semibold">{topNegative.label}</p>
						<p class="text-xs text-slate-400">
							{topNegative.stepTitle} · {topNegative.avgSentiment.toFixed(2)} avg
						</p>
					</div>
				{/if}
				{#if mostMentioned}
					<div class="rounded-xl bg-white/5 p-3">
						<div class="flex items-center gap-1.5 text-sky-300">
							<MessageSquare class="size-4" />
							<span class="text-xs font-semibold uppercase tracking-wide">Most mentioned</span>
						</div>
						<p class="mt-1.5 text-sm font-semibold">{mostMentioned.label}</p>
						<p class="text-xs text-slate-400">
							{mostMentioned.stepTitle} · {mostMentioned.count} segments
						</p>
					</div>
				{/if}
			</div>
		</section>
	{/if}
</div>

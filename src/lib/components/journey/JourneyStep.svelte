<!--
	JourneyStep — one step of the trial-experience journey map.

	Runs the quiz for its step: the user sorts each sentiment driver into
	"pulled people toward the trial" or "pushed them away", then reveals the
	real average sentiment (shown as a colour + number) alongside how often
	each driver was mentioned. Reports its score up to the page when revealed.
-->
<script lang="ts" module>
	/** −2…+2 diverging scale, matching SentimentBar / SortableBarChart. */
	const STOPS = ['#e11d48', '#fb7185', '#cbd5e1', '#34d399', '#059669'];

	function lerpHex(a: string, b: string, t: number): string {
		const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
		const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
		const mix = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
		return '#' + mix.map((v) => v.toString(16).padStart(2, '0')).join('');
	}

	/** Continuous sentiment (−2…+2) → interpolated hex on the diverging scale. */
	function sentimentColor(v: number): string {
		const x = Math.max(0, Math.min(4, v + 2));
		const i = Math.min(3, Math.floor(x));
		return lerpHex(STOPS[i], STOPS[i + 1], x - i);
	}
</script>

<script lang="ts">
	import type { Step, Pull } from '$lib/content/wctglpdemo-data/journey';
	import { TrendingUp, TrendingDown, Check, X } from '@lucide/svelte';
	import { AppCard } from '$lib/components/ui/app-card';

	type Tone = { badge: string; label: string; rail: string; soft: string };

	let {
		step,
		label,
		tone,
		onreveal
	}: {
		step: Step;
		/** Phase.step ordinal, e.g. "2.3". */
		label: string;
		tone: Tone;
		onreveal: (result: { correct: number; total: number }) => void;
	} = $props();

	// driver id -> the user's guess. Undefined until they sort it.
	let answers = $state<Record<string, 'toward' | 'away'>>({});
	let revealed = $state(false);

	const allAnswered = $derived(step.drivers.every((d) => answers[d.id] !== undefined));

	/** A "mixed" driver counts as correct either way — it has no real lean. */
	function isCorrect(driverId: string, pull: Pull): boolean {
		return pull === 'mixed' || answers[driverId] === pull;
	}

	const score = $derived(
		step.drivers.reduce((n, d) => n + (isCorrect(d.id, d.pull) ? 1 : 0), 0)
	);

	const maxCount = $derived(Math.max(1, ...step.drivers.map((d) => d.count)));

	function choose(driverId: string, guess: 'toward' | 'away') {
		if (revealed) return;
		answers = { ...answers, [driverId]: guess };
	}

	function reveal() {
		if (!allAnswered || revealed) return;
		revealed = true;
		onreveal({ correct: score, total: step.drivers.length });
	}

	// Steps with no tagged drivers can't be quizzed — report a no-op result so
	// the page's "all revealed" tally still completes.
	$effect(() => {
		if (step.drivers.length === 0 && !revealed) {
			revealed = true;
			onreveal({ correct: 0, total: 0 });
		}
	});

	const PULL_TRUTH: Record<Pull, string> = {
		toward: 'Drew people in',
		away: 'Put people off',
		mixed: 'Genuinely mixed'
	};
</script>

<AppCard variant="finding" tag="article">
	<header class="flex items-start gap-3 border-b border-slate-100 p-4">
		<span
			class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold {tone.badge}"
		>
			{label}
		</span>
		<div class="min-w-0">
			<h3 class="text-base font-semibold text-slate-900">{step.title}</h3>
			<p class="mt-0.5 text-sm text-slate-500">{step.blurb}</p>
		</div>
	</header>

	{#if step.drivers.length === 0}
		<p class="p-4 text-sm text-slate-400">Not enough tagged data to quiz this step.</p>
	{:else}
		<div class="p-4">
			{#if !revealed}
				<p class="mb-3 text-sm text-slate-600">
					Across <span class="font-semibold text-slate-900">{step.segmentCount}</span> coded
					segments, which way did each driver pull participants — toward joining the trial, or
					away from it?
				</p>
			{/if}

			<ul class="space-y-2">
				{#each step.drivers as driver (driver.id)}
					{@const guess = answers[driver.id]}
					{@const correct = isCorrect(driver.id, driver.pull)}
					<li
						class="rounded-lg border p-2.5 transition-colors
							{revealed
							? correct
								? 'border-emerald-200 bg-emerald-50/60'
								: 'border-rose-200 bg-rose-50/60'
							: 'border-slate-200'}"
					>
						<div class="flex items-center gap-3">
							<span
								class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide
									{driver.kind === 'theme'
									? 'bg-slate-100 text-slate-600'
									: 'bg-violet-100 text-violet-700'}"
							>
								{driver.kind === 'theme' ? 'Theme' : 'Word'}
							</span>
							<span class="min-w-0 flex-1 truncate text-sm font-medium text-slate-800"
								>{driver.label}</span
							>

							{#if revealed}
								<span
									class="shrink-0"
									title={correct ? 'You read it right' : 'Missed this one'}
								>
									{#if correct}
										<Check class="size-4 text-emerald-600" />
									{:else}
										<X class="size-4 text-rose-500" />
									{/if}
								</span>
							{:else}
								<div class="flex shrink-0 gap-1">
									<button
										type="button"
										onclick={() => choose(driver.id, 'toward')}
										aria-pressed={guess === 'toward'}
										class="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors
											{guess === 'toward'
											? 'border-emerald-500 bg-emerald-500 text-white'
											: 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'}"
									>
										<TrendingUp class="size-3.5" />
										Toward
									</button>
									<button
										type="button"
										onclick={() => choose(driver.id, 'away')}
										aria-pressed={guess === 'away'}
										class="flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors
											{guess === 'away'
											? 'border-rose-500 bg-rose-500 text-white'
											: 'border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-600'}"
									>
										<TrendingDown class="size-3.5" />
										Away
									</button>
								</div>
							{/if}
						</div>

						{#if revealed}
							<div class="mt-2 flex items-center gap-3 pl-1">
								<!-- Frequency: how commonly the driver was mentioned. -->
								<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
									<div
										class="h-full rounded-full {tone.rail}"
										style="width: {(driver.count / maxCount) * 100}%"
									></div>
								</div>
								<span class="shrink-0 text-xs tabular-nums text-slate-400">
									{driver.count} {driver.count === 1 ? 'segment' : 'segments'}
								</span>
								<!-- Sentiment: shown alongside frequency, per the brief. -->
								<span
									class="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white"
									style="background-color: {sentimentColor(driver.avgSentiment)}"
									title="Average sentiment of the segments mentioning this driver"
								>
									{PULL_TRUTH[driver.pull]}
									<span class="tabular-nums opacity-90">
										{driver.avgSentiment > 0 ? '+' : ''}{driver.avgSentiment.toFixed(2)}
									</span>
								</span>
							</div>
						{/if}
					</li>
				{/each}
			</ul>

			<footer class="mt-3">
				{#if revealed}
					<p class="text-sm font-medium text-slate-700">
						You read <span class="{tone.label}">{score}</span> of {step.drivers.length}
						drivers correctly.
					</p>
				{:else}
					<button
						type="button"
						onclick={reveal}
						disabled={!allAnswered}
						class="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
					>
						{allAnswered ? 'Reveal this step' : 'Sort every driver to reveal'}
					</button>
				{/if}
			</footer>
		</div>
	{/if}
</AppCard>

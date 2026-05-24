<!--
	Trial designer — an interactive, booth-friendly "pick a barrier" simulator.

	The visitor selects the trial-logistics factors they would address in a trial
	design; the page surfaces the verbatim lines participants gave on each, and
	tallies how many of the interviewees raised it. Turns the codebook's
	"Clinical Trial Motivators & Barriers" group into a decision tool.
-->
<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import {
		subthemeTags,
		fragmentsMatching,
		titleCase,
		themedParticipantIds,
		type ThemeFragment
	} from '$lib/content/wctglpdemo-data/analysis';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';

	const SENT_COLOR: Record<number, string> = {
		[-2]: '#e11d48',
		[-1]: '#fb7185',
		0: '#94a3b8',
		1: '#34d399',
		2: '#059669'
	};
	const SENT_LABEL: Record<number, string> = {
		[-2]: 'Strongly negative',
		[-1]: 'Negative',
		0: 'Neutral / mixed',
		1: 'Positive',
		2: 'Strongly positive'
	};
	const clampS = (s: number) => Math.max(-2, Math.min(2, Math.round(s)));

	const TOTAL = themedParticipantIds.length;

	type Quote = { segmentId: string; text: string; interviewId: string; sentiment: number };
	type Factor = {
		id: string;
		label: string;
		description: string;
		participantCount: number;
		segmentCount: number;
		meanSentiment: number;
		quotes: Quote[]; // one representative line per participant
	};

	/** Prefer a moderate-length, not-too-short line as the participant's quote. */
	const quoteScore = (f: ThemeFragment) =>
		-Math.abs(f.text.length - 150) - (f.text.length < 50 ? 1000 : 0);

	// Codebook 2.0's clinical-trial subthemes (motivators + barriers) as
	// pickable factors. Note: this collapses 10+ old themes down to 2 broad
	// subthemes. Future iteration could surface keyword clusters under each
	// subtheme for finer-grained pick options.
	const TRIAL_FACTOR_IDS = new Set(['trial_motivators', 'trial_barriers']);
	const factors: Factor[] = subthemeTags
		.filter((s) => TRIAL_FACTOR_IDS.has(s.id))
		.map((s) => {
			const frags = fragmentsMatching((a) => a.subthemes.includes(s.id));
			const byParticipant = new Map<string, ThemeFragment>();
			for (const f of frags) {
				const cur = byParticipant.get(f.interview_id);
				if (!cur || quoteScore(f) > quoteScore(cur)) byParticipant.set(f.interview_id, f);
			}
			const quotes = [...byParticipant.values()]
				.map((f) => ({
					segmentId: f.segment_id,
					text: f.text,
					interviewId: f.interview_id,
					sentiment: f.sentiment
				}))
				.sort((a, b) => a.interviewId.localeCompare(b.interviewId));
			return {
				id: s.id,
				label: s.label ?? titleCase(s.id),
				description: s.description ?? '',
				participantCount: byParticipant.size,
				segmentCount: frags.length,
				meanSentiment: frags.length
					? frags.reduce((s, f) => s + f.sentiment, 0) / frags.length
					: 0,
				quotes
			};
		})
		.filter((f) => f.segmentCount > 0)
		.sort((a, b) => b.participantCount - a.participantCount);

	const selected = new SvelteSet<string>();
	const selectedFactors = $derived(factors.filter((f) => selected.has(f.id)));
	// distinct participants who raised at least one selected factor
	const reach = $derived(
		new Set(selectedFactors.flatMap((f) => f.quotes.map((q) => q.interviewId)))
	);

	function toggle(id: string) {
		if (selected.has(id)) selected.delete(id);
		else selected.add(id);
	}
</script>

<div class="flex flex-1 flex-col">
	<!-- Hero -->
	<div
		class="flex h-80 w-full flex-col justify-center bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten"
	>
		<div class="mx-auto flex w-full max-w-7xl flex-col gap-3 px-8">
			<span class="figcaption text-white">GLP-1 Interviews</span>
			<h1 class="font-heading text-5xl font-light capitalize text-primary-foreground md:text-7xl">
				Design a trial they'd join
			</h1>
			<p class="max-w-2xl text-lg leading-7 text-primary-foreground/85">
				Pick the motivators and barriers you'd build your trial around. Each one is drawn from
				what {TOTAL} interviewees actually said — select a few and hear them in their own words.
			</p>
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-6xl flex-col gap-10 px-8 py-16">
		<!-- Factor picker -->
		<section class="flex flex-col gap-5">
			<div class="flex flex-wrap items-end justify-between gap-3 border-b border-(--primary)/15 pb-4">
				<div class="flex flex-col gap-2">
					<span class="caption uppercase text-accent-mint">Step 1</span>
					<h2 class="font-heading text-4xl font-light uppercase text-primary">
						Which factors would you address?
					</h2>
					<p class="max-w-2xl text-base text-muted-foreground">
						Tap the trial logistics that matter to your design. The number on each card is how
						many of the {TOTAL} interviewees raised it; the colour is their average sentiment.
					</p>
				</div>
				{#if selected.size}
					<button
						type="button"
						class="shrink-0 rounded-full border border-(--ink)/20 bg-(--paper) px-3.5 py-1.5 text-sm text-foreground transition-colors hover:bg-(--ink)/5"
						onclick={() => selected.clear()}
					>
						Clear all
					</button>
				{/if}
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each factors as f (f.id)}
					{@const on = selected.has(f.id)}
					{@const sc = SENT_COLOR[clampS(f.meanSentiment)]}
					<button
						type="button"
						aria-pressed={on}
						class="flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-150
							{on
							? 'border-accent-mint bg-accent-mint/10 shadow-sm'
							: 'border-(--ink)/15 bg-(--paper) hover:border-(--ink)/30'}"
						onclick={() => toggle(f.id)}
					>
						<div class="flex items-start justify-between gap-2">
							<span class="font-heading text-lg font-medium text-primary">{f.label}</span>
							<span
								class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs
									{on ? 'border-accent-mint bg-accent-mint text-white' : 'border-(--ink)/25 text-transparent'}"
								>✓</span
							>
						</div>
						<p class="text-sm leading-snug text-muted-foreground">{f.description}</p>
						<div class="mt-1 flex items-center gap-2">
							<span class="text-sm font-semibold text-foreground">
								{f.participantCount} of {TOTAL}
							</span>
							<span class="text-xs text-muted-foreground">raised this</span>
							<span class="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
								<span class="size-2.5 rounded-full" style:background-color={sc}></span>
								{SENT_LABEL[clampS(f.meanSentiment)]}
							</span>
						</div>
					</button>
				{/each}
			</div>
		</section>

		<!-- Results -->
		<section class="flex flex-col gap-5">
			<div class="flex flex-col gap-2 border-b border-(--primary)/15 pb-4">
				<span class="caption uppercase text-accent-mint">Step 2</span>
				<h2 class="font-heading text-4xl font-light uppercase text-primary">
					What patients told us
				</h2>
			</div>

			{#if selected.size === 0}
				<p
					class="rounded-xl border border-dashed border-(--ink)/25 p-12 text-center text-muted-foreground"
				>
					Select one or more factors above to hear the interviews behind them.
				</p>
			{:else}
				<!-- headline tally -->
				<div class="flex flex-col gap-1 rounded-xl bg-accent-mint/10 p-6">
					<p class="font-heading text-2xl font-light text-primary md:text-3xl">
						Your design speaks to
						<span class="font-medium text-accent-mint">{reach.size} of {TOTAL}</span>
						interviewees
					</p>
					<p class="text-sm text-muted-foreground">
						across {selected.size}
						{selected.size === 1 ? 'factor' : 'factors'} —
						{selectedFactors.reduce((n, f) => n + f.segmentCount, 0)} tagged moments in all.
					</p>
				</div>

				<!-- quotes per selected factor -->
				{#each selectedFactors as f (f.id)}
					<div class="flex flex-col gap-3">
						<div class="flex items-baseline gap-2">
							<h3 class="font-heading text-xl font-medium text-primary">{f.label}</h3>
							<span class="text-sm text-muted-foreground">
								{f.participantCount} of {TOTAL} raised this
							</span>
						</div>
						<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
							{#each f.quotes as q (q.segmentId)}
								<figure
									class="flex flex-col gap-3 rounded-xl border border-(--ink)/12 bg-(--paper) p-4"
								>
									<blockquote class="text-base leading-relaxed text-foreground">
										“{q.text}”
									</blockquote>
									<figcaption class="flex items-center gap-2">
										<ParticipantAvatar interviewId={q.interviewId} size="sm" />
										<span class="text-sm text-muted-foreground">
											{titleCase(q.interviewId)}
										</span>
										<span
											class="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground"
										>
											<span
												class="size-2.5 rounded-full"
												style:background-color={SENT_COLOR[clampS(q.sentiment)]}
											></span>
											{SENT_LABEL[clampS(q.sentiment)]}
										</span>
									</figcaption>
								</figure>
							{/each}
						</div>
					</div>
				{/each}
			{/if}
		</section>
	</div>
</div>

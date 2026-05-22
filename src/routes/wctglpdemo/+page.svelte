<!--
	Executive summary — the GLP-1 Lab Book landing page.

	A programmatic read of the interview corpus: an opening paragraph and
	headline stats, the overall sentiment lean, and five cross-cutting findings
	(brightest / hardest moment, GLP-1 drugs vs. methods, most-discussed and
	most-divisive topic). Each card carries a donut of its positive/negative
	split and a supporting quote, and opens a drawer of the coded segments
	behind it. All copy is generated in
	$lib/content/wctglpdemo-data/executive-summary.ts from the pipeline outputs.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { MoveUpRight, Star, ArrowRight } from '@lucide/svelte';
	import {
		summaryStats,
		summaryText,
		sentimentLean,
		buildFindings,
		type Finding
	} from '$lib/content/wctglpdemo-data/executive-summary';
	import KeyQuoteCard from '$lib/components/KeyQuoteCard.svelte';
	import ParticipantDrawer from '$lib/components/ParticipantDrawer.svelte';
	import SentimentDonut from '$lib/components/SentimentDonut.svelte';
	import SentimentBar from '$lib/components/SentimentBar.svelte';
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import CodedFragmentCard from '$lib/components/CodedFragmentCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Participant profiles — seeded from the server, updated locally when the
	// drawer persists an edit.
	let profiles = $state(untrack(() => data.participantProfiles));

	// Findings, with each supporting quote resolved against the analyst's stars.
	const findings = buildFindings(untrack(() => data.starredQuoteIds));

	// --- Participant details drawer ---
	let participantDrawerOpen = $state(false);
	let participantDrawerId = $state<string | null>(null);

	function openParticipant(id: string) {
		participantDrawerId = id;
		participantDrawerOpen = true;
	}

	// --- Finding drawer — the coded segments behind one finding ---
	let findingDrawerOpen = $state(false);
	let activeFinding = $state<Finding | null>(null);

	function openFinding(f: Finding) {
		activeFinding = f;
		findingDrawerOpen = true;
	}

	const headlineStats = [
		{ value: summaryStats.interviews, label: 'interviews' },
		{ value: summaryStats.segments, label: 'coded segments' },
		{ value: summaryStats.themes, label: 'themes' },
		{ value: summaryStats.quotes, label: 'pull quotes' }
	];

	// Per-tone styling for the finding cards.
	const tone: Record<Finding['tone'], { accent: string }> = {
		positive: { accent: 'text-emerald-700' },
		negative: { accent: 'text-rose-700' },
		divisive: { accent: 'text-amber-700' },
		neutral: { accent: 'text-accent-mint' }
	};

	const explore = [
		{
			href: '/wctglpdemo/fingerprint',
			title: 'Participant fingerprint',
			blurb: "Each interviewee's distinctive theme profile."
		},
		{
			href: '/wctglpdemo/interview-words',
			title: 'What patients said',
			blurb: 'Sortable word-usage and theme charts.'
		},
		{
			href: '/wctglpdemo/journey',
			title: 'Trial journey',
			blurb: 'The interview recut as an awareness-to-participation arc.'
		}
	];
</script>

<div class="flex flex-1 flex-col gap-6">
	<div
		class="mx-auto flex h-96 w-full flex-col justify-center bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center align-middle bg-blend-lighten"
	>
		<div class="flex w-full flex-col gap-2">
			<span class="pill-white mx-auto mb-8 text-base">Executive summary</span>
			<p
				class="mx-auto justify-center text-pretty text-center text-2xl leading-8 text-primary-foreground md:w-5xl md:text-5xl md:font-light md:leading-11"
			>
				<span class="font-bold text-primary-foreground">GLP-1</span> Patient Insights Lab Book
			</p>
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-6xl flex-col gap-14 px-8 pt-8 pb-16">
		<!-- Opening read — programmatic paragraph, headline stats, sentiment lean. -->
		<section class="flex flex-col gap-8">
			<div class="flex flex-col gap-4">
				<h2 class="text-2xl font-medium uppercase tracking-wide text-accent-mint">
					The short version
				</h2>
				<p class="max-w-4xl text-pretty text-xl leading-9 text-slate-700 md:text-2xl md:leading-10">
					{summaryText}
				</p>
			</div>

			<div class="grid grid-cols-2 gap-px border bg-slate-200 md:grid-cols-4">
				{#each headlineStats as stat (stat.label)}
					<div class="flex flex-col gap-1 bg-white p-5">
						<span class="font-heading text-4xl font-light text-accent-mint">{stat.value}</span>
						<span class="text-xs uppercase tracking-wide text-slate-500">{stat.label}</span>
					</div>
				{/each}
			</div>

			<!-- Overall sentiment lean across every coded segment. -->
			<div class="flex flex-col gap-3">
				<div class="flex items-baseline justify-between">
					<h3 class="text-sm font-medium uppercase tracking-wide text-slate-500">
						Sentiment across {sentimentLean.total} coded segments
					</h3>
					<span class="text-sm text-slate-500">
						Leans <span class="font-medium text-slate-700">{sentimentLean.lean}</span>
					</span>
				</div>
				<div class="flex h-3 w-full overflow-hidden rounded-full">
					<div class="bg-emerald-400" style="width: {sentimentLean.posPct}%"></div>
					<div class="bg-slate-200" style="width: {sentimentLean.neutralPct}%"></div>
					<div class="bg-rose-400" style="width: {sentimentLean.negPct}%"></div>
				</div>
				<div class="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
					<span class="flex items-center gap-1.5">
						<span class="size-2.5 rounded-full bg-emerald-400"></span>
						Positive — {sentimentLean.positive} ({sentimentLean.posPct}%)
					</span>
					<span class="flex items-center gap-1.5">
						<span class="size-2.5 rounded-full bg-slate-200"></span>
						Neutral / mixed — {sentimentLean.neutral} ({sentimentLean.neutralPct}%)
					</span>
					<span class="flex items-center gap-1.5">
						<span class="size-2.5 rounded-full bg-rose-400"></span>
						Negative — {sentimentLean.negative} ({sentimentLean.negPct}%)
					</span>
				</div>
			</div>
		</section>

		<!-- Key findings — cluster-driven cards, each opening a segment drawer. -->
		<section class="flex flex-col gap-5">
			<div class="flex flex-col gap-1">
				<h2 class="text-2xl font-medium uppercase tracking-wide text-accent-mint">Key findings</h2>
				<p class="text-sm text-muted-foreground">
					The keyword clusters that drove the interviews' sharpest reactions — and the expected
					barriers that didn't. Select a finding to read the coded segments behind it.
				</p>
			</div>

			<div class="grid gap-4 md:grid-cols-2">
				{#each findings as f (f.id)}
					{@const t = tone[f.tone]}
					<div
						role="button"
						tabindex="0"
						onclick={() => openFinding(f)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								openFinding(f);
							}
						}}
						class="group hover:cursor-pointer flex cursor-pointer flex-col gap-4 border border-slate-200 bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-accent-mint hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-mint"
					>
						<div class="flex items-start justify-between gap-4">
							<div class="flex flex-col gap-2">
								<span class="text-xs font-semibold uppercase tracking-wide {t.accent}">
									{f.eyebrow}
								</span>
								<h3 class="text-lg font-medium text-slate-800">{f.headline}</h3>
							</div>
							<SentimentDonut
								positive={f.distribution.positive}
								neutral={f.distribution.neutral}
								negative={f.distribution.negative}
							/>
						</div>

						<p class="text-sm leading-6 text-slate-600">{f.detail}</p>
						<p class="text-xs text-slate-400">
							<span class="text-sm font-medium {t.accent}">{f.stat.value}</span>
							· {f.stat.caption}
						</p>

						{#if f.clusters.length}
							{@const maxCount = Math.max(...f.clusters.map((c) => c.count))}
							<div class="flex flex-col gap-2.5 border-t border-slate-100 pt-4">
								<span class="text-xs font-semibold uppercase tracking-wide text-slate-400">
									Keyword clusters · one block per coded segment
								</span>
								<div class="flex flex-col gap-2">
									{#each f.clusters as c (c.id)}
										<SentimentBar
											label={c.label}
											blocks={c.blocks}
											max={maxCount}
											labelClass="w-36"
										/>
									{/each}
								</div>
							</div>
						{/if}

						{#if f.quote}
							<div class="flex flex-col gap-2 border-t border-slate-100 pt-4">
								<KeyQuoteCard
									text={f.quote.text}
									sentiment={f.quote.sentiment}
									interviewId={f.quote.interview_id}
									questionId={f.quote.question_id}
									{profiles}
									onparticipant={openParticipant}
									size="lg"
								/>
								{#if f.quote.isStarred}
									<span
										class="flex items-center gap-1 self-center text-xs text-amber-600"
										title="Analyst-starred highlight"
									>
										<Star class="size-3.5 fill-amber-400 text-amber-400" />
										Starred
									</span>
								{/if}
							</div>
						{/if}

						<span
							class="mt-auto flex items-center gap-1 pt-1 text-sm font-medium {t.accent}"
						>
							View {f.fragments.length} coded segments
							<ArrowRight
								class="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
							/>
						</span>
					</div>
				{/each}
			</div>
		</section>

		<!-- Onward — the read-only views over the same dataset. -->
		<section class="flex flex-col gap-4">
			<h2 class="text-2xl font-medium uppercase tracking-wide text-accent-mint">Go deeper</h2>
			<div class="grid gap-4 md:grid-cols-3">
				{#each explore as out (out.href)}
					<a
						href={out.href}
						class="flex flex-col gap-2 border p-6 duration-300 ease-in-out hover:-translate-y-2 hover:text-muted-foreground"
					>
						<div class="flex flex-row items-start justify-between gap-3">
							<h3 class="text-lg font-medium uppercase tracking-tight text-accent-mint">
								{out.title}
							</h3>
							<MoveUpRight class="size-5 shrink-0 text-accent-mint" />
						</div>
						<p class="text-sm">{out.blurb}</p>
					</a>
				{/each}
			</div>
		</section>
	</div>
</div>

<!-- Participant details drawer -->
<ParticipantDrawer
	bind:open={participantDrawerOpen}
	interviewId={participantDrawerId}
	bind:profiles
/>

<!-- Finding drawer — the coded segments behind the selected finding -->
<RightDrawer bind:open={findingDrawerOpen}>
	{#if activeFinding}
		<div class="flex h-full flex-col">
			<div class="flex flex-col gap-1 border-b border-slate-200 p-6">
				<span class="figcaption text-accent-mint">{activeFinding.eyebrow}</span>
				<h2 class="font-heading text-2xl font-light text-primary">{activeFinding.headline}</h2>
				<p class="text-sm text-muted-foreground">
					{activeFinding.detail}
				</p>
				<p class="pt-1 text-xs uppercase tracking-wide text-slate-400">
					{activeFinding.fragments.length} coded segments
				</p>
			</div>

			<div class="flex flex-1 flex-col gap-3 overflow-y-auto p-6">
				{#each activeFinding.fragments as f (f.segment_id)}
					<CodedFragmentCard fragment={f} {profiles} />
				{:else}
					<p
						class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500"
					>
						No coded segments behind this finding.
					</p>
				{/each}
			</div>
		</div>
	{/if}
</RightDrawer>

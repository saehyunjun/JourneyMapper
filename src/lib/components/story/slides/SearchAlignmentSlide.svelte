
<!--
	SearchAlignmentSlide — story-mode wrapper around SearchInterviewAlignment.

	Two-way coupling with the chart, same shape as TopicAlignmentSlide:
	  - Slide owns `activeId` so the right-pane narrative tracks the focused
	    row. Defaults to the strongest matched pair on enter.
	  - When the user hovers any row (matched OR gap), the chart fires
	    `onActiveChange` with a discriminated RowFocus payload describing
	    what was hit. The slide routes that payload to a per-kind narrative
	    generator (narrativeForMatchedPair / narrativeForSearchGap /
	    narrativeForInterviewGap).
	  - Hovering away resets to the default narrative (`narrativeOverview`)
	    so the right pane still reads as a complete slide.
-->
<script lang="ts">
	import StorySlide from '../StorySlide.svelte';
	import SearchInterviewAlignment, {
		type RowFocus
	} from '$lib/components/SearchInterviewAlignment.svelte';
	import {
		narrativeForMatchedPair,
		narrativeForSearchGap,
		narrativeForInterviewGap,
		narrativeOverview,
		type AlignmentRowNarrative
	} from '$lib/content/wctglpdemo-data/search-interview-alignment';
	import type { SearchAlignmentSlide as SearchAlignmentSlideData } from '$lib/story/types';

	let { slide }: { slide: SearchAlignmentSlideData } = $props();

	let focused = $state<RowFocus | null>(null);

	const overview = $derived<AlignmentRowNarrative>(narrativeOverview(slide.data));
	const rowNarrative = $derived<AlignmentRowNarrative>(
		focused
			? focused.kind === 'matched'
				? narrativeForMatchedPair(focused.pair)
				: focused.kind === 'search'
					? narrativeForSearchGap(focused.item)
					: narrativeForInterviewGap(focused.item)
			: overview
	);

	// Activeid is what we pass back into the component to drive its scale-up
	// behavior. When nothing is focused, leave it null so the chart renders
	// flat.
	const activeId = $derived<string | null>(
		focused
			? focused.kind === 'matched'
				? `match:${focused.pair.matchKey}`
				: focused.kind === 'search'
					? `search:${focused.item.query}`
					: `interview:${focused.item.clusterId}`
			: null
	);

	// Stable key for the narrative card so the fade-in plays on every focus
	// change. Falls back to '__overview' when nothing is focused.
	const narrativeKey = $derived(activeId ?? '__overview');

	// Chip describing what kind of row is in view — gives the reader an
	// immediate tag without reading the headline.
	const focusKind = $derived(focused?.kind ?? null);
	function chipLabel(k: typeof focusKind): string {
		switch (k) {
			case 'matched':
				return 'Matched pair';
			case 'search':
				return 'Search gap';
			case 'interview':
				return 'Interview gap';
			default:
				return 'Overview';
		}
	}
	function chipColor(k: typeof focusKind): string {
		switch (k) {
			case 'matched':
				return '#CC6324';
			case 'search':
				return '#CC6324';
			case 'interview':
				return '#599077';
			default:
				return '#312f28';
		}
	}
</script>

<StorySlide emphasis="visual">
	{#snippet visual()}
		<div class="alignment-wrap">
			<SearchInterviewAlignment
				data={slide.data}
				{activeId}
				onActiveChange={(f) => (focused = f)}
			/>
		</div>
	{/snippet}

	{#snippet narrative()}
		<span
			class="story-fade-in font-heading text-xs font-semibold uppercase tracking-[0.14em] text-accent-mint"
			style="--delay: 80ms;"
		>
			{slide.eyebrow}
		</span>

		{#key narrativeKey}
			<div class="narrative-card">
				<span
					class="card-chip font-mono"
					style="border-color: {chipColor(focusKind)}; color: {chipColor(focusKind)};"
				>
					{chipLabel(focusKind)}
				</span>
				<h2
					class="card-headline story-fade-in font-heading text-2xl font-light leading-snug text-primary md:text-3xl"
					style="--delay: 80ms;"
				>
					{rowNarrative.headline}
				</h2>
				<p
					class="card-body story-fade-in max-w-md text-pretty text-base leading-relaxed text-secondary-foreground"
					style="--delay: 200ms;"
				>
					{rowNarrative.body}
				</p>

				{#if rowNarrative.quote}
					<blockquote class="card-quote story-fade-in" style="--delay: 320ms;">
						<span class="quote-mark">"</span>
						<span class="quote-text">{rowNarrative.quote.text}</span>
						{#if rowNarrative.quote.attribution}
							<cite class="quote-cite font-mono">— {rowNarrative.quote.attribution}</cite>
						{/if}
					</blockquote>
				{/if}
			</div>
		{/key}

		<p
			class="story-fade-in max-w-md text-xs font-mono uppercase tracking-[0.08em] text-muted-foreground"
			style="--delay: 520ms; margin-top: auto;"
		>
			Hover any row — matched or gap — to swap the read.
		</p>
	{/snippet}
</StorySlide>

<style>
	.alignment-wrap {
		display: flex;
		flex-direction: column;
		justify-content: center;
		width: 100%;
		max-width: 720px;
	}

	.narrative-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.card-chip {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		border: 1px solid;
		background: white;
		font-weight: 600;
	}

	.card-headline {
		font-feature-settings: 'ss01' on;
	}

	.card-quote {
		margin-top: 0.5rem;
		padding: 0.75rem 1rem;
		border-left: 2px solid var(--accent-mint, #599077);
		background: rgba(89, 144, 119, 0.04);
		font-size: 0.92rem;
		line-height: 1.5;
		color: var(--ink, #312f28);
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.quote-mark {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--accent-mint, #599077);
	}
	.quote-text { font-style: italic; }
	.quote-cite {
		font-size: 0.7rem;
		color: var(--muted-foreground, #64748b);
		letter-spacing: 0.04em;
		font-style: normal;
	}

	.story-fade-in {
		opacity: 0;
		animation: story-rise 500ms cubic-bezier(0.19, 1, 0.22, 1) var(--delay, 0ms) forwards;
	}
	@keyframes story-rise {
		from { opacity: 0; transform: translateY(8px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	@media (prefers-reduced-motion: reduce) {
		.story-fade-in { animation: none; opacity: 1; }
	}
</style>

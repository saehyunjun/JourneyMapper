
<!--
	TopicAlignmentSlide — story-mode wrapper around TopicAlignment.

	Two-way coupling with the chart:
	  - The slide owns `activeId` so the right-pane rowNarrative is driven by
	    which row is focused. The first row is the default focus on enter.
	  - When the user hovers a different row, the chart fires
	    `onActiveChange` and the slide updates `activeId` to match. Hovering
	    away resets to the default first row.

	The right pane is composed of three blocks:
	  1. Eyebrow + category-name headline (specific to the focused row)
	  2. Narrative body — data-driven 1-2 sentence read of THIS row
	  3. Optional pull quote (LN has no real interview quotes yet; this slot
	     will populate when an indication ships a real quote bank)

	The rowNarrative generator lives in topic-alignment.ts (rowNarrativeForTopicRow)
	so the per-category framing stays close to the data shape and can be
	reused by other consumers of TopicAlignment.
-->
<script lang="ts">
	import StorySlide from '../StorySlide.svelte';
	import TopicAlignment from '$lib/components/TopicAlignment.svelte';
	import {
		narrativeForTopicRow,
		type TopicRow
	} from '$lib/content/wctglpdemo-data/topic-alignment';
	import type { TopicAlignmentSlide as TopicAlignmentSlideData } from '$lib/story/types';

	let { slide }: { slide: TopicAlignmentSlideData } = $props();

	// Default focus is the first row — keeps the right pane meaningful on
	// initial slide enter, before the user has hovered anything.
	const defaultRow = $derived(slide.data.rows[0] ?? null);
	let focusedRow = $state<TopicRow | null>(null);
	const displayRow = $derived(focusedRow ?? defaultRow);
	const rowNarrative = $derived(displayRow ? narrativeForTopicRow(displayRow) : null);
	const activeId = $derived(displayRow?.category.id ?? null);

	function fmtVol(v: number): string {
		if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
		return String(v);
	}
</script>

<StorySlide emphasis="visual">
	{#snippet visual()}
		<div class="topic-wrap">
			<TopicAlignment
				data={slide.data}
				{activeId}
				onActiveChange={(r) => (focusedRow = r)}
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

		{#if displayRow && rowNarrative}
			<!--
				The headline re-keys on category id so the fade-in plays each
				time the focused row changes, treating the right pane as a
				row-bound rowNarrative card.
			-->
			{#key displayRow.category.id}
				<div class="narrative-card">
					<div class="card-eyebrow font-mono">
						<span class="dot" style="background: #CC6324;"></span>
						{fmtVol(displayRow.searchVolume)} searches
						<span class="card-eyebrow-sep">·</span>
						<span class="dot" style="background: #599077;"></span>
						{displayRow.interviewMentions} mentions
					</div>
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
						<blockquote
							class="card-quote story-fade-in"
							style="--delay: 320ms;"
						>
							<span class="quote-mark">"</span>
							<span class="quote-text">{rowNarrative.quote.text}</span>
							{#if rowNarrative.quote.attribution}
								<cite class="quote-cite font-mono">— {rowNarrative.quote.attribution}</cite>
							{/if}
						</blockquote>
					{/if}
				</div>
			{/key}
		{/if}

		<p
			class="story-fade-in max-w-md text-xs font-mono uppercase tracking-[0.08em] text-muted-foreground"
			style="--delay: 520ms; margin-top: auto;"
		>
			Hover any row to swap the read. Each side normalized to its own column
			max — search totals are in thousands, interview totals in tens.
		</p>
	{/snippet}
</StorySlide>

<style>
	.topic-wrap {
		display: flex;
		flex-direction: column;
		justify-content: center;
		width: 100%;
		max-width: 760px;
	}

	.narrative-card {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}
	.card-eyebrow {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--muted-foreground, #64748b);
	}
	.card-eyebrow-sep {
		color: rgba(48, 47, 40, 0.25);
		margin: 0 0.125rem;
	}
	.dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 999px;
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
		margin-right: 0.125rem;
	}
	.quote-text {
		font-style: italic;
	}
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

<!--
	NarrativeCard — editorial callout card.

	The headline is the always-visible asset. The explainer (body, supporting
	points) is reveal-on-expand. The pattern is "the key claim is always
	readable; click for the why."

	At lg with `points.length === 3`, the layout pins text to the TOP-LEFT
	and BOTTOM-LEFT corners and cedes the rest of the card to a spread
	StackedCards deck — per Aaron's 2026-05-29 direction. The stack uses
	wider rotation + offsets than StackedCards' defaults so every card is
	visibly distinct.

	Variant table:

	  xs / sm  → eyebrow + bold headline only
	  md       → + 1-line caption
	  lg       → corner-text layout + spread point-stack on the right;
	             body explainer + kicker visible in bottom-left
-->
<script lang="ts">
	import StackedCards from '$lib/components/StackedCards.svelte';
	import type { BentoSize } from './types';

	type Point = { value?: string | number; label: string };

	type Props = {
		size: BentoSize;
		eyebrow?: string;
		headline: string;
		caption?: string;
		body?: string;
		points?: Point[];
		kicker?: { value: string | number; label: string };
		tone?: 'positive' | 'negative' | 'neutral';
	};

	let {
		size,
		eyebrow,
		headline,
		caption,
		body,
		points = [],
		kicker,
		tone = 'neutral'
	}: Props = $props();

	const showCaption = $derived(
		(size === 'md' || size === 'lg' || size === 'xl') && caption
	);
	const showBody = $derived((size === 'lg' || size === 'xl') && body);
	const showKicker = $derived((size === 'lg' || size === 'xl') && kicker !== undefined);
	// The card stack only appears at lg+ and only when there are exactly 3
	// points. Aaron's rule: card stack lives at lg, nowhere else.
	const usePointStack = $derived(
		(size === 'lg' || size === 'xl') && points.length === 3
	);
	// At lg without a stack, points fall through to a simple list.
	const showPointList = $derived(
		(size === 'lg' || size === 'xl') && points.length > 0 && !usePointStack
	);

	const sizeClass = $derived(`size-${size}`);
	const toneClass = $derived(`tone-${tone}`);

	function stackBg(index: number): string {
		const shades = {
			negative: ['#CA0005', '#E62D32', '#DC5B5E'],
			positive: ['#0F5132', '#1B7E48', '#2EA664'],
			neutral: ['#2F2D27', '#5B5953', '#8A8780']
		};
		return shades[tone][index] ?? shades[tone][shades[tone].length - 1];
	}

	// Spread tuned to the 18rem frame width (constrained in CSS). Offsets
	// are in pixels — kept modest so spread cards stay within the frame
	// instead of overflowing across the card.
	const SPREAD_ROT = [0, -16, 14, -10];
	const SPREAD_TX = [0, -55, 60, -40];
	const SPREAD_TY = [0, 18, 26, 36];
</script>

<article class="narrative-card {sizeClass} {toneClass}" class:has-stack={usePointStack}>
	{#if usePointStack}
		<!-- lg layout: text in two left corners, stack spans middle/right -->
		<header class="corner-top-left">
			{#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
			<h3 class="headline">{headline}</h3>
		</header>
		<div class="stack-area">
			<!-- Frame caps the stack at a sensible size regardless of how wide
				 the outer card grows (the bridge card spans 12 cols when
				 expanded; without this cap the cards balloon out of bounds). -->
			<div class="stack-frame">
				<StackedCards
					items={points}
					aspect="3 / 4"
					showControls={false}
					expandable={false}
					behindRot={SPREAD_ROT}
					behindTx={SPREAD_TX}
					behindTy={SPREAD_TY}
				>
					{#snippet item(p: Point, i: number)}
						<div class="stack-card" style="background: {stackBg(i)};">
							<span class="stack-label">{p.label}</span>
							<span class="stack-value">{p.value ?? ''}</span>
						</div>
					{/snippet}
				</StackedCards>
			</div>
		</div>
		<footer class="corner-bottom-left">
			{#if showCaption}<p class="caption">{caption}</p>{/if}
			{#if showBody}<p class="body">{body}</p>{/if}
			{#if showKicker}
				<div class="kicker">
					<span class="kicker-value">{kicker.value}</span>
					<span class="kicker-label">{kicker.label}</span>
				</div>
			{/if}
		</footer>
	{:else}
		<!-- xs / sm / md and lg-without-3-points: linear stacked layout -->
		<div class="text-col">
			{#if eyebrow}<span class="eyebrow">{eyebrow}</span>{/if}
			<h3 class="headline">{headline}</h3>
			{#if showCaption}<p class="caption">{caption}</p>{/if}
			{#if showBody}<p class="body">{body}</p>{/if}
			{#if showKicker}
				<div class="kicker">
					<span class="kicker-value">{kicker.value}</span>
					<span class="kicker-label">{kicker.label}</span>
				</div>
			{/if}
			{#if showPointList}
				<ul class="point-list">
					{#each points as p (p.label)}
						<li>
							{#if p.value !== undefined}<span class="point-value">{p.value}</span>{/if}
							<span class="point-label">{p.label}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</article>

<style>
	.narrative-card {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1.25rem;
		padding: 1.25rem 1.5rem;
		height: 100%;
		border: none;
		border-radius: 12px;
		background: rgba(48, 47, 40, 0.025);
		position: relative;
		/* Cards in the stack may peek beyond this rect — keep visible. */
		overflow: visible;
	}

	/* lg with-stack layout: text in two left corners, stack dominates */
	.narrative-card.has-stack {
		grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
		grid-template-rows: auto 1fr auto;
		gap: 1rem;
		padding: 1.5rem 1.75rem;
	}
	.corner-top-left {
		grid-column: 1;
		grid-row: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.corner-bottom-left {
		grid-column: 1;
		grid-row: 3;
		align-self: end;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	.stack-area {
		grid-column: 2;
		grid-row: 1 / -1;
		position: relative;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		/* overflow visible so the spread cards can peek beyond the card
		   edges — Aaron 2026-05-29 directive for "visual energy". The
		   stack-frame's max-width still caps the size of each card so
		   the spill is intentional rather than runaway. */
		overflow: visible;
	}
	.stack-frame {
		width: min(100%, 18rem);
		aspect-ratio: 3 / 4;
		position: relative;
	}

	.text-col {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		min-width: 0;
	}

	.eyebrow {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--accent-mint, #047857);
	}

	.headline {
		font-family: var(--font-heading, "Jost", sans-serif);
		font-weight: 500;
		line-height: 1.2;
		letter-spacing: -0.01em;
		color: var(--ink, #312f28);
		margin: 0;
		text-wrap: balance;
	}

	.caption {
		font-family: var(--font-body, "IBM Plex Sans", system-ui);
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--secondary-foreground, #312f28);
		margin: 0;
	}

	.body {
		font-family: var(--font-body, "IBM Plex Sans", system-ui);
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--secondary-foreground, #312f28);
		margin: 0;
		text-wrap: pretty;
	}

	/* Size scale — headline scales prominently. */
	.size-xs .headline { font-size: 1rem; }
	.size-sm .headline { font-size: 1.15rem; }
	.size-md .headline { font-size: 1.35rem; }
	.size-lg .headline { font-size: 1.65rem; }
	.size-xl .headline { font-size: 2rem; }

	.size-xs, .size-sm { padding: 0.875rem 1rem; gap: 0.6rem; }
	.size-md { padding: 1.125rem 1.25rem; }
	.size-lg { padding: 1.5rem 1.75rem; gap: 1.5rem; }
	.size-xl { padding: 1.75rem 2rem; gap: 2rem; }

	/* Kicker stat. */
	.kicker {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-top: 0.25rem;
		padding-top: 0.625rem;
		border-top: 1px solid rgba(48, 47, 40, 0.12);
	}
	.kicker-value {
		font-family: var(--font-heading, "Jost", sans-serif);
		font-size: 1.5rem;
		line-height: 1;
		color: var(--ink, #312f28);
		font-variant-numeric: tabular-nums;
	}
	.kicker-label {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.07em;
		color: var(--muted-foreground, #6b7280);
	}

	/* Linear point list (fallback when not exactly 3 points). */
	.point-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		width: 100%;
	}
	.point-list li {
		display: grid;
		grid-template-columns: 2.5rem minmax(0, 1fr);
		align-items: baseline;
		gap: 0.5rem;
	}
	.point-value {
		font-family: var(--font-heading, "Jost", sans-serif);
		font-size: 1rem;
		color: var(--ink, #312f28);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}
	.point-label {
		font-family: var(--font-body, "IBM Plex Sans", system-ui);
		font-size: 0.82rem;
		color: var(--secondary-foreground, #312f28);
	}

	/* Card stack cards. */
	.stack-card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 1.25rem 1.4rem;
		height: 100%;
		width: 100%;
		border-radius: 22px;
		color: #ffffff;
		box-shadow: 0 14px 36px -14px rgba(48, 47, 40, 0.45);
	}
	.stack-label {
		font-family: var(--font-heading, "Jost", sans-serif);
		font-weight: 700;
		font-size: 1rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: 1.1;
	}
	.stack-value {
		font-family: var(--font-heading, "Jost", sans-serif);
		font-weight: 700;
		font-size: 4.5rem;
		line-height: 0.95;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		align-self: flex-start;
	}
</style>

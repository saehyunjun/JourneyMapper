<!--
	EmotionDyadChip — canonical display for an emotion tag anywhere in the
	app. Renders the two-circle dot indicator (the same visual the segment-
	tag drawer's picker uses) followed by the emotion's title-cased label.

	Resolves the id through the shared Plutchik config in
	$lib/utils/emotion-colors, so the chip's colors and the picker's swatches
	are guaranteed to agree — single source of truth.

	For dyads (ambivalence, hope, anxiety, etc.) the chip shows two adjacent
	circles representing the two constituent primaries. For intensity-level
	ids (joy, sadness, annoyance, etc.) it shows a single circle in that
	primary's intensity shade. Unknown ids fall back to a neutral grey dot
	so the surrounding layout doesn't collapse.

	The optional `subtitle` slot renders the verbose form ("trust + disgust")
	in muted text alongside the headline label — useful in compact stage
	headers where reviewers need to see the dyad's makeup at a glance.
-->
<script lang="ts">
	import {
		emotionDots,
		emotionLabel,
		dyadConstituents
	} from '$lib/utils/emotion-colors';

	type Size = 'sm' | 'md';

	type Props = {
		/** Plutchik emotion id — primary intensity (e.g. "joy", "annoyance")
		 *  or dyad (e.g. "ambivalence", "hope"). */
		id: string | null | undefined;
		/** Whether to render the emotion's title-cased label next to the dot. */
		showLabel?: boolean;
		/** Whether to render the dyad's constituent primaries ("trust + disgust")
		 *  in muted text. Has no effect for intensity-level ids. */
		showConstituents?: boolean;
		size?: Size;
	};

	let {
		id,
		showLabel = true,
		showConstituents = false,
		size = 'sm'
	}: Props = $props();

	const dots = $derived(id ? emotionDots(id) : null);
	const label = $derived(id ? emotionLabel(id) : '');
	const parts = $derived(id ? dyadConstituents(id) : null);

	const dotPx = $derived(size === 'sm' ? 10 : 14);
	const overlapPx = $derived(size === 'sm' ? 8 : 11);
</script>

{#if id && dots}
	<span class="dyad-chip" data-size={size}>
		{#if dots.c2}
			<span
				class="dyad-dots"
				style="width: {overlapPx + dotPx}px; height: {dotPx}px;"
				aria-hidden="true"
			>
				<span
					class="dot"
					style="left: 0; width: {dotPx}px; height: {dotPx}px; background: {dots.c1};"
				></span>
				<span
					class="dot"
					style="left: {overlapPx}px; width: {dotPx}px; height: {dotPx}px; background: {dots.c2};"
				></span>
			</span>
		{:else}
			<span
				class="dot"
				style="position: relative; width: {dotPx}px; height: {dotPx}px; background: {dots.c1};"
				aria-hidden="true"
			></span>
		{/if}

		{#if showLabel}
			<span class="dyad-label">{label}</span>
		{/if}

		{#if showConstituents && parts}
			<span class="dyad-constituents">
				{emotionLabel(parts.a).toLowerCase()} + {emotionLabel(parts.b).toLowerCase()}
			</span>
		{/if}
	</span>
{/if}

<style>
	.dyad-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		line-height: 1;
	}
	.dyad-chip[data-size='md'] {
		font-size: 0.875rem;
		gap: 0.5rem;
	}
	.dyad-dots {
		position: relative;
		display: inline-block;
		flex-shrink: 0;
	}
	.dot {
		position: absolute;
		top: 0;
		display: inline-block;
		border-radius: 9999px;
		border: 1px solid rgba(0, 0, 0, 0.1);
	}
	.dyad-label {
		font-weight: 500;
		color: var(--ink, #312f28);
		text-transform: capitalize;
		letter-spacing: 0.01em;
	}
	.dyad-constituents {
		font-size: 0.65em;
		color: var(--muted-foreground, #64748b);
		letter-spacing: 0.04em;
		text-transform: lowercase;
	}
</style>

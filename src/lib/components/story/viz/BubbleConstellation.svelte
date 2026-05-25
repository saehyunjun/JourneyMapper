<!--
	BubbleConstellation — packed driver bubbles laid out inside an implicit
	circular stage. Read as "these colored bubbles are the top drivers."
	The bubbles fade + scale in with a deliberate stagger; `replayKey` change
	re-plays the entrance.

	Bubbles carry their own hover state via the underlying BubbleCluster.
-->
<script lang="ts">
	import BubbleCluster from './BubbleCluster.svelte';
	import type { BubbleSpec, SlideTone } from '$lib/story/types';

	let {
		bubbles,
		tone: _tone = 'neutral',
		size = 320,
		variant = 'story',
		replayKey = 0,
		/** Inner padding (each side) inside the stage area. */
		ringPadding = 18,
		/** Reserved buffer (each side) for bubble name labels + leader lines
		 * that sit just outside the bubble area. Counted against `size` so the
		 * component's bounding box always equals `size`. */
		labelPadding = 96
	}: {
		bubbles: BubbleSpec[];
		tone?: SlideTone;
		size?: number;
		variant?: 'static' | 'story' | 'export';
		replayKey?: number;
		ringPadding?: number;
		labelPadding?: number;
	} = $props();

	const BUBBLE_ENTRANCE_OFFSET_MS = 120;
	const BUBBLE_STAGGER_MS = 180;
	const BUBBLE_DURATION_MS = 700;

	const stageOuter = $derived(Math.max(0, size - labelPadding * 2));
	const innerSize = $derived(Math.max(0, stageOuter - ringPadding * 2));
	const innerOffset = $derived(labelPadding + (stageOuter - innerSize) / 2);
</script>

<div class="constellation" style:width="{size}px" style:height="{size}px">
	<div
		class="inner"
		style:width="{innerSize}px"
		style:height="{innerSize}px"
		style:left="{innerOffset}px"
		style:top="{innerOffset}px"
	>
		<BubbleCluster
			{bubbles}
			size={innerSize}
			{variant}
			{replayKey}
			stageFill="transparent"
			entranceStartMs={BUBBLE_ENTRANCE_OFFSET_MS}
			bubbleStaggerMs={BUBBLE_STAGGER_MS}
			bubbleDurationMs={BUBBLE_DURATION_MS}
			shadeFloor={100}
		/>
	</div>
</div>

<style>
	.constellation {
		position: relative;
		display: inline-block;
	}

	.inner {
		position: absolute;
	}
</style>

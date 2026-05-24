
<!--
	StorySlide — editorial 2-column container shared by every slide template.

	45/55 visual / narrative split on desktop; stacked on mobile with the
	visualization first, narrative below. The frame stays fixed across slides;
	only the slotted content changes. Slides should fill the slotted area and
	manage their own internal animation via $lib/motion/viz.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		visual,
		narrative,
		emphasis = 'balanced'
	}: {
		visual: Snippet;
		narrative: Snippet;
		/** 'balanced' = 45/55; 'visual' = 60/40; 'narrative' = 35/65. */
		emphasis?: 'balanced' | 'visual' | 'narrative';
	} = $props();

	const cols = $derived(
		emphasis === 'visual'
			? 'md:[grid-template-columns:6fr_4fr]'
			: emphasis === 'narrative'
				? 'md:[grid-template-columns:35fr_65fr]'
				: 'md:[grid-template-columns:45fr_55fr]'
	);
</script>

<div
	class="grid h-full w-full grid-cols-1 gap-10 px-8 py-10 md:gap-16 md:px-16 md:py-14 {cols}"
>
	<div class="flex min-h-0 flex-col items-center justify-center">
		{@render visual()}
	</div>
	<div class="flex min-h-0 flex-col justify-center gap-5">
		{@render narrative()}
	</div>
</div>

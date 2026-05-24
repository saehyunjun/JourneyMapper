
<!--
	ExecutiveSummaryStory — top-level shell for the Executive Summary story
	mode.

	Owns three pieces of state:
	  - the active slide index (driven by StoryFrame's nav callbacks)
	  - the assembled slide deck (derived from the host's StoryInput)
	  - the detail drawer state (which SlideDetail is open, if any)

	Slides receive an `onOpenDetail` callback; firing it pops the drawer
	with the slide's drivers + tagged quotes. Drawer state survives slide
	navigation so the user can scrub the deck with the drawer still open.
-->
<script lang="ts">
	import StoryFrame from './StoryFrame.svelte';
	import OpeningSlide from './slides/OpeningSlide.svelte';
	import ScopeSlide from './slides/ScopeSlide.svelte';
	import LeanSlide from './slides/LeanSlide.svelte';
	import HeroStatSlide from './slides/HeroStatSlide.svelte';
	import QuoteSlide from './slides/QuoteSlide.svelte';
	import ClosingSlide from './slides/ClosingSlide.svelte';
	import StoryDetailDrawer from './StoryDetailDrawer.svelte';
	import { assembleStory } from '$lib/story/assemble';
	import type { SlideDetail, StoryInput } from '$lib/story/types';

	let {
		input,
		frameTitle,
		onExit
	}: {
		input: StoryInput;
		frameTitle: string;
		onExit?: () => void;
	} = $props();

	const slides = $derived(assembleStory(input));
	let index = $state(0);

	$effect(() => {
		if (index >= slides.length && slides.length > 0) index = slides.length - 1;
	});

	const active = $derived(slides[index]);

	function next() { if (index < slides.length - 1) index++; }
	function prev() { if (index > 0) index--; }
	function jump(i: number) { index = Math.max(0, Math.min(slides.length - 1, i)); }

	// --- Detail drawer state ---------------------------------------------
	let drawerOpen = $state(false);
	let activeDetail = $state<SlideDetail | null>(null);

	function openDetail(detail: SlideDetail) {
		activeDetail = detail;
		drawerOpen = true;
	}
</script>

{#if slides.length}
	<StoryFrame
		index={index}
		total={slides.length}
		title={frameTitle}
		eyebrow={active?.kind === 'opening' ? 'Executive Summary' : active && 'eyebrow' in active ? active.eyebrow : undefined}
		onPrev={prev}
		onNext={next}
		onJump={jump}
		{onExit}
	>
		{#if active}
			{#if active.kind === 'opening'}
				<OpeningSlide slide={active} />
			{:else if active.kind === 'scope'}
				<ScopeSlide slide={active} />
			{:else if active.kind === 'lean'}
				<LeanSlide slide={active} onOpenDetail={openDetail} />
			{:else if active.kind === 'hero-stat'}
				<HeroStatSlide slide={active} onOpenDetail={openDetail} />
			{:else if active.kind === 'quote'}
				<QuoteSlide slide={active} />
			{:else if active.kind === 'closing'}
				<ClosingSlide slide={active} />
			{/if}
		{/if}
	</StoryFrame>

	<StoryDetailDrawer bind:open={drawerOpen} detail={activeDetail} profiles={input.profiles} />
{/if}

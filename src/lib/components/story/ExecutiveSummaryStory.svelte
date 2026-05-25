
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
	import RecolorSlide from './slides/RecolorSlide.svelte';
	import LeanSlide from './slides/LeanSlide.svelte';
	import HeroStatSlide from './slides/HeroStatSlide.svelte';
	import QuoteSlide from './slides/QuoteSlide.svelte';
	import ClosingSlide from './slides/ClosingSlide.svelte';
	import StoryDetailDrawer from './StoryDetailDrawer.svelte';
	import CorpusGrid from './viz/CorpusGrid.svelte';
	import { vizSize } from '$lib/story/responsiveSize.svelte';
	import { assembleStory } from '$lib/story/assemble';
	import type { CorpusVizSpec, SlideDetail, StoryInput } from '$lib/story/types';

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

	// Persistent corpus grid scales up on larger viewports so the dot field
	// reads as a real corpus instead of a postage stamp on desktop.
	const corpusCellSize = $derived(vizSize({ base: 8, md: 10, lg: 12, xl: 15, '2xl': 18 }));
	const corpusGap = $derived(vizSize({ base: 3, md: 3, lg: 4, xl: 5, '2xl': 6 }));

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

	// --- Persistent corpus grid ------------------------------------------
	// Slides that carry a CorpusVizSpec hand their visual region over to a
	// single grid instance mounted in StoryFrame's persistent layer. The
	// grid stays mounted across slide changes so dots morph color in place
	// instead of crossfading between two grid instances.
	//
	// We remember the most recent non-null spec/total so the grid keeps its
	// last appearance while slides without viz are showing — that way you
	// can flip back to a viz slide without the grid having reset.
	let lastViz = $state<CorpusVizSpec | null>(null);
	let lastTotal = $state<number>(0);

	$effect(() => {
		const a = active;
		if (!a) return;
		if (a.kind === 'scope' && a.viz) {
			lastViz = a.viz;
			lastTotal = a.value;
		} else if (a.kind === 'recolor') {
			lastViz = a.viz;
			lastTotal = a.total;
		}
	});

	const gridVisible = $derived(
		(active?.kind === 'scope' && Boolean(active.viz)) || active?.kind === 'recolor'
	);
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
		{#snippet persistentLayer()}
			<div class="corpus-layer">
				<div class="corpus-slot">
					{#if lastViz && lastTotal > 0}
						<CorpusGrid
							total={lastTotal}
							spec={lastViz}
							visible={gridVisible}
							cellSize={corpusCellSize}
							gap={corpusGap}
						/>
					{/if}
				</div>
			</div>
		{/snippet}
		{#if active}
			{#if active.kind === 'opening'}
				<OpeningSlide slide={active} />
			{:else if active.kind === 'scope'}
				<ScopeSlide slide={active} sharedGridActive={Boolean(active.viz)} />
			{:else if active.kind === 'recolor'}
				<RecolorSlide slide={active} onOpenDetail={openDetail} />
			{:else if active.kind === 'lean'}
				<LeanSlide slide={active} onOpenDetail={openDetail} />
			{:else if active.kind === 'hero-stat'}
				<HeroStatSlide slide={active} onOpenDetail={openDetail} />
			{:else if active.kind === 'quote'}
				<QuoteSlide slide={active} profiles={input.profiles} onparticipant={() => {}} />
			{:else if active.kind === 'closing'}
				<ClosingSlide slide={active} />
			{/if}
		{/if}
	</StoryFrame>

	<StoryDetailDrawer bind:open={drawerOpen} detail={activeDetail} profiles={input.profiles} />
{/if}

<style>
	/* Mirrors StorySlide's 2-col layout (45/55) so the persistent grid sits
	   in the same place the per-slide visual snippet would have rendered. */
	.corpus-layer {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
		padding: 2.5rem 2rem;
		height: 100%;
		width: 100%;
	}
	.corpus-slot {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
	}
	@media (min-width: 768px) {
		.corpus-layer {
			grid-template-columns: 45fr 55fr;
			gap: 4rem;
			padding: 3.5rem 4rem;
		}
	}
</style>

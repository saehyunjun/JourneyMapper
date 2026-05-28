
<!--
	StoryFrame — the persistent chrome that wraps every story slide.

	Hosts the breadcrumb, the progress indicator, prev/next controls, and
	manual navigation: keyboard (arrows / space / Home / End / Esc), touch
	swipe, AND mousewheel/trackpad scroll. The wheel handler debounces
	gestures so a single trackpad swipe advances one slide; native page
	scroll is prevented inside the frame so each scroll input is interpreted
	as a slide intent. Slide content rotates in/out keyed on the active
	index.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { ChevronLeft, ChevronRight, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Snippet } from 'svelte';

	let {
		index,
		total,
		title,
		eyebrow,
		onPrev,
		onNext,
		onJump,
		onExit,
		children,
		persistentLayer
	}: {
		index: number;
		total: number;
		title: string;
		eyebrow?: string;
		onPrev: () => void;
		onNext: () => void;
		onJump: (i: number) => void;
		onExit?: () => void;
		children: Snippet;
		/**
		 * Optional persistent overlay rendered inside the stage but OUTSIDE
		 * the keyed slide block. Use it for visuals that should survive
		 * slide transitions (e.g. a dot grid that morphs colors across
		 * slides instead of crossfading).
		 */
		persistentLayer?: Snippet;
	} = $props();

	const atFirst = $derived(index <= 0);
	const atLast = $derived(index >= total - 1);

	function handleKey(e: KeyboardEvent) {
		const t = e.target as HTMLElement | null;
		if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
		if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
			e.preventDefault();
			if (!atLast) onNext();
		} else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
			e.preventDefault();
			if (!atFirst) onPrev();
		} else if (e.key === 'Home') {
			e.preventDefault();
			onJump(0);
		} else if (e.key === 'End') {
			e.preventDefault();
			onJump(total - 1);
		} else if (e.key === 'Escape' && onExit) {
			e.preventDefault();
			onExit();
		}
	}

	// Touch swipe — horizontal threshold of 60px.
	let touchStartX = $state<number | null>(null);
	let touchStartY = $state<number | null>(null);
	function onTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0]?.clientX ?? null;
		touchStartY = e.touches[0]?.clientY ?? null;
	}
	function onTouchEnd(e: TouchEvent) {
		if (touchStartX == null || touchStartY == null) return;
		const endX = e.changedTouches[0]?.clientX ?? touchStartX;
		const endY = e.changedTouches[0]?.clientY ?? touchStartY;
		const dx = endX - touchStartX;
		const dy = endY - touchStartY;
		touchStartX = null;
		touchStartY = null;
		// Vertical swipe also advances — patients use the deck on phones, and
		// the scroll-as-advance model is consistent across input types.
		if (Math.abs(dx) > Math.abs(dy)) {
			if (Math.abs(dx) < 60) return;
			if (dx < 0 && !atLast) onNext();
			else if (dx > 0 && !atFirst) onPrev();
		} else {
			if (Math.abs(dy) < 60) return;
			if (dy < 0 && !atLast) onNext();
			else if (dy > 0 && !atFirst) onPrev();
		}
	}

	// --- Scroll-to-advance ---------------------------------------------------
	// Wheel events fire continuously during a trackpad gesture (often 20+ per
	// swipe). We lock for ~800ms after firing so a single gesture advances by
	// exactly one slide. The lock releases early once the user has stopped
	// scrolling for 120ms — handles slow mousewheel ticks without feeling
	// sluggish. Native page scroll is prevented inside the frame; the slide
	// itself owns vertical overflow if it needs it.
	let frameEl = $state<HTMLElement | null>(null);
	let wheelLocked = false;
	let wheelReleaseTimer: ReturnType<typeof setTimeout> | null = null;
	let wheelIdleTimer: ReturnType<typeof setTimeout> | null = null;

	function releaseSoon(delay = 800) {
		if (wheelReleaseTimer) clearTimeout(wheelReleaseTimer);
		wheelReleaseTimer = setTimeout(() => {
			wheelLocked = false;
		}, delay);
	}

	function onWheel(e: WheelEvent) {
		// Allow native scroll inside surfaces that opt out (closing links,
		// configured selects). Slides are static — no need to scroll within.
		if ((e.target as HTMLElement | null)?.closest('[data-story-allow-scroll]')) return;
		e.preventDefault();

		// Track that we're still receiving wheel events; once the user stops,
		// release the lock a little earlier.
		if (wheelIdleTimer) clearTimeout(wheelIdleTimer);
		wheelIdleTimer = setTimeout(() => {
			wheelLocked = false;
		}, 120);

		if (wheelLocked) return;
		// Ignore tiny inertial deltas at the tail of a gesture.
		if (Math.abs(e.deltaY) < 12 && Math.abs(e.deltaX) < 12) return;

		const dy = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
		if (dy > 0 && !atLast) {
			wheelLocked = true;
			releaseSoon();
			onNext();
		} else if (dy < 0 && !atFirst) {
			wheelLocked = true;
			releaseSoon();
			onPrev();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKey);
		if (frameEl) frameEl.addEventListener('wheel', onWheel, { passive: false });
		return () => {
			window.removeEventListener('keydown', handleKey);
			if (frameEl) frameEl.removeEventListener('wheel', onWheel);
			if (wheelReleaseTimer) clearTimeout(wheelReleaseTimer);
			if (wheelIdleTimer) clearTimeout(wheelIdleTimer);
		};
	});
</script>

<section
	bind:this={frameEl}
	class="story-frame relative flex flex-col"
	aria-roledescription="story carousel"
	aria-label="Executive summary story"
	ontouchstart={onTouchStart}
	ontouchend={onTouchEnd}
>
	<header class="story-header">
		<div class="flex flex-col gap-0.5">
			<span class="text-xs font-heading font-semibold uppercase tracking-[0.14em] text-accent-mint">
				{eyebrow ?? 'Executive Summary'}
			</span>
			<h1 class="font-heading text-base font-medium text-primary">{title}</h1>
		</div>
		<div class="flex items-center gap-3">
			<span class="font-mono text-xs tracking-[0.08em] text-slate-500 tabular-nums">
				{String(index + 1).padStart(2, '0')} <span class="text-slate-300">/ {String(total).padStart(2, '0')}</span>
			</span>
			{#if onExit}
				<Button
					variant="ghost"
					size="icon-sm"
					class="rounded-full"
					onclick={onExit}
					aria-label="Exit story view"
				>
					<X class="size-4" />
				</Button>
			{/if}
		</div>
	</header>

	<div class="story-stage">
		{#if persistentLayer}
			<div class="absolute inset-0 pointer-events-none">
				{@render persistentLayer()}
			</div>
		{/if}
		{#key index}
			<div class="absolute inset-0 flex" in:fade={{ duration: 240, delay: 60 }}>
				{@render children()}
			</div>
		{/key}
	</div>

	<footer class="story-footer">
		<Button
			variant="ghost"
			size="lg"
			class="font-heading"
			onclick={onPrev}
			disabled={atFirst}
			aria-label="Previous slide"
		>
			<ChevronLeft class="size-4" />
			<span>Prev</span>
		</Button>

		<div class="story-dots" role="tablist" aria-label="Slide navigation">
			{#each { length: total } as _, i (i)}
				<button
					type="button"
					class="story-dot"
					class:active={i === index}
					onclick={() => onJump(i)}
					role="tab"
					aria-selected={i === index}
					aria-label="Slide {i + 1}"
				></button>
			{/each}
		</div>

		<Button
			variant="ghost"
			size="sm"
			class="font-heading"
			onclick={onNext}
			disabled={atLast}
			aria-label="Next slide"
		>
			<span>Next</span>
			<ChevronRight class="size-4" />
		</Button>
	</footer>
</section>

<style>
	.story-frame {
		min-height: calc(100svh - 3rem); /* topbar */
		background: var(--paper, #f4f4ff);
		background-image: url('/content-assets/bgtexture.png');
		background-blend-mode: multiply;
		background-size: 600px;
		color: var(--ink, #312f28);
		overscroll-behavior: contain;
	}

	.story-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem 2rem 0.75rem;
	}

	.story-stage {
		position: relative;
		flex: 1;
		min-height: 0;
		min-height: 50rem;
	}

	.story-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 2rem 1.25rem;
		border-top: 1px solid rgba(48, 47, 40, 0.08);
	}

	.story-dots {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.story-dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		background: rgba(48, 47, 40, 0.15);
		transition: background-color 150ms ease, transform 150ms ease, width 200ms ease;
	}
	.story-dot:hover {
		background: rgba(48, 47, 40, 0.35);
	}
	.story-dot.active {
		background: var(--ink, #312f28);
		width: 1.25rem;
		border-radius: 4px;
	}
</style>

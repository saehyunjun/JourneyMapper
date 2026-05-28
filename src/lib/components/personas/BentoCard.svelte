<!--
	BentoCard — clickable tile that scales up into a centred overlay.

	Lives in two shapes:

	- Grid tile: the always-rendered, in-flow card. Shows the `compact` snippet.
	  Clicking it captures its bounding rect and fires `onactivate(id)`.
	- Overlay panel: mounted only when `active`. Shows the `expanded` snippet.
	  On mount, FLIP-animates from the captured rect to its natural centred
	  position. On dismiss, reverses the animation before unmounting.

	The parent owns the `expanded` id and decides which card is active. The card
	knows its origin rect (captured at click time) and runs the morph; the
	parent never has to thread DOMRects through props.

	Dismiss paths: close button, Escape key, or backdrop click — all flow
	through `startDismiss()` so the reverse animation always plays.

	Reduced-motion users get an instant swap instead of the FLIP morph.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X as XIcon, ArrowLeft } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	type Props = {
		id: string;
		eyebrow?: string;
		title?: string;
		/** When false, the tile renders without click-to-expand affordances. */
		expandable?: boolean;
		/** True when this card is the currently expanded one. */
		active?: boolean;
		/** True when *any* card on the page is expanded (so others dim). */
		anyExpanded?: boolean;
		/** Tailwind classes applied to the grid tile (sizing/placement). */
		class?: string;
		/** Optional inner padding on the grid tile. Defaults to p-5. */
		tileClass?: string;
		/**
		 * 0-based position in the bento for the page-mount stagger. Drives a CSS
		 * variable consumed by the rise-in keyframe (60ms × index).
		 */
		index?: number;
		/**
		 * Fires when the pointer enters the tile — wire to the page's per-id
		 * replay-key bag so charts inside the cell re-run their intros on hover.
		 */
		onhoverreplay?: (id: string) => void;
		onactivate?: (id: string) => void;
		ondismiss?: () => void;
		compact: Snippet;
		expanded?: Snippet;
	};

	let {
		id,
		eyebrow,
		title,
		expandable = true,
		active = false,
		anyExpanded = false,
		class: klass = '',
		tileClass = 'p-5',
		index = 0,
		onhoverreplay,
		onactivate,
		ondismiss,
		compact,
		expanded
	}: Props = $props();

	let cardEl = $state<HTMLElement>();
	let overlayEl = $state<HTMLElement>();
	let originRect = $state<DOMRect | null>(null);

	const reducedMotion =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	function handleClick() {
		if (!expandable || active) return;
		if (!cardEl) return;
		originRect = cardEl.getBoundingClientRect();
		onactivate?.(id);
	}

	// FLIP entrance: when the overlay mounts, jump it to the origin rect, then
	// animate to its natural position. The expanded panel keeps transform-origin
	// at top-left so the scale math is straightforward.
	$effect(() => {
		if (!active || !overlayEl || !originRect) return;
		if (reducedMotion) return;
		const to = overlayEl.getBoundingClientRect();
		const from = originRect;
		const dx = from.left - to.left;
		const dy = from.top - to.top;
		const sx = from.width / to.width;
		const sy = from.height / to.height;
		overlayEl.animate(
			[
				{
					transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
					opacity: 0.85
				},
				{ transform: 'translate(0, 0) scale(1, 1)', opacity: 1 }
			],
			{ duration: 480, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'both' }
		);
	});

	async function startDismiss() {
		if (!overlayEl || !originRect || reducedMotion) {
			ondismiss?.();
			return;
		}
		const from = overlayEl.getBoundingClientRect();
		const to = originRect;
		const dx = to.left - from.left;
		const dy = to.top - from.top;
		const sx = to.width / from.width;
		const sy = to.height / from.height;
		const anim = overlayEl.animate(
			[
				{ transform: 'translate(0, 0) scale(1, 1)', opacity: 1 },
				{
					transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
					opacity: 0.85
				}
			],
			{ duration: 320, easing: 'cubic-bezier(0.5, 0, 0.5, 1)', fill: 'both' }
		);
		try {
			await anim.finished;
		} catch {
			// Animation cancelled (e.g. component unmounted mid-flight); fall through.
		}
		ondismiss?.();
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (!active) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			startDismiss();
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<!-- Grid tile — stays in flow even while the overlay is open, so the layout
     does not reflow. Hidden but space-reserving while active. -->
<button
	type="button"
	bind:this={cardEl}
	class="bento-tile group flex flex-col gap-3 rounded-xl border border-(--ink)/10 bg-(--paper) text-left {tileClass} {klass}"
	class:is-hidden={active}
	class:is-dimmed={anyExpanded && !active}
	class:is-expandable={expandable}
	class:is-static={!expandable}
	style="--bento-index: {index};"
	onclick={handleClick}
	onmouseenter={() => onhoverreplay?.(id)}
	aria-expanded={active}
	aria-haspopup={expandable ? 'dialog' : undefined}
	disabled={!expandable && !active}
>
	{#if eyebrow}
		<span class="figcaption text-accent-mint">{eyebrow}</span>
	{/if}
	{#if title}
		<h3 class="font-heading text-lg uppercase text-primary">{title}</h3>
	{/if}
	{@render compact()}
</button>

{#if active && expanded}
	<!-- Backdrop — visible only briefly during the FLIP entrance; the full-screen
	     panel covers it once mounted. Kept as a visual cue during the morph. -->
	<div class="bento-backdrop" aria-hidden="true"></div>

	<!-- Full-viewport panel. transform-origin top-left so the FLIP math stays
	     consistent (matches the entrance/exit animations in $effect/startDismiss). -->
	<div
		bind:this={overlayEl}
		class="bento-overlay-panel"
		role="dialog"
		aria-modal="true"
		aria-labelledby="bento-overlay-{id}-title"
	>
		<header
			class="flex items-center justify-between gap-4 border-b border-(--ink)/10 px-6 py-4 md:px-10 md:py-5"
		>
			<div class="flex items-center gap-5">
				<Button variant="action" size="sm" onclick={startDismiss}>
					<ArrowLeft />
					Back
				</Button>
				<div class="flex flex-col gap-0.5">
					{#if eyebrow}
						<span class="figcaption text-accent-mint">{eyebrow}</span>
					{/if}
					{#if title}
						<h2
							id="bento-overlay-{id}-title"
							class="font-heading text-2xl font-light uppercase text-primary md:text-3xl"
						>
							{title}
						</h2>
					{/if}
				</div>
			</div>
			<button
				type="button"
				class="rounded-full bg-(--ink)/5 p-2 text-foreground transition-colors hover:bg-(--ink)/10"
				onclick={startDismiss}
				aria-label="Close expanded view"
			>
				<XIcon class="size-4" />
			</button>
		</header>
		<div class="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8">
			{@render expanded()}
		</div>
	</div>
{/if}

<style>
	.bento-tile {
		transition:
			opacity 250ms ease,
			transform 250ms ease,
			border-color 200ms ease,
			box-shadow 200ms ease;
		/* Page-mount cascade: each tile rises in, staggered by its declared
		   --bento-index. Pure CSS so it runs without JS once styles load. */
		animation: bento-rise-in 560ms cubic-bezier(0.2, 0.9, 0.25, 1) both;
		animation-delay: calc(var(--bento-index, 0) * 55ms);
	}
	.bento-tile.is-expandable {
		cursor: pointer;
	}
	.bento-tile.is-expandable:hover {
		border-color: rgb(0 0 0 / 0.22);
		box-shadow: 0 12px 32px -16px rgb(0 0 0 / 0.22);
		transform: translateY(-3px);
	}
	@keyframes bento-rise-in {
		from {
			opacity: 0;
			transform: translateY(14px) scale(0.985);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	.bento-tile.is-static {
		cursor: default;
	}
	.bento-tile.is-dimmed {
		opacity: 0.3;
		pointer-events: none;
	}
	.bento-tile.is-hidden {
		visibility: hidden;
	}
	.bento-backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: rgb(15 23 42 / 0.45);
		pointer-events: none;
		animation: backdrop-in 280ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
	}
	.bento-overlay-panel {
		position: fixed;
		inset: 0;
		z-index: 41;
		width: 100vw;
		height: 100vh;
		background: var(--paper, #fafaf7);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		transform-origin: 0 0;
	}
	@keyframes backdrop-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.bento-tile {
			transition: none;
		}
		.bento-backdrop {
			animation: none;
			opacity: 1;
		}
	}
</style>

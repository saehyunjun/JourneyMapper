<!--
	TertiaryDrawer — the shared chrome for every right-side drawer that stacks
	on top of a primary drawer (SegmentTagDrawer, ParticipantDrawer). Owns the
	backdrop, slide-in animation, header strip with eyebrow/title/subtitle/close
	button, and the scrollable body container. Consumers only write the body.

	The drawer is bindable open OR controlled via `open` + `onclose`: both work,
	so consumers driven by store state (groupDrawer) or selection-presence
	(participant fragments) can keep their own state shape.

	Stacking levels:
		secondary — z-55 backdrop / z-60 panel. Opens over a primary drawer.
		top       — z-99 backdrop / z-109 panel. Opens over two stacked drawers.

	Widths:
		compact — max-w-md md:max-w-lg. Default; right for tag/edit drawers.
		wide    — max-w-102 md:max-w-122 xl:max-w-142. For dense stats panels.
-->
<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Snippet } from 'svelte';
	import {
		DRAWER_PANEL_IN,
		DRAWER_PANEL_OUT,
		DRAWER_BACKDROP_IN,
		DRAWER_BACKDROP_OUT
	} from '$lib/motion/drawer';

	let {
		open = $bindable(false),
		ariaLabel,
		onclose,
		width = 'compact',
		level = 'secondary',
		eyebrow,
		title,
		subtitle,
		headerExtra,
		children
	}: {
		open?: boolean;
		ariaLabel: string;
		onclose?: () => void;
		width?: 'compact' | 'wide';
		level?: 'secondary' | 'top';
		eyebrow?: string;
		title?: string;
		subtitle?: string;
		/** Extra content rendered inside the header's text column, below subtitle. */
		headerExtra?: Snippet;
		children?: Snippet;
	} = $props();

	function close() {
		open = false;
		onclose?.();
	}

	function onKeydown(e: KeyboardEvent) {
		if (open && e.key === 'Escape') close();
	}

	const widthClass = $derived(
		width === 'wide'
			? 'max-w-102 md:max-w-122 xl:max-w-142'
			: 'max-w-md md:max-w-lg'
	);
	const backdropZ = $derived(level === 'top' ? 'z-99' : 'z-55');
	const panelZ = $derived(level === 'top' ? 'z-109' : 'z-60');
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<!--
		Stop pointer/click events from bubbling out of the tertiary chrome.
		The tertiary renders as a descendant of whatever primary drawer hosts
		it (e.g. RightDrawer's bits-ui Dialog content) — without this, the
		primary's document-level outside-interaction listener interprets a
		click on the tertiary's backdrop or close button as "outside" and
		dismisses the primary along with the tertiary.
	-->
	<div
		class="fixed inset-0 {backdropZ} bg-slate-900/30"
		in:fade={DRAWER_BACKDROP_IN}
		out:fade={DRAWER_BACKDROP_OUT}
		onpointerdown={(e) => e.stopPropagation()}
		onclick={(e) => {
			e.stopPropagation();
			close();
		}}
		aria-hidden="true"
	></div>

	<aside
		class="fixed inset-y-0 right-0 {panelZ} flex w-full {widthClass} flex-col bg-white shadow-2xl"
		in:fly={DRAWER_PANEL_IN}
		out:fly={DRAWER_PANEL_OUT}
		onpointerdown={(e) => e.stopPropagation()}
		onclick={(e) => e.stopPropagation()}
		aria-label={ariaLabel}
	>
		<header class="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
			<div class="min-w-0 flex-1">
				{#if eyebrow}
					<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
						{eyebrow}
					</p>
				{/if}
				{#if title}
					<h2
						class="truncate font-heading text-2xl font-light uppercase leading-tight text-primary"
					>
						{title}
					</h2>
				{/if}
				{#if subtitle}
					<p class="mt-0.5 text-xs text-slate-500">{subtitle}</p>
				{/if}
				{#if headerExtra}{@render headerExtra()}{/if}
			</div>
			<Button variant="ghost" size="sm" onclick={close} aria-label="Close">
				<XIcon />
			</Button>
		</header>

		<div class="flex flex-1 flex-col overflow-y-auto">
			{@render children?.()}
		</div>
	</aside>
{/if}

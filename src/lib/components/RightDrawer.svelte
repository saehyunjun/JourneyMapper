<!--
	RightDrawer — the app's standard right-side detail drawer.

	Keeps bits-ui's Dialog primitives for accessibility (focus trap, escape,
	click-outside, ARIA wiring) but drives the open/close motion with Svelte
	transitions instead of the library's default Tailwind animate-in/out
	classes — gives us in/out asymmetry and matches the shared motion preset
	used by TertiaryDrawer.

	The shell fixes side=right and a widening max-width scale so every detail
	drawer (quotes, segments, heatmap cells, participant profiles, story
	drivers) opens at one consistent size. Pass the body as children —
	typically a `<div class="flex h-full flex-col">` with a header + scrolling
	section.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import { fly, fade } from 'svelte/transition';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		DRAWER_PANEL_IN,
		DRAWER_PANEL_OUT,
		DRAWER_BACKDROP_IN,
		DRAWER_BACKDROP_OUT
	} from '$lib/motion/drawer';

	let {
		open = $bindable(false),
		showCloseButton = true,
		children
	}: {
		open?: boolean;
		showCloseButton?: boolean;
		children: Snippet;
	} = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay forceMount>
			{#snippet child({ props, open: isOpen })}
				{#if isOpen}
					<div
						{...props}
						class="fixed inset-0 z-50 bg-slate-900/30"
						in:fade={DRAWER_BACKDROP_IN}
						out:fade={DRAWER_BACKDROP_OUT}
					></div>
				{/if}
			{/snippet}
		</Dialog.Overlay>

		<Dialog.Content forceMount>
			{#snippet child({ props, open: isOpen })}
				{#if isOpen}
					<div
						{...props}
						class="bg-popover text-popover-foreground fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col bg-clip-padding text-sm shadow-2xl sm:max-w-2xl md:max-w-3xl xl:max-w-4xl"
						in:fly={DRAWER_PANEL_IN}
						out:fly={DRAWER_PANEL_OUT}
					>
						{@render children()}
						{#if showCloseButton}
							<Dialog.Close>
								{#snippet child({ props: closeProps })}
									<Button
										variant="ghost"
										size="icon-sm"
										class="bg-secondary absolute top-4 right-4"
										{...closeProps}
									>
										<XIcon />
										<span class="sr-only">Close</span>
									</Button>
								{/snippet}
							</Dialog.Close>
						{/if}
					</div>
				{/if}
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<!--
	AppDrawer — the consolidated right-side drawer primitive (DESIGN_SYSTEM_AUDIT.md §2.2, Wave 6).

	Replaces RightDrawer (primary, bits-ui Dialog) and TertiaryDrawer (stacked,
	plain DOM) with a single component selected by the `level` prop. The
	JourneyDrawer / JourneySubDrawer ecosystem migrates separately — it has a
	parallel z-index and motion model that needs interaction-level QA.

	Why two implementation paths under one component:
	  - primary uses bits-ui Dialog for focus trap, escape, click-outside,
	    and ARIA wiring.
	  - secondary/tertiary CANNOT use bits-ui Dialog because the parent
	    Dialog's document-level outside-interaction handler would interpret
	    backdrop/close clicks on the stacked drawer as "outside" and dismiss
	    the parent. The stacked path manually stops propagation.

	Headers come in two flavors:
	  - structured: eyebrow + title + subtitle + headerExtra (close goes
	    inline at top-right of the header row).
	  - bare: when no structured header props are set and no `header`
	    snippet is given, the close button floats (absolute top-4 right-4)
	    so the body can own the header layout (RightDrawer behavior).

	Z-index ladder (matches the audit's proposed scale):
	  primary    backdrop z-50  panel z-50
	  secondary  backdrop z-55  panel z-60
	  tertiary   backdrop z-99  panel z-109
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

	type Size = 'sm' | 'md' | 'lg' | 'xl';
	type Level = 'primary' | 'secondary' | 'tertiary';

	let {
		open = $bindable(false),
		size = 'lg',
		level = 'primary',
		ariaLabel,
		onclose,
		eyebrow,
		title,
		subtitle,
		headerExtra,
		header,
		showCloseButton = true,
		children
	}: {
		open?: boolean;
		/**
		 * sm  = max-w-md md:max-w-lg                       (TertiaryDrawer compact)
		 * md  = max-w-102 md:max-w-122 xl:max-w-142        (TertiaryDrawer wide)
		 * lg  = sm:max-w-2xl md:max-w-3xl xl:max-w-4xl     (RightDrawer default)
		 * xl  = sm:max-w-3xl md:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl
		 *       (Ask drawer — answer + viz pane needs ~70% of viewport)
		 */
		size?: Size;
		level?: Level;
		/** Required for the plain-DOM levels (used as the aside's aria-label). */
		ariaLabel?: string;
		onclose?: () => void;
		eyebrow?: string;
		title?: string;
		subtitle?: string;
		/** Extra content rendered inside the header's text column, below subtitle. */
		headerExtra?: Snippet;
		/** Full override of the header strip. If provided, the structured
		 * props above are ignored and the consumer owns the whole header. */
		header?: Snippet;
		showCloseButton?: boolean;
		children: Snippet;
	} = $props();

	const sizeClass = $derived(
		size === 'sm'
			? 'max-w-md md:max-w-lg'
			: size === 'md'
				? 'max-w-102 md:max-w-122 xl:max-w-142'
				: size === 'xl'
					? 'sm:max-w-3xl md:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl'
					: 'sm:max-w-2xl md:max-w-3xl xl:max-w-4xl'
	);

	const backdropZ = $derived(
		level === 'primary' ? 'z-50' : level === 'secondary' ? 'z-55' : 'z-99'
	);
	const panelZ = $derived(
		level === 'primary' ? 'z-50' : level === 'secondary' ? 'z-60' : 'z-109'
	);

	const hasStructuredHeader = $derived(
		Boolean(eyebrow) || Boolean(title) || Boolean(subtitle) || Boolean(headerExtra)
	);

	function close() {
		open = false;
		onclose?.();
	}

	function onKey(e: KeyboardEvent) {
		// bits-ui handles ESC for the primary level. Stacked levels do it themselves.
		if (level === 'primary') return;
		if (open && e.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={onKey} />

{#if level === 'primary'}
	<Dialog.Root bind:open>
		<Dialog.Portal>
			<Dialog.Overlay forceMount>
				{#snippet child({ props, open: isOpen })}
					{#if isOpen}
						<div
							{...props}
							class="fixed inset-0 {backdropZ} bg-slate-900/30"
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
							class="bg-popover text-popover-foreground fixed inset-y-0 right-0 {panelZ} flex h-full w-full flex-col bg-clip-padding text-sm shadow-2xl {sizeClass}"
							in:fly={DRAWER_PANEL_IN}
							out:fly={DRAWER_PANEL_OUT}
						>
							{#if header}
								{@render header()}
							{:else if hasStructuredHeader}
								<header
									class="flex items-start justify-between gap-3 border-b border-slate-200 p-4"
								>
									<div class="min-w-0 flex-1">
										{#if eyebrow}
											<p
												class="text-xs font-semibold tracking-wide text-slate-500 uppercase"
											>
												{eyebrow}
											</p>
										{/if}
										{#if title}
											<h2
												class="font-heading text-primary truncate text-2xl leading-tight font-light uppercase"
											>
												{title}
											</h2>
										{/if}
										{#if subtitle}
											<p class="mt-0.5 text-xs text-slate-500">{subtitle}</p>
										{/if}
										{#if headerExtra}{@render headerExtra()}{/if}
									</div>
									{#if showCloseButton}
										<Dialog.Close>
											{#snippet child({ props: closeProps })}
												<Button
													variant="ghost"
													size="sm"
													aria-label="Close"
													{...closeProps}
												>
													<XIcon />
												</Button>
											{/snippet}
										</Dialog.Close>
									{/if}
								</header>
							{/if}

							{@render children()}

							{#if !header && !hasStructuredHeader && showCloseButton}
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
{:else if open}
		<!--
			Stop pointer/click events from bubbling out of the stacked chrome.
			This drawer renders as a descendant of whatever primary drawer hosts
			it (e.g. AppDrawer level=primary's bits-ui Dialog content) — without
			the stop-propagation guards, the primary's outside-interaction
			listener interprets a click on this backdrop or close button as
			"outside" and dismisses the primary along with the stacked drawer.
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
		class="fixed inset-y-0 right-0 {panelZ} flex w-full {sizeClass} flex-col bg-white shadow-2xl"
		in:fly={DRAWER_PANEL_IN}
		out:fly={DRAWER_PANEL_OUT}
		onpointerdown={(e) => e.stopPropagation()}
		onclick={(e) => e.stopPropagation()}
		aria-label={ariaLabel}
	>
		{#if header}
			{@render header()}
		{:else if hasStructuredHeader}
			<header class="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
				<div class="min-w-0 flex-1">
					{#if eyebrow}
						<p class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
							{eyebrow}
						</p>
					{/if}
					{#if title}
						<h2
							class="font-heading text-primary truncate text-2xl leading-tight font-light uppercase"
						>
							{title}
						</h2>
					{/if}
					{#if subtitle}
						<p class="mt-0.5 text-xs text-slate-500">{subtitle}</p>
					{/if}
					{#if headerExtra}{@render headerExtra()}{/if}
				</div>
				{#if showCloseButton}
					<Button variant="ghost" size="sm" onclick={close} aria-label="Close">
						<XIcon />
					</Button>
				{/if}
			</header>
		{/if}

		<div class="flex flex-1 flex-col overflow-y-auto">
			{@render children()}
		</div>
	</aside>
{/if}

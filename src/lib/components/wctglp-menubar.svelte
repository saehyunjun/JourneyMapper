<!--
	wctglp-menubar — a floating, bottom-centred navigation bar.

	Replaces the left sidebar with a compact light pill (accent-mint-foreground,
	a near-white tint) that hovers over the bottom of the window à la a
	design-tool toolbar. The bar sits dimmed until hovered. The active route
	shows its text label; every other item collapses to an icon and reveals its
	label in a hover popover.
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { Component } from 'svelte';
	import { flip } from 'svelte/animate';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { NotebookPen, NotebookText, FingerprintPattern, Sparkles, Atom, FlaskConical, MessageSquareText, Route, Trophy, LayoutDashboard } from '@lucide/svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	type NavItem = { title: string; url: string; icon: Component };

	const items: NavItem[] = [
		{ title: 'Executive Summary', url: '/wctglpdemo', icon: NotebookText },
		{ title: 'Insight Builder', url: '/wctglpdemo/key-findings', icon: LayoutDashboard },
		{ title: 'Transcript Review', url: '/wctglpdemo/upload', icon: NotebookPen },
		{ title: 'Fingerprint', url: '/wctglpdemo/fingerprint', icon: FingerprintPattern },
		{ title: 'Interview Words', url: '/wctglpdemo/interview-words', icon: MessageSquareText },
		// { title: 'Journey', url: '/wctglpdemo/journey', icon: Route },
		{ title: 'Constellation', url: '/wctglpdemo/constellation', icon: Sparkles },
		{ title: 'Ambient Booth', url: '/wctglpdemo/segment-cloud', icon: Atom },
		{ title: 'Booth Quiz', url: '/wctglpdemo/quiz', icon: Trophy }
		// { title: 'Trial Designer', url: '/wctglpdemo/trial-designer', icon: FlaskConical }
	];

	const path = $derived(page.url.pathname);

	function isActive(url: string): boolean {
		return url === '/wctglpdemo'
			? path === url
			: path === url || path.startsWith(url + '/');
	}
</script>

<nav
	class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
	aria-label="Primary"
>
	<Tooltip.Provider delayDuration={150}>
		<ul class="flex items-center gap-1 rounded-full bg-accent-mint-foreground p-1.5 shadow-xl ring-1 ring-accent-mint-background/10 opacity-45 hover:opacity-100 ease-in-out transition-opacity duration-300">
			{#each items as item (item.url)}
				{@const Icon = item.icon}
				{@const active = isActive(item.url)}
				<li animate:flip={{ duration: 350, easing: cubicOut }}>
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<a
									{...props}
									href={item.url}
									aria-label={item.title}
									aria-current={active ? 'page' : undefined}
									class="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-300 ease-in-out {active
										? 'bg-accent-mint-background text-white'
										: 'text-accent-mint/40 hover:bg-accent-mint/10 hover:text-accent-mint'}"
								>
									<Icon class="size-4 shrink-0" />
									{#if active}
										<span
											class="overflow-hidden whitespace-nowrap"
											transition:slide={{ axis: 'x', duration: 300, easing: cubicOut }}
										>{item.title}</span>
									{/if}
								</a>
							{/snippet}
						</Tooltip.Trigger>
						{#if !active}
							<Tooltip.Content side="top">{item.title}</Tooltip.Content>
						{/if}
					</Tooltip.Root>
				</li>
			{/each}
		</ul>
	</Tooltip.Provider>
</nav>

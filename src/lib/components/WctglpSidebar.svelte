<!--
	WctglpSidebar — the /wctglpdemo page navigation rail.

	Single-purpose: page navigation only. The indication context selector
	lives in the top filter bar (WctglpTopbar.svelte); the sidebar takes
	just `activeIndication` so its nav links can carry `?indication=<id>`
	forward across page changes.

	A narrow icon rail that expands on hover IN FLOW: as the sidebar's
	width animates from w-14 to w-56, the page-content column shrinks to
	fit. Page content stays fully visible (no overlay), at the cost of a
	small layout reflow on enter/leave.

	When collapsed, tooltips (on the right, matching the prior menubar
	pattern) surface the labels on hover-over-individual-icon. When
	expanded, tooltips suppress themselves because the labels are already
	visible.

	The active route is highlighted with the accent-mint background.
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { Component } from 'svelte';
	import {
		NotebookPen,
		NotebookText,
		FingerprintPattern,
		Sparkles,
		Atom,
		MessageSquareText,
		Trophy,
		LayoutDashboard
	} from '@lucide/svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	type Props = {
		activeIndication: string;
	};
	let { activeIndication }: Props = $props();

	type NavItem = { title: string; url: string; icon: Component };

	// Mirrors the prior wctglp-menubar list verbatim. Update both in lockstep
	// if you add or remove a route.
	const items: NavItem[] = [
		{ title: 'Executive Summary', url: '/patientlyiq', icon: NotebookText },
		{ title: 'Insight Builder', url: '/patientlyiq/key-findings', icon: LayoutDashboard },
		{ title: 'Transcript Review', url: '/patientlyiq/upload', icon: NotebookPen },
		{ title: 'Fingerprint', url: '/patientlyiq/fingerprint', icon: FingerprintPattern },
		{ title: 'Interview Words', url: '/patientlyiq/interview-words', icon: MessageSquareText },
		{ title: 'Constellation', url: '/patientlyiq/constellation', icon: Sparkles },
		{ title: 'Ambient Booth', url: '/patientlyiq/segment-cloud', icon: Atom },
		{ title: 'Booth Quiz', url: '/patientlyiq/quiz', icon: Trophy }
	];

	const path = $derived(page.url.pathname);
	// Preserve ONLY ?indication= across nav clicks; drop any other params
	// (e.g. ?interview=, ?segment_id=) since they're per-page selections that
	// shouldn't leak into routes that don't use them.
	const indicationQuery = $derived(
		activeIndication ? `?indication=${encodeURIComponent(activeIndication)}` : ''
	);

	function isActive(url: string): boolean {
		return url === '/patientlyiq' ? path === url : path === url || path.startsWith(url + '/');
	}

	let hovered = $state(false);
</script>

<aside
	aria-label="Primary"
	onmouseenter={() => (hovered = true)}
	onmouseleave={() => (hovered = false)}
	class="sticky top-14 z-30 flex h-[calc(100svh-3.5rem)] shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 ease-out {hovered
		? 'w-56'
		: 'w-14'}"
>
	<Tooltip.Provider delayDuration={200}>
		<nav class="min-h-0 flex-1 overflow-y-auto py-2 {hovered ? 'px-2' : 'px-0'}">
			<ul class="flex flex-col gap-1">
				{#each items as item (item.url)}
					{@const Icon = item.icon}
					{@const active = isActive(item.url)}
					<li class={hovered ? '' : 'flex justify-center'}>
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<a
										{...props}
										href="{item.url}{indicationQuery}"
										aria-label={item.title}
										aria-current={active ? 'page' : undefined}
										class="flex h-10 items-center rounded-md transition-colors {hovered
											? 'w-full gap-2.5 px-2.5'
											: 'w-10 justify-center'} {active
											? 'bg-accent-mint-background text-white'
											: 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}"
									>
										<Icon class="size-4 shrink-0" />
										{#if hovered}
											<span class="truncate text-sm">{item.title}</span>
										{/if}
									</a>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="right" sideOffset={8}>{item.title}</Tooltip.Content>
						</Tooltip.Root>
					</li>
				{/each}
			</ul>
		</nav>
	</Tooltip.Provider>
</aside>

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
		LayoutDashboard,
		Route,
		Database,
		Lightbulb,
		FlaskConical
	} from '@lucide/svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	type Props = {
		activeIndication: string;
	};
	let { activeIndication }: Props = $props();

	type NavItem = { title: string; url: string; icon: Component };
	type NavSection = { label: string; items: NavItem[] };

	const sections: NavSection[] = [
		{
			label: 'Overview',
			items: [{ title: 'Executive Summary', url: '/patientlyiq', icon: NotebookText }]
		},
		{
			label: 'Build',
			items: [
				{ title: 'Insight Builder', url: '/patientlyiq/key-findings', icon: LayoutDashboard },
				{ title: 'Transcript Review', url: '/patientlyiq/upload', icon: NotebookPen },
				{ title: 'Journey Workbench', url: '/patientlyiq/journey-workbench', icon: Route },
				{ title: 'Content Planner', url: '/patientlyiq/suggestor', icon: Lightbulb }
			]
		},
		{
			label: 'Audiences',
			items: [
				{ title: 'Personas', url: '/patientlyiq/personas', icon: FingerprintPattern },
				{ title: 'Community', url: '/patientlyiq/community', icon: MessageSquareText },
				{ title: 'Digital Data', url: '/patientlyiq/digital-data', icon: Database },
				{ title: 'Clinical Trials', url: '/patientlyiq/clinical-trials', icon: FlaskConical }
			]
		},
		{
			label: 'Experiences',
			items: [
				{ title: 'Constellation', url: '/patientlyiq/constellation', icon: Sparkles },
				{ title: 'Ambient Booth', url: '/patientlyiq/segment-cloud', icon: Atom },
				{ title: 'Booth Quiz', url: '/patientlyiq/quiz', icon: Trophy }
			]
		}
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
	class="piq-sidebar sticky top-14 z-30 flex h-[calc(100svh-3.5rem)] shrink-0 flex-col border-r border-(--panel-mid) bg-(--paper) transition-[width] duration-200 ease-out {hovered
		? 'w-56'
		: 'w-14'}"
>
	<Tooltip.Provider delayDuration={200}>
		<nav class="min-h-0 flex-1 overflow-y-auto py-3 {hovered ? 'px-2' : 'px-1.5'}">
			{#each sections as section, sectionIndex (section.label)}
				{#if sectionIndex > 0}
					{#if hovered}
						<div class="piq-section-gap-open" aria-hidden="true"></div>
					{:else}
						<div class="piq-section-gap-rail" aria-hidden="true"></div>
					{/if}
				{/if}
				{#if hovered}
					<div class="piq-section-label">{section.label}</div>
				{/if}
				<ul class="flex flex-col gap-0.5">
					{#each section.items as item (item.url)}
						{@const Icon = item.icon}
						{@const active = isActive(item.url)}
						<li>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<a
											{...props}
											href="{item.url}{indicationQuery}"
											aria-label={item.title}
											aria-current={active ? 'page' : undefined}
											class="piq-nav-link {active ? 'is-active' : ''} {hovered ? 'is-open' : 'is-rail'}"
										>
											<span class="piq-nav-icon">
												<Icon class="size-4 shrink-0" />
											</span>
											{#if hovered}
												<span class="piq-nav-label truncate">{item.title}</span>
											{/if}
										</a>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content side="right" sideOffset={8}>{item.title}</Tooltip.Content>
							</Tooltip.Root>
						</li>
					{/each}
				</ul>
			{/each}
		</nav>
	</Tooltip.Provider>
</aside>

<style>
	.piq-nav-link {
		display: flex;
		align-items: center;
		height: 2.25rem;
		border-radius: 8px;
		border: 1px solid transparent;
		color: var(--gray);
		transition:
			background-color 150ms ease,
			color 150ms ease,
			border-color 150ms ease;
	}

	.piq-nav-link.is-open {
		width: 100%;
		gap: 0.625rem;
		padding-left: 0.375rem;
		padding-right: 0.625rem;
		justify-content: flex-start;
	}

	.piq-nav-link.is-rail {
		width: 2.5rem;
		margin: 0 auto;
		justify-content: center;
	}

	.piq-nav-link:hover {
		background: var(--panel-dark);
		color: var(--darkgrayblue);
	}

	.piq-nav-link.is-active {
		background: var(--lightorange);
		color: var(--orange);
		border-color: rgba(204, 99, 36, 0.4);
	}

	.piq-nav-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		flex-shrink: 0;
	}

	.piq-nav-label {
		font-family: var(--font-heading);
		font-size: 0.78rem;
		font-weight: 500;
		letter-spacing: 0.01em;
	}

	.piq-nav-link.is-active .piq-nav-label {
		font-weight: 600;
	}

	.piq-section-label {
		font-family: var(--font-heading);
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--gray);
		padding: 0 0.5rem 0.25rem;
		opacity: 0.7;
	}

	.piq-section-gap-open {
		height: 0.875rem;
	}

	.piq-section-gap-rail {
		height: 0.5rem;
		margin: 0.25rem auto;
		width: 1.25rem;
		border-top: 1px solid var(--panel-mid);
	}
</style>

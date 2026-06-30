<!--
	TertiaryDrawer — kept as a thin wrapper around AppDrawer for source-compat
	with existing consumers (SegmentTagDrawer, ParticipantFragmentsDrawer,
	KeywordTagDrawer, PhraseLinkDrawer, GroupStatsDrawer, SponsorDrawer,
	WordUsageDrawer). New code should import AppDrawer directly from
	$lib/components/ui/app-drawer.

	Old prop names map to the new AppDrawer names:
	  width=compact -> size=sm        width=wide -> size=md
	  level=secondary -> level=secondary
	  level=top       -> level=tertiary
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { AppDrawer } from '$lib/components/ui/app-drawer';

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
		headerExtra?: Snippet;
		children?: Snippet;
	} = $props();

	const mappedSize = $derived(width === 'wide' ? 'md' : 'sm');
	const mappedLevel = $derived(level === 'top' ? 'tertiary' : 'secondary');
</script>

<AppDrawer
	bind:open
	level={mappedLevel}
	size={mappedSize}
	{ariaLabel}
	{onclose}
	{eyebrow}
	{title}
	{subtitle}
	{headerExtra}
>
	{#if children}{@render children()}{/if}
</AppDrawer>

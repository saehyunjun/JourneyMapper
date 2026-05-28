<!--
	FilterSelect — labeled <select> used in analyst filter bars.

	Replaces the inline `<label class="flex flex-col gap-1 text-xs ..."> <select
	class="rounded border border-slate-300 px-2 py-1.5 text-sm ..."> </select> </label>`
	pattern that's repeated across analysis / community / digital-data. Keeps the
	native <select> for keyboard ergonomics; styling is consistent with the rest
	of the workspace controls.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	let {
		label,
		hint,
		value = $bindable(),
		children,
		class: className = '',
		selectClass = ''
	}: {
		label: string;
		hint?: string;
		value: string;
		children: Snippet;
		class?: string;
		selectClass?: string;
	} = $props();
</script>

<label class={cn('flex flex-col gap-1 text-xs font-medium text-slate-500', className)}>
	<span>
		{label}
		{#if hint}<span class="font-normal text-slate-400">· {hint}</span>{/if}
	</span>
	<select
		bind:value
		class={cn(
			'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800',
			'focus-visible:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400',
			selectClass
		)}
	>
		{@render children()}
	</select>
</label>

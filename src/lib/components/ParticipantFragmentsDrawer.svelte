<!--
	ParticipantFragmentsDrawer — a secondary drawer stacked over the participant
	details drawer.

	Opened by clicking a theme, emotion, or word-usage row in ParticipantDrawer;
	lists every coded fragment behind that row, scoped to the one participant,
	using the shared CodedFragmentCard. Driven by the `selection` prop —
	non-null opens it, `onclose` dismisses it. Stacks at z-60 so the participant
	drawer underneath peeks through, mirroring GroupStatsDrawer.
-->
<script lang="ts" module>
	import type { ThemeFragment } from '$lib/content/wctglpdemo-data/analysis';

	export type FragmentSelection = {
		/** "Theme" | "Subtheme" | "Emotion" | "Word" — the kind of row clicked. */
		kind: string;
		/** The row's display label. */
		label: string;
		/** The participant the fragments belong to, for the header context line. */
		subtitle: string;
		fragments: ThemeFragment[];
	};
</script>

<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import CodedFragmentCard from '$lib/components/CodedFragmentCard.svelte';
	import type { ParticipantProfile } from '$lib/types/participant-profile';

	let {
		selection = null,
		profiles = {},
		onclose
	}: {
		selection: FragmentSelection | null;
		profiles?: Record<string, ParticipantProfile>;
		onclose: () => void;
	} = $props();

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if selection}
	<!-- Light backdrop — the participant drawer underneath stays legible. -->
	<div
		class="fixed inset-0 z-55 bg-slate-900/20"
		transition:fade={{ duration: 180 }}
		onclick={onclose}
		aria-hidden="true"
	></div>

	<aside
		class="fixed inset-y-0 right-0 z-60 flex w-full max-w-md flex-col bg-white shadow-2xl md:max-w-lg xl:max-w-xl"
		transition:fly={{ x: 120, duration: 300, easing: cubicOut }}
		aria-label="Tagged fragments"
	>
		<!-- Header -->
		<div class="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
			<div class="min-w-0">
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
					{selection.kind} · {selection.subtitle}
				</p>
				<h2 class="font-heading text-2xl font-light uppercase leading-tight text-primary">
					{selection.label}
				</h2>
				<p class="mt-0.5 text-xs text-slate-500">
					{selection.fragments.length} tagged
					{selection.fragments.length === 1 ? 'segment' : 'segments'}
				</p>
			</div>
			<button
				type="button"
				onclick={onclose}
				aria-label="Close"
				class="shrink-0 rounded p-1 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
			>
				✕
			</button>
		</div>

		<!-- Fragments -->
		<div class="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
			{#each selection.fragments as f (f.segment_id)}
				<CodedFragmentCard fragment={f} {profiles} />
			{:else}
				<p
					class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500"
				>
					No tagged segments behind this row yet.
				</p>
			{/each}
		</div>
	</aside>
{/if}

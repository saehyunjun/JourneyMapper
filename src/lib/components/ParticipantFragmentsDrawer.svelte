<!--
	ParticipantFragmentsDrawer — a secondary drawer stacked over the participant
	details drawer.

	Opened by clicking a theme, emotion, or word-usage row in ParticipantDrawer;
	lists every coded fragment behind that row, scoped to the one participant,
	using the shared CodedFragmentCard. Driven by the `selection` prop —
	non-null opens it, `onclose` dismisses it. Chrome owned by TertiaryDrawer.
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
	import CodedFragmentCard from '$lib/components/CodedFragmentCard.svelte';
	import TertiaryDrawer from '$lib/components/TertiaryDrawer.svelte';
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

	const open = $derived(selection !== null);
	const count = $derived(selection?.fragments.length ?? 0);
</script>

<TertiaryDrawer
	{open}
	{onclose}
	ariaLabel="Tagged fragments"
	eyebrow={selection ? `${selection.kind} · ${selection.subtitle}` : undefined}
	title={selection?.label}
	subtitle={selection ? `${count} tagged ${count === 1 ? 'segment' : 'segments'}` : undefined}
>
	{#if selection}
		<div class="flex flex-col gap-3 p-4">
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
	{/if}
</TertiaryDrawer>

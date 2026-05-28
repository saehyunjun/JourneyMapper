<!--
	Key Findings — a presentation-ready storytelling workspace.

	Cards hold rich-text insights, chart widgets (reusing the analysis charts),
	and patient quotes; they're arranged on a responsive grid canvas with
	drag-to-reorder, resize, autosave and undo/redo. State persists per browser
	in localStorage (see the keyFindings store). Clicking a quote's participant
	opens the shared participant drawer.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import KeyFindingsBoard from '$lib/components/key-findings/KeyFindingsBoard.svelte';
	import ParticipantDrawer from '$lib/components/ParticipantDrawer.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Profiles seeded from the server; the drawer writes edits back here.
	let profiles = $state(untrack(() => data.participantProfiles));
	const starredQuoteIds = untrack(() => data.starredQuoteIds);

	let participantDrawerOpen = $state(false);
	let participantDrawerId = $state<string | null>(null);

	function openParticipant(id: string) {
		participantDrawerId = id;
		participantDrawerOpen = true;
	}
</script>

<svelte:head>
	<title>Key Findings · GLP-1 Insights</title>
</svelte:head>

<div class="flex min-h-0 flex-1 flex-col">
	<PageHeader
		eyebrow="PatientlyIQ"
		title="Insight Builder"
		subtitle="A workshop for building shareable insight cards, charts, and patient quotes"
	/>
	<KeyFindingsBoard {profiles} {starredQuoteIds} onparticipant={openParticipant} />
</div>

<ParticipantDrawer bind:open={participantDrawerOpen} interviewId={participantDrawerId} bind:profiles />

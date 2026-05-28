<script lang="ts">
	import MarketingShell from '$lib/components/marketing/MarketingShell.svelte';
	import CapabilityHero from '$lib/components/marketing/CapabilityHero.svelte';
	import IntroBlock from '$lib/components/marketing/IntroBlock.svelte';
	import Subsection from '$lib/components/marketing/Subsection.svelte';
	import VisualFrame from '$lib/components/marketing/VisualFrame.svelte';
	import JourneyMapView from '$lib/components/journey-map/JourneyMapView.svelte';
	import { ArrowUpRight } from '@lucide/svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Journey Map — PatientlyIQ</title>
	<meta
		name="description"
		content="Stage by stage. Quote by quote. A per-indication, per-persona view of the patient experience, synthesized from interviews, social listening, and search."
	/>
</svelte:head>

<MarketingShell>
	<CapabilityHero
		sectionNumber="1.0"
		sectionLabel="Synthesize"
		title="Stage by stage."
		titleSecondLine="Quote by quote."
	/>

	<IntroBlock
		subhead="A patient journey assembled from the evidence."
		body="Journey Map gives every indication and every persona a synthesized read of the patient experience — Awareness, Decision, Participation, and the moments inside each. Stages are derived from real fragments, every emotion is codebook-locked, and every claim traces back to the quote that supports it."
		anchors={[
			{ number: '1.1', label: 'Stages', href: '#stages' },
			{ number: '1.2', label: 'Emotion', href: '#emotion' },
			{ number: '1.3', label: 'Persona lens', href: '#persona-lens' }
		]}
	/>

	<VisualFrame
		caption="Journey Map · {data.artifact.meta.persona_label}"
		footerLeft="{data.artifact.meta.fragment_count_total} fragments · {data.artifact.meta.stage_count} stages · live render"
		footerRight="Click any pill to interact →"
	>
		<div class="live-mount">
			<a
				class="open-product"
				href="/patientlyiq/journey-map/{data.artifact.meta.corpus_id}/{data.artifact.meta.persona_id}"
			>
				Open in product
				<ArrowUpRight size={12} strokeWidth={2} />
			</a>
			<JourneyMapView
				artifact={data.artifact}
				fragmentsById={data.fragmentsById}
				journey={data.journey}
				profiles={data.profiles}
				showHeader={false}
				showFooter={false}
			/>
		</div>
	</VisualFrame>

	<Subsection
		anchor="stages"
		number="1.1"
		label="Stages"
		subhead="Stages emerge from the patient evidence, not from intuition."
		body="The journey backbone — Awareness, Decision, Participation, Follow-up — and the steps inside each are surfaced from the language patients actually use. Each stage carries the supporting fragments and a coverage check so analysts can see where the read is thick and where it is thin."
	/>

	<Subsection
		anchor="emotion"
		number="1.2"
		label="Emotion"
		subhead="Emotion is structured, not adjectival."
		body="Every stage carries a Plutchik-grounded emotional read — primary emotions and named dyads — locked to the project codebook so the labels on the journey match the labels on the segments. No drift between the synthesis and the source."
	/>

	<Subsection
		anchor="persona-lens"
		number="1.3"
		label="Persona lens"
		subhead="The same indication, different lives."
		body="Drop a different persona onto the journey and the stages, emotions, and supporting quotes recompose to match. The Curious patient and the Reluctant patient share a disease and almost nothing else — Journey Map shows that without forcing one composite view."
	/>
</MarketingShell>

<style>
	.live-mount {
		position: relative;
		margin: -1rem;
		padding: 1.4rem 1.6rem 2rem;
		background: #f6f1e6;
		color: var(--ink, #312f28);
		border-radius: 0 0 9px 9px;
		max-height: 44rem;
		overflow: auto;
	}

	.open-product {
		position: sticky;
		top: 0.6rem;
		float: right;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.7rem;
		margin-bottom: -2rem;
		border-radius: 999px;
		background: rgba(11, 14, 20, 0.92);
		color: rgba(244, 245, 243, 0.98);
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-decoration: none;
		z-index: 10;
		transition: transform 180ms ease, background 180ms ease;
	}

	.open-product:hover {
		background: var(--brightorange, #ff8341);
		transform: translateY(-1px);
	}

	/* Hide the embedded view's outer padding so it fits the frame tightly */
	.live-mount :global(.journey-map-page) {
		padding: 0;
	}
</style>

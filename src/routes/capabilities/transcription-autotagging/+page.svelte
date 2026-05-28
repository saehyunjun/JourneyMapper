<script lang="ts">
	import MarketingShell from '$lib/components/marketing/MarketingShell.svelte';
	import CapabilityHero from '$lib/components/marketing/CapabilityHero.svelte';
	import IntroBlock from '$lib/components/marketing/IntroBlock.svelte';
	import Subsection from '$lib/components/marketing/Subsection.svelte';
	import VisualFrame from '$lib/components/marketing/VisualFrame.svelte';
	import TranscriptMock from '$lib/components/marketing/mocks/TranscriptMock.svelte';
</script>

<svelte:head>
	<title>Transcription Autotagging — PatientlyIQ</title>
	<meta
		name="description"
		content="From transcript to tagged evidence. Segment-level codes proposed against a project-specific codebook — analysts review, accept, or override."
	/>
</svelte:head>

<MarketingShell>
	<CapabilityHero
		sectionNumber="3.0"
		sectionLabel="Pipeline"
		title="From transcript"
		titleSecondLine="to tagged evidence."
	/>

	<IntroBlock
		subhead="A codebook-driven pipeline, with analysts in the loop."
		body="Upload a transcript and PatientlyIQ proposes segment-level codes — theme, subtheme, journey stage, and Plutchik-grounded emotion — against your project codebook. The analyst stays in the chair: every proposal is reviewable, every override teaches the codebook for next time."
		anchors={[
			{ number: '3.1', label: 'Codebook', href: '#codebook' },
			{ number: '3.2', label: 'Emotion', href: '#emotion' },
			{ number: '3.3', label: 'Review', href: '#review' }
		]}
	/>

	<VisualFrame
		caption="Autotag · Transcript review"
		footerLeft="14 / 38 segments reviewed"
		footerRight="Codebook LN.v3.1"
	>
		<TranscriptMock />
	</VisualFrame>

	<Subsection
		anchor="codebook"
		number="3.1"
		label="Codebook"
		subhead="The codebook is the source of truth."
		body="Themes, subthemes, journey stages, and emotion vocabulary are defined in a project codebook — JSON-schema constrained, version-controlled, and shared across every pipeline step. The autotagger does not invent labels. It proposes from the catalog you maintain."
	/>

	<Subsection
		anchor="emotion"
		number="3.2"
		label="Emotion"
		subhead="Plutchik primaries and named dyads — no drift."
		body="Emotion is structured: eight primaries and a defined set of dyads (ambivalence, anxiety, bittersweetness, others). The autotagger proposes from this vocabulary, the human-tagging drawer enforces it, and the journey-map synthesis uses the same labels. The read on a segment matches the read on the journey."
	/>

	<Subsection
		anchor="review"
		number="3.3"
		label="Review"
		subhead="Accept, edit, or skip — and the codebook learns."
		body="Every proposal arrives with a confidence score. Analysts accept, edit, or skip; overrides are logged with reasoning so the codebook can tighten on the next pass. The system grows more accurate by being argued with, not by being trusted blindly."
	/>
</MarketingShell>

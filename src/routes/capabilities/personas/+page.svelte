<script lang="ts">
	import MarketingShell from '$lib/components/marketing/MarketingShell.svelte';
	import CapabilityHero from '$lib/components/marketing/CapabilityHero.svelte';
	import IntroBlock from '$lib/components/marketing/IntroBlock.svelte';
	import Subsection from '$lib/components/marketing/Subsection.svelte';
	import VisualFrame from '$lib/components/marketing/VisualFrame.svelte';
	import PersonaMock from '$lib/components/marketing/mocks/PersonaMock.svelte';
</script>

<svelte:head>
	<title>Personas — PatientlyIQ</title>
	<meta
		name="description"
		content="Personas are filters, not avatars. Every persona resolves to the moments that match — speakers, quotes, theme distribution, journey-stage profile."
	/>
</svelte:head>

<MarketingShell>
	<CapabilityHero
		sectionNumber="4.0"
		sectionLabel="Lens"
		title="Personas are filters,"
		titleSecondLine="not avatars."
	/>

	<IntroBlock
		subhead="Every persona resolves to the evidence that proves it."
		body="A PatientlyIQ persona is a multi-clause filter over the patient evidence — indication, role, stage, subtheme, sentiment range. Drop one into any view and the speakers, quotes, theme distribution, and journey-stage profile shift to match. There is no detached persona doc; the persona is the evidence it filters."
		anchors={[
			{ number: '4.1', label: 'Definition', href: '#definition' },
			{ number: '4.2', label: 'Lens', href: '#lens' },
			{ number: '4.3', label: 'Builder', href: '#builder' }
		]}
	/>

	<VisualFrame
		caption="Persona · Curious patient"
		footerLeft="38 speakers · 5 clauses"
		footerRight="Live match preview"
	>
		<PersonaMock />
	</VisualFrame>

	<Subsection
		anchor="definition"
		number="4.1"
		label="Definition"
		subhead="A persona is a defendable set of clauses."
		body="Each persona is defined by clauses an analyst can argue with: indication, role, stage, subtheme, sentiment band. Every clause is auditable; every persona has a fragment match count that updates the moment a clause changes."
	/>

	<Subsection
		anchor="lens"
		number="4.2"
		label="Lens"
		subhead="Apply a persona anywhere in PatientlyIQ."
		body="Personas are the shared lens across the platform. Apply one to the Journey Map and the stages recompose. Apply one to the Workbench and the beeswarm refilters. Apply two side by side and you have the comparison view — same evidence, two lives."
	/>

	<Subsection
		anchor="builder"
		number="4.3"
		label="Builder"
		subhead="Authoring a new persona — coming next."
		body="Today personas are author-built in JSON; the upcoming Persona Builder UI takes the same clause model into a drawer with live match-count preview, fork-from-existing, and a one-click promotion from the active Workbench filter state. No round-trip through code; no waiting on a deploy to test an idea."
	/>
</MarketingShell>

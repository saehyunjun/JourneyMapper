<script lang="ts">
	import MarketingShell from '$lib/components/marketing/MarketingShell.svelte';
	import CapabilityHero from '$lib/components/marketing/CapabilityHero.svelte';
	import IntroBlock from '$lib/components/marketing/IntroBlock.svelte';
	import Subsection from '$lib/components/marketing/Subsection.svelte';
	import VisualFrame from '$lib/components/marketing/VisualFrame.svelte';
	import BeeswarmMock from '$lib/components/marketing/mocks/BeeswarmMock.svelte';
</script>

<svelte:head>
	<title>Journey Workbench — PatientlyIQ</title>
	<meta
		name="description"
		content="Every fragment, one canvas. A persona-scoped beeswarm of patient moments, filterable across stage, sentiment, subtheme, and speaker."
	/>
</svelte:head>

<MarketingShell>
	<CapabilityHero
		sectionNumber="2.0"
		sectionLabel="Explore"
		title="Every fragment,"
		titleSecondLine="one canvas."
	/>

	<IntroBlock
		subhead="The whole patient evidence base, scoped by lens."
		body="Journey Workbench draws every tagged fragment as a dot on a single beeswarm canvas, arranged along the journey and shaded by sentiment. Slice by persona, role, stage, subtheme, or speaker — and click any moment to open the speaker, the quote, the annotation, and the lens that surfaced it."
		anchors={[
			{ number: '2.1', label: 'Filter', href: '#filter' },
			{ number: '2.2', label: 'Open', href: '#open' },
			{ number: '2.3', label: 'Compare', href: '#compare' }
		]}
	/>

	<VisualFrame
		caption="Journey Workbench · Persona-scoped beeswarm"
		footerLeft="96 of 248 visible"
		footerRight="x: stage · y: sentiment"
	>
		<BeeswarmMock />
	</VisualFrame>

	<Subsection
		anchor="filter"
		number="2.1"
		label="Filter"
		subhead="Multi-axis scoping, no menus to chase."
		body="Stack a persona, a role, a sentiment range, and a stage filter as inline chips at the top of the canvas. Each chip narrows the beeswarm; the count updates live. The active filter is the URL, so any read is shareable as a link."
	/>

	<Subsection
		anchor="open"
		number="2.2"
		label="Open"
		subhead="Click a dot, open the full record."
		body="One click on a fragment opens a drawer with the verbatim quote, the speaker profile, the codebook tags, the journey-stage and emotion read, and the linked persona context. Move laterally to adjacent fragments without losing the active filter."
	/>

	<Subsection
		anchor="compare"
		number="2.3"
		label="Compare"
		subhead="Swap personas. Watch the field rearrange."
		body="Workbench is built for the side-by-side question — how do the same stages look for two different personas, or two indications? Drop a comparison persona into the lens and the beeswarm re-clusters in place, with deltas highlighted at the chip level."
	/>
</MarketingShell>

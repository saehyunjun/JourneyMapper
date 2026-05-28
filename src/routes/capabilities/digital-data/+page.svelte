<script lang="ts">
	import MarketingShell from '$lib/components/marketing/MarketingShell.svelte';
	import CapabilityHero from '$lib/components/marketing/CapabilityHero.svelte';
	import IntroBlock from '$lib/components/marketing/IntroBlock.svelte';
	import Subsection from '$lib/components/marketing/Subsection.svelte';
	import VisualFrame from '$lib/components/marketing/VisualFrame.svelte';
	import DigitalDataMock from '$lib/components/marketing/mocks/DigitalDataMock.svelte';
</script>

<svelte:head>
	<title>Digital Data — PatientlyIQ</title>
	<meta
		name="description"
		content="Patient voice next to patient behavior. Search volumes, community engagement, ad spend, and the clinical-trial landscape, scoped to the active indication."
	/>
</svelte:head>

<MarketingShell>
	<CapabilityHero
		sectionNumber="5.0"
		sectionLabel="Signal"
		title="Patient voice next"
		titleSecondLine="to patient behavior."
	/>

	<IntroBlock
		subhead="External signal, scoped to the active indication."
		body="The qualitative read sits alongside the things patients do at scale — search, post, click, enroll. Digital Data pulls indication-level signal from search trends, community forums, ad-spend estimates, and the clinical-trial landscape into the same view as your interview evidence."
		anchors={[
			{ number: '5.1', label: 'Search', href: '#search' },
			{ number: '5.2', label: 'Trials', href: '#trials' },
			{ number: '5.3', label: 'Community', href: '#community' }
		]}
	/>

	<VisualFrame
		caption="Digital Data · LN · 2026"
		footerLeft="5 datasets active"
		footerRight="Refreshed daily"
	>
		<DigitalDataMock />
	</VisualFrame>

	<Subsection
		anchor="search"
		number="5.1"
		label="Search"
		subhead="What patients are looking for, in their own words."
		body="Indication-level search volume — by query, by region, over time — sits next to the interview language analysts have already coded. Where search demand spikes, the quotes that explain it are one click away."
	/>

	<Subsection
		anchor="trials"
		number="5.2"
		label="Trials"
		subhead="The trial landscape, on the same canvas as the patient read."
		body="Active and recent trials by indication, phase, sponsor class, intervention, and geography. Filter by status, search by sponsor, and surface the trials whose enrollment friction the patient evidence helps explain."
	/>

	<Subsection
		anchor="community"
		number="5.3"
		label="Community"
		subhead="Forums, advocacy, ad spend — and what patients say in each."
		body="Reddit, Inspire, and advocacy-org engagement signals layer alongside paid-media estimates so the team can see where attention is being bought versus where it is happening organically — and how the patient language differs across the two."
	/>
</MarketingShell>

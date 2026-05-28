<!--
	Preview route for SerpReadabilityTable.

	Standalone page that renders the Fig. 6-style readability/actionability
	table on top of serp-readability.json. Intended as the starting point for
	the "patient experience online" tool suite — iterate the table here before
	embedding it elsewhere.
-->
<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import SerpReadabilityTable, {
		type SerpReadabilityData
	} from '$lib/components/patient-experience/SerpReadabilityTable.svelte';
	import data from '$lib/content/patient-experience/serp-readability.json';

	const tableData = data as SerpReadabilityData;
</script>

<div class="flex flex-1 flex-col">
	<PageHeader
		eyebrow="Patient experience online"
		title="High-ranking content readability & actionability"
	/>

	<div class="px-6 pb-12 pt-4 max-w-5xl">
		<SerpReadabilityTable data={tableData} />
	</div>
</div>

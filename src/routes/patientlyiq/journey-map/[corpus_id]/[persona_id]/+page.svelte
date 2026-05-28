<!--
	Journey-map artifact render.

	Thin shim: the renderer lives at $lib/components/journey-map/JourneyMapView
	so it can be embedded elsewhere (marketing pages, demo routes). This page
	just hands the loader output through.
-->
<script lang="ts">
	import JourneyMapView from '$lib/components/journey-map/JourneyMapView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.artifact.meta.persona_label} — journey map</title>
</svelte:head>

<JourneyMapView
	artifact={data.artifact}
	fragmentsById={data.fragmentsById}
	journey={data.journey}
	profiles={data.profiles}
/>

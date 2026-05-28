<!--
	PageHeader — the standardized header for /patientlyiq routes.

	A flat, in-flow page anchor: eyebrow (small mint label) + h1 + optional
	subtitle, separated from page content by a thin bottom border. No textured
	hero band. Pages may render right-side controls via the `actions` snippet.

	Width and padding match the existing page bodies (max-w-7xl, px-8), so a
	page can sit `+page.svelte` content directly underneath in its own
	max-w-6xl / max-w-7xl wrapper without re-alignment surprises.

	Used by every patientlyiq page except the ambient booth views
	(constellation, segment-cloud) and quiz.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		eyebrow?: string;
		title: string;
		subtitle?: string;
		actions?: Snippet;
	};

	let { eyebrow, title, subtitle, actions }: Props = $props();
</script>

<header class="bordr-b border-mueted bg-secondary">
	<div class="mx-auto flex flex-col md:flex-row w-full justify-around gap-3 px-8 pt-10 pb-6">
		{#if eyebrow}
			<span class="text-sm tracking-wide text-accent-orange font-semibold uppercase">{eyebrow}</span>
		{/if}
			{#if actions}
				<div class="flex items-center gap-2">
					{@render actions()}
				</div>
			{/if}
		{#if subtitle}
			<p class="max-w-3xl text-base text-muted-foreground">
				{subtitle}
			</p>
		{/if}
	</div>
</header>

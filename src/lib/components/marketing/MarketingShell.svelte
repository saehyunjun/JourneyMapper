<script lang="ts">
	import type { Snippet } from 'svelte';
	import MarketingHeader from './MarketingHeader.svelte';

	type Props = {
		children: Snippet;
	};

	let { children }: Props = $props();
</script>

<main class="page">
	<div class="ambient" aria-hidden="true"></div>
	<div class="grid-wash" aria-hidden="true"></div>

	<MarketingHeader />

	{@render children()}
</main>

<style>
	:global(body) {
		background: #0b0e14;
	}

	.page {
		position: relative;
		min-height: 100vh;
		color: rgba(232, 233, 235, 0.92);
		background: #0b0e14;
		overflow: clip;
	}

	.ambient {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			radial-gradient(ellipse 50% 30% at 50% 12%, rgba(255, 131, 65, 0.08), transparent 70%),
			radial-gradient(ellipse 40% 40% at 80% 70%, rgba(106, 153, 194, 0.06), transparent 70%);
	}

	.grid-wash {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background-image:
			linear-gradient(rgba(232, 233, 235, 0.025) 1px, transparent 1px),
			linear-gradient(90deg, rgba(232, 233, 235, 0.025) 1px, transparent 1px);
		background-size: 64px 64px;
		mask-image: radial-gradient(ellipse 80% 80% at 50% 30%, black, transparent 80%);
	}
</style>

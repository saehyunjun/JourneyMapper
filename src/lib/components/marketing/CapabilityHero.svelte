<script lang="ts">
	import DashboardTag from './DashboardTag.svelte';

	type Props = {
		sectionNumber: string;
		sectionLabel: string;
		title: string;
		titleSecondLine?: string;
		emphasis?: string;
	};

	let { sectionNumber, sectionLabel, title, titleSecondLine, emphasis }: Props = $props();
</script>

<section class="hero">
	<div class="hero-marker">
		<span class="hero-num">{sectionNumber}</span>
		<span class="hero-label">{sectionLabel}</span>
	</div>

	<h1 class="hero-title">
		<span class="hero-line">{title}</span>
		{#if titleSecondLine}
			<span class="hero-line">{titleSecondLine}{#if emphasis} <span class="hero-emph">{emphasis}</span>{/if}</span>
		{:else if emphasis}
			<span class="hero-emph"> {emphasis}</span>
		{/if}
	</h1>
</section>

<style>
	.hero {
		position: relative;
		z-index: 2;
		max-width: 1180px;
		margin: 0 auto;
		padding: clamp(4rem, 12vw, 9rem) clamp(1.2rem, 3vw, 2rem) clamp(2.5rem, 6vw, 4rem);
		display: grid;
		gap: clamp(1.4rem, 3vw, 2rem);
	}

	.hero-marker {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.hero-num {
		color: rgba(232, 233, 235, 0.4);
	}

	.hero-label {
		color: rgba(232, 233, 235, 0.78);
	}

	.hero-title {
		font-family: var(--font-heading-alt);
		font-size: clamp(2.6rem, 7vw, 5.4rem);
		line-height: 1;
		letter-spacing: -0.04em;
		font-weight: 400;
		color: rgba(232, 233, 235, 0.98);
		max-width: 22ch;
		display: grid;
		gap: 0.05em;
	}

	.hero-line {
		display: block;
	}

	.hero-emph {
		color: var(--brightorange, #FF8341);
		font-style: italic;
		font-weight: 300;
	}
</style>

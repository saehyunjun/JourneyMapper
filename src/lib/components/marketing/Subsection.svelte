<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		anchor: string;
		number: string;
		label: string;
		subhead: string;
		body: string;
		children?: Snippet;
	};

	let { anchor, number, label, subhead, body, children }: Props = $props();
</script>

<section id={anchor} class="sub">
	<div class="sub-marker">
		<span class="sub-num">{number}</span>
		<span class="sub-label">{label}</span>
	</div>

	<div class="sub-grid">
		<div class="sub-subhead">
			<h2>{subhead}</h2>
		</div>
		<div class="sub-body">
			<p>{body}</p>
		</div>
	</div>

	{#if children}
		<div class="sub-visual">
			{@render children()}
		</div>
	{/if}
</section>

<style>
	.sub {
		position: relative;
		z-index: 2;
		max-width: 1180px;
		margin: 0 auto;
		padding: clamp(3rem, 7vw, 5rem) clamp(1.2rem, 3vw, 2rem);
		border-top: 1px solid rgba(232, 233, 235, 0.06);
	}

	.sub-marker {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
		font-family: var(--font-mono);
		font-size: 0.74rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		margin-bottom: 2rem;
	}

	.sub-num {
		color: rgba(232, 233, 235, 0.4);
	}

	.sub-label {
		color: rgba(232, 233, 235, 0.78);
	}

	.sub-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
		gap: clamp(2rem, 6vw, 5rem);
		margin-bottom: 2.5rem;
	}

	.sub-subhead h2 {
		font-family: var(--font-heading-alt);
		font-size: clamp(1.4rem, 2.4vw, 1.9rem);
		line-height: 1.12;
		letter-spacing: -0.018em;
		font-weight: 600;
		color: rgba(232, 233, 235, 0.96);
		max-width: 18ch;
	}

	.sub-body p {
		font-family: var(--font-body);
		font-size: 1rem;
		line-height: 1.6;
		color: rgba(232, 233, 235, 0.64);
		max-width: 38rem;
	}

	.sub-visual {
		margin-top: 1rem;
	}

	@media (max-width: 760px) {
		.sub-grid {
			grid-template-columns: 1fr;
		}
	}
</style>

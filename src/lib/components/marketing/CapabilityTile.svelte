<script lang="ts">
	import type { Component } from 'svelte';
	import DashboardTag from './DashboardTag.svelte';

	type Props = {
		tagLabel: string;
		tagValue?: string;
		tagColor?: 'green' | 'amber' | 'orange' | 'blue' | 'red' | 'neutral';
		title: string;
		description: string;
		icon?: Component;
		size?: 'standard' | 'wide';
		href?: string;
	};

	let {
		tagLabel,
		tagValue,
		tagColor = 'neutral',
		title,
		description,
		icon: Icon,
		size = 'standard',
		href
	}: Props = $props();
</script>

<svelte:element this={href ? 'a' : 'article'} class="tile {size}" href={href}>
	<div class="tile-head">
		<DashboardTag label={tagLabel} value={tagValue} color={tagColor} />
		{#if Icon}
			<span class="tile-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.5} /></span>
		{/if}
	</div>

	<div class="tile-body">
		<h3>{title}</h3>
		<p>{description}</p>
	</div>

	<div class="tile-foot">
		<div class="tile-readout" aria-hidden="true">
			<span class="readout-bar"></span>
			<span class="readout-bar mid"></span>
			<span class="readout-bar short"></span>
		</div>
		{#if href}
			<span class="tile-link">Read more →</span>
		{/if}
	</div>
</svelte:element>

<style>
	.tile {
		display: grid;
		grid-template-rows: auto 1fr auto;
		gap: 1.6rem;
		padding: 1.6rem 1.4rem 1.3rem;
		background: rgba(255, 255, 255, 0.025);
		border: 1px solid rgba(232, 233, 235, 0.08);
		border-radius: 8px;
		min-height: 17rem;
		text-decoration: none;
		color: inherit;
		transition: border-color 200ms ease, background 200ms ease, transform 200ms ease;
	}

	.tile:hover {
		border-color: rgba(232, 233, 235, 0.18);
		background: rgba(255, 255, 255, 0.04);
		transform: translateY(-1px);
	}

	.tile-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.tile-link {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.5);
		transition: color 180ms ease;
	}

	.tile:hover .tile-link {
		color: var(--brightorange, #FF8341);
	}

	.tile.wide {
		grid-column: span 2;
	}

	.tile-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}

	.tile-icon {
		display: inline-flex;
		color: rgba(232, 233, 235, 0.5);
	}

	.tile-body h3 {
		font-family: var(--font-heading-alt);
		font-size: 1.55rem;
		font-weight: 500;
		line-height: 1.1;
		letter-spacing: -0.015em;
		color: rgba(232, 233, 235, 0.98);
		margin-bottom: 0.7rem;
	}

	.tile-body p {
		font-family: var(--font-body);
		font-size: 0.92rem;
		line-height: 1.55;
		color: rgba(232, 233, 235, 0.6);
	}

	.tile-readout {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		max-width: 8rem;
	}

	.readout-bar {
		display: block;
		height: 1px;
		background: rgba(232, 233, 235, 0.15);
		flex: 1;
	}

	.readout-bar.mid {
		flex: 0.4;
		background: rgba(232, 233, 235, 0.28);
	}

	.readout-bar.short {
		flex: 0.15;
		background: rgba(255, 131, 65, 0.6);
	}

	@media (max-width: 760px) {
		.tile.wide {
			grid-column: auto;
		}
	}
</style>

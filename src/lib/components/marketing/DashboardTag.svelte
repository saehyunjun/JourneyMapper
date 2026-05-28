<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	type TagColor = 'green' | 'amber' | 'orange' | 'blue' | 'red' | 'neutral';

	type Props = {
		label: string;
		value?: string;
		color?: TagColor;
		icon?: Component;
		size?: 'sm' | 'md';
		children?: Snippet;
	};

	let {
		label,
		value,
		color = 'neutral',
		icon: Icon,
		size = 'md',
		children
	}: Props = $props();
</script>

<span class="tag {color} {size}">
	{#if Icon}
		<span class="tag-icon" aria-hidden="true"><Icon size={size === 'sm' ? 11 : 13} strokeWidth={1.75} /></span>
	{/if}
	<span class="tag-label">{label}{value ? ':' : ''}</span>
	{#if value}
		<span class="tag-value">{value}</span>
	{/if}
	{#if children}{@render children()}{/if}
</span>

<style>
	.tag {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
		padding: 0.32em 0.62em;
		border-radius: 4px;
		border: 1px solid var(--tag-border);
		background: transparent;
		color: var(--tag-text);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		line-height: 1;
		white-space: nowrap;
	}

	.tag.sm {
		font-size: 0.62rem;
		padding: 0.28em 0.52em;
		letter-spacing: 0.14em;
	}

	.tag-icon {
		display: inline-flex;
		color: var(--tag-border);
	}

	.tag-label {
		color: var(--tag-text);
		opacity: 0.78;
	}

	.tag-value {
		color: var(--tag-border);
		font-weight: 600;
	}

	.tag.green {
		--tag-border: #7DBFA7;
		--tag-text: rgba(232, 233, 235, 0.95);
	}

	.tag.amber {
		--tag-border: #D4A93A;
		--tag-text: rgba(232, 233, 235, 0.95);
	}

	.tag.orange {
		--tag-border: #FF8341;
		--tag-text: rgba(232, 233, 235, 0.95);
	}

	.tag.blue {
		--tag-border: #6a99c2;
		--tag-text: rgba(232, 233, 235, 0.95);
	}

	.tag.red {
		--tag-border: #FB8809;
		--tag-text: rgba(232, 233, 235, 0.95);
	}

	.tag.neutral {
		--tag-border: rgba(232, 233, 235, 0.32);
		--tag-text: rgba(232, 233, 235, 0.85);
	}
</style>

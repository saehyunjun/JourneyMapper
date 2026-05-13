<script lang="ts">
	import type { Snippet } from "svelte";

	type Variant = "info" | "warning" | "success" | "takeaway";

	let {
		variant = "info",
		title,
		children
	}: {
		variant?: Variant;
		title?: string;
		children: Snippet;
	} = $props();
</script>

<aside class="callout callout-{variant}">
	{#if title}
		<div class="callout-title">
			{title}</div>
	{/if}
	<div class="callout-body">
		{@render children()}
	</div>
</aside>

<style>
	.callout {
		border-top: 3px solid var(--border);
		padding: 0.75rem 1rem;
		margin: 1rem 0;
		background: var(--muted);
	}
	.callout-info {
		border-top-color: var(--primary);
	}
	.callout-warning {
		border-top-color: #d97706;
	}
	.callout-success {
		border-top-color: #059669;
	}
	.callout-title {
		font-weight: 800;
		text-transform: uppercase;
		font-family: var(--font-mono);
		margin-bottom: .725rem;
		padding-bottom: .425rem;
		border-bottom: 1px solid var(--color-gray-600);
	}
	.callout-body :global(li) {
		margin-bottom: 1rem;
		padding-left: .5rem;
		list-style-type: circle;
	}
</style>

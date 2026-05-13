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
		border-left: 3px solid var(--border);
		padding: 0.75rem 1rem;
		margin: 1rem 0;
		border-radius: 0.5rem;
		background: var(--muted);
	}
	.callout-info {
		border-left-color: var(--primary);
	}
	.callout-warning {
		border-left-color: #d97706;
	}
	.callout-success {
		border-left-color: #059669;
	}
	.callout-title {
		font-weight: 600;
		margin-bottom: 0.25rem;
	}
	.callout-body :global(p:last-child) {
		margin-bottom: 0;
	}
</style>

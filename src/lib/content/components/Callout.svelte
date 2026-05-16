<script lang="ts">
	import type { Snippet } from "svelte";

	type Variant = "info" | "warning" | "success" | "takeaway" | "citation" | "more";

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
		<div class="callout-title w-full border-b border-gray-300 p-4 mb-4">
			{title}</div>
	{/if}
	<div class="callout-body pb-2">
		{@render children()}
	</div>
</aside>

<style>
	.callout {
		border-top: 5px solid var(--border);
		margin: 3.5rem 0;
		background: var(--color-sidebar-primary-foreground);
		box-shadow: 10px 10px -10%;
	}

	.callout-info {
		border-top-color: var(--primary);
	}
	.callout-warning {
		border-top-color: var(--color-red-800);
	}

	.callout-takeaway {
		border-top-color: var(--color-secondary-foreground);
	}

	.callout-success {
		border-top-color: var(--color-green-600);
	}

	.callout-citation {
		border-top: 1px solid var(--primary);
		box-shadow: none;
		background-color: transparent;
		list-style-type: square;
	}

	.callout-more {
		border-top-color: var(--primary);
	}

	.callout-title {
		font-weight: 600;
		font-family: var(--font-heading-alt);
		text-transform: capitalize;
	}

	.callout-body :global(li) {
		padding-left: .5rem;
		list-style-type: circle;
	}
</style>

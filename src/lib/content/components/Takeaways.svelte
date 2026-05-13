<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		title = "Takeaways",
		children
	}: {
		title?: string;
		children: Snippet;
	} = $props();
</script>

<section class="takeaways">
	<h2 class="takeaways-title">
		{title}</h2>
	<div class="takeaways-body">
		{@render children()}
	</div>
</section>

<style>
	.takeaways {
		margin: 2rem 0;
	}
	.takeaways-title {
		font-size: 1.75rem;
		font-weight: 700;
		margin: 0 0 1.5rem;
		line-height: 1.1;
	}
	.takeaways-body :global(ul) {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
		gap: 2rem 2.5rem;
		counter-reset: takeaway;
	}
	.takeaways-body :global(li) {
		counter-increment: takeaway;
		position: relative;
		list-style: none;
		padding-top: 2.25rem;
		font-size: 1.0625rem;
		line-height: 1.55;
	}
	.takeaways-body :global(li::before) {
		content: counter(takeaway);
		position: absolute;
		top: 0;
		left: 0;
		font-size: 0.8125rem;
		color: var(--muted-foreground);
		font-variant-numeric: tabular-nums;
	}
	.takeaways-body :global(li::after) {
		content: "";
		position: absolute;
		top: 1.75rem;
		left: 0;
		right: 0;
		height: 1px;
		background: currentColor;
		opacity: 0.2;
	}
	.takeaways-body :global(p) {
		margin: 0 0 0.5rem;
	}
	.takeaways-body :global(p:last-child) {
		margin-bottom: 0;
	}
</style>

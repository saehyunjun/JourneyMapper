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
	<h2 class="takeaways-title">{title}</h2>

	<div class="takeaways-body">
		{@render children()}
	</div>
</section>

<style>

	.takeaways-body :global(ol) {
		display: grid;
		position: relative;
		margin-top: 4rem;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 2rem 1.25rem;
		list-style: none;
		counter-reset: takeaway;
	}

	.takeaways-body :global(li) {
		counter-increment: takeaway;
		position: relative;
		padding-top: .525rem;
		border-top: 2px solid var(--color-accent-mint);
		font-size: 1rem;
		line-height: 1.35;
	}

	.takeaways-body :global(li::before) {
		content: counter(takeaway);
		position: relative;
		font-weight: 800;
		font-size: 0.825rem;
		color: var(--color-accent-mint);
		font-variant-numeric: tabular-nums;
	}

	.takeaways-body :global(p) {
		font-size: 1rem;
		padding-top: 1rem;
		line-height: 1.4;
	}

	@media (max-width: 768px) {
		.takeaways-body :global(ol) {
			grid-template-columns: 1fr;
		}
	}
</style>
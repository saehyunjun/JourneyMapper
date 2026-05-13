<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		title = "Key takeaways",
		children
	}: {
		title?: string;
		children: Snippet;
	} = $props();
</script>

<aside class="takeaways">
	<h2 class="takeaways-title">{title}</h2>
	<div class="takeaways-body">
		{@render children()}
	</div>
</aside>

<style>
	.takeaways {
		position: relative;
		background: var(--muted);
		padding: 2rem 1.5rem 1.5rem;
		margin: 1.5rem 0;
		border-radius: 0.25rem;
	}
	.takeaways::before {
		content: "";
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
		background: var(--takeaways-accent, #ffea00);
		border-top-left-radius: 0.25rem;
		border-top-right-radius: 0.25rem;
	}
	.takeaways-title {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0 0 1rem;
		line-height: 1.2;
	}
	.takeaways-body :global(ul) {
		list-style: disc;
		padding-left: 1.25rem;
		margin: 0;
	}
	.takeaways-body :global(li) {
		margin-bottom: 0.75rem;
		line-height: 1.5;
	}
	.takeaways-body :global(li:last-child) {
		margin-bottom: 0;
	}
	.takeaways-body :global(p) {
		margin: 0 0 0.75rem;
		line-height: 1.5;
	}
	.takeaways-body :global(p:last-child) {
		margin-bottom: 0;
	}
</style>

<script lang="ts">
	let {
		src,
		alt = "",
		caption
	}: {
		src: string;
		alt?: string;
		caption?: string;
	} = $props();
</script>

<figure class="figure bg-secondary p-4 shadow-sm">
	<img {src} {alt} />
	{#if caption}
		<figcaption class="flex flex-row bg-muted border-t mt-4 border-accent-foreground pt-2 justify-between">
		{caption}</figcaption>
	{/if}
</figure>

<style>
	.figure {
		margin: 1.5rem 0;
		background-color: var(--color-secondary);
	}
	.figure img {
		width: 100%;
		height: auto;
		border-radius: 0.5rem;
		display: block;
	}

</style>

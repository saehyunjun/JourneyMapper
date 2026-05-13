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

<figure class="figure">
	<img {src} {alt} />
	{#if caption}
		<figcaption>{caption}</figcaption>
	{/if}
</figure>

<style>
	.figure {
		margin: 1.5rem 0;
	}
	.figure img {
		width: 100%;
		height: auto;
		border-radius: 0.5rem;
		display: block;
	}
	figcaption {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		margin-top: 0.5rem;
		text-align: center;
	}
</style>

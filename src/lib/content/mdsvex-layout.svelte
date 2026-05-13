<script module>
	export { default as Callout } from "$lib/content/components/Callout.svelte";
	export { default as Figure } from "$lib/content/components/Figure.svelte";
</script>

<script lang="ts">
	let { children } = $props();
</script>

{@render children()}

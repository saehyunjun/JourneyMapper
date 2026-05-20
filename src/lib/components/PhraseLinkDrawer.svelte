<!--
	PhraseLinkDrawer — tertiary drawer for linking the highlighted phrase to a
	phrase wordlist. Chrome is owned by TertiaryDrawer; placeholder body for now.
-->
<script lang="ts">
	import TertiaryDrawer from '$lib/components/TertiaryDrawer.svelte';

	let {
		open = $bindable(false),
		selection
	}: { open?: boolean; selection: string } = $props();
</script>

<TertiaryDrawer
	bind:open
	ariaLabel="Link to a phrase"
	eyebrow="Link to a phrase"
	title={`“${selection}”`}
>
	<div class="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
		<p class="text-sm text-slate-500">Phrase linking is coming soon.</p>
		<p class="text-xs text-slate-400">
			This drawer will let you attach the selection to an existing phrase wordlist or start a new
			one with the right semantic variants.
		</p>
	</div>
</TertiaryDrawer>

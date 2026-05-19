<!--
	RightDrawer — the app's standard right-side detail drawer.

	A thin wrapper over the ui/sheet primitives that fixes the side and width so
	every detail drawer (quotes, segments, heatmap cells, participant profiles)
	opens at one consistent size. Pass the drawer body as children — typically a
	`<div class="flex h-full flex-col">` with a header and a scrolling section.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as Sheet from '$lib/components/ui/sheet/index.js';

	let {
		open = $bindable(false),
		children
	}: {
		open?: boolean;
		children: Snippet;
	} = $props();
</script>

<Sheet.Root bind:open>
	<Sheet.Content
		side="right"
		class="data-[side=right]:sm:max-w-2xl data-[side=right]:md:max-w-3xl data-[side=right]:xl:max-w-4xl"
	>
		{@render children()}
	</Sheet.Content>
</Sheet.Root>

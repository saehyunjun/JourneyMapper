<!--
	RightDrawer — kept as a thin wrapper around AppDrawer level=primary for
	source-compat with existing consumers. New code should import AppDrawer
	directly from $lib/components/ui/app-drawer and pass level="primary".

	The body is owned by children (no built-in structured header), and the
	close button floats top-right — that's the historical RightDrawer
	contract that consumers like ParticipantDrawer and ThemeDrawer depend on.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { AppDrawer } from '$lib/components/ui/app-drawer';

	let {
		open = $bindable(false),
		showCloseButton = true,
		children
	}: {
		open?: boolean;
		showCloseButton?: boolean;
		children: Snippet;
	} = $props();
</script>

<AppDrawer bind:open level="primary" size="lg" {showCloseButton}>
	{@render children()}
</AppDrawer>

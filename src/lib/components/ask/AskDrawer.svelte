<!--
	AskDrawer — wider variant of the primary right-side drawer, sized
	for the Ask PatientlyAI answer + visualization layout.

	Wraps AppDrawer level="primary" with size="xl" so the answer prose +
	right-rail charts have enough horizontal room to read comfortably
	(the standard lg size capped at max-w-4xl was too tight). Mounted
	once in the patientlyiq layout — page-level callers shouldn't need
	to touch this file.
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

<AppDrawer bind:open level="primary" size="xl" {showCloseButton}>
	{@render children()}
</AppDrawer>

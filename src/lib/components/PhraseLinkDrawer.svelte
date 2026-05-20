<!--
	PhraseLinkDrawer — tertiary drawer for linking the highlighted phrase to a
	phrase wordlist (canonical label + semantic variants). Opened from the
	segment tag drawer's right-click menu.

	Placeholder for now: the surface text is shown but no linking UI yet —
	we'll revisit this once the phrase-linking flow is fully designed.
-->
<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';

	let {
		open = $bindable(false),
		selection
	}: { open?: boolean; selection: string } = $props();
</script>

{#if open}
	<div
		class="fixed inset-0 z-60 bg-slate-900/30"
		transition:fade={{ duration: 180 }}
		onclick={() => (open = false)}
		aria-hidden="true"
	></div>

	<aside
		class="fixed inset-y-0 right-0 z-70 flex w-full max-w-md flex-col bg-white shadow-2xl"
		transition:fly={{ x: 120, duration: 240, easing: cubicOut }}
		aria-label="Link to a phrase"
	>
		<header class="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
			<div class="min-w-0">
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
					Link to a phrase
				</p>
				<h2 class="mt-1 truncate font-heading text-xl font-light text-primary">
					“{selection}”
				</h2>
			</div>
			<Button variant="ghost" size="sm" onclick={() => (open = false)} aria-label="Close">
				<XIcon />
			</Button>
		</header>

		<div class="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
			<p class="text-sm text-slate-500">Phrase linking is coming soon.</p>
			<p class="text-xs text-slate-400">
				This drawer will let you attach the selection to an existing phrase wordlist or start a new
				one with the right semantic variants.
			</p>
		</div>
	</aside>
{/if}


<!--
	InlineLinkButton — a baseline-aligned link-styled button that sits inside a
	paragraph. Used to make focal numeric phrases ("296 tagged moments")
	clickable so they open the side drawer with the supporting evidence.

	Distinct from the ui/button "link" variant because that primitive carries
	w-fit + capitalize and stacks block-ish — this one flows inline with the
	surrounding text and keeps its case.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		onclick,
		children,
		ariaLabel = 'View supporting details'
	}: {
		onclick: () => void;
		children: Snippet;
		ariaLabel?: string;
	} = $props();
</script>

<button
	type="button"
	class="story-link-btn font-medium text-primary"
	{onclick}
	aria-label={ariaLabel}
>
	{@render children()}
</button>

<style>
	.story-link-btn {
		display: inline;
		border: 0;
		background: transparent;
		padding: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
		border-bottom: 1px dashed var(--midgreen, #7DBFA7);
		text-decoration: none;
		transition: border-color 150ms ease, color 150ms ease, border-bottom-style 150ms ease;
	}
	.story-link-btn:hover,
	.story-link-btn:focus-visible {
		color: var(--green, #599077);
		border-bottom-color: var(--green, #599077);
		border-bottom-style: solid;
		outline: none;
	}
	.story-link-btn:focus-visible {
		border-bottom-width: 2px;
	}
</style>

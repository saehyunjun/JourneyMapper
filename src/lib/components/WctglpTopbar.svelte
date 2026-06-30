<!--
	WctglpTopbar — the /patientlyiq top filter bar.

	The indication dropdown itself lives in IndicationPicker.svelte; this
	component owns only the topbar chrome (brand lockup, divider, trigger
	pill styling, view toggle). The shared picker handles grouping by TA,
	?indication=<id> + invalidateAll navigation, and is also rendered as
	an editorial pill in the /patientlyiq page header.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { ChevronDown } from '@lucide/svelte';
	import type { Indication, TherapeuticArea } from '$lib/server/lexicon';
	import PIQLogo from '$lib/components/PIQLogo.svelte';
	import ViewModeToggle from '$lib/components/ViewModeToggle.svelte';
	import IndicationPicker from '$lib/components/IndicationPicker.svelte';

	type Props = {
		indications: Indication[];
		therapeuticAreas: TherapeuticArea[];
		activeIndication: string;
	};
	let { indications, therapeuticAreas, activeIndication }: Props = $props();

	// The Story / Dashboard toggle is meaningful only on pages that implement
	// story mode. Today that's just the Executive Summary at /patientlyiq.
	const showViewToggle = $derived(page.url.pathname === '/patientlyiq');
</script>

<div class="topbar">
	<div class="brand-lockup">
		<PIQLogo />
		<span class="wordmark">PatientlyIQ</span>
	</div>

	<div class="divider-v"></div>

	<IndicationPicker {indications} {therapeuticAreas} {activeIndication}>
		{#snippet trigger({ active, props })}
			<button
				{...props}
				type="button"
				class="indication-trigger"
				aria-label="Select indication"
			>
				<span class="trigger-label">
					<span class="trigger-kicker">Indication</span>
					<span class="trigger-value">{active?.label ?? '—'}</span>
				</span>
				<ChevronDown class="size-4 shrink-0 text-(--gray)" />
			</button>
		{/snippet}
	</IndicationPicker>

	{#if showViewToggle}
		<div class="ml-auto flex items-center">
			<ViewModeToggle />
		</div>
	{/if}
</div>

<style>
	.topbar {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0 1.25rem;
		border-bottom: 1px solid var(--panel-mid);
		background: var(--paper);
		min-height: 3.5rem;
	}

	.brand-lockup {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.25rem 0;
	}

	.wordmark {
		font-family: var(--font-heading);
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--darkgrayblue);
	}

	.divider-v {
		width: 1px;
		height: 1.75rem;
		background: var(--panel-mid);
		flex-shrink: 0;
	}

	.indication-trigger {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.75rem;
		min-width: 12rem;
		justify-content: space-between;
		height: 2.375rem;
		padding: 0 0.875rem;
		text-align: left;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 999px;
		cursor: pointer;
		transition:
			background-color 160ms ease,
			border-color 160ms ease;
	}

	.indication-trigger:hover {
		background: rgba(255, 255, 255, 0.7);
		border-color: var(--panel-mid);
	}

	.trigger-label {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.trigger-kicker {
		font-family: var(--font-heading);
		font-size: 0.5625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--orange);
		line-height: 1;
	}

	.trigger-value {
		font-family: var(--font-heading);
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--ink);
		line-height: 1.15;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 14rem;
	}
</style>

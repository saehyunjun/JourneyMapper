<!--
	WctglpTopbar — the /wctglpdemo top filter bar.

	A single indication dropdown (bits-ui DropdownMenu — the same primitive
	family used for the right-click ContextMenu in SegmentTagDrawer). The
	cascading TA → Indication melt-ui selects didn't open reliably in
	practice; this replacement is a click-to-open menu with indications
	grouped under their therapeutic-area headings. Indications belonging to
	multiple therapeutic areas appear under each of their groups.

	Options are sourced from `data.slice.indications` + `data.slice.therapeutic_areas`,
	which the layout server loads from src/lib/content/registries/ (indications.json
	and therapeutic_areas.json) — the canonical registry. Cross-cutting
	clusters use `indications: []` and always show under whichever indication
	is active.

	On selection: goto(?indication=<id>, { invalidateAll: true }) so every
	loader downstream (layout + each +page.server.ts) re-runs and the
	visible pages reflect the new indication's data.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { ChevronDown, Check } from '@lucide/svelte';
	import type { Indication, TherapeuticArea } from '$lib/server/lexicon';
	import PIQLogo from '$lib/components/PIQLogo.svelte';
	import ViewModeToggle from '$lib/components/ViewModeToggle.svelte';

	type Props = {
		indications: Indication[];
		therapeuticAreas: TherapeuticArea[];
		activeIndication: string;
	};
	let { indications, therapeuticAreas, activeIndication }: Props = $props();

	// The Story / Dashboard toggle is meaningful only on pages that implement
	// story mode. Today that's just the Executive Summary at /patientlyiq.
	const showViewToggle = $derived(page.url.pathname === '/patientlyiq');

	const selectable = $derived(indications);

	// Group selectable indications by therapeutic area. An indication that
	// belongs to multiple TAs appears under each of them, matching the
	// many-to-many shape of the registry.
	type Group = { area: TherapeuticArea; indications: Indication[] };
	const groups = $derived<Group[]>(
		therapeuticAreas
			.map((area) => ({
				area,
				indications: selectable.filter((i) => i.therapeutic_area_ids.includes(area.id))
			}))
			.filter((g) => g.indications.length > 0)
	);

	const active = $derived(
		indications.find((i) => i.id === activeIndication) ?? selectable[0] ?? indications[0]
	);

	async function selectIndication(id: string) {
		if (id === activeIndication) return;
		const u = new URL(page.url);
		u.searchParams.set('indication', id);
		// invalidateAll re-runs every load() in the page tree (layout +
		// per-page +page.server.ts/+page.ts), so pages that read the active
		// indication or load indication-scoped data refresh together with
		// the URL change.
		await goto(u, { invalidateAll: true, keepFocus: false, noScroll: true });
	}
</script>

<div class="topbar">
	<div class="brand-lockup">
		<PIQLogo />
		<span class="wordmark">PatientlyIQ</span>
	</div>

	<div class="divider-v"></div>

	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
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
		</DropdownMenu.Trigger>
		<DropdownMenu.Content class="min-w-[18rem]" align="start" sideOffset={6}>
			{#each groups as group, i (group.area.id)}
				{#if i > 0}
					<DropdownMenu.Separator />
				{/if}
				<DropdownMenu.Group>
					<DropdownMenu.GroupHeading class="text-[0.65rem] font-heading font-semibold uppercase tracking-wider text-(--orange)"
						>{group.area.label}</DropdownMenu.GroupHeading
					>
					{#each group.indications as ind (ind.id)}
						{@const isActive = ind.id === activeIndication}
						<DropdownMenu.Item onSelect={() => selectIndication(ind.id)}>
							<div class="flex w-full items-start gap-2">
								<div class="mt-0.5 size-4 shrink-0">
									{#if isActive}
										<Check class="size-4 text-(--orange)" />
									{/if}
								</div>
								<div class="min-w-0 flex-1">
									<div class="text-sm font-medium text-(--ink)">
										{ind.label}</div>
								</div>
							</div>
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Group>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Root>

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

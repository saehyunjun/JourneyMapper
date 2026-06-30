<!--
	IndicationPicker — the shared TA-grouped indication dropdown.

	Wraps bits-ui DropdownMenu with a flat, TA-grouped list and the
	?indication=<id> + invalidateAll navigation contract. The consumer
	supplies its own trigger via the `trigger` snippet, so the same
	primitive can render as a topbar pill (WctglpTopbar) or an editorial
	header pill (/patientlyiq landing) without forking the dropdown logic.

	Flat-grouped (not nested submenus): the prior submenu shape didn't open
	reliably under click, and at ~5–10 indications the flat list fits in
	one scrollable panel without crowding.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Check } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import type { Indication, TherapeuticArea } from '$lib/server/lexicon';

	type TriggerArgs = {
		active: Indication | null;
		props: Record<string, unknown>;
	};

	type Props = {
		indications: Indication[];
		therapeuticAreas: TherapeuticArea[];
		activeIndication: string;
		trigger: Snippet<[TriggerArgs]>;
		/** Width of the dropdown panel; default 18rem fits TA heading + label + abbreviation. */
		contentClass?: string;
		align?: 'start' | 'center' | 'end';
		sideOffset?: number;
	};

	let {
		indications,
		therapeuticAreas,
		activeIndication,
		trigger,
		contentClass = 'min-w-[18rem]',
		align = 'start',
		sideOffset = 6
	}: Props = $props();

	type Group = { area: TherapeuticArea; indications: Indication[] };

	// Group indications by therapeutic area. An indication assigned to
	// multiple TAs appears under each of its parents — matches the many-
	// to-many registry shape.
	const groups = $derived<Group[]>(
		therapeuticAreas
			.map((area) => ({
				area,
				indications: indications.filter((i) => i.therapeutic_area_ids.includes(area.id))
			}))
			.filter((g) => g.indications.length > 0)
	);

	const active = $derived<Indication | null>(
		indications.find((i) => i.id === activeIndication) ?? indications[0] ?? null
	);

	async function selectIndication(id: string) {
		if (id === activeIndication) return;
		const u = new URL(page.url);
		u.searchParams.set('indication', id);
		// invalidateAll re-runs every load() in the page tree (layout +
		// per-page +page.server.ts/+page.ts) so indication-scoped data
		// refreshes alongside the URL change.
		await goto(u, { invalidateAll: true, keepFocus: false, noScroll: true });
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			{@render trigger({ active, props })}
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class={contentClass} {align} {sideOffset}>
		{#each groups as group, i (group.area.id)}
			{#if i > 0}
				<DropdownMenu.Separator />
			{/if}
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading
					class="text-[0.65rem] font-heading font-semibold uppercase tracking-wider text-(--orange)"
					>{group.area.label}</DropdownMenu.GroupHeading
				>
				{#each group.indications as ind (ind.id)}
					{@const isActive = ind.id === activeIndication}
					<DropdownMenu.Item onSelect={() => selectIndication(ind.id)}>
						<div class="flex w-full items-center gap-2">
							<div class="size-4 shrink-0">
								{#if isActive}
									<Check class="size-4 text-(--orange)" />
								{/if}
							</div>
							<span class="flex-1 text-sm font-medium text-(--ink)">{ind.label}</span>
							{#if ind.abbreviation}
								<span
									class="font-mono text-[0.65rem] uppercase tracking-wider text-(--gray)"
									>{ind.abbreviation}</span
								>
							{/if}
						</div>
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Group>
		{/each}
	</DropdownMenu.Content>
</DropdownMenu.Root>

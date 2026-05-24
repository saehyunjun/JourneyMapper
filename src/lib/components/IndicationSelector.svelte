<!--
	IndicationSelector — the condition toggle for the wctglpdemo sidebar.

	Reads the indications registry + active id from the layout's slice and
	renders a dropdown. Selecting an indication navigates to the current page
	with `?indication=<id>` set, preserving other query params. SvelteKit's
	layout server load re-runs, so the slice and any downstream consumers
	refresh.

	"general" is omitted from the selectable list — it's cross-cutting and
	always shown alongside whichever indication is active.

	`compact` prop renders the trigger as a small square badge (for use in an
	icon-rail sidebar) with a tooltip; the dropdown panel floats out to the
	right rather than pushing down within the rail.

	Closed by ESC, outside click, or selecting an option.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ChevronsUpDown, Check } from '@lucide/svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import type { Indication, TherapeuticArea } from '$lib/server/lexicon';

	type Props = {
		indications: Indication[];
		therapeuticAreas: TherapeuticArea[];
		activeIndication: string;
		compact?: boolean;
	};
	let { indications, therapeuticAreas, activeIndication, compact = false }: Props = $props();

	let open = $state(false);
	let buttonEl: HTMLButtonElement | undefined = $state();
	let panelEl: HTMLDivElement | undefined = $state();

	const selectable = $derived(indications.filter((i) => i.id !== 'general'));
	const active = $derived(
		indications.find((i) => i.id === activeIndication) ?? selectable[0] ?? indications[0]
	);
	const areaLabel = $derived(
		(id: string) => therapeuticAreas.find((a) => a.id === id)?.label ?? id
	);

	// First letter of each word, uppercased, max 3 chars. "Lupus Nephritis" → "LN".
	const initials = $derived(
		(active?.label ?? '?')
			.split(/\s+/)
			.filter(Boolean)
			.map((w) => w[0])
			.join('')
			.slice(0, 3)
			.toUpperCase()
	);
	const activeAreas = $derived(
		(active?.therapeutic_areas ?? []).map(areaLabel).join(' + ')
	);

	function select(id: string) {
		open = false;
		const u = new URL(page.url);
		u.searchParams.set('indication', id);
		goto(u, { keepFocus: false, noScroll: true });
	}

	function onDocClick(e: MouseEvent) {
		if (!open) return;
		const t = e.target as Node;
		if (buttonEl?.contains(t) || panelEl?.contains(t)) return;
		open = false;
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			open = false;
			buttonEl?.focus();
		}
	}

	$effect(() => {
		if (!open) return;
		document.addEventListener('click', onDocClick);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('click', onDocClick);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<div class="relative">
	{#if compact}
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<button
						{...props}
						bind:this={buttonEl}
						type="button"
						aria-haspopup="listbox"
						aria-expanded={open}
						aria-label="Indication: {active?.label ?? 'none'}"
						onclick={() => (open = !open)}
						class="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-white text-xs font-semibold tracking-tight text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-mint-background/40"
					>
						{initials}
					</button>
				{/snippet}
			</Tooltip.Trigger>
			{#if !open}
				<Tooltip.Content side="right" sideOffset={8}>
					<div class="flex flex-col gap-0.5">
						<span class="text-[10px] font-medium uppercase tracking-wide opacity-70"
							>Indication</span
						>
						<span class="font-medium">{active?.label ?? '—'}</span>
						{#if activeAreas}
							<span class="text-[11px] opacity-70">{activeAreas}</span>
						{/if}
					</div>
				</Tooltip.Content>
			{/if}
		</Tooltip.Root>
	{:else}
		<button
			bind:this={buttonEl}
			type="button"
			aria-haspopup="listbox"
			aria-expanded={open}
			onclick={() => (open = !open)}
			class="group flex w-full items-start gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-left text-sm shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-mint-background/40"
		>
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<span class="text-[10px] font-medium uppercase tracking-wide text-zinc-500"
					>Indication</span
				>
				<span class="truncate font-medium text-zinc-900">{active?.label ?? '—'}</span>
				{#if active?.therapeutic_areas?.length}
					<div class="mt-0.5 flex flex-wrap gap-1">
						{#each active.therapeutic_areas as areaId (areaId)}
							<span
								class="rounded-sm bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
								>{areaLabel(areaId)}</span
							>
						{/each}
					</div>
				{/if}
			</div>
			<ChevronsUpDown class="mt-0.5 size-4 shrink-0 text-zinc-400 group-hover:text-zinc-600" />
		</button>
	{/if}

	{#if open}
		<div
			bind:this={panelEl}
			role="listbox"
			aria-label="Select indication"
			class={compact
				? 'absolute left-full top-0 z-50 ml-2 w-72 max-h-[70vh] overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg'
				: 'absolute left-0 right-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg'}
		>
			<ul class="py-1">
				{#each selectable as ind (ind.id)}
					{@const isActive = ind.id === activeIndication}
					<li>
						<button
							type="button"
							role="option"
							aria-selected={isActive}
							onclick={() => select(ind.id)}
							class="flex w-full items-start gap-2 px-2.5 py-2 text-left text-sm transition-colors hover:bg-zinc-50 {isActive
								? 'bg-zinc-50'
								: ''}"
						>
							<div class="mt-0.5 size-4 shrink-0">
								{#if isActive}
									<Check class="size-4 text-accent-mint-background" />
								{/if}
							</div>
							<div class="min-w-0 flex-1">
								<div class="font-medium text-zinc-900">{ind.label}</div>
								{#if ind.mesh_term}
									<div class="text-[11px] text-zinc-500">MeSH · {ind.mesh_term}</div>
								{/if}
								{#if ind.therapeutic_areas?.length}
									<div class="mt-1 flex flex-wrap gap-1">
										{#each ind.therapeutic_areas as areaId (areaId)}
											<span
												class="rounded-sm bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
												>{areaLabel(areaId)}</span
											>
										{/each}
									</div>
								{/if}
							</div>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

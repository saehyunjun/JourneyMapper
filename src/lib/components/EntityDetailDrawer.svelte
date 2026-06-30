<!--
	EntityDetailDrawer — the detail drawer for the new Entity layer
	(drugs, biomarkers, sponsors, symptoms, concepts, trials, conditions).
	Sibling of GroupStatsDrawer, which still owns the legacy cluster/theme
	stats path.

	Phase 3 of the codebook migration. Opens when KeywordText dispatches
	an entity click via entityDrawer.open(entityId). Renders the entity's
	label, kind, indication scoping, surface forms, theme links, and
	kind-specific metadata.

	The mentions/sentiment aggregation (per-corpus rollups, cross-indication
	contrast) is intentionally NOT here yet — that data shape lands when
	the autotag pipeline produces EntityMention + ThemeTag rows in Phase 4.
	Until then the drawer shows an empty-state caption noting the gap, so
	the entity layer is visibly real even before the data layer catches up.

	Chrome (panel, backdrop, animation) is owned by TertiaryDrawer.
-->
<script lang="ts">
	import TertiaryDrawer from '$lib/components/TertiaryDrawer.svelte';
	import type { Entity, EntityKind } from '$lib/content/entities/types';
	import { themeDrawer } from '$lib/stores/theme-drawer.svelte';

	let {
		entity,
		onclose,
		level = 'top',
		indicationLabels = {}
	}: {
		entity: Entity | null;
		onclose: () => void;
		level?: 'secondary' | 'top';
		/** Map of indication_id → display label, used to render the
		 *  indication chips with human-readable text rather than slugs.
		 *  Optional — falls back to the raw id when no label is provided. */
		indicationLabels?: Record<string, string>;
	} = $props();

	// Phase 5: theme_link chips dispatch to ThemeStatsDrawer when clicked.
	// Allows pivoting from entity → theme without closing the drawer stack.
	function pickThemeLink(themeId: string) {
		themeDrawer.open(themeId);
	}

	const open = $derived(entity !== null);

	const KIND_LABEL: Record<EntityKind, string> = {
		drug: 'Drug',
		biomarker: 'Biomarker',
		sponsor: 'Sponsor',
		concept: 'Concept',
		symptom: 'Symptom',
		trial: 'Trial',
		condition: 'Condition'
	};

	// Per-kind background tints. Full-perimeter colored backgrounds, no
	// side rails — hard rule #4 forbids border-left + rounded-rect combos.
	const KIND_BG: Record<EntityKind, string> = {
		drug: 'bg-emerald-50 text-emerald-900 border-emerald-200',
		biomarker: 'bg-sky-50 text-sky-900 border-sky-200',
		sponsor: 'bg-amber-50 text-amber-900 border-amber-200',
		concept: 'bg-violet-50 text-violet-900 border-violet-200',
		symptom: 'bg-rose-50 text-rose-900 border-rose-200',
		trial: 'bg-indigo-50 text-indigo-900 border-indigo-200',
		condition: 'bg-slate-50 text-slate-900 border-slate-200'
	};

	function indLabel(id: string): string {
		return indicationLabels[id] ?? id;
	}

	// Format kind-specific metadata as dt/dd pairs for the bottom Metadata
	// section. Each kind has a tiny per-shape projector; the entity
	// registry is small enough that this isn't a maintenance burden.
	type Pair = { dt: string; dd: string };
	function metadataPairs(e: Entity): Pair[] {
		const md = e.metadata as Record<string, unknown>;
		const out: Pair[] = [];
		const push = (dt: string, value: unknown) => {
			if (value === undefined || value === null || value === '') return;
			if (Array.isArray(value)) {
				if (value.length === 0) return;
				out.push({ dt, dd: value.join(', ') });
			} else {
				out.push({ dt, dd: String(value) });
			}
		};
		switch (e.kind) {
			case 'drug':
				push('Class', md.class);
				push('Mechanism', md.mechanism);
				push('Approval', md.approval_status);
				push('Brand names', md.brand_names);
				push('Routes', md.routes);
				push('Generic name', md.generic_name);
				push('Sponsor', md.sponsor_id);
				break;
			case 'biomarker':
				push('Measurement type', md.measurement_type);
				push('Normal range', md.normal_range);
				push('Clinical use', md.clinical_use);
				break;
			case 'sponsor':
				push('Type', md.sponsor_type);
				push('Headquarters', md.headquarters_country);
				push('Parent org', md.parent_org);
				break;
			case 'symptom':
				push('Severity scale', md.severity_scale);
				push('ICD-10', md.icd10_codes);
				break;
			case 'trial':
				push('NCT ID', md.nct_id);
				push('Phase', md.phase);
				push('Status', md.status);
				push('Sponsor', md.sponsor_id);
				break;
			case 'condition':
				push('ICD-10', md.icd10_codes);
				push('Primary indication', md.is_primary_indication);
				break;
		}
		return out;
	}

	const pairs = $derived(entity ? metadataPairs(entity) : []);
	const kindBg = $derived(entity ? KIND_BG[entity.kind] : '');
</script>

<TertiaryDrawer
	{open}
	{onclose}
	ariaLabel="Entity detail"
	{level}
	width="wide"
	eyebrow={entity ? KIND_LABEL[entity.kind].toUpperCase() : undefined}
	title={entity?.label}
	subtitle={entity?.description}
>
	{#if entity}
		<div class="flex flex-1 flex-col gap-6 p-4">
			<!-- Kind + indication chip row -->
			<div class="flex flex-wrap items-center gap-2">
				<span
					class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium {kindBg}"
					>{KIND_LABEL[entity.kind]}</span
				>
				{#if entity.indications.length === 0}
					<span
						class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600"
						>Cross-cutting</span
					>
				{:else}
					{#each entity.indications as ind (ind)}
						<span
							class="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700"
							>{indLabel(ind)}</span
						>
					{/each}
				{/if}
				{#each entity.therapeutic_areas as ta (ta)}
					<span
						class="inline-flex items-center rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-[10px] font-medium tracking-wide text-slate-500 uppercase"
						>{ta}</span
					>
				{/each}
			</div>

			<!-- Theme links (clickable: opens ThemeStatsDrawer for that theme) -->
			{#if entity.theme_links.length > 0}
				<section class="flex flex-col gap-2">
					<p
						class="border-b border-muted-foreground font-heading text-xs font-bold uppercase text-muted-foreground"
					>
						Theme links
					</p>
					<p class="text-xs text-muted-foreground">
						Themes this entity is typically discussed in. Click any chip to open the theme's stats
						across the active indication.
					</p>
					<div class="flex flex-wrap gap-1.5 pt-1">
						{#each entity.theme_links as tid (tid)}
							<button
								type="button"
								onclick={() => pickThemeLink(tid)}
								class="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono text-xs text-zinc-700 transition-colors hover:bg-zinc-50 hover:border-zinc-300"
								>{tid}</button
							>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Surface forms -->
			{#if entity.surface_forms.length > 0}
				<section class="flex flex-col gap-2">
					<p
						class="border-b border-muted-foreground font-heading text-xs font-bold uppercase text-muted-foreground"
					>
						Surface forms ({entity.surface_forms.length})
					</p>
					<div class="flex flex-wrap gap-1.5 pt-1">
						{#each entity.surface_forms as sf (sf)}
							<span
								class="inline-flex items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700"
								>{sf}</span
							>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Kind-specific metadata -->
			{#if pairs.length > 0}
				<section class="flex flex-col gap-2">
					<p
						class="border-b border-muted-foreground font-heading text-xs font-bold uppercase text-muted-foreground"
					>
						Metadata
					</p>
					<dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 pt-1 text-sm">
						{#each pairs as p (p.dt)}
							<dt class="font-mono text-xs uppercase tracking-wide text-muted-foreground">
								{p.dt}
							</dt>
							<dd class="text-zinc-800">{p.dd}</dd>
						{/each}
					</dl>
				</section>
			{/if}

			<!-- Mentions placeholder (Phase 4 fills this) -->
			<section class="flex flex-col gap-2">
				<p
					class="border-b border-muted-foreground font-heading text-xs font-bold uppercase text-muted-foreground"
				>
					Corpus mentions
				</p>
				<p class="text-xs text-muted-foreground">
					No EntityMention rows yet. The autotag pipeline (Phase 4 of the codebook migration) will
					populate per-corpus mention counts, sentiment distribution, and cross-indication
					contrast here.
				</p>
			</section>

			<!-- Provenance footer -->
			<div class="mt-auto border-t border-zinc-100 pt-3">
				<p class="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
					Provenance: {entity.provenance} · Status: {entity.status} · ID: {entity.id}
				</p>
			</div>
		</div>
	{/if}
</TertiaryDrawer>

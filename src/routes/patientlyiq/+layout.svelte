<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import WctglpTopbar from '$lib/components/WctglpTopbar.svelte';
	import WctglpSidebar from '$lib/components/WctglpSidebar.svelte';
	import ToastViewport from '$lib/components/ToastViewport.svelte';
	import GroupStatsDrawer from '$lib/components/GroupStatsDrawer.svelte';
	import EntityDetailDrawer from '$lib/components/EntityDetailDrawer.svelte';
	import ThemeStatsDrawer from '$lib/components/ThemeStatsDrawer.svelte';
	import AskFab from '$lib/components/ask/AskFab.svelte';
	import AskPanel from '$lib/components/ask/AskPanel.svelte';
	import AskDrawer from '$lib/components/ask/AskDrawer.svelte';
	import { groupDrawer } from '$lib/stores/group-drawer.svelte.js';
	import { entityDrawer } from '$lib/stores/entity-drawer.svelte';
	import { themeDrawer } from '$lib/stores/theme-drawer.svelte';
	import { askStore } from '$lib/stores/ask-patientlyai.svelte';
	import { getThemeStats } from '$lib/content/theme-tags';
	import themesV2Raw from '$lib/content/themes/themes.json';
	import type { Theme as ThemeV2 } from '$lib/content/themes/types';
	import { ASK_DEMO_SEEDS } from '$lib/content/ask-demo-seeds';
	import { groupStats as glp1GroupStats } from '$lib/content/wctglpdemo-data/lexicon-stats';
	import {
		groupStats as corpusGroupStats,
		hasCorpusForIndication
	} from '$lib/content/lexicon-stats-corpus';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	// Story mode owns its own chrome (StoryFrame) and exit affordance, so the
	// app shell steps out of the way when ?view=story is active.
	const isStory = $derived(page.url.searchParams.get('view') === 'story');

	// Global lexicon stats drawer — fed by the groupDrawer store, which any
	// KeywordText click anywhere in the app fires into. Workbench-specific
	// subtheme stats are computed locally on that page; this layout drawer
	// only handles the wctglpdemo lexicon kinds ('keyword' | 'theme').
	//
	// Routing: indications backed by a fragment corpus (LN, MS, …) read from
	// corpora/<id>/{fragments,annotations}. Obesity stays on the legacy
	// wctglpdemo path (denser annotations + participant profiles than the
	// wct_glp1_2025q4 corpus surfaces today). When a non-obesity indication is
	// active but has no corpus loaded, fall back to the legacy module so the
	// drawer still renders something rather than blank zeros.
	const layoutStats = $derived.by(() => {
		const cur = groupDrawer.current;
		if (!cur || cur.kind === 'subtheme') return null;
		const ind = data.slice.active_indication;
		if (ind !== 'obesity' && hasCorpusForIndication(ind)) {
			return corpusGroupStats(ind, cur.kind, cur.id);
		}
		return glp1GroupStats(cur.kind, cur.id);
	});

	const activeIndicationLabel = $derived(
		data.slice.indications.find((i) => i.id === data.slice.active_indication)?.label ?? ''
	);

	// === Ask PatientlyAI — global FAB + drawer ==============================
	// Mounted at layout level so the FAB is visible on every route under
	// /patientlyiq and the drawer / question state survives navigation.

	// Seed the store at component-init time (before any $effect fires) so
	// that the first syncIndication() call below sees the primer table
	// populated. Demo Q&A pairs surface as instant "Recent" pills; the
	// indication primer pre-fills the input when the drawer opens.
	{
		const seeds = Object.values(ASK_DEMO_SEEDS).flatMap((s) =>
			s.answers.map((a) => ({
				question: a.question,
				indication: a.indication,
				additional_indications: a.additional_indications,
				response: a.response,
				timestamp: 0,
				source: 'seed' as const
			}))
		);
		const seedPrimers: Record<string, string> = {};
		for (const [ind, s] of Object.entries(ASK_DEMO_SEEDS)) seedPrimers[ind] = s.primer;
		askStore.registerSeeds({ seeds, primers: seedPrimers });
	}

	const activeIndication = $derived(data.slice.active_indication);

	// Phase 3 of the codebook migration: resolve the entityDrawer's
	// current selection against the layout's entity slice so
	// EntityDetailDrawer renders the right entity. Sibling to
	// layoutStats / GroupStatsDrawer above.
	const activeEntity = $derived.by(() => {
		const sel = entityDrawer.current;
		if (!sel) return null;
		return data.slice.entities.find((e) => e.id === sel.entityId) ?? null;
	});

	// Indication label map for the EntityDetailDrawer's chip row — saves
	// the drawer from re-looking-up labels from the registry on each render.
	const indicationLabelMap = $derived<Record<string, string>>(
		Object.fromEntries(data.slice.indications.map((i) => [i.id, i.label]))
	);

	// Phase 5: resolve the themeDrawer's current query against the corpora
	// backing the active indication. Reads Phase 4's theme_tags/<source>.json
	// output via the bundled-glob loader. themesV2 is the 27-theme registry
	// from themes.json; the drawer uses it to resolve theme_ids to display
	// labels + axis info.
	const themeStats = $derived.by(() => {
		const sel = themeDrawer.current;
		if (!sel) return null;
		return getThemeStats(activeIndication, sel.query);
	});
	const themesV2 = (themesV2Raw as { items: ThemeV2[] }).items;

	// Indications with corpora that the user could fold into the workbench
	// pool. Passed in full (including the active one) so the AskPanel and
	// its charts can look up a human-readable label for *any* indication —
	// the panel itself filters out the active id from the "Compare with"
	// picker. Without the active indication in this list, the sentiment-by-
	// indication chart would render the bare slug ("multiple_sclerosis")
	// because it has no label-map entry to humanize from.
	const indicationsWithCorpora = $derived(
		new Set<string>(data.indicationsWithCorpora ?? [])
	);
	const compareIndications = $derived(
		data.slice.indications
			.filter((i) => indicationsWithCorpora.has(i.id))
			.map((i) => ({ id: i.id, label: i.label }))
	);

	// Clear stale answer + comparison set when the active indication
	// changes. The store reset is idempotent — calling it with the same
	// indication is a no-op.
	$effect(() => {
		askStore.syncIndication(activeIndication);
	});

	// Bridge the store's drawerOpen flag to a local $state so AppDrawer
	// can bind to it (Svelte 5 bind: only accepts state/props, not
	// getter+setter on a plain object).
	//
	// Each effect is locked to ONE side of the bridge via untrack so
	// they don't race: the store→local effect tracks only the store
	// flag and silently writes the local one; the local→store effect
	// tracks only the local flag and silently calls the store methods.
	// Without untrack, an X-click that sets local=false would be
	// reverted by the first effect (which still sees store=true) before
	// the second effect could fire close().
	let drawerOpen = $state(askStore.drawerOpen);
	$effect(() => {
		const storeOpen = askStore.drawerOpen;
		untrack(() => {
			if (drawerOpen !== storeOpen) drawerOpen = storeOpen;
		});
	});
	$effect(() => {
		const localOpen = drawerOpen;
		untrack(() => {
			if (askStore.drawerOpen === localOpen) return;
			if (localOpen) askStore.openDrawer();
			else askStore.closeDrawer();
		});
	});

</script>

<div class="flex min-h-svh flex-col bg-(--panel)">
	{#if !isStory}
		<div class="sticky top-0 z-40">
			<WctglpTopbar
				indications={data.slice.indications}
				therapeuticAreas={data.slice.therapeutic_areas}
				activeIndication={data.slice.active_indication}
			/>
		</div>
	{/if}
	<div class="flex flex-1">
		{#if !isStory}
			<WctglpSidebar activeIndication={data.slice.active_indication} />
		{/if}
		<main class="flex min-w-0 flex-1 flex-col bg-(--panel)">
			{@render children()}
		</main>
	</div>
</div>

<GroupStatsDrawer
	stats={layoutStats}
	scopeLabel={activeIndicationLabel}
	onclose={() => groupDrawer.close()}
/>
<EntityDetailDrawer
	entity={activeEntity}
	indicationLabels={indicationLabelMap}
	onclose={() => entityDrawer.close()}
/>
<ThemeStatsDrawer
	stats={themeStats}
	themes={themesV2}
	scopeLabel={activeIndicationLabel}
	onclose={() => themeDrawer.close()}
/>
<ToastViewport />

{#if !isStory}
	<AskDrawer bind:open={drawerOpen} showCloseButton={true}>
		<AskPanel
			indication={activeIndication}
			availableIndications={compareIndications}
		/>
	</AskDrawer>

	<AskFab />
{/if}

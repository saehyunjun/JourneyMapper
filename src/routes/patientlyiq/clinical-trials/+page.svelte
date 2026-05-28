<!--
	Clinical-trials explorer.

	Bubble map: one bubble per country, sized by the count of active+recent
	trials with ≥1 site in that country. Filters (phase, intervention type,
	sponsor class, status) subset the trial pool; bubbles re-size smoothly.
	Trial-level data is shipped from the server already projected — the
	component aggregates by country in $derived on every filter change.
-->
<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { TrialRow } from './+page.server';
	import type { PageProps } from './$types';
	import { onMount } from 'svelte';
	import { geoEqualEarth, geoPath, geoCentroid, scaleSqrt } from 'd3';
	import { feature } from 'topojson-client';

	let { data }: PageProps = $props();

	// ---- Filter state ----------------------------------------------------
	// Each chip filter is a Set of selected values. Empty set = "no filter" (all pass).
	// Initial defaults focus on the "what's actively being studied now" view:
	// active/recruiting industry-sponsored interventional drug-class trials.
	const DEFAULT_STATUS = new Set(['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'NOT_YET_RECRUITING']);
	const DEFAULT_SPONSOR_CLASS = new Set(['INDUSTRY']);
	const DEFAULT_STUDY_TYPE = new Set(['INTERVENTIONAL']);
	const DEFAULT_IV_TYPE = new Set([
		'DRUG',
		'BIOLOGICAL',
		'COMBINATION_PRODUCT',
		'GENETIC'
	]);

	let phaseFilter = $state(new Set<string>());
	let ivTypeFilter = $state(new Set(DEFAULT_IV_TYPE));
	let sponsorClassFilter = $state(new Set(DEFAULT_SPONSOR_CLASS));
	let statusFilter = $state(new Set(DEFAULT_STATUS));
	let studyTypeFilter = $state(new Set(DEFAULT_STUDY_TYPE));
	// Free-text search filters (substring, case-insensitive) — chip lists don't scale
	// for the ~1,800 distinct intervention names or ~1,100 sponsors in MS alone.
	let ivNameQuery = $state('');
	let sponsorQuery = $state('');
	const ivNameQueryNorm = $derived(ivNameQuery.trim().toLowerCase());
	const sponsorQueryNorm = $derived(sponsorQuery.trim().toLowerCase());

	function toggle(set: Set<string>, val: string) {
		const next = new Set(set);
		if (next.has(val)) next.delete(val);
		else next.add(val);
		return next;
	}
	const togglePhase = (v: string) => (phaseFilter = toggle(phaseFilter, v));
	const toggleIv = (v: string) => (ivTypeFilter = toggle(ivTypeFilter, v));
	const toggleSponsor = (v: string) => (sponsorClassFilter = toggle(sponsorClassFilter, v));
	const toggleStatus = (v: string) => (statusFilter = toggle(statusFilter, v));
	const toggleStudyType = (v: string) => (studyTypeFilter = toggle(studyTypeFilter, v));

	function resetAll() {
		phaseFilter = new Set();
		ivTypeFilter = new Set();
		sponsorClassFilter = new Set();
		statusFilter = new Set();
		studyTypeFilter = new Set();
		ivNameQuery = '';
		sponsorQuery = '';
	}
	function restoreDefaults() {
		phaseFilter = new Set();
		ivTypeFilter = new Set(DEFAULT_IV_TYPE);
		sponsorClassFilter = new Set(DEFAULT_SPONSOR_CLASS);
		statusFilter = new Set(DEFAULT_STATUS);
		studyTypeFilter = new Set(DEFAULT_STUDY_TYPE);
		ivNameQuery = '';
		sponsorQuery = '';
	}
	const anyFilterActive = $derived(
		phaseFilter.size +
			ivTypeFilter.size +
			sponsorClassFilter.size +
			statusFilter.size +
			studyTypeFilter.size +
			(ivNameQueryNorm ? 1 : 0) +
			(sponsorQueryNorm ? 1 : 0) >
			0
	);

	function humanize(s: string): string {
		return s
			.replace(/_/g, ' ')
			.toLowerCase()
			.replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
	}

	// ---- Filter application ---------------------------------------------
	const filtered = $derived.by(() => {
		const ivQ = ivNameQueryNorm;
		const spQ = sponsorQueryNorm;
		return data.trials.filter((t: TrialRow) => {
			if (phaseFilter.size && !t.phases.some((p) => phaseFilter.has(p))) return false;
			if (ivTypeFilter.size && !t.intervention_types.some((x) => ivTypeFilter.has(x))) return false;
			if (sponsorClassFilter.size) {
				if (!t.sponsor_class || !sponsorClassFilter.has(t.sponsor_class)) return false;
			}
			if (statusFilter.size) {
				if (!t.status || !statusFilter.has(t.status)) return false;
			}
			if (studyTypeFilter.size) {
				if (!t.study_type || !studyTypeFilter.has(t.study_type)) return false;
			}
			if (ivQ) {
				if (!t.intervention_names.some((n) => n.toLowerCase().includes(ivQ))) return false;
			}
			if (spQ) {
				if (!t.sponsor_name || !t.sponsor_name.toLowerCase().includes(spQ)) return false;
			}
			return true;
		});
	});

	// ---- Aggregation by country -----------------------------------------
	type CountryAgg = {
		name: string;
		count: number;
		by_phase: Record<string, number>;
		by_status: Record<string, number>;
	};
	const byCountry = $derived.by(() => {
		const m = new Map<string, CountryAgg>();
		for (const t of filtered) {
			for (const c of t.countries) {
				let agg = m.get(c);
				if (!agg) {
					agg = { name: c, count: 0, by_phase: {}, by_status: {} };
					m.set(c, agg);
				}
				agg.count += 1;
				for (const p of t.phases) agg.by_phase[p] = (agg.by_phase[p] ?? 0) + 1;
				if (t.status) agg.by_status[t.status] = (agg.by_status[t.status] ?? 0) + 1;
			}
		}
		return [...m.values()].sort((a, b) => b.count - a.count);
	});

	// ---- Map data (lazy-loaded topojson) --------------------------------
	type Feature = { type: 'Feature'; properties: { name: string }; geometry: unknown };
	let landFeatures = $state<Feature[] | null>(null);
	let countryCentroids = $state<Map<string, [number, number]> | null>(null);
	let loadError = $state<string | null>(null);

	onMount(async () => {
		try {
			const res = await fetch('/maps/world-110m.json');
			if (!res.ok) throw new Error('HTTP ' + res.status);
			const topo = await res.json();
			const fc = feature(topo, topo.objects.countries) as unknown as {
				features: Feature[];
			};
			landFeatures = fc.features;
			const m = new Map<string, [number, number]>();
			for (const f of fc.features) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const c = geoCentroid(f as any) as [number, number];
				if (Number.isFinite(c[0]) && Number.isFinite(c[1])) {
					m.set(f.properties.name, c);
				}
			}
			countryCentroids = m;
		} catch (e) {
			loadError = e instanceof Error ? e.message : String(e);
		}
	});

	// ---- Projection + scales --------------------------------------------
	const VB_W = 980;
	const VB_H = 520;
	const projection = $derived(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		geoEqualEarth().fitSize([VB_W, VB_H], { type: 'Sphere' } as any)
	);
	const path = $derived(geoPath(projection));

	const maxCount = $derived(byCountry[0]?.count ?? 1);
	const bubbleR = $derived(scaleSqrt().domain([0, Math.max(maxCount, 1)]).range([0, 28]));

	// Legend radii — three reference circles at max, ~quarter-max, and 1.
	const legendMidCount = $derived(Math.max(Math.round(maxCount / 4), 1));
	const legendRMax = $derived(bubbleR(Math.max(maxCount, 1)));
	const legendRMid = $derived(bubbleR(legendMidCount));
	const legendRMin = $derived(bubbleR(1));

	type Bubble = {
		name: string;
		count: number;
		cx: number;
		cy: number;
		r: number;
		agg: CountryAgg;
	};
	const bubbles = $derived.by<Bubble[]>(() => {
		if (!countryCentroids) return [];
		const out: Bubble[] = [];
		for (const agg of byCountry) {
			const ll = countryCentroids.get(agg.name);
			if (!ll) continue;
			const xy = projection(ll);
			if (!xy) continue;
			out.push({ name: agg.name, count: agg.count, cx: xy[0], cy: xy[1], r: bubbleR(agg.count), agg });
		}
		// Render bigger bubbles first so smaller ones overlay on top and remain hittable.
		return out.sort((a, b) => b.r - a.r);
	});

	// Hover / tooltip
	let hoverName = $state<string | null>(null);
	const hoveredBubble = $derived(
		hoverName ? bubbles.find((b) => b.name === hoverName) ?? null : null
	);
	const topPhases = $derived.by(() => {
		if (!hoveredBubble) return [] as Array<[string, number]>;
		return Object.entries(hoveredBubble.agg.by_phase)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 4);
	});

	// ---- Focused-country zoom -------------------------------------------
	// When a country bubble is clicked, the map transforms to fit that country
	// and switches from country-aggregate bubbles to per-site bubbles.
	let focusedCountryName = $state<string | null>(null);

	function focusCountry(name: string) {
		focusedCountryName = name;
		hoverName = null;
		hoverSiteKey = null;
		selectedSiteKey = null;
	}
	function unfocus() {
		focusedCountryName = null;
		hoverSiteKey = null;
		selectedSiteKey = null;
	}

	const focusedFeature = $derived.by<Feature | null>(() => {
		if (!focusedCountryName || !landFeatures) return null;
		return landFeatures.find((f) => f.properties.name === focusedCountryName) ?? null;
	});

	const mapView = $derived.by(() => {
		if (!focusedFeature) return { tx: 0, ty: 0, scale: 1 };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const bounds = path.bounds(focusedFeature as any) as [[number, number], [number, number]];
		const [[x0, y0], [x1, y1]] = bounds;
		const bw = Math.max(x1 - x0, 1);
		const bh = Math.max(y1 - y0, 1);
		const scale = Math.min(VB_W / bw, VB_H / bh) * 0.82;
		const cx = (x0 + x1) / 2;
		const cy = (y0 + y1) / 2;
		return { tx: VB_W / 2 - cx * scale, ty: VB_H / 2 - cy * scale, scale };
	});
	// CSS transform syntax (commas + px units) so transitions animate smoothly across browsers.
	// `transform-box: view-box` + `transform-origin: 0 0` keeps the origin at SVG (0,0) regardless
	// of the element's bounding box, which is essential for the math above to be correct.
	const mapTransform = $derived(
		`translate(${mapView.tx}px, ${mapView.ty}px) scale(${mapView.scale})`
	);

	// ---- Site aggregation (only when focused) ---------------------------
	type SiteAgg = {
		key: string;
		cx: number;
		cy: number;
		trials: number;
		cities: string[];
		facilities: string[];
		/** NCT ids of trials with ≥1 location at this clustered site. Dedupe via a Set during build. */
		trialIds: string[];
	};
	const siteBubbles = $derived.by<SiteAgg[]>(() => {
		if (!focusedCountryName) return [];
		const m = new Map<string, SiteAgg>();
		// Per-cluster trial-id set so we don't double-count a multi-site trial that hits the same cluster twice.
		const seenPerCluster = new Map<string, Set<string>>();
		for (const t of filtered) {
			if (!t.countries.includes(focusedCountryName)) continue;
			for (const s of t.sites) {
				if (s.country !== focusedCountryName) continue;
				// Cluster sites within ~10 km (one decimal of lat/lon).
				const key = `${Math.round(s.lat * 10) / 10},${Math.round(s.lon * 10) / 10}`;
				let agg = m.get(key);
				if (!agg) {
					const xy = projection([s.lon, s.lat]);
					if (!xy) continue;
					agg = { key, cx: xy[0], cy: xy[1], trials: 0, cities: [], facilities: [], trialIds: [] };
					m.set(key, agg);
					seenPerCluster.set(key, new Set());
				}
				const seen = seenPerCluster.get(key)!;
				if (!seen.has(t.id)) {
					seen.add(t.id);
					agg.trials += 1;
					agg.trialIds.push(t.id);
				}
				if (s.city && !agg.cities.includes(s.city) && agg.cities.length < 4) {
					agg.cities.push(s.city);
				}
				if (s.facility && !agg.facilities.includes(s.facility) && agg.facilities.length < 4) {
					agg.facilities.push(s.facility);
				}
			}
		}
		return [...m.values()].sort((a, b) => b.trials - a.trials);
	});

	const siteR = $derived.by(() => {
		const max = siteBubbles[0]?.trials ?? 1;
		return scaleSqrt()
			.domain([0, Math.max(max, 1)])
			.range([0, 12]);
	});

	// Site hover state
	let hoverSiteKey = $state<string | null>(null);
	const hoveredSite = $derived(
		hoverSiteKey ? siteBubbles.find((s) => s.key === hoverSiteKey) ?? null : null
	);

	// Site-click drawer state. Selecting a site shows a list of its trials in a
	// right-side drawer that overlays the map. Cleared when unfocusing the country.
	let selectedSiteKey = $state<string | null>(null);
	const selectedSite = $derived(
		selectedSiteKey ? siteBubbles.find((s) => s.key === selectedSiteKey) ?? null : null
	);
	const selectedSiteTrials = $derived.by<TrialRow[]>(() => {
		if (!selectedSite) return [];
		const wanted = new Set(selectedSite.trialIds);
		return filtered
			.filter((t) => wanted.has(t.id))
			// Most-informative-status-first ordering: actively enrolling at the top.
			.sort((a, b) => {
				const rank = (s: string | null) =>
					s === 'RECRUITING'
						? 0
						: s === 'ENROLLING_BY_INVITATION'
							? 1
							: s === 'NOT_YET_RECRUITING'
								? 2
								: s === 'ACTIVE_NOT_RECRUITING'
									? 3
									: 4;
				const da = rank(a.status);
				const db = rank(b.status);
				if (da !== db) return da - db;
				return (a.title ?? '').localeCompare(b.title ?? '');
			});
	});
	function closeDrawer() {
		selectedSiteKey = null;
	}

	// Map a bubble's logical SVG coords through the current zoom transform so
	// the floating tooltip stays attached visually as the map zooms.
	function visualX(cx: number) {
		return (cx * mapView.scale + mapView.tx) / VB_W;
	}
	function visualY(cy: number) {
		return (cy * mapView.scale + mapView.ty) / VB_H;
	}

	// Esc closes the drawer first; a second Esc unfocuses the country.
	$effect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key !== 'Escape') return;
			if (selectedSiteKey !== null) {
				selectedSiteKey = null;
			} else if (focusedCountryName !== null) {
				unfocus();
			}
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

<svelte:head>
	<title>Clinical trials · {data.indication?.label ?? 'PatientlyIQ'}</title>
</svelte:head>

<PageHeader
	eyebrow="Clinical Trial Explorer"
	title={data.indication?.label ?? 'Clinical trials'}
	subtitle="Active and recently-active studies registered with ClinicalTrials.gov. One bubble per country, sized by trial count. Filter to focus on phase, intervention class, sponsor type, or current status."
/>

<div class="mx-auto w-full px-8 pt-6 pb-16">
{#if !data.indication}
<p class="text-sm text-(--gray)">No indication active.</p>
	{:else if data.trials.length === 0}
		<p class="text-sm text-(--gray)">No clinical-trials dataset registered for this indication.</p>
	{:else}
		<!-- Summary chips -->
		<div class="mb-6 flex flex-wrap items-center gap-2 text-xs text-(--gray)">
			<span class="rounded-full border border-(--panel-mid) bg-(--paper) px-2.5 py-1 font-medium text-(--ink)">
				{filtered.length.toLocaleString()} of {data.trials.length.toLocaleString()} trials
			</span>
			<span class="rounded-full border border-(--panel-mid) bg-(--paper) px-2.5 py-1">
				{byCountry.length} countries
			</span>
			{#if data.activity_filter}
				<span class="rounded-full border border-(--panel-mid) bg-(--paper) px-2.5 py-1 font-mono">
					updated ≥ {data.activity_filter.recent_cutoff}
				</span>
			{/if}
			{#if data.source_fetched_at}
				<span class="rounded-full border border-(--panel-mid) bg-(--paper) px-2.5 py-1 font-mono">
					fetched {data.source_fetched_at.slice(0, 10)}
				</span>
			{/if}
			{#if anyFilterActive}
				<div class="ml-auto flex gap-2">
					<button
						type="button"
						onclick={restoreDefaults}
						class="rounded-full border border-(--panel-mid) bg-(--paper) px-3 py-1 text-(--ink) hover:border-(--midgrayblue)/50"
					>
						Restore defaults
					</button>
					<button
						type="button"
						onclick={resetAll}
						class="rounded-full border border-(--orange)/40 bg-(--orange)/10 px-3 py-1 text-(--orange) hover:bg-(--orange)/20"
					>
						Clear filters
					</button>
				</div>
			{/if}
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
			<!-- ============ Filter sidebar ============ -->
			<aside class="flex flex-col gap-5">
				{#snippet filterGroup(title: string, options: string[], selected: Set<string>, onToggle: (v: string) => void)}
					<section>
						<h3 class="font-heading mb-2 text-[10px] font-semibold tracking-widest uppercase text-(--darkgrayblue)">
							{title}
						</h3>
						<div class="flex flex-wrap gap-1.5">
							{#each options as opt (opt)}
								{@const on = selected.has(opt)}
								<button
									type="button"
									onclick={() => onToggle(opt)}
									aria-pressed={on}
									class="rounded-full border px-2.5 py-0.5 text-[11px] transition-colors {on
										? 'border-(--midgrayblue) bg-(--midgrayblue) text-(--paper)'
										: 'border-(--panel-mid) bg-(--paper) text-(--ink) hover:border-(--midgrayblue)/50'}"
								>
									{humanize(opt)}
								</button>
							{/each}
						</div>
					</section>
				{/snippet}

				{@render filterGroup('Phase', data.facets.phases, phaseFilter, togglePhase)}
				{#if data.facets.study_types.length > 1}
					{@render filterGroup('Study type', data.facets.study_types, studyTypeFilter, toggleStudyType)}
				{/if}
				{@render filterGroup('Intervention type', data.facets.intervention_types, ivTypeFilter, toggleIv)}

				<!-- Intervention-name search -->
				<section>
					<h3 class="font-heading mb-2 text-[10px] font-semibold tracking-widest uppercase text-(--darkgrayblue)">
						Intervention name
					</h3>
					<div class="relative">
						<input
							type="search"
							bind:value={ivNameQuery}
							placeholder="e.g. ocrelizumab"
							class="w-full rounded-md border border-(--panel-mid) bg-(--paper) px-2.5 py-1.5 pr-7 text-xs text-(--ink) placeholder:text-(--gray) focus:border-(--midgrayblue) focus:outline-none"
						/>
						{#if ivNameQuery}
							<button
								type="button"
								aria-label="Clear intervention search"
								onclick={() => (ivNameQuery = '')}
								class="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full px-1.5 text-xs text-(--gray) hover:bg-(--panel) hover:text-(--ink)"
							>
								×
							</button>
						{/if}
					</div>
					{#if data.facets.top_interventions.length > 0}
						<div class="mt-2 flex flex-wrap gap-1">
							{#each data.facets.top_interventions.slice(0, 8) as iv (iv.name)}
								{@const on = ivNameQueryNorm === iv.name.toLowerCase()}
								<button
									type="button"
									onclick={() => (ivNameQuery = on ? '' : iv.name)}
									aria-pressed={on}
									title="{iv.count} trials"
									class="rounded-full border px-2 py-0.5 text-[10px] transition-colors {on
										? 'border-(--midgrayblue) bg-(--midgrayblue) text-(--paper)'
										: 'border-(--panel-mid) bg-(--paper) text-(--ink) hover:border-(--midgrayblue)/50'}"
								>
									{iv.name}
									<span class={on ? 'opacity-70' : 'text-(--gray)'}>· {iv.count}</span>
								</button>
							{/each}
						</div>
					{/if}
				</section>

				{@render filterGroup('Sponsor class', data.facets.sponsor_classes, sponsorClassFilter, toggleSponsor)}

				<!-- Sponsor-name search -->
				<section>
					<h3 class="font-heading mb-2 text-[10px] font-semibold tracking-widest uppercase text-(--darkgrayblue)">
						Sponsor name
					</h3>
					<div class="relative">
						<input
							type="search"
							bind:value={sponsorQuery}
							placeholder="e.g. Biogen"
							list="sponsor-name-suggestions"
							class="w-full rounded-md border border-(--panel-mid) bg-(--paper) px-2.5 py-1.5 pr-7 text-xs text-(--ink) placeholder:text-(--gray) focus:border-(--midgrayblue) focus:outline-none"
						/>
						{#if sponsorQuery}
							<button
								type="button"
								aria-label="Clear sponsor search"
								onclick={() => (sponsorQuery = '')}
								class="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full px-1.5 text-xs text-(--gray) hover:bg-(--panel) hover:text-(--ink)"
							>
								×
							</button>
						{/if}
						<!-- Native datalist gives free typeahead against the top-N sponsors without committing to a custom combobox. -->
						<datalist id="sponsor-name-suggestions">
							{#each data.facets.top_sponsors as sp (sp.name)}
								<option value={sp.name}>{sp.count} trials</option>
							{/each}
						</datalist>
					</div>
					{#if data.facets.top_sponsors.length > 0}
						<div class="mt-2 flex flex-wrap gap-1">
							{#each data.facets.top_sponsors.slice(0, 6) as sp (sp.name)}
								{@const on = sponsorQueryNorm === sp.name.toLowerCase()}
								<button
									type="button"
									onclick={() => (sponsorQuery = on ? '' : sp.name)}
									aria-pressed={on}
									title="{sp.count} trials"
									class="rounded-full border px-2 py-0.5 text-[10px] transition-colors {on
										? 'border-(--midgrayblue) bg-(--midgrayblue) text-(--paper)'
										: 'border-(--panel-mid) bg-(--paper) text-(--ink) hover:border-(--midgrayblue)/50'}"
								>
									{sp.name}
									<span class={on ? 'opacity-70' : 'text-(--gray)'}>· {sp.count}</span>
								</button>
							{/each}
						</div>
					{/if}
				</section>

				{@render filterGroup('Status', data.facets.statuses, statusFilter, toggleStatus)}

				<section class="mt-2 rounded-md border border-(--panel-mid) bg-(--paper) p-3">
					<h3 class="font-heading mb-2 text-[10px] font-semibold tracking-widest uppercase text-(--darkgrayblue)">
						Top countries
					</h3>
					{#if byCountry.length === 0}
						<p class="text-[11px] text-(--gray)">No trials match the current filter.</p>
					{:else}
						<ul class="flex flex-col gap-1">
							{#each byCountry.slice(0, 8) as c (c.name)}
								<li
									class="grid grid-cols-[1fr_auto] items-center gap-2 text-[11px]"
									onmouseenter={() => (hoverName = c.name)}
									onmouseleave={() => (hoverName = null)}
								>
									<span class="truncate text-(--ink)" title={c.name}>{c.name}</span>
									<span class="font-mono text-(--darkgrayblue)">{c.count}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			</aside>

			<!-- ============ Map ============ -->
			<div class="relative flex min-h-[520px] items-center justify-center overflow-hidden rounded-lg border border-(--panel-mid) bg-(--paper) lg:self-start">
				{#if loadError}
					<p class="p-4 text-xs text-(--orange)">Failed to load world map: {loadError}</p>
				{:else if !landFeatures}
					<p class="p-4 text-xs text-(--gray)">Loading map…</p>
				{:else}
					<svg viewBox="0 0 {VB_W} {VB_H}" class="block w-full" role="img" aria-label="World map of clinical trial sites">
						<g
							style:transform={mapTransform}
							style:transform-box="view-box"
							style:transform-origin="0 0"
							style:transition="transform 600ms cubic-bezier(0.4, 0, 0.2, 1)"
							style:will-change="transform"
						>
							<!-- Land outlines -->
							<g class="land">
								{#each landFeatures as f, i (i)}
									<path
										d={path(f as never) ?? ''}
										fill={focusedCountryName === f.properties.name ? 'var(--paper)' : 'var(--panel)'}
										stroke={focusedCountryName === f.properties.name
											? 'var(--midgrayblue)'
											: 'var(--panel-mid)'}
										stroke-width={focusedCountryName === f.properties.name ? 1 : 0.5}
										vector-effect="non-scaling-stroke"
									/>
								{/each}
							</g>

							{#if !focusedCountryName}
								<!-- Country bubbles (world view) -->
								<g class="bubbles">
									{#each bubbles as b (b.name)}
										<circle
											cx={b.cx}
											cy={b.cy}
											r={b.r}
											fill="var(--orange)"
											fill-opacity={hoverName && hoverName !== b.name ? 0.18 : 0.55}
											stroke="var(--orange)"
											stroke-opacity={hoverName === b.name ? 1 : 0.6}
											stroke-width={hoverName === b.name ? 1.5 : 0.75}
											class="cursor-pointer"
											style="transition: r 280ms ease, fill-opacity 180ms ease;"
											onmouseenter={() => (hoverName = b.name)}
											onmouseleave={() => (hoverName = null)}
											onclick={() => focusCountry(b.name)}
											tabindex="0"
											onfocus={() => (hoverName = b.name)}
											onblur={() => (hoverName = null)}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													focusCountry(b.name);
												}
											}}
										>
											<title>{b.name}: {b.count} trials — click to zoom</title>
										</circle>
									{/each}
								</g>
							{:else}
								<!-- Site bubbles (country view); radii inverse-scaled so they stay visually consistent. -->
								<g class="sites">
									{#each siteBubbles as s (s.key)}
										{@const isSelected = selectedSiteKey === s.key}
										<circle
											cx={s.cx}
											cy={s.cy}
											r={siteR(s.trials) / mapView.scale}
											fill={isSelected ? 'var(--midgrayblue)' : 'var(--teal)'}
											fill-opacity={hoverSiteKey && hoverSiteKey !== s.key && !isSelected
												? 0.22
												: 0.75}
											stroke={isSelected ? 'var(--midgrayblue)' : 'var(--teal)'}
											stroke-opacity={hoverSiteKey === s.key || isSelected ? 1 : 0.75}
											stroke-width={(isSelected ? 2 : hoverSiteKey === s.key ? 1.5 : 0.6) /
												mapView.scale}
											class="cursor-pointer"
											onmouseenter={() => (hoverSiteKey = s.key)}
											onmouseleave={() => (hoverSiteKey = null)}
											onclick={() => (selectedSiteKey = s.key)}
											tabindex="0"
											onfocus={() => (hoverSiteKey = s.key)}
											onblur={() => (hoverSiteKey = null)}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													selectedSiteKey = s.key;
												}
											}}
										>
											<title
												>{s.cities[0] ?? s.facilities[0] ?? 'Site'}: {s.trials} trial{s.trials === 1
													? ''
													: 's'} — click for details</title
											>
										</circle>
									{/each}
								</g>
							{/if}
						</g>
					</svg>

					<!-- Back-to-world button (visible when focused) -->
					{#if focusedCountryName}
						<button
							type="button"
							onclick={unfocus}
							class="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md border border-(--panel-mid) bg-(--paper) px-2.5 py-1 text-xs text-(--ink) shadow-sm hover:bg-(--panel)"
							title="Back to world view (Esc)"
						>
							<span aria-hidden="true">←</span>
							<span class="font-medium">{focusedCountryName}</span>
							<span class="ml-1 text-(--gray)">· {siteBubbles.length} sites</span>
						</button>
					{/if}

					<!-- Site drawer (opens when a site bubble is clicked) -->
					{#if selectedSite}
						<div
							role="dialog"
							aria-modal="false"
							aria-label="Trials at this site"
							class="absolute right-0 top-0 z-20 flex h-full w-[360px] max-w-[80%] flex-col overflow-hidden rounded-r-lg border-l border-(--panel-mid) bg-(--paper) shadow-xl"
						>
							<header class="flex items-start justify-between gap-2 border-b border-(--panel-mid) px-4 py-3">
								<div class="min-w-0">
									{#if selectedSite.cities.length > 0}
										<p class="font-heading truncate text-sm font-semibold text-(--ink)" title={selectedSite.cities.join(', ')}>
											{selectedSite.cities.join(', ')}
										</p>
									{:else}
										<p class="font-heading text-sm font-semibold text-(--ink)">Site</p>
									{/if}
									{#if selectedSite.facilities.length > 0}
										<p class="truncate text-[11px] text-(--gray)" title={selectedSite.facilities.join(' · ')}>
											{selectedSite.facilities[0]}{selectedSite.facilities.length > 1
												? ` (+${selectedSite.facilities.length - 1} more)`
												: ''}
										</p>
									{/if}
									<p class="mt-1 text-[11px] text-(--gray)">
										<span class="font-mono text-(--darkgrayblue)">{selectedSiteTrials.length}</span>
										trial{selectedSiteTrials.length === 1 ? '' : 's'} matching the current filter
									</p>
								</div>
								<button
									type="button"
									onclick={closeDrawer}
									aria-label="Close drawer"
									class="rounded-full p-1 text-(--gray) hover:bg-(--panel) hover:text-(--ink)"
								>
									×
								</button>
							</header>

							<div class="flex-1 overflow-y-auto px-4 py-3">
								{#if selectedSiteTrials.length === 0}
									<p class="text-xs text-(--gray)">No matching trials at this site.</p>
								{:else}
									<ul class="flex flex-col gap-3">
										{#each selectedSiteTrials as t (t.id)}
											<li class="rounded-md border border-(--panel-mid) bg-(--panel)/50 p-2.5">
												<div class="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-(--gray)">
													<a
														href="https://clinicaltrials.gov/study/{t.id}"
														target="_blank"
														rel="noopener noreferrer"
														class="font-mono text-(--midgrayblue) hover:underline"
													>
														{t.id}
													</a>
													{#if t.status}
														<span class="rounded-full bg-(--paper) px-1.5 py-0.5 text-(--ink)">{humanize(t.status)}</span>
													{/if}
													{#each t.phases as p (p)}
														<span class="rounded-full bg-(--paper) px-1.5 py-0.5 text-(--ink)">{humanize(p)}</span>
													{/each}
												</div>
												{#if t.title}
													<p class="text-[12px] leading-snug text-(--ink)">{t.title}</p>
												{/if}
												<div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-(--gray)">
													{#if t.sponsor_name}
														<span>
															<span class="text-(--ink)">{t.sponsor_name}</span>{#if t.sponsor_class}
																<span class="ml-1 lowercase">{humanize(t.sponsor_class)}</span>
															{/if}
														</span>
													{/if}
													{#if t.intervention_names.length > 0}
														<span>
															{t.intervention_names.slice(0, 3).join(', ')}{t.intervention_names.length > 3
																? `, +${t.intervention_names.length - 3}`
																: ''}
														</span>
													{/if}
												</div>
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Country tooltip (world view) -->
					{#if hoveredBubble && !focusedCountryName}
						<div
							class="pointer-events-none absolute z-10 max-w-xs rounded-md border border-(--panel-mid) bg-(--paper) p-3 shadow-md"
							style:left="{visualX(hoveredBubble.cx) * 100}%"
							style:top="{visualY(hoveredBubble.cy) * 100}%"
							style:transform="translate(12px, -50%)"
						>
							<p class="font-heading text-sm font-semibold text-(--ink)">{hoveredBubble.name}</p>
							<p class="mb-1.5 text-xs text-(--gray)">
								<span class="font-mono text-base text-(--darkgrayblue)">{hoveredBubble.count}</span> trials
							</p>
							{#if topPhases.length > 0}
								<ul class="flex flex-col gap-0.5 text-[11px]">
									{#each topPhases as [phase, n] (phase)}
										<li class="flex justify-between gap-3">
											<span class="text-(--ink)">{humanize(phase)}</span>
											<span class="font-mono text-(--darkgrayblue)">{n}</span>
										</li>
									{/each}
								</ul>
							{/if}
							<p class="mt-1.5 border-t border-(--panel-mid) pt-1.5 text-[10px] text-(--gray)">
								Click to zoom →
							</p>
						</div>
					{/if}

					<!-- Site tooltip (country view) -->
					{#if hoveredSite && focusedCountryName}
						<div
							class="pointer-events-none absolute z-10 max-w-xs rounded-md border border-(--panel-mid) bg-(--paper) p-3 shadow-md"
							style:left="{visualX(hoveredSite.cx) * 100}%"
							style:top="{visualY(hoveredSite.cy) * 100}%"
							style:transform="translate(12px, -50%)"
						>
							{#if hoveredSite.cities.length > 0}
								<p class="font-heading text-sm font-semibold text-(--ink)">
									{hoveredSite.cities.join(', ')}
								</p>
							{/if}
							{#if hoveredSite.facilities.length > 0}
								<p class="text-[11px] text-(--gray)">{hoveredSite.facilities[0]}{hoveredSite.facilities.length > 1 ? ` (+${hoveredSite.facilities.length - 1})` : ''}</p>
							{/if}
							<p class="mt-1 text-xs text-(--gray)">
								<span class="font-mono text-base text-(--darkgrayblue)">{hoveredSite.trials}</span>
								trial{hoveredSite.trials === 1 ? '' : 's'}
							</p>
						</div>
					{/if}

					<!-- Legend -->
					<div class="absolute bottom-3 right-3 flex items-end gap-3 rounded-md border border-(--panel-mid) bg-(--paper)/90 px-3 py-2 backdrop-blur">
						<span class="font-heading text-[10px] uppercase tracking-wider text-(--gray)">Trials per country</span>
						<svg width="140" height="34" viewBox="0 0 140 34">
							<circle cx="20" cy="22" r={legendRMax} fill="var(--orange)" fill-opacity="0.4" stroke="var(--orange)" stroke-opacity="0.7" stroke-width="0.75" />
							<circle cx="60" cy="22" r={legendRMid} fill="var(--orange)" fill-opacity="0.4" stroke="var(--orange)" stroke-opacity="0.7" stroke-width="0.75" />
							<circle cx="100" cy="22" r={legendRMin} fill="var(--orange)" fill-opacity="0.4" stroke="var(--orange)" stroke-opacity="0.7" stroke-width="0.75" />
							<text x="20" y="34" text-anchor="middle" font-size="9" fill="var(--gray)" font-family="monospace">{maxCount}</text>
							<text x="60" y="34" text-anchor="middle" font-size="9" fill="var(--gray)" font-family="monospace">{legendMidCount}</text>
							<text x="100" y="34" text-anchor="middle" font-size="9" fill="var(--gray)" font-family="monospace">1</text>
						</svg>
					</div>
				{/if}
			</div>
		</div>

		{#if data.stats.dropped_country_names.length > 0}
			<p class="mt-4 text-[10px] text-(--gray)">
				Note: {data.stats.dropped_country_names.length} CT.gov location countries are not represented on this map ({data.stats.dropped_country_names
					.slice(0, 6)
					.join(', ')}{data.stats.dropped_country_names.length > 6 ? '…' : ''}). Trials at those sites are still counted if they have any other geocoded site.
			</p>
		{/if}
	{/if}
</div>

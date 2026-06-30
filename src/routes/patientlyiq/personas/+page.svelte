<!--
	Personas — two parallel galleries of cluster-shape cards:

	  - Suggestions: clusters produced by the deterministic suggester,
	    ranked across corpora.
	  - Saved: analyst-curated PersonaFilter JSONs in
	    src/lib/content/personas/. Stats are computed on the fly by running
	    each filter against the first matching corpus.

	Top-level toggle switches galleries; a pill strip lists every entry in
	the active gallery; the bento renders the shared PersonaView shape.
-->

<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import BentoCard from '$lib/components/personas/BentoCard.svelte';
	import { createCountUp, createReplayKeys } from '$lib/components/personas/bento-anim.svelte';
	import { themePalette } from '$lib/content/wctglpdemo-data/topicTree';
	import type { PageProps } from './$types';
	import type { PersonaView } from './+page.server';
	import {
		Tag as TagIcon,
		Quote as QuoteIcon,
		Layers,
		Route,
		Sparkles,
		Filter as FilterIcon,
		Users
	} from '@lucide/svelte';

	let { data }: PageProps = $props();

	// === Active indication ===================================================
	// Sourced from the patientlyiq layout (`?indication=<id>`). Both galleries
	// scope to it so the page mirrors the rest of the indication-context-aware
	// surfaces (analysis, journey-workbench, etc.).
	type SliceLike = { active_indication?: string };
	const activeIndication = $derived(
		(data as unknown as { slice?: SliceLike }).slice?.active_indication ?? null
	);

	// === Gallery + selection =================================================

	let view = $state<'suggestions' | 'saved'>(
		untrack(() => data.initialView)
	);
	const allInActiveView = $derived<PersonaView[]>(
		view === 'saved' ? data.saved : data.suggestions
	);
	const gallery = $derived<PersonaView[]>(
		activeIndication
			? allInActiveView.filter((p) => p.indication === activeIndication)
			: allInActiveView
	);

	// If the selected persona falls outside the indication scope after a switch,
	// jump to the first remaining one.
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		[activeIndication, view];
		untrack(() => {
			if (!gallery.some((p) => p.id === selectedId)) {
				selectedId = gallery[0]?.id ?? '';
			}
		});
	});

	// Per-gallery counts scoped to the active indication. Drives the tab labels.
	const sugScopedCount = $derived(
		activeIndication
			? data.suggestions.filter((p) => p.indication === activeIndication).length
			: data.suggestions.length
	);
	const savedScopedCount = $derived(
		activeIndication
			? data.saved.filter((p) => p.indication === activeIndication).length
			: data.saved.length
	);

	let selectedId = $state<string>(
		untrack(() => data.initialPersonaId ?? '')
	);
	const selected = $derived<PersonaView | null>(
		gallery.find((p) => p.id === selectedId) ?? null
	);

	function switchView(next: 'suggestions' | 'saved') {
		if (view === next) return;
		view = next;
		dismissExpanded();
		// Land on the first entry of the new view, scoped to the active
		// indication so the user doesn't jump to a persona that gets
		// immediately filtered out.
		const nextGallery = (next === 'saved' ? data.saved : data.suggestions).filter(
			(p) => !activeIndication || p.indication === activeIndication
		);
		selectedId = nextGallery[0]?.id ?? '';
		const url = new URL(window.location.href);
		url.searchParams.set('view', next);
		if (selectedId) url.searchParams.set('persona', selectedId);
		else url.searchParams.delete('persona');
		url.searchParams.delete('suggestion');
		url.searchParams.delete('focus');
		goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
	}

	function selectPersona(id: string) {
		selectedId = id;
		dismissExpanded();
		const url = new URL(window.location.href);
		url.searchParams.set('view', view);
		url.searchParams.set('persona', id);
		url.searchParams.delete('suggestion');
		url.searchParams.delete('focus');
		goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
	}

	// === Archetype vs bento ==================================================
	// When the selected persona has a narrative sidecar, we render the
	// Commonwealth-style archetype layout by default; clicking the toggle
	// flips back to the cluster-stats bento for verification.
	let archetypeView = $state(true);
	const hasNarrative = $derived(selected?.narrative != null);

	// === Bento expansion =====================================================

	type CardId = 'identity' | 'themes' | 'filter' | 'journey' | 'emotional' | 'evidence';
	let expandedCard = $state<CardId | null>(null);

	function expand(id: CardId) {
		expandedCard = id;
		syncFocusUrl(id);
	}
	function dismissExpanded() {
		expandedCard = null;
		syncFocusUrl(null);
	}
	function syncFocusUrl(focus: CardId | null) {
		const url = new URL(window.location.href);
		if (focus) url.searchParams.set('focus', focus);
		else url.searchParams.delete('focus');
		goto(url.pathname + url.search, { replaceState: true, keepFocus: true, noScroll: true });
	}

	$effect(() => {
		const focus = page.url.searchParams.get('focus') as CardId | null;
		const valid: CardId[] = ['identity', 'themes', 'filter', 'journey', 'emotional', 'evidence'];
		untrack(() => {
			if (focus && valid.includes(focus) && expandedCard !== focus) expandedCard = focus;
		});
	});

	// === Display helpers =====================================================

	function titleCase(id: string): string {
		return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	// Hardcoded indication palette; lives here rather than the codebook because
	// it's a visual concern, not a data one. Extract to a registry once a
	// fourth indication lands.
	const INDICATION_COLOR: Record<string, string> = {
		obesity: '#cc6324',
		lupus_nephritis: '#7c3aed',
		multiple_sclerosis: '#0d9488'
	};
	function indicationColor(id: string | null): string {
		return (id && INDICATION_COLOR[id]) || '#64748b';
	}

	function personaTitle(p: PersonaView): string {
		// Suggestions don't carry a label; derive one from the dominant subtheme.
		// Saved personas carry their analyst-authored `title` (= persona.label).
		if (p.title) return p.title;
		const top = p.top_subthemes[0]?.id ?? p.top_themes[0]?.id ?? null;
		return top ? titleCase(top) : `Cluster #${p.rank ?? '?'}`;
	}

	function evidenceAuthorAvatar(author: string | null): string | null {
		if (!selected || !author) return null;
		return selected.evidence.find((ev) => ev.author_handle_hash === author)?.author_avatar_url ?? null;
	}

	// Filter prose — a one-sentence English render of the PersonaFilter, used
	// in the hero card and the pill subtitle. Optional chunks only render when
	// the filter actually carries them.
	function filterProse(p: PersonaView): string {
		const f = p.filter;
		const parts: string[] = [];
		if (f.indications?.length) {
			parts.push(`in ${f.indications.map((i) => titleCase(i)).join(' / ')}`);
		}
		if (f.content_source?.length) {
			parts.push(`from ${f.content_source.map((c) => titleCase(c)).join(' or ')}`);
		}
		if (f.annotations?.has_stage?.length) {
			parts.push(`at the ${f.annotations.has_stage.map(titleCase).join(' / ')} stage`);
		}
		if (f.annotations?.has_subtheme?.length) {
			parts.push(
				`touching ${f.annotations.has_subtheme.slice(0, 3).map(titleCase).join(', ')}`
			);
		}
		if (f.annotations?.has_emotion?.length) {
			parts.push(`carrying ${f.annotations.has_emotion.map(titleCase).join(' / ')}`);
		}
		if (f.annotations?.sentiment) {
			const { min, max } = f.annotations.sentiment;
			if (min != null && max != null) parts.push(`with sentiment in [${min}, ${max}]`);
			else if (min != null) parts.push(`with sentiment ≥ ${min}`);
			else if (max != null) parts.push(`with sentiment ≤ ${max}`);
		}
		return parts.length > 0 ? `Fragments ${parts.join(', ')}.` : 'Unfiltered cluster.';
	}

	// === Derived per-selection views =========================================

	const selectedThemes = $derived(selected?.top_themes ?? []);
	const selectedSubthemes = $derived(selected?.top_subthemes ?? []);
	const maxThemeShare = $derived(
		selectedThemes.reduce((m, t) => Math.max(m, t.share), 0) || 1
	);
	const maxSubthemeShare = $derived(
		selectedSubthemes.reduce((m, t) => Math.max(m, t.share), 0) || 1
	);

	const selectedStages = $derived(selected?.top_stages ?? []);
	const selectedSteps = $derived(selected?.top_steps ?? []);
	const maxStageShare = $derived(
		selectedStages.reduce((m, t) => Math.max(m, t.share), 0) || 1
	);
	const maxStepShare = $derived(
		selectedSteps.reduce((m, t) => Math.max(m, t.share), 0) || 1
	);

	const selectedEmotions = $derived(selected?.top_emotions ?? []);
	const maxEmotionShare = $derived(
		selectedEmotions.reduce((m, t) => Math.max(m, t.share), 0) || 1
	);

	// Sentiment mean lives on [-2, 2] (per codebook); map to 0–100 for a band.
	const sentimentPct = $derived(
		selected?.sentiment ? Math.round(((selected.sentiment.mean + 2) / 4) * 100) : 50
	);
	const sentimentLabel = $derived.by(() => {
		const m = selected?.sentiment?.mean;
		if (m == null) return 'No sentiment data';
		if (m <= -1) return 'Strongly negative';
		if (m < -0.25) return 'Negative-leaning';
		if (m <= 0.25) return 'Mixed / neutral';
		if (m < 1) return 'Positive-leaning';
		return 'Strongly positive';
	});

	// === Bento motion ========================================================

	const replay = createReplayKeys();
	const bumpReplay = (id: string) => replay.bump(id);

	const trigger = $derived(`${selectedId}|${replay.keys['hero'] ?? 0}`);
	const fragmentCountTween = createCountUp(
		() => selected?.fragment_count ?? 0,
		() => trigger
	);
	const authorCountTween = createCountUp(
		() => selected?.author_count ?? 0,
		() => trigger
	);
	const annotatedCountTween = createCountUp(
		() => selected?.annotated_count ?? 0,
		() => trigger
	);

	// === Filter-chip rows for the Filter card ================================

	type FilterChip = { kind: string; value: string; color: string };
	const filterChips = $derived.by<FilterChip[]>(() => {
		if (!selected) return [];
		const f = selected.filter;
		const chips: FilterChip[] = [];
		for (const i of f.indications ?? []) {
			chips.push({ kind: 'Indication', value: titleCase(i), color: indicationColor(i) });
		}
		for (const c of f.content_source ?? []) {
			chips.push({ kind: 'Source', value: titleCase(c), color: '#64748b' });
		}
		for (const s of f.annotations?.has_stage ?? []) {
			chips.push({ kind: 'Stage', value: titleCase(s), color: '#0ea5e9' });
		}
		for (const s of f.annotations?.has_step ?? []) {
			chips.push({ kind: 'Step', value: titleCase(s), color: '#06b6d4' });
		}
		for (const t of f.annotations?.has_theme ?? []) {
			chips.push({ kind: 'Theme', value: titleCase(t), color: themePalette[t] ?? '#64748b' });
		}
		for (const st of f.annotations?.has_subtheme ?? []) {
			chips.push({ kind: 'Subtheme', value: titleCase(st), color: '#6366f1' });
		}
		for (const e of f.annotations?.has_emotion ?? []) {
			chips.push({ kind: 'Emotion', value: titleCase(e), color: '#f59e0b' });
		}
		const role = f.speaker_attrs?.role;
		if (role?.in?.length) {
			for (const v of role.in) {
				chips.push({ kind: 'Role', value: titleCase(String(v)), color: '#f97316' });
			}
		}
		return chips;
	});
</script>

<svelte:head><title>Personas</title></svelte:head>

<div class="flex flex-1 flex-col">
	<PageHeader eyebrow="In their own words · Personas" title="Cluster signatures" />

	<div class="mx-auto flex w-full max-w-7xl flex-col gap-8 px-8 py-10">
		<!-- View toggle — switch between auto-discovered Suggestions and the
		     analyst-curated Saved gallery. Both counts are scoped to the
		     active indication, mirroring the gallery filtering. -->
		<div class="flex items-center gap-3">
			<div
				class="inline-flex rounded-full border border-(--ink)/15 bg-(--paper) p-0.5 text-sm"
				role="tablist"
			>
				<button
					type="button"
					role="tab"
					aria-selected={view === 'suggestions'}
					onclick={() => switchView('suggestions')}
					class="rounded-full px-4 py-1.5 transition-colors
						{view === 'suggestions'
						? 'bg-(--orange) text-(--paper)'
						: 'text-foreground hover:bg-(--ink)/5'}"
				>
					Suggestions
					<span class="ml-1 opacity-70">· {sugScopedCount}</span>
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={view === 'saved'}
					onclick={() => switchView('saved')}
					class="rounded-full px-4 py-1.5 transition-colors
						{view === 'saved'
						? 'bg-(--orange) text-(--paper)'
						: 'text-foreground hover:bg-(--ink)/5'}"
				>
					Saved
					<span class="ml-1 opacity-70">· {savedScopedCount}</span>
				</button>
			</div>
			{#if activeIndication}
				<span class="text-xs text-muted-foreground">
					scoped to <strong>{titleCase(activeIndication)}</strong>
				</span>
			{/if}
		</div>

		{#if gallery.length === 0}
			<p class="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
				{#if view === 'suggestions'}
					No persona suggestions yet. Run
					<code class="rounded bg-(--ink)/8 px-1.5 py-0.5 font-mono">
						node scripts/propose-persona-suggestions.mjs &lt;corpus_id&gt;
					</code>
					to generate clusters for at least one corpus.
				{:else}
					No saved personas yet. Use the
					<a href="/patientlyiq/persona-workbench" class="text-accent-mint underline">workbench</a>
					to derive or build one.
				{/if}
			</p>
		{:else}
			<!-- Pills — one per persona, color-coded by indication. -->
			<div class="flex flex-col gap-3 border-b border-(--ink)/15 pb-5">
				<span class="figcaption text-accent-mint">
					{view === 'suggestions' ? 'Cluster Explorer' : 'Saved Personas'}
				</span>
				<Tooltip.Provider delayDuration={200}>
					<div class="flex flex-wrap gap-2">
						{#each gallery as p (p.id)}
							{@const active = p.id === selectedId}
							{@const dot = p.color ?? indicationColor(p.indication)}
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant="secondary"
											class="flex items-center gap-2 rounded-full border py-1 pr-2 pl-2 text-sm transition-colors duration-350
												{active
												? 'border-(--orange) bg-(--orange) text-(--paper)'
												: 'border-(-muted) bg-(-muted) text-foreground hover:bg-(--ink)/5'}"
											aria-pressed={active}
											onclick={() => selectPersona(p.id)}
										>
											{#if p.avatar_url}
												<img
													src={p.avatar_url}
													alt=""
													class="size-6 shrink-0 rounded-full border border-white/60 bg-white object-cover"
												/>
											{:else}
												<span
													class="ml-1 inline-block size-2 shrink-0 rounded-full"
													style:background-color={dot}
												></span>
											{/if}
											<span class="text-sm font-medium leading-tight">{personaTitle(p)}</span>
											<span
												class="ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums
													{active ? 'bg-(--paper)/20 text-(--paper)' : 'bg-(--ink)/10 text-foreground/70'}"
											>
												{p.fragment_count}
											</span>
										</Button>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content sideOffset={6}>
									<div class="flex flex-col gap-0.5">
										<span class="text-[10px] font-medium uppercase tracking-wide opacity-70">
											Source
										</span>
										<span class="font-medium">{p.corpus_label}</span>
										<span class="text-[11px] opacity-70">
											{p.fragment_count} fragments
										</span>
									</div>
								</Tooltip.Content>
							</Tooltip.Root>
						{/each}
					</div>
				</Tooltip.Provider>
			</div>

			{#if selected}
				{#if hasNarrative && selected.narrative}
					<!-- Archetype/bento toggle — only visible when a narrative exists. -->
					<div class="flex items-center justify-end gap-3 -mt-2">
						<span class="text-[10px] uppercase tracking-wider text-muted-foreground">View as</span>
						<div class="inline-flex rounded-md border border-(--ink)/15 bg-(--paper) p-0.5 text-xs">
							<button
								type="button"
								onclick={() => (archetypeView = true)}
								aria-pressed={archetypeView}
								class="rounded px-2.5 py-1 transition-colors {archetypeView
									? 'bg-foreground text-(--paper)'
									: 'text-foreground hover:bg-(--ink)/5'}"
							>
								Archetype
							</button>
							<button
								type="button"
								onclick={() => (archetypeView = false)}
								aria-pressed={!archetypeView}
								class="rounded px-2.5 py-1 transition-colors {!archetypeView
									? 'bg-foreground text-(--paper)'
									: 'text-foreground hover:bg-(--ink)/5'}"
							>
								Cluster stats
							</button>
						</div>
					</div>
				{/if}

				{#if hasNarrative && archetypeView && selected.narrative}
					{@const motif = selected.color ?? indicationColor(selected.indication)}
					{@const n = selected.narrative}
					{@const pillars = [
						{ id: 'medical_self_efficacy', label: 'Medical self-efficacy', color: '#c7935d', items: n.medical_self_efficacy },
						{ id: 'provider_trust', label: 'Provider trust', color: '#5e7bb5', items: n.provider_trust },
						{ id: 'logistical_capacity', label: 'Logistical capacity', color: '#6da378', items: n.logistical_capacity },
						{ id: 'emotional_valence', label: 'Emotional valence', color: '#9b8cc7', items: n.emotional_valence }
					].filter((p) => p.items && p.items.length > 0)}
					{@const factLists = [
						{ id: 'care_team_history', label: 'Care team history', items: n.care_team_history },
						{ id: 'key_health_events', label: 'Key health events', items: n.key_health_events },
						{ id: 'treatment_history', label: 'Treatment history', items: n.treatment_history },
						{ id: 'trial_awareness', label: 'Trial awareness', items: n.trial_awareness }
					].filter((f) => f.items && f.items.length > 0)}
					<!-- Archetype layout — Commonwealth-Fund-style: color band header
					     + tagline, four-pillar concerns grid (or legacy Patient/Person
					     two-column fallback), narrative paragraph beside the hero
					     pull-quote, then optional "At a glance" fact lists. -->
					<article class="overflow-hidden rounded-xl border border-(--ink)/10 bg-white shadow-sm">
						<!-- Color band header -->
						<header
							class="flex flex-col gap-5 px-8 py-7 md:flex-row md:items-center"
							style:background-color={motif}
						>
							{#if selected.avatar_url}
								<img
									src={selected.avatar_url}
									alt=""
									class="size-24 shrink-0 rounded-full border-4 border-white/55 bg-white object-cover shadow-sm"
								/>
							{/if}
							<div class="flex min-w-0 flex-col gap-2">
								<span class="text-[10px] font-medium uppercase tracking-[0.18em] text-white/80">
									{selected.kind === 'saved' ? 'Saved persona' : 'Suggested cluster'}
									· {selected.corpus_label}
									{#if selected.indication}
										· {titleCase(selected.indication)}
									{/if}
								</span>
								<h2 class="font-heading text-3xl font-light uppercase text-white md:text-4xl">
									{personaTitle(selected)}
								</h2>
								<p class="max-w-3xl font-heading text-lg font-light text-white/90">
									{n.tagline}
								</p>
							</div>
						</header>

						{#if pillars.length > 0}
							<!-- Four-pillar concerns grid — matches the journeymap sentiment
							     tracker's vocabulary so the persona card and journeymap can
							     be read against each other. Pillars with no data are hidden. -->
							<section class="grid grid-cols-1 gap-px bg-(--ink)/10 md:grid-cols-2">
								{#each pillars as pillar (pillar.id)}
									<div class="flex flex-col gap-3 bg-(--paper) p-7">
										<div class="flex items-center gap-2">
											<span
												class="inline-block size-2.5 shrink-0 rounded-sm"
												style:background-color={pillar.color}
											></span>
											<h3 class="font-heading text-base font-medium tracking-wide text-foreground">
												{pillar.label}
											</h3>
										</div>
										<ul class="flex flex-col gap-3">
											{#each pillar.items ?? [] as concern, i (i)}
												<li class="flex gap-2 text-sm leading-relaxed text-foreground">
													<span
														class="mt-1.5 inline-block size-1.5 shrink-0 rounded-full"
														style:background-color={pillar.color}
													></span>
													<span>{concern}</span>
												</li>
											{/each}
										</ul>
									</div>
								{/each}
							</section>
						{:else if n.patient_concerns && n.person_concerns}
							<!-- Legacy Patient / Person two-column bullets — rendered for
							     narratives generated before the four-pillar framework
							     landed. Regenerate via propose-persona-narrative.mjs to
							     migrate. -->
							<section class="grid grid-cols-1 gap-px bg-(--ink)/10 md:grid-cols-2">
								<div class="flex flex-col gap-3 bg-(--paper) p-7">
									<h3
										class="font-heading text-base font-medium tracking-wide"
										style:color={motif}
									>
										Patient
									</h3>
									<ul class="flex flex-col gap-3">
										{#each n.patient_concerns as concern, i (i)}
											<li class="flex gap-2 text-sm leading-relaxed text-foreground">
												<span
													class="mt-1.5 inline-block size-1.5 shrink-0 rounded-full"
													style:background-color={motif}
												></span>
												<span>{concern}</span>
											</li>
										{/each}
									</ul>
								</div>
								<div class="flex flex-col gap-3 bg-(--paper) p-7">
									<h3
										class="font-heading text-base font-medium tracking-wide"
										style:color={motif}
									>
										Person
									</h3>
									<ul class="flex flex-col gap-3">
										{#each n.person_concerns as concern, i (i)}
											<li class="flex gap-2 text-sm leading-relaxed text-foreground">
												<span
													class="mt-1.5 inline-block size-1.5 shrink-0 rounded-full"
													style:background-color={motif}
												></span>
												<span>{concern}</span>
											</li>
										{/each}
									</ul>
								</div>
							</section>
						{/if}

						<!-- Narrative paragraph + hero pull-quote -->
						<section class="grid grid-cols-1 gap-8 px-8 py-8 md:grid-cols-5">
							<div class="md:col-span-3">
								<p class="text-[15px] leading-7 text-foreground first-letter:font-heading first-letter:text-3xl first-letter:font-light first-letter:leading-none first-letter:float-left first-letter:mr-1.5 first-letter:mt-1" style:--firstcolor={motif}>
									{n.paragraph}
								</p>
							</div>
							<aside class="md:col-span-2">
								{#if n.hero_quote_text}
									<figure
										class="flex flex-col gap-3 rounded-lg border-l-4 bg-(--ink)/3 px-5 py-5"
										style:border-color={motif}
									>
										<span
											class="font-heading text-5xl font-light leading-none"
											style:color={motif}>“</span
										>
										<blockquote class="text-base leading-relaxed text-foreground">
											{n.hero_quote_text}
										</blockquote>
										{#if n.hero_quote_author}
											{@const heroAuthorAvatar = evidenceAuthorAvatar(n.hero_quote_author)}
											<figcaption class="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
												{#if heroAuthorAvatar}
													<img
														src={heroAuthorAvatar}
														alt=""
														class="size-6 rounded-full bg-white object-cover"
													/>
												{/if}
												<span>— {n.hero_quote_author}</span>
											</figcaption>
										{/if}
									</figure>
								{:else}
									<p class="text-xs text-muted-foreground">
										Hero quote fragment <code class="font-mono">{n.hero_quote_fragment_id}</code>
										not found in corpus.
									</p>
								{/if}
							</aside>
						</section>

						{#if factLists.length > 0}
							<!-- "At a glance" — concrete extractions from the evidence
							     (specialists, milestones, drugs tried, trials tracked).
							     Each list is hidden when the persona has no signal for
							     it, so the section grows organically with the evidence. -->
							<section class="border-t border-(--ink)/10 bg-(--ink)/3 px-8 py-7">
								<div class="mb-4 flex items-center gap-2">
									<span class="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
										At a glance
									</span>
									<span class="h-px flex-1 bg-(--ink)/10"></span>
								</div>
								<div class="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-4">
									{#each factLists as list (list.id)}
										<div class="flex flex-col gap-2.5">
											<h4
												class="font-heading text-xs font-medium uppercase tracking-wider"
												style:color={motif}
											>
												{list.label}
											</h4>
											<ul class="flex flex-col gap-1.5">
												{#each list.items ?? [] as item, i (i)}
													<li class="flex gap-2 text-[13px] leading-snug text-foreground">
														<span
															class="mt-1.5 inline-block size-1 shrink-0 rounded-full"
															style:background-color={motif}
														></span>
														<span>{item}</span>
													</li>
												{/each}
											</ul>
										</div>
									{/each}
								</div>
							</section>
						{/if}

						<footer class="flex flex-wrap items-center justify-between gap-2 border-t border-(--ink)/10 px-8 py-4 text-[11px] text-muted-foreground">
							<span>
								{filterProse(selected)}
							</span>
							<span>
								{selected.fragment_count} fragments · {selected.author_count} authors
								{#if n.generated_at}
									· generated {new Date(n.generated_at).toLocaleDateString()}
								{/if}
							</span>
						</footer>
					</article>
				{:else}
				<!-- HERO — title, prose, big numerics. -->
				<BentoCard
					id="identity"
					eyebrow="Persona signature"
					active={expandedCard === 'identity'}
					anyExpanded={expandedCard !== null}
					onactivate={() => expand('identity')}
					ondismiss={dismissExpanded}
					onhoverreplay={bumpReplay}
					tileClass="p-6"
				>
					{#snippet compact()}
						<div class="flex flex-col gap-4">
							<div class="flex items-center gap-2">
								<span
									class="inline-block size-2 rounded-full"
									style:background-color={selected.color ?? indicationColor(selected.indication)}
								></span>
								<span class="text-[10px] uppercase tracking-wider text-muted-foreground">
									{selected.kind === 'saved' ? 'Saved persona' : 'Suggested cluster'}
									· {selected.corpus_label}
									{#if selected.indication}
										· {titleCase(selected.indication)}
									{/if}
								</span>
							</div>
							<h3 class="font-heading text-3xl font-light uppercase text-primary md:text-4xl">
								{personaTitle(selected)}
							</h3>
							{#if selected.description}
								<p class="max-w-3xl text-sm leading-6 text-foreground">
									{selected.description}
								</p>
							{/if}
							<p class="max-w-3xl text-sm leading-6 text-muted-foreground">
								{filterProse(selected)}
							</p>
							<div class="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-md bg-(--ink)/15 md:grid-cols-4">
								<div class="flex flex-col gap-0.5 bg-(--paper) p-3">
									<span class="text-[10px] uppercase tracking-wide text-muted-foreground">Fragments</span>
									<span class="font-heading text-2xl font-light tabular-nums text-foreground">
										{fragmentCountTween.value}
									</span>
								</div>
								<div class="flex flex-col gap-0.5 bg-(--paper) p-3">
									<span class="text-[10px] uppercase tracking-wide text-muted-foreground">
										{selected.kind === 'saved' ? 'Distinct authors' : 'Cluster authors'}
									</span>
									<span class="font-heading text-2xl font-light tabular-nums text-foreground">
										{authorCountTween.value}
									</span>
								</div>
								<div class="flex flex-col gap-0.5 bg-(--paper) p-3">
									<span class="text-[10px] uppercase tracking-wide text-muted-foreground">Annotated</span>
									<span class="font-heading text-2xl font-light tabular-nums text-foreground">
										{annotatedCountTween.value}
									</span>
								</div>
								<div class="flex flex-col gap-0.5 bg-(--paper) p-3">
									{#if selected.kind === 'suggestion' && selected.cohesion != null && selected.distinctness != null}
										<span class="text-[10px] uppercase tracking-wide text-muted-foreground">Cohesion · distinctness</span>
										<span class="font-heading text-2xl font-light tabular-nums text-foreground">
											{selected.cohesion.toFixed(2)} · {selected.distinctness.toFixed(2)}
										</span>
									{:else if selected.sentiment}
										<span class="text-[10px] uppercase tracking-wide text-muted-foreground">Mean sentiment</span>
										<span class="font-heading text-2xl font-light tabular-nums text-foreground">
											{selected.sentiment.mean.toFixed(2)}
										</span>
									{:else}
										<span class="text-[10px] uppercase tracking-wide text-muted-foreground">Persona id</span>
										<span class="truncate font-mono text-xs text-foreground">{selected.id}</span>
									{/if}
								</div>
							</div>
							{#if selected.kind === 'suggestion' && selected.overlaps_existing && selected.overlaps_existing.length > 0}
								<div class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
									Overlaps existing persona
									<code class="font-mono">{selected.overlaps_existing[0].persona_id}</code>
									· Jaccard {selected.overlaps_existing[0].jaccard.toFixed(2)}.
								</div>
							{/if}
						</div>
					{/snippet}
					{#snippet expanded()}
						<div class="mx-auto flex max-w-4xl flex-col gap-6 px-2">
							<div class="flex items-center gap-2">
								<span
									class="inline-block size-2.5 rounded-full"
									style:background-color={selected.color ?? indicationColor(selected.indication)}
								></span>
								<span class="text-xs uppercase tracking-wider text-muted-foreground">
									{selected.kind === 'saved' ? 'Saved persona' : 'Suggested cluster'}
									· {selected.corpus_label}
									{#if selected.indication}
										· {titleCase(selected.indication)}
									{/if}
								</span>
							</div>
							<h3 class="font-heading text-4xl font-light uppercase text-primary md:text-5xl">
								{personaTitle(selected)}
							</h3>
							{#if selected.description}
								<p class="text-base leading-7 text-foreground">{selected.description}</p>
							{/if}
							<p class="text-base leading-7 text-muted-foreground">{filterProse(selected)}</p>
							<dl class="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-(--ink)/15 md:grid-cols-4">
								<div class="flex flex-col gap-1 bg-(--paper) p-4">
									<dt class="text-xs uppercase tracking-wide text-muted-foreground">Fragments</dt>
									<dd class="font-heading text-2xl font-light tabular-nums text-foreground">{selected.fragment_count}</dd>
								</div>
								<div class="flex flex-col gap-1 bg-(--paper) p-4">
									<dt class="text-xs uppercase tracking-wide text-muted-foreground">
										{selected.kind === 'saved' ? 'Distinct authors' : 'Cluster authors'}
									</dt>
									<dd class="font-heading text-2xl font-light tabular-nums text-foreground">{selected.author_count}</dd>
								</div>
								<div class="flex flex-col gap-1 bg-(--paper) p-4">
									<dt class="text-xs uppercase tracking-wide text-muted-foreground">Annotated</dt>
									<dd class="font-heading text-2xl font-light tabular-nums text-foreground">{selected.annotated_count}</dd>
								</div>
								<div class="flex flex-col gap-1 bg-(--paper) p-4">
									{#if selected.kind === 'suggestion' && selected.cohesion != null}
										<dt class="text-xs uppercase tracking-wide text-muted-foreground">Cohesion</dt>
										<dd class="font-heading text-2xl font-light tabular-nums text-foreground">{selected.cohesion.toFixed(2)}</dd>
									{:else if selected.sentiment}
										<dt class="text-xs uppercase tracking-wide text-muted-foreground">Sentiment</dt>
										<dd class="font-heading text-2xl font-light tabular-nums text-foreground">{selected.sentiment.mean.toFixed(2)}</dd>
									{:else}
										<dt class="text-xs uppercase tracking-wide text-muted-foreground">Kind</dt>
										<dd class="font-heading text-base font-light text-foreground">{selected.kind}</dd>
									{/if}
								</div>
							</dl>
							<p class="text-xs text-muted-foreground">
								{#if selected.kind === 'suggestion' && selected.exemplar_author}
									Exemplar author: <code class="font-mono">{selected.exemplar_author}</code> · Cluster id:
									<code class="font-mono">{selected.id}</code>
								{:else}
									Persona id: <code class="font-mono">{selected.id}</code>
								{/if}
							</p>
						</div>
					{/snippet}
				</BentoCard>

				<!-- Bento grid: 12-col on lg+. -->
				<div class="grid grid-cols-1 gap-5 md:grid-cols-6 lg:grid-cols-12 lg:auto-rows-[minmax(280px,auto)]">
					<!-- THEMES & SUBTHEMES (tall, left) -->
					<BentoCard
						id="themes"
						eyebrow="Themes & subthemes"
						title="What this cluster talks about"
						index={0}
						onhoverreplay={bumpReplay}
						class="md:col-span-6 lg:col-span-8 lg:row-span-2"
						tileClass="p-6"
						active={expandedCard === 'themes'}
						anyExpanded={expandedCard !== null}
						onactivate={() => expand('themes')}
						ondismiss={dismissExpanded}
					>
						{#snippet compact()}
							<div class="flex flex-col gap-4">
								<div>
									<span class="text-[10px] uppercase tracking-wider text-muted-foreground">Top themes</span>
									<ul class="mt-2 flex flex-col gap-1.5">
										{#each selectedThemes as t (t.id)}
											{@const color = themePalette[t.id] ?? '#94a3b8'}
											{@const width = Math.max(6, Math.round((t.share / maxThemeShare) * 100))}
											<li class="flex items-center gap-3">
												<span class="w-32 truncate text-xs font-medium text-foreground">
													{titleCase(t.id)}
												</span>
												<span class="relative h-2 flex-1 overflow-hidden rounded-full bg-(--ink)/8">
													<span
														class="absolute inset-y-0 left-0 rounded-full"
														style="width: {width}%; background-color: {color};"
													></span>
												</span>
												<span class="w-10 text-right text-xs tabular-nums text-muted-foreground">
													{(t.share * 100).toFixed(0)}%
												</span>
											</li>
										{/each}
									</ul>
								</div>
								<div class="border-t border-(--ink)/10 pt-3">
									<span class="text-[10px] uppercase tracking-wider text-muted-foreground">Top subthemes</span>
									<ul class="mt-2 flex flex-col gap-1.5">
										{#each selectedSubthemes.slice(0, 5) as s (s.id)}
											{@const width = Math.max(6, Math.round((s.share / maxSubthemeShare) * 100))}
											<li class="flex items-center gap-3">
												<TagIcon class="size-3.5 shrink-0 text-muted-foreground" />
												<span class="w-44 truncate text-xs text-foreground">
													{titleCase(s.id)}
												</span>
												<span class="relative h-1.5 flex-1 overflow-hidden rounded-full bg-(--ink)/8">
													<span
														class="absolute inset-y-0 left-0 rounded-full bg-indigo-500"
														style="width: {width}%"
													></span>
												</span>
												<span class="w-10 text-right text-xs tabular-nums text-muted-foreground">
													{(s.share * 100).toFixed(0)}%
												</span>
											</li>
										{/each}
									</ul>
								</div>
							</div>
						{/snippet}
						{#snippet expanded()}
							<div class="mx-auto flex max-w-3xl flex-col gap-6">
								<div>
									<h3 class="font-heading text-lg font-medium text-foreground">Themes (3)</h3>
									<ul class="mt-3 flex flex-col gap-2">
										{#each selectedThemes as t (t.id)}
											{@const color = themePalette[t.id] ?? '#94a3b8'}
											{@const width = Math.max(6, Math.round((t.share / maxThemeShare) * 100))}
											<li class="flex items-center gap-3">
												<Layers class="size-4 shrink-0" style="color: {color};" />
												<span class="w-44 truncate text-sm font-medium text-foreground">
													{titleCase(t.id)}
												</span>
												<span class="relative h-2.5 flex-1 overflow-hidden rounded-full bg-(--ink)/8">
													<span
														class="absolute inset-y-0 left-0 rounded-full"
														style="width: {width}%; background-color: {color};"
													></span>
												</span>
												<span class="w-12 text-right text-sm tabular-nums text-muted-foreground">
													{(t.share * 100).toFixed(0)}%
												</span>
											</li>
										{/each}
									</ul>
								</div>
								<div>
									<h3 class="font-heading text-lg font-medium text-foreground">Subthemes</h3>
									<ul class="mt-3 flex flex-col gap-2">
										{#each selectedSubthemes as s (s.id)}
											{@const width = Math.max(6, Math.round((s.share / maxSubthemeShare) * 100))}
											<li class="flex items-center gap-3">
												<TagIcon class="size-4 shrink-0 text-muted-foreground" />
												<span class="w-56 truncate text-sm text-foreground">{titleCase(s.id)}</span>
												<span class="relative h-2 flex-1 overflow-hidden rounded-full bg-(--ink)/8">
													<span
														class="absolute inset-y-0 left-0 rounded-full bg-indigo-500"
														style="width: {width}%"
													></span>
												</span>
												<span class="w-12 text-right text-sm tabular-nums text-muted-foreground">
													{(s.share * 100).toFixed(0)}%
												</span>
											</li>
										{/each}
									</ul>
								</div>
								<p class="text-xs text-muted-foreground">
									Shares are mean per-author fragment-share, so they can exceed 1.0 when one author's
									fragments span multiple subthemes — that's the suggester's "talks about everything"
									signal.
								</p>
							</div>
						{/snippet}
					</BentoCard>

					<!-- FILTER (top right) -->
					<BentoCard
						id="filter"
						eyebrow="Proposed filter"
						index={1}
						onhoverreplay={bumpReplay}
						class="md:col-span-3 lg:col-span-4"
						tileClass="p-6"
						active={expandedCard === 'filter'}
						anyExpanded={expandedCard !== null}
						onactivate={() => expand('filter')}
						ondismiss={dismissExpanded}
					>
						{#snippet compact()}
							<div class="flex flex-col gap-3">
								<div class="flex items-center gap-2">
									<FilterIcon class="size-4 text-muted-foreground" />
									<span class="text-[10px] uppercase tracking-wider text-muted-foreground">
										{filterChips.length} {filterChips.length === 1 ? 'clause' : 'clauses'}
									</span>
								</div>
								{#if filterChips.length}
									<div class="flex flex-wrap gap-1.5">
										{#each filterChips.slice(0, 8) as c (c.kind + c.value)}
											<span
												class="rounded-full border px-2 py-0.5 text-[11px]"
												style="border-color: {c.color}40; background-color: {c.color}10; color: {c.color};"
												title={c.kind}
											>
												{c.value}
											</span>
										{/each}
										{#if filterChips.length > 8}
											<span class="text-[11px] text-muted-foreground">
												+{filterChips.length - 8} more
											</span>
										{/if}
									</div>
								{:else}
									<p class="text-xs text-muted-foreground">Empty filter — cluster too heterogeneous.</p>
								{/if}
							</div>
						{/snippet}
						{#snippet expanded()}
							<div class="mx-auto flex max-w-2xl flex-col gap-4">
								<h3 class="font-heading text-lg font-medium text-foreground">PersonaFilter</h3>
								<p class="text-sm leading-6 text-foreground">{filterProse(selected)}</p>
								{#if filterChips.length}
									<ul class="flex flex-col gap-2">
										{#each filterChips as c (c.kind + c.value)}
											<li class="flex items-center gap-3">
												<span class="w-20 text-[10px] uppercase tracking-wide text-muted-foreground">
													{c.kind}
												</span>
												<span
													class="rounded-full border px-3 py-1 text-xs"
													style="border-color: {c.color}60; background-color: {c.color}15; color: {c.color};"
												>
													{c.value}
												</span>
											</li>
										{/each}
									</ul>
								{/if}
								<p class="text-xs text-muted-foreground">
									All clauses combine with AND semantics. Subthemes and stages within a kind combine
									with OR.
								</p>
							</div>
						{/snippet}
					</BentoCard>

					<!-- JOURNEY (under filter) -->
					<BentoCard
						id="journey"
						eyebrow="Journey footprint"
						index={2}
						onhoverreplay={bumpReplay}
						class="md:col-span-3 lg:col-span-4"
						tileClass="p-6"
						active={expandedCard === 'journey'}
						anyExpanded={expandedCard !== null}
						onactivate={() => expand('journey')}
						ondismiss={dismissExpanded}
					>
						{#snippet compact()}
							<div class="flex flex-col gap-3">
								<div class="flex items-center gap-2">
									<Route class="size-4 text-muted-foreground" />
									<span class="text-[10px] uppercase tracking-wider text-muted-foreground">
										Stages & steps
									</span>
								</div>
								{#if selectedStages.length || selectedSteps.length}
									<div class="flex flex-col gap-1">
										{#each selectedStages.slice(0, 3) as st (st.id)}
											{@const width = Math.max(6, Math.round((st.share / maxStageShare) * 100))}
											<div class="flex items-center gap-2">
												<span class="w-32 truncate text-[11px] text-foreground">
													{titleCase(st.id)}
												</span>
												<span class="relative h-1.5 flex-1 overflow-hidden rounded-full bg-(--ink)/8">
													<span
														class="absolute inset-y-0 left-0 rounded-full bg-sky-500"
														style="width: {width}%"
													></span>
												</span>
											</div>
										{/each}
									</div>
									<div class="border-t border-(--ink)/10 pt-2">
										<div class="flex flex-col gap-1">
											{#each selectedSteps.slice(0, 3) as sp (sp.id)}
												{@const width = Math.max(6, Math.round((sp.share / maxStepShare) * 100))}
												<div class="flex items-center gap-2">
													<span class="w-32 truncate text-[11px] text-muted-foreground">
														{titleCase(sp.id)}
													</span>
													<span class="relative h-1.5 flex-1 overflow-hidden rounded-full bg-(--ink)/8">
														<span
															class="absolute inset-y-0 left-0 rounded-full bg-cyan-500"
															style="width: {width}%"
														></span>
													</span>
												</div>
											{/each}
										</div>
									</div>
								{:else}
									<p class="text-xs text-muted-foreground">No stage tags on this cluster.</p>
								{/if}
							</div>
						{/snippet}
						{#snippet expanded()}
							<div class="mx-auto flex max-w-2xl flex-col gap-6">
								<div>
									<h3 class="font-heading text-lg font-medium text-foreground">Stages</h3>
									<ul class="mt-3 flex flex-col gap-2">
										{#each selectedStages as st (st.id)}
											{@const width = Math.max(6, Math.round((st.share / maxStageShare) * 100))}
											<li class="flex items-center gap-3">
												<span class="w-44 truncate text-sm text-foreground">{titleCase(st.id)}</span>
												<span class="relative h-2 flex-1 overflow-hidden rounded-full bg-(--ink)/8">
													<span
														class="absolute inset-y-0 left-0 rounded-full bg-sky-500"
														style="width: {width}%"
													></span>
												</span>
												<span class="w-12 text-right text-sm tabular-nums text-muted-foreground">
													{(st.share * 100).toFixed(0)}%
												</span>
											</li>
										{/each}
									</ul>
								</div>
								<div>
									<h3 class="font-heading text-lg font-medium text-foreground">Steps</h3>
									<ul class="mt-3 flex flex-col gap-2">
										{#each selectedSteps as sp (sp.id)}
											{@const width = Math.max(6, Math.round((sp.share / maxStepShare) * 100))}
											<li class="flex items-center gap-3">
												<span class="w-44 truncate text-sm text-foreground">{titleCase(sp.id)}</span>
												<span class="relative h-2 flex-1 overflow-hidden rounded-full bg-(--ink)/8">
													<span
														class="absolute inset-y-0 left-0 rounded-full bg-cyan-500"
														style="width: {width}%"
													></span>
												</span>
												<span class="w-12 text-right text-sm tabular-nums text-muted-foreground">
													{(sp.share * 100).toFixed(0)}%
												</span>
											</li>
										{/each}
									</ul>
								</div>
							</div>
						{/snippet}
					</BentoCard>

					<!-- EMOTIONAL (bottom left) -->
					<BentoCard
						id="emotional"
						eyebrow="Emotional signature"
						index={3}
						onhoverreplay={bumpReplay}
						class="md:col-span-3 lg:col-span-6"
						tileClass="p-6"
						active={expandedCard === 'emotional'}
						anyExpanded={expandedCard !== null}
						onactivate={() => expand('emotional')}
						ondismiss={dismissExpanded}
					>
						{#snippet compact()}
							<div class="flex flex-col gap-4">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<Sparkles class="size-4 text-muted-foreground" />
										<span class="text-[10px] uppercase tracking-wider text-muted-foreground">
											Sentiment
										</span>
									</div>
									{#if selected.sentiment}
										<span class="font-heading text-base font-light tabular-nums text-foreground">
											{selected.sentiment.mean.toFixed(2)}
											{#if selected.sentiment.std != null}
												<span class="text-xs text-muted-foreground">
													± {selected.sentiment.std.toFixed(2)}
												</span>
											{/if}
										</span>
									{/if}
								</div>
								<div class="flex flex-col gap-1">
									<div class="relative h-2 w-full overflow-hidden rounded-full bg-(--ink)/8">
										<span
											class="absolute inset-y-0 w-1 -translate-x-1/2 rounded-full bg-foreground"
											style="left: {sentimentPct}%"
										></span>
										<span
											class="absolute inset-0 rounded-full"
											style="background: linear-gradient(to right, #e11d48 0%, #94a3b8 50%, #059669 100%); opacity: 0.25;"
										></span>
									</div>
									<div class="flex justify-between text-[10px] text-muted-foreground">
										<span>negative</span>
										<span>{sentimentLabel}</span>
										<span>positive</span>
									</div>
								</div>
								{#if selectedEmotions.length}
									<div class="border-t border-(--ink)/10 pt-3">
										<span class="text-[10px] uppercase tracking-wider text-muted-foreground">
											Top emotions
										</span>
										<ul class="mt-2 flex flex-col gap-1.5">
											{#each selectedEmotions.slice(0, 4) as e (e.id)}
												{@const width = Math.max(6, Math.round((e.share / maxEmotionShare) * 100))}
												<li class="flex items-center gap-3">
													<span class="w-24 truncate text-xs text-foreground">{titleCase(e.id)}</span>
													<span class="relative h-1.5 flex-1 overflow-hidden rounded-full bg-(--ink)/8">
														<span
															class="absolute inset-y-0 left-0 rounded-full bg-amber-500"
															style="width: {width}%"
														></span>
													</span>
													<span class="w-10 text-right text-xs tabular-nums text-muted-foreground">
														{(e.share * 100).toFixed(0)}%
													</span>
												</li>
											{/each}
										</ul>
									</div>
								{/if}
							</div>
						{/snippet}
						{#snippet expanded()}
							<div class="mx-auto flex max-w-2xl flex-col gap-6">
								<h3 class="font-heading text-lg font-medium text-foreground">Sentiment</h3>
								{#if selected.sentiment}
									<div class="flex items-baseline gap-4">
										<span class="font-heading text-4xl font-light tabular-nums text-foreground">
											{selected.sentiment.mean.toFixed(2)}
										</span>
										{#if selected.sentiment.std != null}
											<span class="text-sm text-muted-foreground">
												± {selected.sentiment.std.toFixed(2)} std
											</span>
										{/if}
										<span class="ml-auto text-sm text-muted-foreground">{sentimentLabel}</span>
									</div>
									<div class="relative h-3 w-full overflow-hidden rounded-full bg-(--ink)/8">
										<span
											class="absolute inset-0 rounded-full"
											style="background: linear-gradient(to right, #e11d48 0%, #94a3b8 50%, #059669 100%); opacity: 0.25;"
										></span>
										<span
											class="absolute inset-y-0 w-1 -translate-x-1/2 rounded-full bg-foreground"
											style="left: {sentimentPct}%"
										></span>
									</div>
								{/if}
								<div>
									<h3 class="font-heading text-lg font-medium text-foreground">Emotions</h3>
									<ul class="mt-3 flex flex-col gap-2">
										{#each selectedEmotions as e (e.id)}
											{@const width = Math.max(6, Math.round((e.share / maxEmotionShare) * 100))}
											<li class="flex items-center gap-3">
												<span class="w-44 truncate text-sm text-foreground">{titleCase(e.id)}</span>
												<span class="relative h-2 flex-1 overflow-hidden rounded-full bg-(--ink)/8">
													<span
														class="absolute inset-y-0 left-0 rounded-full bg-amber-500"
														style="width: {width}%"
													></span>
												</span>
												<span class="w-12 text-right text-sm tabular-nums text-muted-foreground">
													{(e.share * 100).toFixed(0)}%
												</span>
											</li>
										{/each}
									</ul>
								</div>
							</div>
						{/snippet}
					</BentoCard>

					<!-- EVIDENCE (bottom right) -->
					<BentoCard
						id="evidence"
						eyebrow="Evidence"
						index={4}
						onhoverreplay={bumpReplay}
						class="md:col-span-3 lg:col-span-6"
						tileClass="p-6"
						active={expandedCard === 'evidence'}
						anyExpanded={expandedCard !== null}
						onactivate={() => expand('evidence')}
						ondismiss={dismissExpanded}
					>
						{#snippet compact()}
							<div class="flex flex-col gap-3">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<Users class="size-4 text-muted-foreground" />
										<span class="text-[10px] uppercase tracking-wider text-muted-foreground">
											{selected.evidence.length} exemplar
											{selected.evidence.length === 1 ? 'fragment' : 'fragments'}
										</span>
									</div>
								</div>
								{#if selected.evidence.length}
									<ul class="flex flex-col gap-2">
										{#each selected.evidence.slice(0, 2) as ev (ev.id)}
											<li class="rounded-md border border-(--ink)/10 bg-(--ink)/3 p-3">
												<div class="flex items-center justify-between gap-2">
													<QuoteIcon class="size-3.5 text-muted-foreground" />
													{#if ev.author_avatar_url}
														<img
															src={ev.author_avatar_url}
															alt=""
															class="size-6 rounded-full bg-white object-cover"
														/>
													{/if}
												</div>
												<blockquote class="mt-1 line-clamp-3 text-xs leading-relaxed text-foreground">
													{ev.text}
												</blockquote>
												{#if ev.author_handle_hash}
													<div class="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
														{ev.author_handle_hash}
													</div>
												{/if}
											</li>
										{/each}
									</ul>
									{#if selected.evidence.length > 2}
										<span class="text-[11px] text-muted-foreground">
											+{selected.evidence.length - 2} more · click to expand
										</span>
									{/if}
								{:else}
									<p class="text-xs text-muted-foreground">No annotated fragments — cluster lacks evidence text.</p>
								{/if}
							</div>
						{/snippet}
						{#snippet expanded()}
							<div class="mx-auto flex max-w-3xl flex-col gap-4">
								<h3 class="font-heading text-lg font-medium text-foreground">
									Exemplar fragments
								</h3>
								<p class="text-sm text-muted-foreground">
									Highest-density fragments closest to the cluster centroid, capped at one per author.
								</p>
								{#each selected.evidence as ev (ev.id)}
									<figure class="rounded-md border border-(--ink)/10 bg-(--ink)/3 p-4">
										<div class="flex items-center justify-between gap-3">
											<QuoteIcon class="size-4 text-muted-foreground" />
											{#if ev.author_avatar_url}
												<img
													src={ev.author_avatar_url}
													alt=""
													class="size-8 rounded-full bg-white object-cover"
												/>
											{/if}
										</div>
										<blockquote class="mt-2 text-sm leading-relaxed text-foreground">
											{ev.text}
										</blockquote>
										<figcaption class="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
											<span>
												{ev.author_handle_hash ?? 'no author'}
											</span>
											<code class="font-mono normal-case tracking-normal">{ev.id}</code>
										</figcaption>
									</figure>
								{:else}
									<p class="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-muted-foreground">
										No exemplar fragments yet.
									</p>
								{/each}
							</div>
						{/snippet}
					</BentoCard>
				</div>
				{/if}
			{/if}
		{/if}
	</div>
</div>

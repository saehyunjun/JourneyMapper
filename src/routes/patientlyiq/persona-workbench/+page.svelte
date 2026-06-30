<!--
	Persona Workbench — pick authors, derive a filter, save as a persona.

	Two entry points to picking authors:
	  - Suggestions dropdown: choose a deterministic cluster the suggester
	    produced (scripts/propose-persona-suggestions.mjs → artifacts/
	    persona_suggestions.json). Picking a suggestion pre-fills the
	    author multi-select with that cluster's seeds + attached singletons.
	  - Manual: tick authors directly in the list below.

	Either way: Derive → preview the filter → fill in id/label/description →
	Save writes src/lib/content/personas/<id>.json for other views to consume.

	Deferred for a follow-up:
	  - Inline filter editing (toggle subthemes/stages before save)
	  - Active-indication scoping like journey-workbench has
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { toasts } from '$lib/stores/toasts.svelte';
	import type { PageProps } from './$types';
	import type { DeriveResponse } from '../../api/personas/derive/+server';
	import type { MatchFilterResponse } from '../../api/personas/match-filter/+server';
	import type { PersonaFilter } from '$lib/content/personas/types';

	let { data }: PageProps = $props();

	// === Mode ================================================================
	// Three tabs:
	//   - 'filter' (default): build the filter directly with attitudinal
	//     pickers, no derivation step
	//   - 'authors': pick a suggestion or hand-pick authors, derive the filter
	//   - 'personas': list of saved personas scoped to the current corpus's
	//     indication — each row links into the personas page and can spawn a
	//     narrative-chart generation job
	// Save form is shared; the persona it writes uses whichever filter is current.
	let mode = $state<'authors' | 'filter' | 'personas'>('filter');

	// === Corpus selection ====================================================
	// Only corpora with author_handle_hash–style provenance work for manual
	// merge — interview corpora use interview_id, not author handles, so the
	// deriver has nothing to group on.
	const mergeableCorpora = $derived(
		data.corpora_summary.filter((c) => c.authored_fragments > 0)
	);

	let corpusId = $state<string>(
		untrack(() => data.corpora_summary.find((c) => c.authored_fragments > 0)?.id ?? '')
	);
	const corpus = $derived(mergeableCorpora.find((c) => c.id === corpusId) ?? null);
	const authors = $derived(corpusId ? (data.corpora_authors[corpusId] ?? []) : []);

	// === Suggestion picker ===================================================
	// corpora_suggestions[corpusId] is null when the corpus hasn't run
	// scripts/propose-persona-suggestions.mjs yet.
	const suggestionsBundle = $derived(
		corpusId ? data.corpora_suggestions[corpusId] : null
	);
	const suggestions = $derived(suggestionsBundle?.suggestions ?? []);
	let pickedSuggestionId = $state<string>('');
	const pickedSuggestion = $derived(
		suggestions.find((s) => s.id === pickedSuggestionId) ?? null
	);

	// === Author selection ====================================================

	let selectedAuthors = $state<Set<string>>(new Set());
	let authorFilter = $state('');

	// === Filter builder ======================================================
	// All four chip groups + the sentiment band combine with AND inside the
	// PersonaFilter we build. Within a group the underlying matcher is OR
	// (matchesFilter checks `some()` against has_subtheme/etc.).

	const availability = $derived(corpusId ? data.corpora_availability[corpusId] : null);

	// Sentiment is now a 5-chip multi-select over the codebook's integer scale
	// (-2..2). The filter is `{ min: min(selected), max: max(selected) }` —
	// when the picks are non-contiguous (e.g. {-2, 0}) the resulting band
	// still spans the gap; we surface that in the dropdown caption.
	let selectedSentiments = $state<Set<number>>(new Set());

	let selectedEmotions = $state<Set<string>>(new Set());
	let selectedSubthemes = $state<Set<string>>(new Set());
	let selectedStages = $state<Set<string>>(new Set());
	let selectedSteps = $state<Set<string>>(new Set());

	// Which header dropdown is open (only one at a time). null = closed.
	let openDropdown = $state<'sentiment' | 'stage' | 'subtheme' | null>(null);

	function toggleIn(set: Set<string>, v: string): Set<string> {
		const next = new Set(set);
		if (next.has(v)) next.delete(v);
		else next.add(v);
		return next;
	}
	function toggleNum(set: Set<number>, v: number): Set<number> {
		const next = new Set(set);
		if (next.has(v)) next.delete(v);
		else next.add(v);
		return next;
	}

	const sentimentRange = $derived.by(() => {
		if (selectedSentiments.size === 0) return null;
		const arr = [...selectedSentiments];
		return { min: Math.min(...arr), max: Math.max(...arr) };
	});

	const customFilter = $derived<PersonaFilter>({
		indications: corpus?.indications ?? [],
		annotations: {
			...(selectedSubthemes.size > 0
				? { has_subtheme: [...selectedSubthemes] }
				: {}),
			...(selectedEmotions.size > 0 ? { has_emotion: [...selectedEmotions] } : {}),
			...(selectedStages.size > 0 ? { has_stage: [...selectedStages] } : {}),
			...(selectedSteps.size > 0 ? { has_step: [...selectedSteps] } : {}),
			...(sentimentRange && (sentimentRange.min > -2 || sentimentRange.max < 2)
				? { sentiment: sentimentRange }
				: {})
		}
	});

	// Any clause set at all? Empty filter (just indications) would match the
	// entire corpus — usually not what the analyst wants.
	const filterIsEmpty = $derived(
		selectedSubthemes.size === 0 &&
			selectedEmotions.size === 0 &&
			selectedStages.size === 0 &&
			selectedSteps.size === 0 &&
			selectedSentiments.size === 0
	);

	let filterMatchResult = $state<MatchFilterResponse | null>(null);
	let filterMatching = $state(false);
	let filterError = $state<string | null>(null);

	// Debounced live preview. Re-fires whenever any clause changes or the
	// analyst picks a different corpus. 300ms feels snappy for chip clicks.
	// matchDebounce is intentionally a plain let, not $state — reading and
	// writing a $state inside the same effect causes Svelte to re-run the
	// effect on every write, which here would loop forever and silently bail
	// out, leaving the preview blank and later chip clicks inert.
	let matchDebounce: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		// Take a snapshot of dependencies so the effect re-runs.
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		[corpusId, customFilter, mode, filterIsEmpty];
		if (matchDebounce) clearTimeout(matchDebounce);
		if (mode !== 'filter' || !corpusId || filterIsEmpty) {
			filterMatchResult = null;
			filterError = null;
			return;
		}
		matchDebounce = setTimeout(() => {
			runFilterMatch();
		}, 300);
	});

	async function runFilterMatch() {
		if (!corpusId) return;
		filterMatching = true;
		filterError = null;
		try {
			const res = await fetch('/api/personas/match-filter', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					corpus_id: corpusId,
					filter: customFilter,
					sample_limit: 6
				})
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
			filterMatchResult = body as MatchFilterResponse;
		} catch (e) {
			filterError = e instanceof Error ? e.message : String(e);
			filterMatchResult = null;
		} finally {
			filterMatching = false;
		}
	}

	function clearFilter() {
		selectedSentiments = new Set();
		selectedEmotions = new Set();
		selectedSubthemes = new Set();
		selectedStages = new Set();
		selectedSteps = new Set();
		openDropdown = null;
	}

	// Reset selection + filter when corpus changes.
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		corpusId;
		selectedAuthors = new Set();
		authorFilter = '';
		pickedSuggestionId = '';
		deriveResult = null;
		deriveError = null;
		untrack(clearFilter);
		filterMatchResult = null;
		filterError = null;
		personaName = '';
		personaDescription = '';
		personaColor = '';
		lastAutoName = '';
		lastAutoDescription = '';
		saveResult = null;
		saveError = null;
	});

	// Switching modes clears the "ready to save" payload from the other path so
	// you can't accidentally save a filter built under the wrong path.
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		mode;
		untrack(() => {
			deriveResult = null;
			deriveError = null;
			filterMatchResult = null;
			filterError = null;
			saveResult = null;
			saveError = null;
		});
	});

	function applySuggestion(id: string) {
		pickedSuggestionId = id;
		const s = suggestions.find((x) => x.id === id);
		if (!s) {
			selectedAuthors = new Set();
			return;
		}
		// Pre-fill with the full cluster (seeds + attached singletons). The
		// suggestion's proposed_filter was derived from this exact set, so the
		// Derive button will reproduce it without surprises.
		selectedAuthors = new Set([...s.seed_authors, ...s.attached_singletons]);
		// Drop any stale derive/save state so the analyst starts clean.
		deriveResult = null;
		deriveError = null;
		saveResult = null;
		saveError = null;
	}

	function toggleAuthor(h: string) {
		const next = new Set(selectedAuthors);
		if (next.has(h)) next.delete(h);
		else next.add(h);
		selectedAuthors = next;
	}
	function clearSelection() {
		selectedAuthors = new Set();
	}

	const filteredAuthors = $derived(
		authorFilter.trim().length === 0
			? authors
			: authors.filter((a) => {
					const q = authorFilter.toLowerCase();
					return (
						a.author_handle_hash.toLowerCase().includes(q) ||
						a.sample_text.toLowerCase().includes(q)
					);
				})
	);

	// === Derive call =========================================================

	let deriving = $state(false);
	let deriveResult = $state<DeriveResponse | null>(null);
	let deriveError = $state<string | null>(null);

	async function runDerive() {
		if (selectedAuthors.size === 0 || !corpusId) return;
		deriving = true;
		deriveError = null;
		try {
			const res = await fetch('/api/personas/derive', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					corpus_id: corpusId,
					authors: [...selectedAuthors]
				})
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
			deriveResult = body as DeriveResponse;
		} catch (e) {
			deriveError = e instanceof Error ? e.message : String(e);
			deriveResult = null;
		} finally {
			deriving = false;
		}
	}

	// === Save form ===========================================================
	// The analyst types one human name ("Trial skeptics") and we derive the
	// on-disk id slug ("trial_skeptics") from it. Description is editable; we
	// still auto-suggest it but the analyst can rewrite.

	let personaName = $state('');
	let personaDescription = $state('');
	let personaColor = $state('');
	let saving = $state(false);
	let saveResult = $state<{ ok: true; path: string; id: string } | null>(null);
	let saveError = $state<string | null>(null);

	function nameToSlug(name: string): string {
		return name
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 64);
	}

	const personaId = $derived(nameToSlug(personaName));
	const idLooksValid = $derived(/^[a-z0-9][a-z0-9_-]{1,63}$/.test(personaId));
	// "Ready to save" — derive path needs a deriveResult, filter path needs a
	// non-empty filter that successfully matched at least one fragment.
	const hasSavablePayload = $derived(
		mode === 'authors'
			? !!deriveResult
			: mode === 'filter'
				? !filterIsEmpty && !!filterMatchResult && filterMatchResult.fragment_count > 0
				: false
	);
	const canSave = $derived(
		hasSavablePayload &&
			idLooksValid &&
			personaName.trim().length > 0 &&
			personaDescription.trim().length > 0 &&
			!saving
	);
	const idConflicts = $derived(
		data.existing_personas.some((p) => p.id === personaId)
	);

	// === Personas tab =======================================================
	// Saved personas scoped to the current corpus's indications. Each row can
	// link out to the persona page or spawn a narrative-chart generation job.
	const scopedPersonas = $derived(
		data.existing_personas.filter((p) =>
			corpus?.indications.some((i) => p.applicable_indications.includes(i))
		)
	);

	// Per-persona narrative-job state, keyed by persona id. We track the toast
	// id so the in-flight progress toast can be upgraded to success when the
	// /api/personas/generate-narrative call resolves.
	let narrativeJobs = $state<Record<string, { toastId: number; running: boolean }>>({});

	// Per-persona journey-map-job state. Same shape; sibling endpoint
	// (/api/personas/generate-journey-map) spawns synthesize-journey-map.mjs
	// for the active corpus. Takes 5–15min vs. narrative's ~1min.
	let journeyMapJobs = $state<Record<string, { toastId: number; running: boolean }>>({});

	async function runJourneyMap(personaIdToGenerate: string, label: string) {
		if (journeyMapJobs[personaIdToGenerate]?.running) return;
		if (!corpusId) return;
		const toastId = toasts.push({
			message: `Generating journey-map table for "${label}"…`,
			variant: 'progress',
			progressLabel: 'Calling Claude per stage — 5–15min. Safe to leave this tab.',
			duration: 0
		});
		journeyMapJobs = { ...journeyMapJobs, [personaIdToGenerate]: { toastId, running: true } };
		try {
			const res = await fetch('/api/personas/generate-journey-map', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					persona_id: personaIdToGenerate,
					corpus_id: corpusId,
					force: true
				})
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
			toasts.update(toastId, {
				message: `Journey-map table ready for "${label}".`,
				variant: 'success',
				progress: 1
			});
			setTimeout(() => toasts.dismiss(toastId), 5000);
			await invalidateAll();
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			toasts.update(toastId, {
				message: `Journey-map generation failed: ${msg}`,
				variant: 'error'
			});
			setTimeout(() => toasts.dismiss(toastId), 7000);
		} finally {
			journeyMapJobs = {
				...journeyMapJobs,
				[personaIdToGenerate]: { toastId, running: false }
			};
		}
	}

	async function runNarrative(personaIdToGenerate: string, label: string) {
		if (narrativeJobs[personaIdToGenerate]?.running) return;
		const toastId = toasts.push({
			message: `Generating narrative for "${label}"…`,
			variant: 'progress',
			progressLabel: 'Calling Claude — this can take 30s–2min.',
			duration: 0
		});
		narrativeJobs = { ...narrativeJobs, [personaIdToGenerate]: { toastId, running: true } };
		try {
			const res = await fetch('/api/personas/generate-narrative', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ persona_id: personaIdToGenerate, force: true })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
			toasts.update(toastId, {
				message: `Narrative ready for "${label}".`,
				variant: 'success',
				progress: 1
			});
			// Auto-dismiss the upgraded success toast after the standard window.
			setTimeout(() => toasts.dismiss(toastId), 5000);
			await invalidateAll();
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			toasts.update(toastId, {
				message: `Narrative generation failed: ${msg}`,
				variant: 'error'
			});
			setTimeout(() => toasts.dismiss(toastId), 7000);
		} finally {
			narrativeJobs = {
				...narrativeJobs,
				[personaIdToGenerate]: { toastId, running: false }
			};
		}
	}

	async function runSave() {
		if (!canSave) return;
		saving = true;
		saveError = null;
		try {
			let persona;
			const label = personaName.trim();
			if (mode === 'authors' && deriveResult) {
				persona = {
					...deriveResult.persona,
					id: personaId,
					label,
					description: personaDescription.trim(),
					...(personaColor.trim() ? { color: personaColor.trim() } : {})
				};
			} else if (mode === 'filter') {
				persona = {
					id: personaId,
					label,
					description: personaDescription.trim(),
					applicable_indications: corpus?.indications ?? [],
					filter: customFilter,
					weighting: { type: 'uniform' as const },
					...(personaColor.trim() ? { color: personaColor.trim() } : {})
				};
			} else {
				return;
			}
			const res = await fetch('/api/personas/save', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ persona, force: idConflicts })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
			saveResult = { ok: true, path: body.path, id: personaId };
			// Surface success globally + refresh existing_personas so the new
			// row appears under the Personas tab without a hard reload.
			toasts.push({
				message: `Saved persona "${label}".`,
				href: `/patientlyiq/personas?view=saved&persona=${personaId}`,
				linkLabel: 'View persona →',
				variant: 'success'
			});
			await invalidateAll();
			mode = 'personas';
		} catch (e) {
			saveError = e instanceof Error ? e.message : String(e);
			toasts.push({
				message: `Save failed: ${saveError}`,
				variant: 'error',
				duration: 7000
			});
		} finally {
			saving = false;
		}
	}

	function titleCase(s: string) {
		return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	// Sentiment helpers. Codebook stores sentiment as integer scores in
	// [-2, 2] (Strongly negative … Strongly positive). The chip row paints
	// each level with the same red→slate→green gradient the personas-page
	// bento uses for its sentiment band, so the two surfaces feel of-a-piece.
	const SENTIMENT_LEVELS: Array<{
		value: number;
		short: string;
		long: string;
		color: string;
	}> = [
		{ value: -2, short: 'Very neg', long: 'Very negative', color: '#e11d48' },
		{ value: -1, short: 'Negative', long: 'Negative', color: '#fb7185' },
		{ value: 0, short: 'Neutral', long: 'Neutral / mixed', color: '#94a3b8' },
		{ value: 1, short: 'Positive', long: 'Positive', color: '#34d399' },
		{ value: 2, short: 'Very pos', long: 'Very positive', color: '#059669' }
	];
	function sentimentPct(v: number): number {
		return ((v + 2) / 4) * 100;
	}
	function sentimentLevelLabel(v: number): string {
		return SENTIMENT_LEVELS.find((l) => l.value === v)?.long ?? `${v}`;
	}

	// Sentence-summary helpers — what the inline dropdown shows when closed.
	const sentimentSummary = $derived.by(() => {
		if (selectedSentiments.size === 0) return 'any';
		if (selectedSentiments.size === 5) return 'all';
		const labels = SENTIMENT_LEVELS.filter((l) => selectedSentiments.has(l.value)).map(
			(l) => l.long
		);
		return labels.length <= 2 ? labels.join(' or ') : `${labels.length} sentiments`;
	});
	const stageSummary = $derived.by(() => {
		if (selectedStages.size === 0) return 'any stage';
		if (selectedStages.size === 1) return titleCase([...selectedStages][0]);
		return `${selectedStages.size} stages`;
	});
	const subthemeSummary = $derived.by(() => {
		if (selectedSubthemes.size === 0) return 'any subtheme';
		if (selectedSubthemes.size === 1) return titleCase([...selectedSubthemes][0]);
		return `${selectedSubthemes.size} subthemes`;
	});

	function toggleDropdown(which: 'sentiment' | 'stage' | 'subtheme') {
		openDropdown = openDropdown === which ? null : which;
	}

	// True when the selected sentiment set's implied band [min, max] is
	// wider than the explicit picks — picking {-2, 0} implicitly includes -1.
	const sentimentRangeIsImplied = $derived.by(() => {
		if (!sentimentRange || selectedSentiments.size === 0) return false;
		const span = sentimentRange.max - sentimentRange.min + 1;
		return span > selectedSentiments.size;
	});

	// === Auto-fill save form from filter ====================================
	// Generate a human-friendly name + description from the current filter,
	// so the analyst doesn't stare at empty fields. We don't trample what the
	// user types: each field is auto-written only when its current value
	// still matches the previous auto-fill. Clearing a field re-enables
	// auto-fill for it.

	const INDICATION_META: Record<string, { short: string; long: string }> = {
		lupus_nephritis: { short: 'LN', long: 'Lupus nephritis' },
		obesity: { short: 'Obesity', long: 'Obesity' },
		multiple_sclerosis: { short: 'MS', long: 'Multiple sclerosis' }
	};

	function indicationMeta(ind: string | undefined) {
		if (!ind) return { short: 'Patient', long: 'Patient' };
		return INDICATION_META[ind] ?? { short: titleCase(ind), long: titleCase(ind) };
	}

	function sentimentWord(r: { min: number; max: number } | null): string | null {
		if (!r) return null;
		if (r.max <= -2) return 'very_negative';
		if (r.max < 0) return 'negative';
		if (r.min >= 2) return 'very_positive';
		if (r.min > 0) return 'positive';
		if (r.min === 0 && r.max === 0) return 'neutral';
		if (r.min < 0 && r.max > 0) return 'mixed';
		return null;
	}

	// Pithy archetype nouns per stage — what kind of patient lives in that
	// stage. Used in the suggested name so "Trial Consideration" reads as
	// "trial considerers" rather than the bare stage id.
	const STAGE_PERSONA: Record<string, string> = {
		pre_diagnosis: 'pre-diagnosis voices',
		diagnostic_odyssey: 'diagnosis seekers',
		induction_treatment: 'induction patients',
		stable_maintenance: 'maintenance patients',
		flare_or_refractory_cycle: 'flare-cycle patients',
		trial_consideration: 'trial considerers',
		in_trial_experience: 'trial participants',
		post_trial: 'post-trial voices'
	};

	// Override archetypes for known (sentiment, stage) combos that have a
	// snappier idiomatic name than the formulaic "negative trial considerers".
	const ARCHETYPE_OVERRIDES: Record<string, string> = {
		'negative|trial_consideration': 'Trial skeptics',
		'very_negative|trial_consideration': 'Trial skeptics',
		'positive|trial_consideration': 'Trial advocates',
		'very_positive|trial_consideration': 'Trial advocates',
		'negative|diagnostic_odyssey': 'Stalled diagnosis seekers',
		'positive|induction_treatment': 'Hopeful induction patients',
		'negative|induction_treatment': 'Struggling induction patients',
		'negative|flare_or_refractory_cycle': 'Flare-burdened patients',
		'positive|in_trial_experience': 'Trial enthusiasts',
		'negative|in_trial_experience': 'Discouraged trial participants',
		'negative|post_trial': 'Post-trial drop-offs'
	};

	function suggestedName(
		indShort: string,
		sw: string | null,
		stages: string[],
		subs: string[]
	): string {
		// 1. Archetype override for a single (sentiment, stage) combo.
		if (sw && stages.length === 1) {
			const hit = ARCHETYPE_OVERRIDES[`${sw}|${stages[0]}`];
			if (hit) return hit;
		}
		// 2. Sentiment-qualified stage persona.
		const sentimentAdj = sw
			? { very_negative: 'Embattled', negative: 'Skeptical', neutral: 'Cautious', positive: 'Hopeful', very_positive: 'Enthusiastic', mixed: 'Conflicted' }[sw]
			: null;
		if (stages.length === 1) {
			const base = STAGE_PERSONA[stages[0]] ?? titleCase(stages[0]).toLowerCase() + ' patients';
			return sentimentAdj ? `${sentimentAdj} ${base}` : titleCase(base);
		}
		if (stages.length > 1) {
			return sentimentAdj
				? `${sentimentAdj} voices across ${stages.length} stages`
				: `Voices across ${stages.length} stages`;
		}
		// 3. Subtheme-led when no stage selected.
		if (subs.length === 1) {
			const sub = titleCase(subs[0]).toLowerCase();
			return sentimentAdj ? `${sentimentAdj} voices on ${sub}` : `${indShort} ${sub} voices`;
		}
		if (subs.length > 1) {
			return sentimentAdj
				? `${sentimentAdj} voices across ${subs.length} subthemes`
				: `Voices across ${subs.length} subthemes`;
		}
		// 4. Sentiment only.
		if (sw) return `${sentimentAdj} ${indShort} voices`;
		return `${indShort} cohort`;
	}

	const autoFill = $derived.by(() => {
		const meta = indicationMeta(corpus?.indications?.[0]);
		const sw = sentimentWord(sentimentRange);
		const stages = [...selectedStages];
		const subs = [...selectedSubthemes];

		const name = suggestedName(meta.short, sw, stages, subs);

		// Description: a complete sentence built from the filter.
		const descBits: string[] = [];
		if (sw) descBits.push(`expressing ${sw.replace(/_/g, ' ')} sentiment`);
		if (stages.length > 0)
			descBits.push(`during ${stages.map((s) => titleCase(s).toLowerCase()).join(' / ')}`);
		if (subs.length > 0)
			descBits.push(`discussing ${subs.map((s) => titleCase(s).toLowerCase()).join(' / ')}`);
		const description =
			descBits.length === 0
				? `${meta.long} voices in this corpus.`
				: `${meta.long} voices ${descBits.join(', ')}.`;

		return { name, description };
	});

	// Track the last auto-filled value per field so we can tell whether the
	// analyst has manually edited it. If current === lastAuto (or empty), we
	// keep refreshing it from the filter. If they typed something else, we
	// stop touching that field until they clear it.
	let lastAutoName = $state('');
	let lastAutoDescription = $state('');

	$effect(() => {
		if (mode !== 'filter' || filterIsEmpty) return;
		const auto = autoFill;
		untrack(() => {
			if (personaName === lastAutoName || personaName.trim() === '') {
				personaName = auto.name;
				lastAutoName = auto.name;
			}
			if (personaDescription === lastAutoDescription || personaDescription.trim() === '') {
				personaDescription = auto.description;
				lastAutoDescription = auto.description;
			}
		});
	});
</script>

<svelte:head><title>Persona Workbench</title></svelte:head>

<div class="mx-auto w-full max-w-6xl px-6 py-6">
	<header class="mb-6">
		<h1 class="text-xl font-medium text-primary">Persona Workbench</h1>
		<p class="mt-1 text-sm text-gray-600">
			Build a persona <strong>by filter</strong> (attitudinal predicates: sentiment, emotion,
			subtheme, stage) or <strong>by authors</strong> (pick a cluster, derive the filter from their
			shared profile). Save it, then jump to <strong>Personas</strong> to generate a narrative
			chart that ships to the personas page.
		</p>
	</header>

	<!-- Corpus picker -->
	<section class="mb-6">
		<label class="text-xs font-medium uppercase tracking-wider text-gray-500" for="corpus">
			Corpus
		</label>
		<select
			id="corpus"
			bind:value={corpusId}
			class="mt-1 block w-full max-w-lg rounded-md border border-muted bg-white px-3 py-2 text-sm shadow-sm"
		>
			{#each mergeableCorpora as c (c.id)}
				<option value={c.id}>
					{c.label} — {c.distinct_authors} authors, {c.total_fragments} fragments
					{c.annotated_fragments < c.total_fragments
						? ` (${c.annotated_fragments} annotated)`
						: ''}
				</option>
			{/each}
		</select>
		{#if corpus}
			<p class="mt-1 text-xs text-gray-500">
				Indications: {corpus.indications.join(', ')}
			</p>
		{/if}
	</section>

	<!-- Mode tabs — pick which entry point the analyst is using. The suggestion
	     picker and author list belong to the "authors" path; the filter builder
	     is its own path; the "personas" tab lists already-saved personas for
	     this corpus's indication. The Save button sits at the right of the row
	     so the primary CTA is in eyeshot as soon as a filter resolves. -->
	<section class="mb-6 flex items-center justify-between gap-3">
		<div
			class="inline-flex rounded-md border border-muted bg-white p-0.5 text-sm"
			role="tablist"
		>
			<button
				type="button"
				role="tab"
				aria-selected={mode === 'filter'}
				onclick={() => (mode = 'filter')}
				class="rounded px-3 py-1.5 transition-colors
					{mode === 'filter'
					? 'bg-indigo-600 text-white'
					: 'text-gray-700 hover:bg-gray-50'}"
			>
				By filter
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={mode === 'authors'}
				onclick={() => (mode = 'authors')}
				class="rounded px-3 py-1.5 transition-colors
					{mode === 'authors'
					? 'bg-indigo-600 text-white'
					: 'text-gray-700 hover:bg-gray-50'}"
			>
				By authors
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={mode === 'personas'}
				onclick={() => (mode = 'personas')}
				class="rounded px-3 py-1.5 transition-colors
					{mode === 'personas'
					? 'bg-indigo-600 text-white'
					: 'text-gray-700 hover:bg-gray-50'}"
			>
				Personas
				<span
					class="ml-1 rounded-full bg-(--ink)/10 px-1.5 py-0.5 text-[10px] font-medium"
				>
					{scopedPersonas.length}
				</span>
			</button>
		</div>
		{#if mode !== 'personas'}
			<button
				type="button"
				onclick={runSave}
				disabled={!canSave}
				class="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
				title={canSave
					? idConflicts
						? 'Overwrite the existing persona of the same name'
						: 'Save this filter as a new persona'
					: hasSavablePayload
						? 'Fill in a name and description'
						: mode === 'filter'
							? 'Pick at least one predicate that matches fragments'
							: 'Pick authors and derive the filter first'}
			>
				{saving ? 'Saving…' : idConflicts ? 'Save persona (overwrite)' : 'Save persona'}
			</button>
		{/if}
	</section>

	{#if mode === 'authors'}
	<!-- Suggestion picker — pre-fills the author selection with a cluster the
	     deterministic suggester produced. Empty state when the corpus has no
	     persona_suggestions.json artifact. -->
	<section class="mb-6">
		<label
			class="text-xs font-medium uppercase tracking-wider text-gray-500"
			for="suggestion"
		>
			Pre-fill from suggestion
		</label>
		{#if suggestions.length}
			<select
				id="suggestion"
				value={pickedSuggestionId}
				onchange={(e) => applySuggestion((e.currentTarget as HTMLSelectElement).value)}
				class="mt-1 block w-full max-w-lg rounded-md border border-muted bg-white px-3 py-2 text-sm shadow-sm"
			>
				<option value="">— pick a cluster to load its authors —</option>
				{#each suggestions as s (s.id)}
					{@const top = s.top_subthemes[0]?.id ?? s.top_themes[0]?.id ?? 'cluster'}
					<option value={s.id}>
						#{s.rank} · {titleCase(top)} · {s.seed_authors.length}+{s.attached_singletons
							.length} authors · {s.fragment_count} frags · cohesion {s.cohesion.toFixed(2)}
					</option>
				{/each}
			</select>
			{#if pickedSuggestion}
				<div class="mt-2 rounded-md border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-900">
					Loaded
					<strong>{pickedSuggestion.seed_authors.length}</strong>
					seed + <strong>{pickedSuggestion.attached_singletons.length}</strong> attached
					{pickedSuggestion.attached_singletons.length === 1 ? 'singleton' : 'singletons'}
					into the selection.
					{#if pickedSuggestion.top_subthemes.length}
						<span class="ml-1 text-indigo-700/80">
							Top subthemes: {pickedSuggestion.top_subthemes
								.slice(0, 3)
								.map((t) => titleCase(t.id))
								.join(', ')}.
						</span>
					{/if}
					{#if pickedSuggestion.overlaps_existing.length > 0}
						<span class="ml-1 text-amber-800">
							Overlaps existing <code class="font-mono">
								{pickedSuggestion.overlaps_existing[0].persona_id}
							</code>.
						</span>
					{/if}
				</div>
			{/if}
		{:else}
			<p class="mt-1 max-w-lg text-xs text-gray-500">
				No suggestion artifact for this corpus. Run
				<code class="rounded bg-gray-100 px-1 py-0.5 font-mono">
					node scripts/propose-persona-suggestions.mjs {corpusId}
				</code>
				to generate one.
			</p>
		{/if}
	</section>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Author list -->
		<section class="rounded-lg border border-muted bg-white">
			<div class="flex items-center justify-between gap-3 border-b border-muted px-4 py-3">
				<div>
					<h2 class="text-sm font-medium text-primary">Authors</h2>
					<p class="text-xs text-gray-500">
						{filteredAuthors.length} of {authors.length} shown · {selectedAuthors.size} selected
					</p>
				</div>
				<button
					type="button"
					onclick={clearSelection}
					disabled={selectedAuthors.size === 0}
					class="rounded-md border border-muted px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
				>
					Clear
				</button>
			</div>
			<div class="px-4 py-2">
				<input
					type="search"
					placeholder="Filter by handle or text…"
					bind:value={authorFilter}
					class="block w-full rounded-md border border-muted px-2 py-1 text-sm"
				/>
			</div>
			<ul class="max-h-[640px] overflow-y-auto divide-y divide-muted">
				{#each filteredAuthors as a (a.author_handle_hash)}
					{@const checked = selectedAuthors.has(a.author_handle_hash)}
					<li>
						<button
							type="button"
							onclick={() => toggleAuthor(a.author_handle_hash)}
							class="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 {checked
								? 'bg-indigo-50'
								: ''}"
						>
							<input
								type="checkbox"
								{checked}
								tabindex={-1}
								class="mt-0.5 cursor-pointer"
								onclick={(e) => e.stopPropagation()}
								onchange={() => toggleAuthor(a.author_handle_hash)}
							/>
							<img
								src={a.avatar_url}
								alt=""
								class="size-9 shrink-0 rounded-full bg-white object-cover"
							/>
							<div class="min-w-0 flex-1">
								<div class="flex items-baseline justify-between gap-2">
									<span class="truncate text-sm font-medium text-primary">
										{a.author_handle_hash}
									</span>
									<span class="whitespace-nowrap text-xs text-gray-500">
										{a.fragment_count} frag · {a.annotated_count} ann
										{a.role_seen ? ` · ${a.role_seen}` : ''}
									</span>
								</div>
								<p class="mt-1 line-clamp-2 text-xs text-gray-600">{a.sample_text}</p>
							</div>
						</button>
					</li>
				{:else}
					<li class="px-4 py-6 text-center text-xs text-gray-500">No authors match the filter.</li>
				{/each}
			</ul>
		</section>

		<!-- Derive + preview + save -->
		<section class="flex flex-col gap-4">
			<div class="rounded-lg border border-muted bg-white p-4">
				<div class="flex items-center justify-between gap-3">
					<div>
						<h2 class="text-sm font-medium text-primary">Derived filter</h2>
						<p class="text-xs text-gray-500">
							{selectedAuthors.size === 0
								? 'Pick one or more authors to start.'
								: `${selectedAuthors.size} author${selectedAuthors.size === 1 ? '' : 's'} selected.`}
						</p>
					</div>
					<button
						type="button"
						onclick={runDerive}
						disabled={selectedAuthors.size === 0 || deriving}
						class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{deriving ? 'Deriving…' : 'Derive'}
					</button>
				</div>

				{#if deriveError}
					<p class="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
						{deriveError}
					</p>
				{/if}

				{#if deriveResult}
					<!-- Match preview -->
					<div class="mt-4 grid grid-cols-3 gap-2 text-xs">
						<div class="rounded bg-gray-50 px-3 py-2">
							<div class="text-[10px] uppercase tracking-wider text-gray-500">Seeds</div>
							<div class="mt-0.5 text-sm font-medium text-primary">
								{deriveResult.preview.seed_authors} authors · {deriveResult.preview.seed_fragments} frags
							</div>
						</div>
						<div class="rounded bg-gray-50 px-3 py-2">
							<div class="text-[10px] uppercase tracking-wider text-gray-500">Filter matches</div>
							<div class="mt-0.5 text-sm font-medium text-primary">
								{deriveResult.preview.filter_matches_authors} authors · {deriveResult.preview
									.filter_matches_fragments} frags
							</div>
						</div>
						<div class="rounded bg-gray-50 px-3 py-2">
							<div class="text-[10px] uppercase tracking-wider text-gray-500">Swept in</div>
							<div class="mt-0.5 text-sm font-medium text-primary">
								+{deriveResult.preview.non_seed_authors_swept_in} authors · +{deriveResult.preview
									.non_seed_fragments_swept_in} frags
							</div>
						</div>
					</div>
					{#if deriveResult.preview.non_seed_authors_swept_in > 0}
						<p class="mt-2 text-[11px] text-gray-500">
							The filter is broader than your selection — it also matches voices outside the authors you
							picked. That's saved-query semantics working as intended.
						</p>
					{/if}

					<!-- The filter itself -->
					<div class="mt-4 rounded border border-muted bg-gray-50 p-3">
						<div class="text-[10px] uppercase tracking-wider text-gray-500">Derived filter</div>
						{#if deriveResult.persona.filter.annotations?.has_subtheme?.length}
							<div class="mt-1 text-xs">
								<span class="text-gray-500">Subthemes:</span>
								{#each deriveResult.persona.filter.annotations.has_subtheme as id, i (id)}
									<span class="ml-1 rounded bg-indigo-100 px-1.5 py-0.5 text-indigo-800"
										>{titleCase(id)}</span
									>{i < deriveResult.persona.filter.annotations.has_subtheme.length - 1 ? '' : ''}
								{/each}
							</div>
						{/if}
						{#if deriveResult.persona.filter.annotations?.has_stage?.length}
							<div class="mt-1 text-xs">
								<span class="text-gray-500">Stages:</span>
								{#each deriveResult.persona.filter.annotations.has_stage as id (id)}
									<span class="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800"
										>{titleCase(id)}</span
									>
								{/each}
							</div>
						{/if}
						{#if deriveResult.persona.filter.speaker_attrs?.role}
							<div class="mt-1 text-xs">
								<span class="text-gray-500">Role:</span>
								<span class="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
									{deriveResult.persona.filter.speaker_attrs.role.in.join(', ')}
								</span>
							</div>
						{/if}
						{#if !deriveResult.persona.filter.annotations?.has_subtheme?.length && !deriveResult.persona.filter.annotations?.has_stage?.length && !deriveResult.persona.filter.speaker_attrs?.role}
							<p class="mt-1 text-xs text-gray-500">
								No theme/stage/role crossed the share threshold — filter is content_source +
								indications only. Selection may be too heterogeneous; try a narrower set.
							</p>
						{/if}
					</div>

					<!-- Profile summary -->
					<details class="mt-4">
						<summary class="cursor-pointer text-xs text-gray-600 hover:text-gray-900">
							Profile summary
						</summary>
						<div class="mt-2 grid grid-cols-2 gap-3 text-xs">
							{#if deriveResult.profile_summary.top_subthemes.length}
								<div>
									<div class="text-[10px] uppercase tracking-wider text-gray-500">
										Top subthemes
									</div>
									<ul class="mt-1 space-y-0.5">
										{#each deriveResult.profile_summary.top_subthemes as t (t.id)}
											<li class="flex justify-between gap-2">
												<span class="truncate">{titleCase(t.id)}</span>
												<span class="tabular-nums text-gray-500">{t.share.toFixed(2)}</span>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
							{#if deriveResult.profile_summary.top_stages.length}
								<div>
									<div class="text-[10px] uppercase tracking-wider text-gray-500">Top stages</div>
									<ul class="mt-1 space-y-0.5">
										{#each deriveResult.profile_summary.top_stages as t (t.id)}
											<li class="flex justify-between gap-2">
												<span class="truncate">{titleCase(t.id)}</span>
												<span class="tabular-nums text-gray-500">{t.share.toFixed(2)}</span>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
							{#if deriveResult.profile_summary.top_emotions.length}
								<div>
									<div class="text-[10px] uppercase tracking-wider text-gray-500">
										Top emotions
									</div>
									<ul class="mt-1 space-y-0.5">
										{#each deriveResult.profile_summary.top_emotions as t (t.id)}
											<li class="flex justify-between gap-2">
												<span class="truncate">{titleCase(t.id)}</span>
												<span class="tabular-nums text-gray-500">{t.share.toFixed(2)}</span>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					</details>

					<!-- Overlaps -->
					{#if deriveResult.overlaps_existing.length > 0}
						<div class="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
							<div class="font-medium text-amber-900">Overlaps existing personas</div>
							<ul class="mt-1 space-y-0.5 text-amber-800">
								{#each deriveResult.overlaps_existing as o (o.persona_id)}
									<li>
										<code class="font-mono">{o.persona_id}</code> — Jaccard {o.jaccard.toFixed(2)}
									</li>
								{/each}
							</ul>
							<p class="mt-1 text-amber-700">
								This persona's annotation predicates resemble one already in the personas folder.
								Consider whether to refine the selection or skip the save.
							</p>
						</div>
					{/if}
				{/if}
			</div>

		</section>
	</div>
	{/if}

	{#if mode === 'filter'}
		<!-- Filter builder — pick attitudinal predicates directly. Each chip group
		     OR-combines internally; groups AND-combine. Live count + samples
		     update on every toggle (300ms debounce). The current customFilter is
		     what gets saved. Two-column on lg+: builder on the left, live match
		     preview pinned on the right so the analyst can watch counts/samples
		     change as they toggle chips. -->
		<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
		<!-- Sentence-driven filter builder. Three inline dropdowns
		     (sentiment / stage / subtheme) carry the main predicates; the
		     fourth and fifth (emotion / step) live under "More filters". -->
		<section class="flex flex-col gap-4 rounded-lg border border-muted bg-white p-5">
			{#if !availability}
				<p class="rounded border border-dashed border-muted bg-gray-50 p-3 text-xs text-gray-500">
					Pick a corpus to see its available tags.
				</p>
			{:else}
				<header class="flex items-start justify-between gap-4">
					<p class="text-base leading-relaxed text-foreground">
						Build a persona who expressed
						<button
							type="button"
							onclick={() => toggleDropdown('sentiment')}
							class="mx-0.5 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-base transition-colors
								{openDropdown === 'sentiment'
								? 'border-indigo-500 bg-indigo-50 text-indigo-700'
								: selectedSentiments.size > 0
									? 'border-indigo-300 bg-indigo-50/60 text-indigo-700 hover:bg-indigo-50'
									: 'border-dashed border-(--ink)/30 text-muted-foreground hover:border-(--ink)/50 hover:text-foreground'}"
						>
							{sentimentSummary}
							<span class="opacity-60">▾</span>
						</button>
						sentiment during
						<button
							type="button"
							onclick={() => toggleDropdown('stage')}
							class="mx-0.5 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-base transition-colors
								{openDropdown === 'stage'
								? 'border-sky-500 bg-sky-50 text-sky-700'
								: selectedStages.size > 0
									? 'border-sky-300 bg-sky-50/60 text-sky-700 hover:bg-sky-50'
									: 'border-dashed border-(--ink)/30 text-muted-foreground hover:border-(--ink)/50 hover:text-foreground'}"
						>
							{stageSummary}
							<span class="opacity-60">▾</span>
						</button>
						, and discussed
						<button
							type="button"
							onclick={() => toggleDropdown('subtheme')}
							class="mx-0.5 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-base transition-colors
								{openDropdown === 'subtheme'
								? 'border-violet-500 bg-violet-50 text-violet-700'
								: selectedSubthemes.size > 0
									? 'border-violet-300 bg-violet-50/60 text-violet-700 hover:bg-violet-50'
									: 'border-dashed border-(--ink)/30 text-muted-foreground hover:border-(--ink)/50 hover:text-foreground'}"
						>
							{subthemeSummary}
							<span class="opacity-60">▾</span>
						</button>
						.
					</p>
					<button
						type="button"
						onclick={clearFilter}
						disabled={filterIsEmpty}
						class="shrink-0 rounded-md border border-muted px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Clear all
					</button>
				</header>

				<!-- Open dropdown panel — only one shown at a time. -->
				{#if openDropdown === 'sentiment'}
					<div class="flex flex-col gap-3 rounded-md border border-indigo-200 bg-indigo-50/40 p-4">
						<div class="flex items-center justify-between">
							<span class="text-[10px] font-medium uppercase tracking-wider text-indigo-700">
								Sentiment band
							</span>
							{#if selectedSentiments.size > 0}
								<button
									type="button"
									onclick={() => (selectedSentiments = new Set())}
									class="text-[11px] text-indigo-700/70 hover:text-indigo-900"
								>
									Clear
								</button>
							{/if}
						</div>
						<!-- Five-chip row over a gradient track. Each chip is a toggle;
						     the saved filter spans min..max of the selected values. -->
						<div class="relative">
							<div
								class="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full bg-(--ink)/8"
							>
								<span
									class="absolute inset-0 rounded-full"
									style="background: linear-gradient(to right, #e11d48 0%, #94a3b8 50%, #059669 100%); opacity: 0.22;"
								></span>
								{#if sentimentRange}
									<span
										class="absolute inset-y-0 rounded-full"
										style="background: linear-gradient(to right, #e11d48 0%, #94a3b8 50%, #059669 100%); left: {sentimentPct(
											sentimentRange.min
										)}%; right: {100 - sentimentPct(sentimentRange.max)}%;"
									></span>
								{/if}
							</div>
							<div class="relative flex items-center justify-between gap-2 py-2">
								{#each SENTIMENT_LEVELS as lvl (lvl.value)}
									{@const on = selectedSentiments.has(lvl.value)}
									<button
										type="button"
										onclick={() => (selectedSentiments = toggleNum(selectedSentiments, lvl.value))}
										class="flex flex-1 items-center justify-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium transition-colors
											{on
											? 'border-foreground bg-foreground text-(--paper) shadow-sm'
											: 'border-(--ink)/25 bg-white text-gray-700 hover:bg-gray-50'}"
									>
										<span
											class="inline-block size-2 rounded-full"
											style:background-color={lvl.color}
										></span>
										{lvl.short}
									</button>
								{/each}
							</div>
						</div>
						<div class="flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-500">
							<span>Negative</span>
							<span>Positive</span>
						</div>
						{#if sentimentRangeIsImplied && sentimentRange}
							<p class="text-[11px] text-indigo-700/80">
								Filter spans <strong>{sentimentLevelLabel(sentimentRange.min)}</strong> through
								<strong>{sentimentLevelLabel(sentimentRange.max)}</strong> — picking endpoints
								includes the values between them.
							</p>
						{/if}
					</div>
				{:else if openDropdown === 'stage'}
					<div class="flex flex-col gap-3 rounded-md border border-sky-200 bg-sky-50/40 p-4">
						<div class="flex items-center justify-between">
							<span class="text-[10px] font-medium uppercase tracking-wider text-sky-700">
								Stages ({selectedStages.size} of {availability.stages.filter((t) => t.available).length} available)
							</span>
							{#if selectedStages.size > 0}
								<button
									type="button"
									onclick={() => (selectedStages = new Set())}
									class="text-[11px] text-sky-700/70 hover:text-sky-900"
								>
									Clear
								</button>
							{/if}
						</div>
						{#if availability.stages.length === 0}
							<p class="text-xs text-gray-500">No journey stages defined for this corpus's indication.</p>
						{:else}
							<div class="flex flex-wrap gap-1.5">
								{#each availability.stages as t (t.id)}
									{@const on = selectedStages.has(t.id)}
									<button
										type="button"
										disabled={!t.available}
										title={t.available ? '' : 'Not tagged in this corpus'}
										onclick={() => (selectedStages = toggleIn(selectedStages, t.id))}
										class="rounded-full border px-2.5 py-0.5 text-xs transition-colors
											{!t.available
											? 'cursor-not-allowed border-dashed border-(--ink)/15 bg-white text-gray-400 opacity-60'
											: on
												? 'border-sky-500 bg-sky-500 text-white'
												: 'border-muted bg-white text-gray-700 hover:bg-gray-50'}"
									>
										{titleCase(t.id)}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{:else if openDropdown === 'subtheme'}
					<div class="flex flex-col gap-3 rounded-md border border-violet-200 bg-violet-50/40 p-4">
						<div class="flex items-center justify-between">
							<span class="text-[10px] font-medium uppercase tracking-wider text-violet-700">
								Subthemes ({selectedSubthemes.size} of {availability.subthemes.reduce(
									(n, g) => n + g.tags.filter((t) => t.available).length,
									0
								)} available)
							</span>
							{#if selectedSubthemes.size > 0}
								<button
									type="button"
									onclick={() => (selectedSubthemes = new Set())}
									class="text-[11px] text-violet-700/70 hover:text-violet-900"
								>
									Clear
								</button>
							{/if}
						</div>
						{#if availability.subthemes.length === 0}
							<p class="text-xs text-gray-500">No subthemes in the codebook.</p>
						{:else}
							<div class="flex flex-col gap-2.5">
								{#each availability.subthemes as group (group.id)}
									<div class="flex flex-col gap-1">
										<span class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
											{group.label}
										</span>
										<div class="flex flex-wrap gap-1.5">
											{#each group.tags as t (t.id)}
												{@const on = selectedSubthemes.has(t.id)}
												<button
													type="button"
													disabled={!t.available}
													title={t.available ? '' : 'Not tagged in this corpus'}
													onclick={() =>
														(selectedSubthemes = toggleIn(selectedSubthemes, t.id))}
													class="rounded-full border px-2.5 py-0.5 text-xs transition-colors
														{!t.available
														? 'cursor-not-allowed border-dashed border-(--ink)/15 bg-white text-gray-400 opacity-60'
														: on
															? 'border-violet-500 bg-violet-500 text-white'
															: 'border-muted bg-white text-gray-700 hover:bg-gray-50'}"
												>
													{titleCase(t.id)}
												</button>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- More filters — emotion + step pickers, collapsed by default. -->
				<details class="rounded-md border border-(--ink)/10 bg-gray-50/60 p-3 open:bg-white">
					<summary class="cursor-pointer text-xs font-medium text-gray-700 select-none hover:text-gray-900">
						More filters
						{#if selectedEmotions.size + selectedSteps.size > 0}
							<span class="ml-1 rounded-full bg-(--ink)/10 px-1.5 py-0.5 text-[10px] text-foreground">
								{selectedEmotions.size + selectedSteps.size} selected
							</span>
						{/if}
					</summary>

					<div class="mt-4 flex flex-col gap-5">
						<!-- Emotion chips, grouped by valence -->
						<div class="flex flex-col gap-2">
							<div class="flex items-center justify-between">
								<span class="text-[10px] font-medium uppercase tracking-wider text-gray-500">
									Emotions ({selectedEmotions.size} of {availability.emotions.reduce(
										(n, g) => n + g.tags.filter((t) => t.available).length,
										0
									)} available)
								</span>
								{#if selectedEmotions.size > 0}
									<button
										type="button"
										onclick={() => (selectedEmotions = new Set())}
										class="text-[11px] text-gray-500 hover:text-gray-700"
									>
										Clear
									</button>
								{/if}
							</div>
							{#if availability.emotions.length === 0}
								<p class="text-xs text-gray-500">No emotions tagged in this corpus.</p>
							{:else}
								<div class="flex flex-col gap-2.5">
									{#each availability.emotions as group (group.id)}
										<div class="flex flex-col gap-1">
											<span class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
												{group.label}
											</span>
											<div class="flex flex-wrap gap-1.5">
												{#each group.tags as t (t.id)}
													{@const on = selectedEmotions.has(t.id)}
													<button
														type="button"
														disabled={!t.available}
														title={t.available ? '' : 'Not tagged in this corpus'}
														onclick={() =>
															(selectedEmotions = toggleIn(selectedEmotions, t.id))}
														class="rounded-full border px-2.5 py-0.5 text-xs transition-colors
															{!t.available
															? 'cursor-not-allowed border-dashed border-(--ink)/15 bg-white text-gray-400 opacity-60'
															: on
																? 'border-amber-500 bg-amber-500 text-white'
																: 'border-muted bg-white text-gray-700 hover:bg-gray-50'}"
													>
														{titleCase(t.id)}
													</button>
												{/each}
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Step chips, grouped by parent stage -->
						<div class="flex flex-col gap-2">
							<div class="flex items-center justify-between">
								<span class="text-[10px] font-medium uppercase tracking-wider text-gray-500">
									Journey steps ({selectedSteps.size} of {availability.steps.reduce(
										(n, g) => n + g.tags.filter((t) => t.available).length,
										0
									)} available)
								</span>
								{#if selectedSteps.size > 0}
									<button
										type="button"
										onclick={() => (selectedSteps = new Set())}
										class="text-[11px] text-gray-500 hover:text-gray-700"
									>
										Clear
									</button>
								{/if}
							</div>
							{#if availability.steps.length === 0}
								<p class="text-xs text-gray-500">No journey steps defined for this corpus's indication.</p>
							{:else}
								<div class="flex flex-col gap-2.5">
									{#each availability.steps as group (group.id)}
										<div class="flex flex-col gap-1">
											<span class="text-[10px] font-medium uppercase tracking-wide text-gray-400">
												{group.label}
											</span>
											<div class="flex flex-wrap gap-1.5">
												{#each group.tags as t (t.id)}
													{@const on = selectedSteps.has(t.id)}
													<button
														type="button"
														disabled={!t.available}
														title={t.available ? '' : 'Not tagged in this corpus'}
														onclick={() => (selectedSteps = toggleIn(selectedSteps, t.id))}
														class="rounded-full border px-2.5 py-0.5 text-xs transition-colors
															{!t.available
															? 'cursor-not-allowed border-dashed border-(--ink)/15 bg-white text-gray-400 opacity-60'
															: on
																? 'border-cyan-500 bg-cyan-500 text-white'
																: 'border-muted bg-white text-gray-700 hover:bg-gray-50'}"
													>
														{titleCase(t.id)}
													</button>
												{/each}
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</details>
			{/if}
		</section>

		<!-- Live match preview — sticky on the right so it stays in view while
		     the analyst scrolls through the chip groups. -->
		<section class="rounded-lg border border-muted bg-white p-5 lg:sticky lg:top-6">
			<div class="flex items-center justify-between gap-4">
				<div>
					<h2 class="text-sm font-medium text-primary">Match preview</h2>
					<p class="text-xs text-gray-500">
						Updates as you toggle predicates. Fill in the save form below when the set looks right.
					</p>
				</div>
				{#if filterMatching}
					<span class="text-xs text-gray-500">Matching…</span>
				{/if}
			</div>

			{#if filterError}
				<p class="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
					{filterError}
				</p>
			{/if}

			{#if filterIsEmpty}
				<p class="mt-3 text-xs text-gray-500">
					Pick at least one predicate to see matched fragments.
				</p>
			{:else if filterMatchResult}
				<div class="mt-3 grid grid-cols-3 gap-2 text-xs">
					<div class="rounded bg-gray-50 px-3 py-2">
						<div class="text-[10px] uppercase tracking-wider text-gray-500">Fragments</div>
						<div class="mt-0.5 text-sm font-medium text-primary">
							{filterMatchResult.fragment_count}
						</div>
					</div>
					<div class="rounded bg-gray-50 px-3 py-2">
						<div class="text-[10px] uppercase tracking-wider text-gray-500">Distinct authors</div>
						<div class="mt-0.5 text-sm font-medium text-primary">
							{filterMatchResult.author_count}
						</div>
					</div>
					<div class="rounded bg-gray-50 px-3 py-2">
						<div class="text-[10px] uppercase tracking-wider text-gray-500">Annotated</div>
						<div class="mt-0.5 text-sm font-medium text-primary">
							{filterMatchResult.annotated_match_count}
						</div>
					</div>
				</div>

				{#if filterMatchResult.fragment_count === 0}
					<p class="mt-3 text-xs text-amber-700">
						No fragments match. Loosen a chip group or widen the sentiment band.
					</p>
				{:else if filterMatchResult.sample_fragments.length > 0}
					<div class="mt-4">
						<div class="text-[10px] uppercase tracking-wider text-gray-500">
							Sample fragments
						</div>
						<ul class="mt-2 flex flex-col gap-2">
							{#each filterMatchResult.sample_fragments as f (f.id)}
								<li class="rounded border border-muted bg-gray-50 px-3 py-2 text-xs text-gray-700">
									<p class="leading-relaxed">{f.text}</p>
									<p class="mt-1 font-mono text-[10px] text-gray-500">
										{f.author_handle_hash ?? '—'} · {f.id}
									</p>
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			{/if}
		</section>
		</div>
	{/if}

	{#if mode === 'personas'}
		<!-- Personas tab — list of saved PersonaFilter JSONs scoped to the
		     current corpus's indication. Each row links to the personas page
		     and offers a one-click button to generate (or regenerate) the
		     narrative-chart sidecar via /api/personas/generate-narrative. -->
		<section class="mb-10 rounded-lg border border-muted bg-white">
			<div class="flex items-center justify-between gap-3 border-b border-muted px-5 py-3">
				<div>
					<h2 class="text-sm font-medium text-primary">Saved personas</h2>
					<p class="text-xs text-gray-500">
						{scopedPersonas.length} persona{scopedPersonas.length === 1 ? '' : 's'} for
						<strong>{corpus?.indications.map(titleCase).join(', ') ?? 'this corpus'}</strong>.
						Generate a narrative chart to render a Commonwealth-style archetype on the
						<a
							href="/patientlyiq/personas?view=saved"
							class="text-indigo-700 hover:underline"
						>
							personas page
						</a>.
					</p>
				</div>
			</div>
			{#if scopedPersonas.length === 0}
				<p class="px-5 py-6 text-center text-xs text-gray-500">
					No saved personas yet for this corpus. Build one with the <strong>By filter</strong> or
					<strong>By authors</strong> tab.
				</p>
			{:else}
				<ul class="divide-y divide-muted">
					{#each scopedPersonas as p (p.id)}
						{@const job = narrativeJobs[p.id]}
						{@const jmJob = journeyMapJobs[p.id]}
						{@const hasJourneyMap = p.journey_map_corpora?.includes(corpusId) ?? false}
						<li class="flex items-start justify-between gap-3 px-5 py-3">
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									{#if p.avatar_url}
										<img
											src={p.avatar_url}
											alt=""
											class="size-8 shrink-0 rounded-full bg-white object-cover"
										/>
									{:else if p.color}
										<span
											class="inline-block size-2.5 shrink-0 rounded-full"
											style:background-color={p.color}
										></span>
									{/if}
									<a
										href={`/patientlyiq/personas?view=saved&persona=${p.id}`}
										class="truncate text-sm font-medium text-primary hover:text-indigo-700 hover:underline"
									>
										{p.label}
									</a>
									{#if p.has_narrative}
										<span
											class="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800"
										>
											Narrative ✓
										</span>
									{/if}
									{#if hasJourneyMap}
										<a
											href={`/patientlyiq/journey-map/${corpusId}/${p.id}?view=table`}
											class="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 hover:bg-sky-200"
											title="Open the journey-map table for this persona"
										>
											Journey map ✓
										</a>
									{/if}
								</div>
								<p class="mt-1 line-clamp-2 text-xs text-gray-600">{p.description}</p>
								<p class="mt-1 font-mono text-[10px] text-gray-400">{p.id}</p>
							</div>
							<div class="flex shrink-0 flex-col gap-1.5">
								<button
									type="button"
									onclick={() => runNarrative(p.id, p.label)}
									disabled={job?.running}
									class="rounded-md border border-muted bg-white px-2.5 py-1 text-xs text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
									title={p.has_narrative
										? 'Regenerate the narrative chart sidecar from the latest corpus annotations'
										: 'Generate a Commonwealth-style archetype narrative for this persona'}
								>
									{job?.running
										? 'Generating…'
										: p.has_narrative
											? 'Regenerate narrative'
											: 'Create narrative chart'}
								</button>
								<button
									type="button"
									onclick={() => runJourneyMap(p.id, p.label)}
									disabled={jmJob?.running || !corpusId}
									class="rounded-md border border-muted bg-white px-2.5 py-1 text-xs text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
									title={hasJourneyMap
										? `Regenerate the journey-map artifact for ${corpusId} (5–15min)`
										: `Synthesize a journey-map artifact for this persona against ${corpusId} (5–15min)`}
								>
									{jmJob?.running
										? 'Generating…'
										: hasJourneyMap
											? 'Regenerate journey map'
											: 'Create journey-map table'}
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	<!-- Save form — shared by both modes. Renders once the current path has a
	     savable payload (a derive result OR a non-empty filter that matched
	     at least one fragment). -->
	{#if mode !== 'personas' && hasSavablePayload}
		<section class="mb-10 rounded-lg border border-muted bg-white p-5">
			<h2 class="text-sm font-medium text-primary">Save as persona</h2>
			<p class="text-xs text-gray-500">
				Filter source: <strong>{mode === 'authors' ? 'derived from authors' : 'attitudinal builder'}</strong>.
			</p>
			<div class="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
				<label class="block lg:col-span-2">
					<span class="text-[10px] uppercase tracking-wider text-gray-500">Name</span>
					<input
						type="text"
						bind:value={personaName}
						placeholder="Trial skeptics"
						class="mt-0.5 block w-full rounded-md border border-muted px-2 py-1 text-sm"
					/>
					{#if personaName.length > 0 && !idLooksValid}
						<span class="text-[11px] text-red-700">
							Name must contain at least one letter or digit.
						</span>
					{:else if personaId}
						<span class="text-[11px] text-gray-500">
							Saved as <code class="font-mono">{personaId}.json</code>{idConflicts
								? ' — will overwrite an existing persona.'
								: ''}
						</span>
					{/if}
				</label>
				<label class="block lg:col-span-2">
					<span class="text-[10px] uppercase tracking-wider text-gray-500">Description</span>
					<textarea
						bind:value={personaDescription}
						rows="3"
						placeholder="Lupus patients running their own CAR-T research…"
						class="mt-0.5 block w-full rounded-md border border-muted px-2 py-1 text-sm"
					></textarea>
				</label>
				<label class="block">
					<span class="text-[10px] uppercase tracking-wider text-gray-500">
						Color (optional, hex)
					</span>
					<input
						type="text"
						bind:value={personaColor}
						placeholder="#7c3aed"
						class="mt-0.5 block w-full rounded-md border border-muted px-2 py-1 text-sm"
					/>
				</label>
			</div>

			<!-- Inline error banner. The primary "Save persona" CTA lives in the
			     tabs row above and success is announced via the global toast —
			     this is here so a failure stays visible next to the form fields
			     the analyst needs to fix. -->
			{#if saveError}
				<p class="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
					{saveError}
				</p>
			{/if}
		</section>
	{/if}
</div>

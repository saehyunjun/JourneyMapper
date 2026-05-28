<!--
	FragmentTagDrawer — right-hand drawer for confirming/editing one corpus
	fragment's codebook tags AND journey stages.

	Parallels SegmentTagDrawer (which is interview-shaped). Differences:
	  - Driven by a Fragment + FragmentAnnotation, not a TaggableSegment.
	  - Adds a Stages section that edits the `stages` annotation dimension
	    (multi-label { stage_id, step_id, confidence }[]).
	  - No edit-text / keyword-tag / phrase-link affordances — fragments are
	    deidentified and analyst rewrites are out of scope.
	  - Saves dispatch to the `saveFragmentAnnotation` form action on the
	    upload page; one POST per dirty dimension.
-->
<script lang="ts">
	import { fly, fade, slide } from 'svelte/transition';
	import { deserialize } from '$app/forms';
	import {
		DRAWER_PANEL_IN,
		DRAWER_PANEL_OUT,
		DRAWER_BACKDROP_IN,
		DRAWER_BACKDROP_OUT
	} from '$lib/motion/drawer';
	import codebook from '$lib/content/wctglpdemo-data/codebook.json';
	import { EMOTION_PICKER } from '$lib/journeymapper2/plutchikEmotionsConfig.js';
	import EmotionDyadChip from '$lib/components/EmotionDyadChip.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import StarIcon from '@lucide/svelte/icons/star';
	import { Button } from '$lib/components/ui/button/index.js';
	import KeywordText from '$lib/components/KeywordText.svelte';
	import KeywordTagDrawer from '$lib/components/KeywordTagDrawer.svelte';
	import type {
		InstanceKeywordTag,
		KeywordMatcher
	} from '$lib/content/wctglpdemo-data/keywords';
	import type { FragmentKeywordTag } from '$lib/server/fragment-keyword-tags';
	import type {
		Fragment,
		FragmentAnnotation,
		JourneySchema,
		SegmentTagsAnnotation,
		StagesAnnotation
	} from '$lib/content/corpora/types';
	import { XIcon, ChevronLeftIcon, ChevronRightIcon } from '@lucide/svelte';

	let {
		fragment = null,
		annotation = null,
		journey,
		corpusId,
		matcher,
		fragmentKeywordTags = [],
		starred = false,
		togglingStar = false,
		onToggleStar,
		onTagsChanged,
		onTextEdited,
		onclose,
		onsaved,
		siblings = [],
		onNavigate
	}: {
		fragment: Fragment | null;
		annotation: FragmentAnnotation | null;
		journey: JourneySchema | null;
		corpusId: string;
		/** Indication-scoped matcher for keyword highlighting in the fragment
		 *  quote. Optional; omitted callers get plain text. */
		matcher?: KeywordMatcher;
		/** All per-instance keyword tags currently attached to this fragment;
		 *  feeds the bolding overlay in the quote. */
		fragmentKeywordTags?: FragmentKeywordTag[];
		/** Whether this fragment is in the analyst's starred-highlight set. */
		starred?: boolean;
		/** True while the parent is mid-flight on a star toggle. */
		togglingStar?: boolean;
		/** Supplying this enables the star control inside the drawer header. */
		onToggleStar?: (fragmentId: string) => void;
		/** Fired after a successful tag/untag — caller refreshes its local cache. */
		onTagsChanged?: (tags: FragmentKeywordTag[]) => void;
		/** Fired after a successful edit-text — caller refreshes its local copy. */
		onTextEdited?: (newText: string) => void;
		onclose: () => void;
		onsaved: (a: FragmentAnnotation) => void;
		/** Sibling stack — all split-children of the same parent post, sorted by
		 *  char_start, including `fragment` itself. Empty / single-entry array =
		 *  no stack; nav controls hide. Parent computes this from corpus state. */
		siblings?: Fragment[];
		/** Called when prev/next/arrow-key navigates within the stack. Parent
		 *  swaps its openFragment binding to `target`. */
		onNavigate?: (target: Fragment) => void;
	} = $props();

	// === Right-click selection capture ========================================
	// Mirrors SegmentTagDrawer.captureSelection: snapshot both the highlighted
	// text AND the right-clicked keyword span at the moment the menu opens, so
	// later browser selection drift doesn't change what we operate on.
	let selectionText = $state('');
	let selectionStart = $state(-1);
	let selectionEnd = $state(-1);
	let fragmentTextEl = $state<HTMLElement | null>(null);
	let rightClickKeyword = $state<{
		id: string;
		label: string;
		surface: string;
		instance: { charStart: number; charEnd: number } | null;
	} | null>(null);

	// === Inline edit-selection state ==========================================
	let editingSelection = $state(false);
	let editFind = $state('');
	let editReplace = $state('');
	let editBusy = $state(false);
	let editError = $state('');

	// === Keyword drawer state =================================================
	let keywordDrawerOpen = $state(false);
	let keywordDrawerSelection = $state('');
	let keywordDrawerStart = $state(-1);
	let keywordDrawerEnd = $state(-1);
	let moveSourceKeyword = $state<{
		id: string;
		label: string;
		instance: { charStart: number; charEnd: number } | null;
	} | null>(null);
	let kwBusy = $state(false);
	let kwError = $state('');
	let kwSuccess = $state('');
	let kwFormResetSeq = $state(0);

	// Local copy of fragmentKeywordTags so an apply-and-close flow doesn't have
	// to wait on a parent re-render before re-deriving bolding.
	let localTags = $state<FragmentKeywordTag[]>([]);
	$effect(() => {
		localTags = [...fragmentKeywordTags];
	});

	const instanceTagsForRender = $derived.by((): InstanceKeywordTag[] => {
		return localTags.map((t) => ({
			start: t.char_start,
			end: t.char_end,
			keywordId: t.keyword_id
		}));
	});

	// === Codebook UI scaffolding (mirrors SegmentTagDrawer) ===================
	type CodebookTheme = {
		id: string;
		label?: string;
		description?: string;
		subthemes?: { id: string; label?: string; description?: string }[];
	};
	const codebookThemes = codebook.themes as CodebookTheme[];

	const emotionPrimaries = EMOTION_PICKER as Array<{
		id: string;
		label: string;
		color: string;
		levels: { id: string; intensity: string }[];
		dyads: { id: string; with: string }[];
	}>;
	const emotionDesc = new Map(
		(codebook.emotion_tags as { id: string; description: string }[]).map((e) => [e.id, e.description])
	);

	const sentimentScale = codebook.meta.sentiment_scale as Record<string, string>;
	const sentiments = [
		{ v: -2, color: '#e11d48' },
		{ v: -1, color: '#fb7185' },
		{ v: 0, color: '#94a3b8' },
		{ v: 1, color: '#34d399' },
		{ v: 2, color: '#059669' }
	];
	const sentimentLabel = (v: number) => {
		const raw = sentimentScale[String(v)] ?? '';
		return raw.charAt(0).toUpperCase() + raw.slice(1);
	};
	const titleCase = (id: string) => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

	// === Working state ========================================================
	// segment_tags dimension
	let subthemes = $state<string[]>([]);
	let emotions = $state<string[]>([]);
	let sentiment = $state(0);
	let note = $state('');
	// stages dimension
	type StageEntry = { stage_id: string; step_id: string; confidence: number };
	let stageEntries = $state<StageEntry[]>([]);
	let stagesOverall = $state(0.5);
	let stagesNote = $state('');

	let saving = $state(false);
	let errorMsg = $state('');
	let expandedThemes = $state<string[]>([]);
	let expandedEmotion = $state('');

	// Dirty tracking per dimension — only POST the ones that changed.
	type TagsSnapshot = {
		subthemes: string[];
		emotions: string[];
		sentiment: number;
		note: string;
	};
	type StagesSnapshot = {
		entries: StageEntry[];
		overall: number;
		note: string;
	};
	let tagsBaseline = $state<TagsSnapshot | null>(null);
	let stagesBaseline = $state<StagesSnapshot | null>(null);

	const tagsSnapshot = (): TagsSnapshot => ({
		subthemes: [...subthemes],
		emotions: [...emotions],
		sentiment,
		note
	});
	const stagesSnapshot = (): StagesSnapshot => ({
		entries: stageEntries.map((e) => ({ ...e })),
		overall: stagesOverall,
		note: stagesNote
	});
	const sameTags = (a: TagsSnapshot, b: TagsSnapshot) => {
		const sameList = (x: string[], y: string[]) =>
			x.length === y.length && x.every((v, i) => v === y[i]);
		return (
			a.sentiment === b.sentiment &&
			a.note === b.note &&
			sameList(a.subthemes, b.subthemes) &&
			sameList(a.emotions, b.emotions)
		);
	};
	const sameStages = (a: StagesSnapshot, b: StagesSnapshot) => {
		if (a.overall !== b.overall || a.note !== b.note) return false;
		if (a.entries.length !== b.entries.length) return false;
		for (let i = 0; i < a.entries.length; i++) {
			const x = a.entries[i];
			const y = b.entries[i];
			if (x.stage_id !== y.stage_id || x.step_id !== y.step_id || x.confidence !== y.confidence) {
				return false;
			}
		}
		return true;
	};

	const tagsDirty = $derived(tagsBaseline !== null && !sameTags(tagsSnapshot(), tagsBaseline));
	const stagesDirty = $derived(stagesBaseline !== null && !sameStages(stagesSnapshot(), stagesBaseline));
	const isDirty = $derived(tagsDirty || stagesDirty);

	// Re-seed working state every time a new fragment opens the drawer.
	let seededFor = $state('');
	$effect(() => {
		const id = fragment?.id ?? '';
		if (id && id !== seededFor) {
			seededFor = id;
			const st = annotation?.segment_tags;
			subthemes = st?.subthemes ? [...st.subthemes] : [];
			emotions = st?.emotions ? [...st.emotions] : [];
			sentiment = typeof st?.sentiment_score === 'number' ? st.sentiment_score : 0;
			note = st?.note ?? '';

			const stages = annotation?.stages;
			stageEntries = (stages?.values ?? []).map((v) => ({
				stage_id: v.stage_id,
				step_id: v.step_id ?? '',
				confidence: v.confidence ?? 0.5
			}));
			stagesOverall = stages?.overall_confidence ?? 0.5;
			stagesNote = stages?.note ?? '';

			errorMsg = '';
			// Open the codebook themes that already carry tags so AI proposals
			// don't sit in a collapsed accordion.
			expandedThemes = codebookThemes
				.filter((t) => (t.subthemes ?? []).some((s) => subthemes.includes(s.id)))
				.map((t) => t.id);
			expandedEmotion =
				emotionPrimaries.find(
					(p) =>
						p.levels.some((l) => emotions.includes(l.id)) ||
						p.dyads.some((d) => emotions.includes(d.id))
				)?.id ?? '';

			tagsBaseline = tagsSnapshot();
			stagesBaseline = stagesSnapshot();
		} else if (!id) {
			seededFor = '';
			tagsBaseline = null;
			stagesBaseline = null;
		}
	});

	// === Codebook mutations ===================================================
	function toggleSubtheme(id: string) {
		subthemes = subthemes.includes(id)
			? subthemes.filter((x) => x !== id)
			: [...subthemes, id];
	}
	function toggleEmotion(id: string) {
		emotions = emotions.includes(id)
			? emotions.filter((x) => x !== id)
			: [...emotions, id];
	}
	const toggleTheme = (id: string) =>
		(expandedThemes = expandedThemes.includes(id)
			? expandedThemes.filter((x) => x !== id)
			: [...expandedThemes, id]);
	const toggleEmotionFamily = (id: string) =>
		(expandedEmotion = expandedEmotion === id ? '' : id);

	// Count of selected subthemes inside a top-level codebook theme.
	const themeTagCount = (t: CodebookTheme) =>
		(t.subthemes ?? []).filter((s) => subthemes.includes(s.id)).length;
	// Count of selected emotions in one Plutchik family (levels + dyads).
	const emotionFamilyCount = (p: (typeof emotionPrimaries)[number]) => {
		let c = 0;
		for (const l of p.levels) if (emotions.includes(l.id)) c++;
		for (const d of p.dyads) if (emotions.includes(d.id)) c++;
		return c;
	};

	// === Stages mutations =====================================================
	function addStageEntry() {
		if (!journey || journey.stages.length === 0) return;
		stageEntries = [
			...stageEntries,
			{ stage_id: journey.stages[0].id, step_id: '', confidence: 0.7 }
		];
	}
	function removeStageEntry(idx: number) {
		stageEntries = stageEntries.filter((_, i) => i !== idx);
	}
	function updateStageEntry(idx: number, patch: Partial<StageEntry>) {
		stageEntries = stageEntries.map((e, i) => (i === idx ? { ...e, ...patch } : e));
	}
	function stepsFor(stageId: string) {
		return journey?.stages.find((s) => s.id === stageId)?.steps ?? [];
	}

	// === Save =================================================================
	async function postDimension(
		dimension: 'segment_tags' | 'stages',
		payload: unknown
	): Promise<FragmentAnnotation | null> {
		if (!fragment) return null;
		const fd = new FormData();
		fd.append('corpus_id', corpusId);
		fd.append('fragment_id', fragment.id);
		fd.append('dimension', dimension);
		fd.append('payload', JSON.stringify(payload));
		const res = await fetch('/patientlyiq/upload?/saveFragmentAnnotation', {
			method: 'POST',
			body: fd
		});
		const text = await res.text();
		const result = deserialize(text) as
			| { type: 'success'; data?: { annotation?: FragmentAnnotation; error?: string } }
			| { type: 'failure'; data?: { error?: string } }
			| { type: 'error'; error?: { message?: string } }
			| { type: 'redirect' };
		if (result.type === 'success' && result.data?.annotation) {
			return result.data.annotation;
		}
		if (result.type === 'failure') {
			errorMsg = result.data?.error ?? 'Save failed.';
		} else if (result.type === 'error') {
			errorMsg = result.error?.message ?? 'Server error.';
		}
		return null;
	}

	async function save() {
		if (!fragment || saving) return;
		saving = true;
		errorMsg = '';
		try {
			let latestAnnotation: FragmentAnnotation | null = null;

			if (tagsDirty) {
				const subthemeToParent = new Map<string, string>();
				for (const t of codebookThemes) {
					for (const s of t.subthemes ?? []) subthemeToParent.set(s.id, t.id);
				}
				const themesPayload = [
					...new Set(
						subthemes.map((s) => subthemeToParent.get(s)).filter((x): x is string => !!x)
					)
				];
				const payload: Partial<SegmentTagsAnnotation> = {
					themes: themesPayload,
					subthemes,
					emotions,
					sentiment_score: sentiment,
					note
				};
				const ann = await postDimension('segment_tags', payload);
				if (!ann) return;
				latestAnnotation = ann;
			}

			if (stagesDirty) {
				const payload: Partial<StagesAnnotation> & { overall_confidence?: number } = {
					values: stageEntries.map((e) => ({
						stage_id: e.stage_id,
						step_id: e.step_id || null,
						confidence: e.confidence
					})),
					overall_confidence: stagesOverall,
					note: stagesNote
				};
				const ann = await postDimension('stages', payload);
				if (!ann) return;
				latestAnnotation = ann;
			}

			if (latestAnnotation) {
				tagsBaseline = tagsSnapshot();
				stagesBaseline = stagesSnapshot();
				onsaved(latestAnnotation);
				onclose();
			} else if (!tagsDirty && !stagesDirty) {
				// Nothing to save — just close.
				onclose();
			}
		} catch (err) {
			errorMsg = `Save failed: ${(err as Error).message}`;
		} finally {
			saving = false;
		}
	}

	function tryClose() {
		if (isDirty && !confirm('Discard unsaved changes?')) return;
		onclose();
	}

	// === Sibling stack navigation =============================================
	// Split-children of a long forum post share source_ref.post_id +
	// comment_id; the parent computes `siblings` (sorted by char_start) and
	// passes it in. Navigation walks the same list, with a dirty-check so the
	// reviewer doesn't drop unsaved work by tabbing ahead.
	const siblingIndex = $derived.by(() => {
		if (!fragment || siblings.length === 0) return -1;
		return siblings.findIndex((s) => s.id === fragment.id);
	});
	const hasStack = $derived(siblings.length > 1 && siblingIndex >= 0);
	const prevSibling = $derived(hasStack && siblingIndex > 0 ? siblings[siblingIndex - 1] : null);
	const nextSibling = $derived(
		hasStack && siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : null
	);

	function navigateToSibling(target: Fragment | null) {
		if (!target || !onNavigate) return;
		if (isDirty && !confirm('Discard unsaved changes?')) return;
		onNavigate(target);
	}

	function onKeydown(e: KeyboardEvent) {
		if (!fragment) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			tryClose();
		} else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			void save();
		} else if (hasStack && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
			// Don't intercept arrow keys while the reviewer is editing text or
			// interacting with a form field — they expect cursor movement there.
			const t = e.target as HTMLElement | null;
			const tag = t?.tagName;
			if (
				tag === 'INPUT' ||
				tag === 'TEXTAREA' ||
				tag === 'SELECT' ||
				(t && (t as HTMLElement).isContentEditable)
			) {
				return;
			}
			e.preventDefault();
			navigateToSibling(e.key === 'ArrowLeft' ? prevSibling : nextSibling);
		}
	}

	const reviewBadge = $derived.by(() => {
		if (!annotation) return null;
		const st = annotation.segment_tags;
		const stages = annotation.stages;
		if (
			(st && (st.source === 'human' || st.review_status === 'human_confirmed')) &&
			(stages && (stages.source === 'human' || stages.review_status === 'human_confirmed'))
		) {
			return { label: 'confirmed', tone: 'emerald' as const };
		}
		if (st || stages) return { label: 'AI-proposed', tone: 'amber' as const };
		return null;
	});

	const sourceMeta = $derived.by(() => {
		const ref = fragment?.source_ref;
		if (!ref) return null;
		if (
			ref.kind === 'social_post' ||
			ref.kind === 'social_comment' ||
			ref.kind === 'forum_post' ||
			ref.kind === 'forum_comment' ||
			ref.kind === 'blog_post' ||
			ref.kind === 'blog_comment'
		) {
			return {
				platform: ref.platform,
				postId: ref.post_id,
				commentId: ref.comment_id ?? null,
				author: ref.author_handle_hash ?? null
			};
		}
		return null;
	});

	// Local text copy so inline edit-selection can update the rendered quote
	// optimistically; re-seeds when a different fragment opens the drawer.
	let currentText = $state('');
	$effect(() => {
		if (fragment?.id) currentText = fragment.text;
	});

	// === Selection capture ====================================================
	// Snapshot both the right-clicked keyword span (via data-* attrs that
	// KeywordText emits on bolded runs) AND the live window.getSelection so we
	// can operate on what the analyst pinned even if browser selection drifts.
	function captureSelection(e: MouseEvent) {
		const target = e.target as HTMLElement | null;
		const kwEl = target?.closest('[data-keyword-id]') as HTMLElement | null;
		if (kwEl) {
			const id = kwEl.getAttribute('data-keyword-id') ?? '';
			const label = kwEl.getAttribute('data-keyword-label') ?? id;
			const surface = kwEl.getAttribute('data-keyword-surface') ?? kwEl.textContent ?? '';
			const isInstance = kwEl.getAttribute('data-keyword-instance') === 'true';
			let instance: { charStart: number; charEnd: number } | null = null;
			if (isInstance) {
				const start = Number(kwEl.getAttribute('data-keyword-start'));
				const end = Number(kwEl.getAttribute('data-keyword-end'));
				if (Number.isFinite(start) && Number.isFinite(end)) {
					instance = { charStart: start, charEnd: end };
				}
			}
			rightClickKeyword = { id, label, surface, instance };
		} else {
			rightClickKeyword = null;
		}

		// Selection offsets are computed relative to the fragment text container.
		const sel = window.getSelection();
		if (!sel || sel.isCollapsed || !fragmentTextEl) {
			selectionText = '';
			selectionStart = -1;
			selectionEnd = -1;
			return;
		}
		const range = sel.getRangeAt(0);
		if (!fragmentTextEl.contains(range.commonAncestorContainer)) {
			selectionText = '';
			selectionStart = -1;
			selectionEnd = -1;
			return;
		}
		const startRange = range.cloneRange();
		startRange.selectNodeContents(fragmentTextEl);
		startRange.setEnd(range.startContainer, range.startOffset);
		const start = startRange.toString().length;
		const text = range.toString();
		const end = start + text.length;
		const trimmed = text.trim();
		const leading = text.length - text.trimStart().length;
		const trailing = text.length - text.trimEnd().length;
		selectionText = trimmed;
		selectionStart = trimmed ? start + leading : -1;
		selectionEnd = trimmed ? end - trailing : -1;
	}

	const hasSelection = $derived(selectionText.length > 0 && selectionStart >= 0);

	// === Edit-selection flow ==================================================
	function startEditSelection() {
		if (!selectionText) return;
		editFind = selectionText;
		editReplace = selectionText;
		editError = '';
		editingSelection = true;
	}
	function cancelEditSelection() {
		editingSelection = false;
		editFind = '';
		editReplace = '';
		editError = '';
	}
	async function applyEditSelection() {
		if (!fragment || editBusy) return;
		const replace = editReplace.replace(/\s+/g, ' ').trim();
		if (!replace || replace === editFind) {
			editError = 'Pick a different replacement.';
			return;
		}
		editBusy = true;
		editError = '';
		try {
			const fd = new FormData();
			fd.append('corpus_id', corpusId);
			fd.append('fragment_id', fragment.id);
			fd.append('find', editFind);
			fd.append('replace', replace);
			const res = await fetch('/patientlyiq/upload?/editFragmentText', {
				method: 'POST',
				body: fd
			});
			const text = await res.text();
			const result = deserialize(text) as
				| { type: 'success'; data?: { text?: string; error?: string } }
				| { type: 'failure'; data?: { error?: string } }
				| { type: 'error'; error?: { message?: string } }
				| { type: 'redirect' };
			if (result.type === 'success' && typeof result.data?.text === 'string') {
				currentText = result.data.text;
				onTextEdited?.(result.data.text);
				editingSelection = false;
				editFind = '';
				editReplace = '';
				return;
			}
			if (result.type === 'failure') editError = result.data?.error ?? 'Edit failed.';
			else if (result.type === 'error') editError = result.error?.message ?? 'Server error.';
		} catch (err) {
			editError = `Edit failed: ${(err as Error).message}`;
		} finally {
			editBusy = false;
		}
	}

	// === Keyword tagging flow =================================================
	function openKeywordDrawer() {
		if (!hasSelection) return;
		keywordDrawerSelection = selectionText;
		keywordDrawerStart = selectionStart;
		keywordDrawerEnd = selectionEnd;
		moveSourceKeyword = null;
		kwError = '';
		kwSuccess = '';
		keywordDrawerOpen = true;
	}
	function openMoveDrawer() {
		if (!rightClickKeyword) return;
		keywordDrawerSelection = rightClickKeyword.surface;
		if (rightClickKeyword.instance) {
			keywordDrawerStart = rightClickKeyword.instance.charStart;
			keywordDrawerEnd = rightClickKeyword.instance.charEnd;
		} else {
			keywordDrawerStart = -1;
			keywordDrawerEnd = -1;
		}
		moveSourceKeyword = {
			id: rightClickKeyword.id,
			label: rightClickKeyword.label,
			instance: rightClickKeyword.instance
		};
		kwError = '';
		kwSuccess = '';
		keywordDrawerOpen = true;
	}

	async function postTagAction(
		action: 'tag' | 'untag',
		body: {
			keywordId: string;
			charStart: number;
			charEnd: number;
			expectedSurface?: string;
		}
	): Promise<FragmentKeywordTag[] | null> {
		if (!fragment) return null;
		const fd = new FormData();
		fd.append('action', action);
		fd.append('corpus_id', corpusId);
		fd.append('fragment_id', fragment.id);
		fd.append('keyword_id', body.keywordId);
		fd.append('char_start', String(body.charStart));
		fd.append('char_end', String(body.charEnd));
		if (body.expectedSurface !== undefined) {
			fd.append('expected_surface', body.expectedSurface);
		}
		const res = await fetch('/patientlyiq/upload?/saveFragmentKeywordTag', {
			method: 'POST',
			body: fd
		});
		const text = await res.text();
		const result = deserialize(text) as
			| { type: 'success'; data?: { tags?: FragmentKeywordTag[]; error?: string } }
			| { type: 'failure'; data?: { error?: string } }
			| { type: 'error'; error?: { message?: string } }
			| { type: 'redirect' };
		if (result.type === 'success' && Array.isArray(result.data?.tags)) {
			return result.data.tags;
		}
		if (result.type === 'failure') kwError = result.data?.error ?? 'Save failed.';
		else if (result.type === 'error') kwError = result.error?.message ?? 'Server error.';
		return null;
	}

	async function applyKeywordTag(keywordId: string) {
		if (!fragment || kwBusy) return;
		if (keywordDrawerStart < 0 || keywordDrawerEnd <= keywordDrawerStart) {
			kwError = 'Lost selection — re-highlight the phrase.';
			return;
		}
		kwBusy = true;
		kwError = '';
		try {
			// Move mode: untag the source span first, then tag the new cluster.
			if (moveSourceKeyword?.instance) {
				const untagged = await postTagAction('untag', {
					keywordId: moveSourceKeyword.id,
					charStart: moveSourceKeyword.instance.charStart,
					charEnd: moveSourceKeyword.instance.charEnd
				});
				if (!untagged) return;
				localTags = untagged;
			}
			const tagged = await postTagAction('tag', {
				keywordId,
				charStart: keywordDrawerStart,
				charEnd: keywordDrawerEnd,
				expectedSurface: keywordDrawerSelection
			});
			if (!tagged) return;
			localTags = tagged;
			onTagsChanged?.(tagged);
			kwSuccess = moveSourceKeyword ? 'Keyword moved.' : 'Keyword tagged.';
			moveSourceKeyword = null;
			keywordDrawerOpen = false;
		} finally {
			kwBusy = false;
		}
	}

	async function applyUnlinkClicked() {
		if (!fragment || !rightClickKeyword?.instance) return;
		kwError = '';
		const tags = await postTagAction('untag', {
			keywordId: rightClickKeyword.id,
			charStart: rightClickKeyword.instance.charStart,
			charEnd: rightClickKeyword.instance.charEnd
		});
		if (tags) {
			localTags = tags;
			onTagsChanged?.(tags);
		}
		rightClickKeyword = null;
	}

	function closeKeywordDrawer() {
		keywordDrawerOpen = false;
		moveSourceKeyword = null;
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet sectionHead(title: string, hint: string)}
	<div class="mb-2">
		<p class="text-xs font-semibold tracking-wide text-slate-700">{title}</p>
		<p class="text-[11px] leading-snug text-slate-400">{hint}</p>
	</div>
{/snippet}

{#snippet subLabel(text: string)}
	<p class="mb-1.5 text-[11px] font-medium tracking-wide text-slate-400 uppercase">{text}</p>
{/snippet}

{#if fragment}
	<div
		class="fixed inset-0 z-40 bg-slate-900/30"
		in:fade={DRAWER_BACKDROP_IN}
		out:fade={DRAWER_BACKDROP_OUT}
		onclick={(e) => {
			if (e.target === e.currentTarget) tryClose();
		}}
		aria-hidden="true"
	></div>

	<aside
		class="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl lg:max-w-4xl xl:max-w-5xl"
		in:fly={DRAWER_PANEL_IN}
		out:fly={DRAWER_PANEL_OUT}
		aria-label="Edit fragment tags"
	>
		<!-- Header -->
		<div class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
			<div class="min-w-0">
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
					Edit fragment tags
				</p>
				<p class="truncate font-mono text-xs text-slate-400">{fragment.id}</p>
				{#if sourceMeta}
					<p class="mt-2 text-[11px] leading-snug text-muted-foreground">
						{sourceMeta.platform} ·
						<span class="font-mono">{sourceMeta.postId}{sourceMeta.commentId ? ` / ${sourceMeta.commentId}` : ''}</span>
						{#if sourceMeta.author}
							· {sourceMeta.author}
						{/if}
					</p>
				{/if}
				{#if hasStack}
					<div
						class="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"
						aria-label="Sibling sentence navigation"
					>
						<Button
							variant="outline"
							size="icon-sm"
							class="h-6 w-6"
							onclick={() => navigateToSibling(prevSibling)}
							disabled={prevSibling === null}
							aria-label="Previous sibling sentence"
							title="Previous sentence (←)"
						>
							<ChevronLeftIcon size={14} />
						</Button>
						<span class="tabular-nums">
							Sentence {siblingIndex + 1} of {siblings.length}
						</span>
						<Button
							variant="outline"
							size="icon-sm"
							class="h-6 w-6"
							onclick={() => navigateToSibling(nextSibling)}
							disabled={nextSibling === null}
							aria-label="Next sibling sentence"
							title="Next sentence (→)"
						>
							<ChevronRightIcon size={14} />
						</Button>
					</div>
				{/if}
			</div>
			<div class="flex shrink-0 items-center gap-2">
				{#if errorMsg}<span class="text-xs text-rose-600">{errorMsg}</span>{/if}
				{#if onToggleStar}
					<Button
						variant="ghost"
						size="icon-sm"
						onclick={() => fragment && onToggleStar?.(fragment.id)}
						disabled={togglingStar}
						aria-pressed={starred}
						title={starred ? 'Starred — click to unstar' : 'Star this fragment'}
						class={starred ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'}
					>
						<StarIcon size={18} fill={starred ? 'currentColor' : 'none'} />
					</Button>
				{/if}
				<Button variant="secondary" onclick={save} disabled={saving || !isDirty}>
					{saving ? 'Saving…' : 'Save tags'}
				</Button>
				<Button variant="outline" size="icon-sm" onclick={tryClose} aria-label="Close">
					<XIcon />
				</Button>
			</div>
		</div>

		<Tooltip.Provider delayDuration={120}>
			<div class="flex flex-1 flex-col overflow-hidden">
				<!-- TOP — fragment text + metadata. Wrapped in a ContextMenu so the
					 analyst can right-click to tag/edit/unlink, mirroring the
					 interview SegmentTagDrawer. -->
				<div class="shrink-0 border-b border-slate-200 p-5">
					<ContextMenu.Root>
						<ContextMenu.Trigger>
							{#snippet child({ props })}
								<p
									{...props}
									bind:this={fragmentTextEl}
									oncontextmenu={(e: MouseEvent) => {
										captureSelection(e);
										(props.oncontextmenu as ((e: MouseEvent) => void) | undefined)?.(e);
									}}
									class="cursor-text border-l-2 border-accent-mint px-4 text-lg leading-snug text-primary select-text whitespace-pre-wrap"
								>
									<KeywordText text={currentText} {matcher} instanceTags={instanceTagsForRender} />
								</p>
							{/snippet}
						</ContextMenu.Trigger>
						<ContextMenu.Content class="w-72">
							{#if rightClickKeyword}
								<ContextMenu.Label>
									Linked:
									<span class="font-medium text-slate-700">"{rightClickKeyword.surface}"</span>
									→
									<span class="font-medium text-slate-700">{rightClickKeyword.label}</span>
								</ContextMenu.Label>
								<ContextMenu.Separator />
								<ContextMenu.Item onSelect={() => applyUnlinkClicked()}>
									Unlink this occurrence
								</ContextMenu.Item>
								<ContextMenu.Item onSelect={() => openMoveDrawer()}>
									Move to another keyword…
								</ContextMenu.Item>
								{#if hasSelection}
									<ContextMenu.Separator />
								{/if}
							{/if}
							{#if hasSelection}
								<ContextMenu.Label>
									<span class="font-medium text-slate-700">"{selectionText}"</span>
								</ContextMenu.Label>
								<ContextMenu.Separator />
								<ContextMenu.Item onSelect={startEditSelection}>
									Edit selection…
								</ContextMenu.Item>
								<ContextMenu.Item onSelect={openKeywordDrawer}>
									Tag as keyword…
								</ContextMenu.Item>
							{/if}
							{#if !hasSelection && !rightClickKeyword}
								<ContextMenu.Label>
									Select a phrase in the fragment, or right-click a
									<span class="font-semibold">bold</span> keyword to manage its tag.
								</ContextMenu.Label>
							{/if}
						</ContextMenu.Content>
					</ContextMenu.Root>

					<!-- Inline editor — replaces the highlighted phrase in fragment.text
						 when the reviewer chose "Edit selection" from the menu. -->
					{#if editingSelection}
						<div
							class="mt-3 rounded-md border border-accent-mint/40 bg-accent-mint/5 p-3"
							transition:slide={{ duration: 180 }}
						>
							<p class="mb-2 text-xs text-slate-500">
								Replacing
								<span class="font-medium text-slate-700">"{editFind}"</span>
								with:
							</p>
							<textarea
								bind:value={editReplace}
								rows="2"
								class="mb-2 w-full resize-y rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
							></textarea>
							{#if editError}
								<p class="mb-2 text-xs text-rose-600">{editError}</p>
							{/if}
							<div class="flex justify-end gap-2">
								<Button
									variant="ghost"
									size="xs"
									onclick={cancelEditSelection}
									disabled={editBusy}
								>
									Cancel
								</Button>
								<Button
									variant="secondary"
									size="xs"
									onclick={applyEditSelection}
									disabled={editBusy || !editReplace.trim() || editReplace.trim() === editFind}
								>
									{editBusy ? 'Saving…' : 'Apply edit'}
								</Button>
							</div>
						</div>
					{/if}

					<div class="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
						<span>{currentText.length.toLocaleString()} chars</span>
						<span>·</span>
						<span>{new Date(fragment.date_observed).toLocaleString()}</span>
						{#if fragment.weight_base != null}
							<span>·</span>
							<span>weight {fragment.weight_base}</span>
						{/if}
					</div>
				</div>

				<!-- BELOW — codebook column + stages column -->
				<div class="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
					<!-- LEFT — sentiment, emotions, themes, note -->
					<div
						class="flex shrink-0 flex-col gap-5 border-b border-slate-200 p-5
						md:w-[26rem] md:overflow-y-auto md:border-r md:border-b-0"
					>
						<section>
							{@render sectionHead(
								'Sentiment',
								'How positive or negative the fragment reads overall.'
							)}
							<div class="flex">
								{#each sentiments as s (s.v)}
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<button
													{...props}
													type="button"
													onclick={() => (sentiment = s.v)}
													aria-pressed={sentiment === s.v}
													aria-label={sentimentLabel(s.v)}
													class="h-7 hover:cursor-pointer flex-1 border transition-all
													{sentiment === s.v
														? 'ring-2 ring-primary ring-offset-1'
														: 'opacity-40 hover:opacity-75'}"
													style="background-color: {s.color}; border-color: {s.color}"
												></button>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content>{sentimentLabel(s.v)}</Tooltip.Content>
									</Tooltip.Root>
								{/each}
							</div>
						</section>

						<section>
							{@render sectionHead(
								'Emotions',
								'What the speaker is expressing. Pick a primary, then an intensity or a blend.'
							)}
							{#if emotions.length}
								<div class="mb-2 flex flex-wrap gap-1.5">
									{#each emotions as e (e)}
										<button
											type="button"
											title={emotionDesc.get(e) ?? ''}
											onclick={() => toggleEmotion(e)}
											class="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"
										>
											<EmotionDyadChip id={e} showLabel={false} />
											{titleCase(e)}<span class="opacity-70">✕</span>
										</button>
									{/each}
								</div>
							{/if}
							<div class="flex flex-wrap gap-1.5">
								{#each emotionPrimaries as p (p.id)}
									{@const cnt = emotionFamilyCount(p)}
									<button
										type="button"
										onclick={() => toggleEmotionFamily(p.id)}
										aria-expanded={expandedEmotion === p.id}
										class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors
										{expandedEmotion === p.id
											? 'border-slate-700 bg-slate-100 text-slate-800'
											: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}"
									>
										<span class="size-2 rounded-full" style="background-color: {p.color}"></span>
										{p.label}
										{#if cnt}
											<span
												class="rounded-full bg-slate-700 px-1 text-[10px] leading-tight text-white"
												>{cnt}</span
											>
										{/if}
									</button>
								{/each}
							</div>
							{#each emotionPrimaries as p (p.id)}
								{#if expandedEmotion === p.id}
									<div
										class="mt-2 rounded-md bg-slate-50 p-2.5"
										transition:slide={{ duration: 180 }}
									>
										{@render subLabel('Intensity')}
										<div class="flex flex-wrap gap-1.5">
											{#each p.levels as lvl (lvl.id)}
												{@const on = emotions.includes(lvl.id)}
												<button
													type="button"
													title={emotionDesc.get(lvl.id) ?? ''}
													onclick={() => toggleEmotion(lvl.id)}
													aria-pressed={on}
													class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors
													{on
														? 'border-slate-700 bg-slate-100 text-slate-800'
														: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}"
												>
													<EmotionDyadChip id={lvl.id} showLabel={false} />
													{titleCase(lvl.id)}
												</button>
											{/each}
										</div>
										{#if p.dyads.length}
											<div class="mt-2.5">
												{@render subLabel('Blends with another emotion')}
												<div class="flex flex-wrap gap-1.5">
													{#each p.dyads as d (d.id)}
														{@const on = emotions.includes(d.id)}
														<Tooltip.Root>
															<Tooltip.Trigger>
																{#snippet child({ props })}
																	<button
																		{...props}
																		type="button"
																		onclick={() => toggleEmotion(d.id)}
																		aria-pressed={on}
																		class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors
																		{on
																			? 'border-slate-700 bg-slate-100 text-slate-800'
																			: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}"
																	>
																		<EmotionDyadChip id={d.id} showLabel={false} />
																		{titleCase(d.id)}
																	</button>
																{/snippet}
															</Tooltip.Trigger>
															<Tooltip.Content>+ {titleCase(d.with)}</Tooltip.Content>
														</Tooltip.Root>
													{/each}
												</div>
											</div>
										{/if}
									</div>
								{/if}
							{/each}
						</section>

						<section>
							{@render sectionHead(
								'Themes',
								'What the fragment is about. Open a theme to pick subthemes.'
							)}
							<div class="flex flex-col gap-1.5">
								{#each codebookThemes as t (t.id)}
									{@const open = expandedThemes.includes(t.id)}
									{@const cnt = themeTagCount(t)}
									<div class="overflow-hidden rounded-md border border-slate-200">
										<button
											type="button"
											onclick={() => toggleTheme(t.id)}
											aria-expanded={open}
											class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:cursor-pointer hover:bg-slate-50"
										>
											<span class="min-w-0">
												<span class="text-sm font-medium text-slate-700">
													{t.label ?? titleCase(t.id)}
												</span>
												<span class="block truncate text-[11px] text-slate-400">
													{t.description ?? ''}
												</span>
											</span>
											<span class="flex shrink-0 items-center gap-2">
												{#if cnt}
													<span
														class="rounded-full bg-accent-mint px-1.5 py-0.5 text-[11px] font-medium text-white"
													>
														{cnt}
													</span>
												{/if}
												<span class="text-slate-400">{open ? '▾' : '▸'}</span>
											</span>
										</button>
										{#if open && (t.subthemes ?? []).length}
											<div class="border-t border-slate-100 p-3" transition:slide={{ duration: 180 }}>
												<div class="flex flex-wrap gap-1.5">
													{#each t.subthemes ?? [] as sub (sub.id)}
														{@const on = subthemes.includes(sub.id)}
														<Button
															variant="outline"
															size="xs"
															title={sub.description ?? ''}
															onclick={() => toggleSubtheme(sub.id)}
															pressed={on}
															activeClass="border-accent-mint bg-accent-mint/15 text-accent-mint"
														>
															{sub.label ?? titleCase(sub.id)}
														</Button>
													{/each}
												</div>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</section>

						<section>
							{@render sectionHead(
								'Reviewer note',
								'Optional context for the next reviewer.'
							)}
							<textarea
								bind:value={note}
								rows="3"
								placeholder="Optional note"
								class="w-full resize-y rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700"
							></textarea>
						</section>
					</div>

					<!-- RIGHT — journey stages -->
					<div class="flex flex-1 flex-col gap-5 p-5 md:overflow-y-auto">
						<section>
							{@render sectionHead(
								'Journey stages',
								'Where the fragment sits in the patient journey. Multi-label — add a row for each stage it touches.'
							)}
							{#if !journey}
								<p class="text-xs text-amber-600">
									No journey schema for this corpus's indication. Stages cannot be edited here.
								</p>
							{:else}
								<div class="flex flex-col gap-2">
									{#each stageEntries as entry, idx (idx)}
										<div class="rounded-md border border-slate-200 bg-white p-3">
											<div class="mb-2 flex items-center gap-2">
												<select
													value={entry.stage_id}
													onchange={(e) =>
														updateStageEntry(idx, {
															stage_id: (e.currentTarget as HTMLSelectElement).value,
															step_id: ''
														})}
													class="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
												>
													{#each journey.stages as s (s.id)}
														<option value={s.id}>{s.order}. {s.label}</option>
													{/each}
												</select>
												<select
													value={entry.step_id}
													onchange={(e) =>
														updateStageEntry(idx, {
															step_id: (e.currentTarget as HTMLSelectElement).value
														})}
													class="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
												>
													<option value="">— no specific step —</option>
													{#each stepsFor(entry.stage_id) as step (step.id)}
														<option value={step.id}>{step.label}</option>
													{/each}
												</select>
												<Button
													variant="ghost"
													size="icon-sm"
													onclick={() => removeStageEntry(idx)}
													aria-label="Remove stage"
													title="Remove this stage entry"
												>
													<TrashIcon />
												</Button>
											</div>
											<div class="flex items-center gap-2">
												<span class="text-[11px] uppercase tracking-wide text-slate-400">
													Confidence
												</span>
												<input
													type="range"
													min="0"
													max="1"
													step="0.05"
													value={entry.confidence}
													oninput={(e) =>
														updateStageEntry(idx, {
															confidence: Number((e.currentTarget as HTMLInputElement).value)
														})}
													class="flex-1"
												/>
												<span class="w-10 text-right font-mono text-[11px] text-slate-600">
													{entry.confidence.toFixed(2)}
												</span>
											</div>
										</div>
									{/each}
									<Button variant="outline" size="sm" onclick={addStageEntry}>
										<PlusIcon />
										Add stage
									</Button>
								</div>

								<div class="mt-4 flex flex-col gap-2 rounded-md bg-slate-50 p-3">
									<div class="flex items-center gap-2">
										<span class="text-[11px] uppercase tracking-wide text-slate-400">
											Overall confidence
										</span>
										<input
											type="range"
											min="0"
											max="1"
											step="0.05"
											bind:value={stagesOverall}
											class="flex-1"
										/>
										<span class="w-10 text-right font-mono text-[11px] text-slate-600">
											{stagesOverall.toFixed(2)}
										</span>
									</div>
									<textarea
										bind:value={stagesNote}
										rows="2"
										placeholder="Optional note about the stage tagging"
										class="w-full resize-y rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700"
									></textarea>
								</div>
							{/if}
						</section>
					</div>
				</div>
			</div>
		</Tooltip.Provider>

		<!-- Footer — provenance + a quick dirty indicator -->
		<div
			class="flex flex-row items-center justify-between bg-secondary p-2 font-mono text-xs text-muted-foreground"
		>
			<div class="flex flex-row gap-4">
				{#if fragment.content_source}
					<span class="text-accent-mint">{fragment.content_source}</span>
				{/if}
				{#if tagsDirty}<span class="text-amber-600">tags dirty</span>{/if}
				{#if stagesDirty}<span class="text-amber-600">stages dirty</span>{/if}
			</div>
			{#if reviewBadge}
				<span class="rounded-full bg-{reviewBadge.tone}-100 px-1.5 py-0.5 text-{reviewBadge.tone}-700">
					{reviewBadge.label}
				</span>
			{:else}
				<span class="rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-500">untagged</span>
			{/if}
		</div>
	</aside>

	<!-- Tertiary drawer: KeywordTagDrawer for "Tag as keyword" / "Move to
		 another keyword" flows. Reuses the segment-side component as-is — its
		 props are generic (selection text + categories + callbacks). -->
	{#if matcher}
		<KeywordTagDrawer
			open={keywordDrawerOpen}
			selection={keywordDrawerSelection}
			categories={matcher.categories}
			currentKeyword={moveSourceKeyword
				? { id: moveSourceKeyword.id, label: moveSourceKeyword.label }
				: null}
			busy={kwBusy}
			errorMsg={kwError}
			successMsg={kwSuccess}
			formResetSeq={kwFormResetSeq}
			ontag={(keywordId: string) => applyKeywordTag(keywordId)}
			oncreate={() => {
				// Creating new clusters from the drawer is an interview-side
				// affordance — for now, fragment tagging restricts to existing
				// clusters. A follow-up could thread an "add cluster" flow that
				// writes into the active lexicon slice.
				kwError = 'Create new clusters from the interview tagger for now.';
			}}
			onclose={closeKeywordDrawer}
		/>
	{/if}
{/if}

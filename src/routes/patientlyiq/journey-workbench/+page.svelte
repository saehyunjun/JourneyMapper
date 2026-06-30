<!--
	Journey Workbench — persona-driven view over the fragment corpus pool.

	Indication-scoped: only personas + corpora applicable to the app's active
	indication (data.slice.active_indication, sourced from the patientlyiq
	layout) are shown.

	Filter chips above the beeswarm narrow the matched set further on
	sentiment / stage / subtheme / speaker-role axes. Each chip composes AND
	with the persona filter and other active chips.

	Click a dot (or a sample-fragment row) → opens the primary RightDrawer
	with the fragment, full annotations, speaker profile, and the rest of
	that speaker's voice in this corpus.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { Accordion } from 'bits-ui';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { fragmentMatchesPersona } from '$lib/content/personas/evaluate';
	import { fragmentParticipantAvatarUrl } from '$lib/dicebear-avatars';
	import { Button } from '$lib/components/ui/button/index.js';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import GroupStatsDrawer from '$lib/components/GroupStatsDrawer.svelte';
	import { countWords } from '$lib/content/wctglpdemo-data/word-tokenize';
	import { SENTIMENT_LABELS, titleCase } from '$lib/content/wctglpdemo-data/analysis';
	import type { Fragment } from '$lib/content/corpora/types';
	import type { GroupStats } from '$lib/types/group-stats';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Active indication from the patientlyiq layout. Falls back if the layout
	// data isn't populated (test contexts, broken builds).
	type SliceLike = { active_indication?: string };
	const activeIndication = $derived(
		(data as unknown as { slice?: SliceLike }).slice?.active_indication ?? 'obesity'
	);

	// === Persona / corpus scoping to the app indication ======================

	const visiblePersonas = $derived(
		data.personas.filter((p) => p.applicable_indications.includes(activeIndication as never))
	);
	const visibleCorpora = $derived(
		data.corpora.filter((c) => c.manifest.indications.includes(activeIndication as never))
	);

	// Default to the broadest "_all_voices" persona within the active indication
	// if one exists; otherwise the first visible persona.
	let selectedId = $state<string>(
		untrack(() => {
			const visibleIds = data.personas
				.filter((p) => {
					const ind = (data as unknown as { slice?: SliceLike }).slice?.active_indication;
					return ind ? p.applicable_indications.includes(ind as never) : true;
				})
				.map((p) => p.id);
			const broad = visibleIds.find((id) => id.endsWith('_all_voices'));
			return broad ?? visibleIds[0] ?? '';
		})
	);

	// If the indication changes and the current selection no longer applies,
	// auto-switch to a compatible persona.
	$effect(() => {
		if (!visiblePersonas.find((p) => p.id === selectedId)) {
			const broad = visiblePersonas.find((p) => p.id.endsWith('_all_voices'));
			selectedId = broad?.id ?? visiblePersonas[0]?.id ?? '';
		}
	});

	let colorBy = $state<'participant' | 'sentiment' | 'persona'>('participant');
	let tooltip = $state<{ dotIdx: number; x: number; y: number } | null>(null);

	const selected = $derived(visiblePersonas.find((p) => p.id === selectedId) ?? null);

	// Active corpus is the first visible-and-compatible corpus for the selected
	// persona (visible = matches active indication).
	const activeCorpus = $derived.by(() => {
		if (selected && selected.applicable_indications.length > 0) {
			const c = visibleCorpora.find((c) =>
				selected.applicable_indications.some((ind) => c.manifest.indications.includes(ind))
			);
			if (c) return c;
		}
		return visibleCorpora[0] ?? null;
	});

	const activeFragments = $derived(activeCorpus?.fragments ?? []);
	const activeAnnotations = $derived(activeCorpus?.annotations ?? {});
	const activeJourney = $derived.by(() => {
		const ind = activeCorpus?.manifest.indications[0];
		return ind ? (data.journeys[ind] ?? null) : null;
	});
	const activeProfiles = $derived(
		activeCorpus ? (data.profilesByCorpus[activeCorpus.manifest.id] ?? {}) : {}
	);

	// Persona-matched fragments (before chip filtering).
	const matched = $derived(
		selected
			? activeFragments.filter((f) => fragmentMatchesPersona(f, selected, activeAnnotations))
			: []
	);

	// === Filter chips ========================================================

	let activeStageFilters = $state<Set<string>>(new Set());
	let activeSubthemeFilters = $state<Set<string>>(new Set());
	let activeSentimentFilters = $state<Set<number>>(new Set());
	let activeRoleFilters = $state<Set<string>>(new Set());

	const anyFilterActive = $derived(
		activeStageFilters.size +
			activeSubthemeFilters.size +
			activeSentimentFilters.size +
			activeRoleFilters.size >
			0
	);

	function toggleStage(id: string) {
		const next = new Set(activeStageFilters);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		activeStageFilters = next;
	}
	function toggleSubtheme(id: string) {
		const next = new Set(activeSubthemeFilters);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		activeSubthemeFilters = next;
	}
	function toggleSentiment(n: number) {
		const next = new Set(activeSentimentFilters);
		if (next.has(n)) next.delete(n);
		else next.add(n);
		activeSentimentFilters = next;
	}
	function toggleRole(r: string) {
		const next = new Set(activeRoleFilters);
		if (next.has(r)) next.delete(r);
		else next.add(r);
		activeRoleFilters = next;
	}
	function clearAllFilters() {
		activeStageFilters = new Set();
		activeSubthemeFilters = new Set();
		activeSentimentFilters = new Set();
		activeRoleFilters = new Set();
	}

	// Reset chips when persona / indication changes — stale chips from another
	// scope confuse more than they help.
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		selectedId;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		activeIndication;
		untrack(() => clearAllFilters());
	});

	// Filter chip OPTIONS — derive from the persona-matched set so we only show
	// chips that have at least one fragment behind them.
	const subthemeOptions = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const f of matched) {
			const sub = activeAnnotations[f.id]?.segment_tags?.subthemes ?? [];
			for (const s of sub) counts[s] = (counts[s] ?? 0) + 1;
		}
		return Object.entries(counts).sort((a, b) => b[1] - a[1]);
	});
	const stageOptions = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const f of matched) {
			const stages = activeAnnotations[f.id]?.stages?.values ?? [];
			for (const s of stages) counts[s.stage_id] = (counts[s.stage_id] ?? 0) + 1;
		}
		// Order by journey order, not by frequency, so chips read chronologically.
		const order = (activeJourney?.stages ?? []).map((s) => s.id);
		return order
			.filter((id) => counts[id] > 0)
			.map((id) => [id, counts[id]] as [string, number]);
	});
	const sentimentOptions = $derived.by(() => {
		const counts: Record<number, number> = {};
		for (const f of matched) {
			const s = activeAnnotations[f.id]?.segment_tags?.sentiment_score;
			if (typeof s === 'number') counts[s] = (counts[s] ?? 0) + 1;
		}
		return [-2, -1, 0, 1, 2].filter((n) => counts[n] > 0).map((n) => [n, counts[n]] as [number, number]);
	});
	const roleOptions = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const f of matched) {
			const r = f.speaker_attrs?.role?.value ?? '(unknown)';
			counts[r] = (counts[r] ?? 0) + 1;
		}
		return Object.entries(counts).sort((a, b) => b[1] - a[1]);
	});

	// Apply chip filters on top of persona-matched.
	const filteredMatched = $derived.by(() => {
		if (!anyFilterActive) return matched;
		return matched.filter((f) => {
			const ann = activeAnnotations[f.id];
			if (activeStageFilters.size > 0) {
				const stageIds = (ann?.stages?.values ?? []).map((s) => s.stage_id);
				if (!stageIds.some((id) => activeStageFilters.has(id))) return false;
			}
			if (activeSubthemeFilters.size > 0) {
				const subs = ann?.segment_tags?.subthemes ?? [];
				if (!subs.some((s) => activeSubthemeFilters.has(s))) return false;
			}
			if (activeSentimentFilters.size > 0) {
				const s = ann?.segment_tags?.sentiment_score;
				if (typeof s !== 'number' || !activeSentimentFilters.has(s)) return false;
			}
			if (activeRoleFilters.size > 0) {
				const r = f.speaker_attrs?.role?.value ?? '(unknown)';
				if (!activeRoleFilters.has(String(r))) return false;
			}
			return true;
		});
	});

	// === Helpers =============================================================

	function speakerIdOf(f: Fragment): string {
		const ref = f.source_ref;
		if (ref.kind === 'interview') return ref.interview_id;
		if (ref.kind === 'youtube_transcript' || ref.kind === 'podcast_transcript') {
			return ref.media_id;
		}
		if (ref.kind === 'search_query') return ref.source_dataset;
		return ref.author_handle_hash ?? '(unknown)';
	}
	function speakerLabel(f: Fragment): string {
		return speakerLabelById(speakerIdOf(f));
	}
	function speakerLabelById(id: string): string {
		const p = activeProfiles[id];
		if (p && (p.first_name || p.last_initial)) {
			const fn = p.first_name?.trim() ?? '';
			const li = p.last_initial?.trim() ?? '';
			return [fn, li ? `${li}.` : ''].filter(Boolean).join(' ');
		}
		// Mask raw corpus-derived speaker ids (e.g. "Anon_ms_reddit_2026q1_0002")
		// so source names like "reddit" don't leak into the UI. Fall back to the
		// trailing numeric suffix as an anonymous identifier.
		const m = id.match(/(\d{2,})\D*$/);
		return m ? `Anon ${m[1]}` : id;
	}
	function speakerInitials(id: string): string {
		const p = activeProfiles[id];
		const fn = p?.first_name?.trim();
		const li = p?.last_initial?.trim();
		if (fn && li) return (fn[0] + li[0]).toUpperCase();
		if (fn) return fn.slice(0, 2).toUpperCase();
		const m = id.match(/\d+/);
		return m ? m[0].slice(-2) : id.slice(0, 2).toUpperCase();
	}
	function fragmentLabel(f: Fragment): string {
		if (f.source_ref.kind === 'interview') return f.source_ref.interview_id;
		return speakerIdOf(f);
	}
	function getAnn(id: string) {
		return activeAnnotations[id];
	}

	// === Subtheme stats drawer ==============================================
	//
	// Same GroupStatsDrawer that the wctglpdemo lexicon-stats use elsewhere in
	// the app, but fed by stats computed live over the active corpus. Opens as
	// a tertiary panel above the primary fragment drawer.

	let subthemeStatsForId = $state<string | null>(null);
	const subthemeStats = $derived<GroupStats | null>(
		subthemeStatsForId ? computeSubthemeStats(subthemeStatsForId) : null
	);

	function speakerDisplayLabel(sid: string): string {
		const p = activeProfiles[sid];
		if (p && (p.first_name || p.last_initial)) {
			const fn = p.first_name?.trim() ?? '';
			const li = p.last_initial?.trim() ?? '';
			return [fn, li ? `${li}.` : ''].filter(Boolean).join(' ');
		}
		return sid;
	}

	function computeSubthemeStats(subthemeId: string): GroupStats {
		const matched = activeFragments.filter((f) =>
			(activeAnnotations[f.id]?.segment_tags?.subthemes ?? []).includes(subthemeId)
		);

		const sentiment = [-2, -1, 0, 1, 2].map((value) => ({
			value,
			label: SENTIMENT_LABELS[value],
			count: 0
		}));
		let sentSum = 0;
		let sentN = 0;
		const emoTally = new Map<string, number>();
		const themeTally = new Map<string, number>();
		const partTally = new Map<string, number>();
		const texts: string[] = [];

		for (const f of matched) {
			const tags = activeAnnotations[f.id]?.segment_tags;
			if (tags) {
				const s = tags.sentiment_score;
				if (s !== null && s !== undefined) {
					const slot = sentiment.find((c) => c.value === s);
					if (slot) slot.count++;
					sentSum += s;
					sentN++;
				}
				for (const e of tags.emotions) emoTally.set(e, (emoTally.get(e) ?? 0) + 1);
				for (const t of tags.themes) themeTally.set(t, (themeTally.get(t) ?? 0) + 1);
			}
			const sid = speakerIdOf(f);
			partTally.set(sid, (partTally.get(sid) ?? 0) + 1);
			texts.push(f.text);
		}

		return {
			kind: 'subtheme',
			id: subthemeId,
			label: titleCase(subthemeId.replace(/_/g, ' ')),
			context: activeCorpus?.manifest.label ?? 'Active corpus',
			invocations: matched.length,
			invocationUnit: matched.length === 1 ? 'tagged fragment' : 'tagged fragments',
			segmentCount: matched.length,
			participantCount: partTally.size,
			sentiment,
			avgSentiment: sentN > 0 ? sentSum / sentN : null,
			emotions: [...emoTally]
				.map(([id, count]) => ({ id, label: titleCase(id), count }))
				.sort((a, b) => b.count - a.count),
			relatedThemes: [...themeTally]
				.map(([id, count]) => ({ id, label: titleCase(id.replace(/_/g, ' ')), count }))
				.sort((a, b) => b.count - a.count),
			commonWords: countWords(texts).slice(0, 12),
			perParticipant: [...partTally]
				.map(([interviewId, count]) => ({
					interviewId,
					label: speakerDisplayLabel(interviewId),
					count
				}))
				.sort((a, b) => b.count - a.count)
		};
	}

	function openSubthemeStats(subthemeId: string) {
		subthemeStatsForId = subthemeId;
	}

	function closeSubthemeStats() {
		subthemeStatsForId = null;
	}

	// === Color schemes =======================================================

	const WCT_GLP1_PALETTE: Record<string, string> = {
		participant_06: '#6366f1',
		participant_07: '#f43f5e',
		participant_08: '#10b981',
		participant_09: '#f59e0b',
		participant_10: '#0ea5e9',
		participant_11: '#8b5cf6',
		participant_12: '#ec4899'
	};
	const FALLBACK_COLOR = '#64748b';
	function hashHue(s: string): number {
		let h = 0;
		for (let i = 0; i < s.length; i += 1) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
		return (h >>> 0) % 360;
	}
	function participantColor(speakerId: string): string {
		const fixed = WCT_GLP1_PALETTE[speakerId];
		if (fixed) return fixed;
		return `hsl(${hashHue(speakerId)}, 65%, 52%)`;
	}
	const SENTIMENT_PALETTE: Record<number, string> = {
		[-2]: '#dc2626',
		[-1]: '#f97316',
		0: '#94a3b8',
		1: '#84cc16',
		2: '#16a34a'
	};
	function colorFor(d: { speakerId: string; sentiment: number }): string {
		if (colorBy === 'participant') return participantColor(d.speakerId);
		if (colorBy === 'sentiment') return SENTIMENT_PALETTE[d.sentiment] ?? FALLBACK_COLOR;
		if (colorBy === 'persona') return selected?.color ?? FALLBACK_COLOR;
		return FALLBACK_COLOR;
	}

	// === Aggregations (now over filteredMatched) =============================

	const bySpeaker = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const f of filteredMatched) {
			const sid = speakerIdOf(f);
			counts[sid] = (counts[sid] ?? 0) + 1;
		}
		return counts;
	});

	const demographicCounts = $derived.by(() => {
		const counts: Record<string, Record<string, number>> = {};
		for (const f of filteredMatched) {
			for (const [attr, entry] of Object.entries(f.speaker_attrs ?? {})) {
				if (!entry) continue;
				const value = entry.value === null ? '(unknown)' : String(entry.value);
				if (!counts[attr]) counts[attr] = {};
				counts[attr][value] = (counts[attr][value] ?? 0) + 1;
			}
		}
		return counts;
	});

	const stageStats = $derived.by(() => {
		const counts: Record<string, number> = {};
		let tagged = 0;
		for (const f of filteredMatched) {
			const ann = activeAnnotations[f.id];
			const stages = ann?.stages?.values ?? [];
			if (stages.length === 0) continue;
			tagged += 1;
			for (const s of stages) counts[s.stage_id] = (counts[s.stage_id] ?? 0) + 1;
		}
		return { counts, tagged };
	});

	function sortedEntries<V>(obj: Record<string, V>): [string, V][] {
		return Object.entries(obj).sort((a, b) =>
			typeof a[1] === 'number' && typeof b[1] === 'number'
				? (b[1] as number) - (a[1] as number)
				: a[0].localeCompare(b[0])
		);
	}

	// === Beeswarm geometry ===================================================

	// Wider aspect than the surrounding text column. The chart section pulls
	// itself outside the page's max-w-6xl wrapper (see the markup below) and
	// renders this viewBox edge-to-edge of that wider container.
	const VIEWBOX_W = 1600;
	const VIEWBOX_H = 460;
	const M = { top: 24, right: 16, bottom: 116, left: 56 };
	const PLOT_W = VIEWBOX_W - M.left - M.right;
	const PLOT_H = VIEWBOX_H - M.top - M.bottom;
	const stages = $derived(activeJourney?.stages ?? []);
	const SENT_VALUES = [-2, -1, 0, 1, 2];

	type StageLayout = {
		stage_id: string;
		x_left: number;
		x_width: number;
		stepCenters: Record<string, number>;
		generalCenter: number;
		generalSubColWidth: number;
	};

	const stageLayout = $derived.by(() => {
		const layout: StageLayout[] = [];
		if (stages.length === 0) return layout;

		// Zoomed: only the focused stage is laid out. If a step is focused,
		// it gets the full stage width; other steps shift off-screen so their
		// dots animate out via the cx CSS transition + Svelte out:fade.
		if (zoomedStageId !== null) {
			const s = stages.find((x) => x.id === zoomedStageId);
			if (s) {
				const x_left = M.left;
				const x_width = PLOT_W;
				const stepCenters: Record<string, number> = {};
				let generalCenter: number;
				let generalSubColWidth: number;
				if (zoomedStepId !== null) {
					for (const st of s.steps) {
						stepCenters[st.id] = st.id === zoomedStepId ? M.left + PLOT_W / 2 : -3000;
					}
					generalCenter = -3000;
					generalSubColWidth = PLOT_W;
				} else {
					const subCols = s.steps.length + 1;
					const subW = PLOT_W / subCols;
					for (let k = 0; k < s.steps.length; k += 1) {
						stepCenters[s.steps[k].id] = x_left + (k + 0.5) * subW;
					}
					generalCenter = x_left + (s.steps.length + 0.5) * subW;
					generalSubColWidth = subW;
				}
				layout.push({
					stage_id: s.id,
					x_left,
					x_width,
					stepCenters,
					generalCenter,
					generalSubColWidth
				});
			}
			return layout;
		}

		const stageW = PLOT_W / stages.length;
		for (let i = 0; i < stages.length; i += 1) {
			const s = stages[i];
			const x_left = M.left + i * stageW;
			const subCols = s.steps.length + 1;
			const subW = stageW / subCols;
			const stepCenters: Record<string, number> = {};
			for (let k = 0; k < s.steps.length; k += 1) {
				stepCenters[s.steps[k].id] = x_left + (k + 0.5) * subW;
			}
			const generalCenter = x_left + (s.steps.length + 0.5) * subW;
			layout.push({
				stage_id: s.id,
				x_left,
				x_width: stageW,
				stepCenters,
				generalCenter,
				generalSubColWidth: subW
			});
		}
		return layout;
	});

	function hashf(s: string): number {
		let h = 0;
		for (let i = 0; i < s.length; i += 1) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
		return ((h >>> 0) % 1000) / 1000;
	}

	type Dot = {
		fragmentId: string;
		stageId: string;
		stepId: string | null;
		speakerId: string;
		sentiment: number;
		cx: number;
		cy: number;
	};

	const beeswarm = $derived.by(() => {
		if (stages.length === 0)
			return { dots: [] as Dot[], plotted: 0, dropped_no_sentiment: 0, dropped_no_stage: 0 };
		const sentH = PLOT_H / (SENT_VALUES.length - 1);
		const stageById: Record<string, StageLayout> = {};
		for (const sl of stageLayout) stageById[sl.stage_id] = sl;
		const stepStageMap: Record<string, string> = {};
		for (const s of stages) for (const st of s.steps) stepStageMap[st.id] = s.id;

		const dots: Dot[] = [];
		let dropped_no_sentiment = 0;
		let dropped_no_stage = 0;
		for (const f of filteredMatched) {
			const ann = activeAnnotations[f.id];
			const stageTags = ann?.stages?.values ?? [];
			const sentiment = ann?.segment_tags?.sentiment_score ?? null;
			if (stageTags.length === 0) {
				dropped_no_stage += 1;
				continue;
			}
			if (sentiment === null) {
				dropped_no_sentiment += 1;
				continue;
			}
			const sid = speakerIdOf(f);
			for (const s of stageTags) {
				// Zoom filter: when a stage is focused, only its dots render.
				// When a step is also focused, only dots tagged with that step
				// render. The result is that as the chart zooms, irrelevant
				// dots fade out via Svelte's out:fade.
				if (zoomedStageId !== null && s.stage_id !== zoomedStageId) continue;
				if (zoomedStepId !== null && s.step_id !== zoomedStepId) continue;
				const sl = stageById[s.stage_id];
				if (!sl) continue;
				const stepBelongsHere = s.step_id != null && stepStageMap[s.step_id] === s.stage_id;
				const baseX = stepBelongsHere ? sl.stepCenters[s.step_id!] : sl.generalCenter;
				const baseY = M.top + (SENT_VALUES[SENT_VALUES.length - 1] - sentiment) * sentH;
				const jitterX =
					(hashf(f.id + s.stage_id + (s.step_id ?? '')) - 0.5) * sl.generalSubColWidth * 0.65;
				const jitterY = (hashf(f.id + s.stage_id + 'y') - 0.5) * sentH * 0.55;
				dots.push({
					fragmentId: f.id,
					stageId: s.stage_id,
					stepId: stepBelongsHere ? s.step_id : null,
					speakerId: sid,
					sentiment,
					cx: baseX + jitterX,
					cy: baseY + jitterY
				});
			}
		}
		return { dots, plotted: dots.length, dropped_no_sentiment, dropped_no_stage };
	});

	const tooltipDot = $derived(tooltip ? (beeswarm.dots[tooltip.dotIdx] ?? null) : null);
	const tooltipFragment = $derived(
		tooltipDot ? (filteredMatched.find((f) => f.id === tooltipDot.fragmentId) ?? null) : null
	);

	const LEGEND_MAX_SPEAKERS = 14;
	const topSpeakers = $derived(
		sortedEntries(bySpeaker)
			.map(([id]) => id)
			.slice(0, LEGEND_MAX_SPEAKERS)
	);
	const extraSpeakerCount = $derived(
		Math.max(0, Object.keys(bySpeaker).length - LEGEND_MAX_SPEAKERS)
	);

	function onDotEnter(e: MouseEvent, idx: number) {
		tooltip = { dotIdx: idx, x: e.clientX, y: e.clientY };
		const d = beeswarm.dots[idx];
		if (d) setHover(d.stageId, d.stepId);
	}
	function onDotMove(e: MouseEvent, idx: number) {
		if (tooltip && tooltip.dotIdx === idx) tooltip = { dotIdx: idx, x: e.clientX, y: e.clientY };
	}
	function onDotLeave() {
		tooltip = null;
		queueClearHover();
	}

	// === Stage / step zoom ===================================================
	// Click → focus a stage (or step) so it fills the plot. Cleared when the
	// stage drawer closes. The layout math below honors these so the focused
	// column's x/width grows, and dots animate via CSS transitions on cx/cy.

	let zoomedStageId = $state<string | null>(null);
	let zoomedStepId = $state<string | null>(null);
	const isZoomed = $derived(zoomedStageId !== null);

	function clearZoom() {
		zoomedStageId = null;
		zoomedStepId = null;
	}

	// === Stage / step hover ==================================================
	// A small debounce on clearHover keeps the highlight stable when the
	// pointer crosses from a column hit-rect onto a dot inside that column
	// (both fire mouseleave/enter, but the new mouseenter cancels the pending
	// clear).

	let hoveredStageId = $state<string | null>(null);
	let hoveredStepId = $state<string | null>(null);
	let hoverClearTimer: ReturnType<typeof setTimeout> | null = null;

	// Column tooltip (named after the hovered stage / step). Suppressed when
	// the dot tooltip is showing, since they'd otherwise stack at the cursor.
	let columnTooltip = $state<{
		stageId: string;
		stepId: string | null;
		x: number;
		y: number;
	} | null>(null);

	function setHover(stageId: string, stepId: string | null) {
		if (hoverClearTimer) {
			clearTimeout(hoverClearTimer);
			hoverClearTimer = null;
		}
		hoveredStageId = stageId;
		hoveredStepId = stepId;
	}
	function setColumnTooltip(e: MouseEvent, stageId: string, stepId: string | null) {
		setHover(stageId, stepId);
		columnTooltip = { stageId, stepId, x: e.clientX, y: e.clientY };
	}
	function moveColumnTooltip(e: MouseEvent, stageId: string, stepId: string | null) {
		columnTooltip = { stageId, stepId, x: e.clientX, y: e.clientY };
	}
	function queueClearHover() {
		if (hoverClearTimer) clearTimeout(hoverClearTimer);
		hoverClearTimer = setTimeout(() => {
			hoveredStageId = null;
			hoveredStepId = null;
			hoverClearTimer = null;
			columnTooltip = null;
		}, 60);
	}

	function isDimmed(stageId: string, stepId: string | null): boolean {
		if (hoveredStageId === null) return false;
		if (hoveredStageId !== stageId) return true;
		if (hoveredStepId !== null && hoveredStepId !== stepId) return true;
		return false;
	}

	// === Drawer ==============================================================

	let drawerOpen = $state(false);
	let drawerFragmentId = $state<string | null>(null);

	// Stage/step drawer — opens when a stage or step column is clicked.
	let stageDrawerOpen = $state(false);
	let stageDrawerSelection = $state<{ stageId: string; stepId: string | null } | null>(null);

	function openStageDrawer(stageId: string, stepId: string | null) {
		// Drawer + matching zoom. Used by non-chart callers (the stats grid
		// row and the in-drawer step list) where a single click should open
		// the drawer directly.
		zoomedStageId = stageId;
		zoomedStepId = stepId;
		tooltip = null;
		columnTooltip = null;
		stageDrawerSelection = { stageId, stepId };
		stageDrawerOpen = true;
	}

	// Chart click handlers — two-step drill:
	//   - First click zooms (stage → stage-zoom, step → that step's stage).
	//   - Second click on a step (after the chart has zoomed to its stage)
	//     drills further AND opens the drawer.
	// Clicking the focused stage again is a zoom-out.
	function onChartStageClick(stageId: string) {
		if (zoomedStageId === stageId && zoomedStepId === null) {
			clearZoom();
		} else {
			zoomedStageId = stageId;
			zoomedStepId = null;
		}
		tooltip = null;
		columnTooltip = null;
	}
	function onChartStepClick(stageId: string, stepId: string) {
		if (zoomedStageId !== stageId) {
			zoomedStageId = stageId;
			zoomedStepId = null;
		} else {
			zoomedStepId = stepId;
			stageDrawerSelection = { stageId, stepId };
			stageDrawerOpen = true;
		}
		tooltip = null;
		columnTooltip = null;
	}

	$effect(() => {
		if (!stageDrawerOpen) {
			stageDrawerSelection = null;
			// Rewind step-zoom only; the user can still see the surrounding
			// stage context, and clicks the focused stage (or Reset) to fully
			// zoom out.
			zoomedStepId = null;
		}
	});

	const stageDrawerStage = $derived(
		stageDrawerSelection
			? (stages.find((s) => s.id === stageDrawerSelection!.stageId) ?? null)
			: null
	);
	const stageDrawerStep = $derived.by(() => {
		if (!stageDrawerSelection?.stepId || !stageDrawerStage) return null;
		return stageDrawerStage.steps.find((st) => st.id === stageDrawerSelection!.stepId) ?? null;
	});
	const stageDrawerFragments = $derived.by(() => {
		const sel = stageDrawerSelection;
		if (!sel) return [] as Fragment[];
		return filteredMatched.filter((f) => {
			const stageTags = activeAnnotations[f.id]?.stages?.values ?? [];
			return stageTags.some((s) => {
				if (s.stage_id !== sel.stageId) return false;
				if (sel.stepId) return s.step_id === sel.stepId;
				return true;
			});
		});
	});
	const stageDrawerSentimentCounts = $derived.by(() => {
		const counts: Record<number, number> = {};
		for (const f of stageDrawerFragments) {
			const s = activeAnnotations[f.id]?.segment_tags?.sentiment_score;
			if (typeof s === 'number') counts[s] = (counts[s] ?? 0) + 1;
		}
		return counts;
	});
	const stageDrawerSpeakerIds = $derived.by(() => {
		const set = new Set<string>();
		for (const f of stageDrawerFragments) set.add(speakerIdOf(f));
		return [...set];
	});
	const stageDrawerTopThemes = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const f of stageDrawerFragments) {
			const subs = activeAnnotations[f.id]?.segment_tags?.subthemes ?? [];
			for (const s of subs) counts[s] = (counts[s] ?? 0) + 1;
		}
		return Object.entries(counts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 8);
	});

	function openDrawer(fragmentId: string) {
		drawerFragmentId = fragmentId;
		drawerOpen = true;
		// Clear hover-tooltip so it doesn't double up with the drawer.
		tooltip = null;
	}
	$effect(() => {
		if (!drawerOpen) drawerFragmentId = null;
	});

	// === Ask the workbench ===================================================
	// The Ask PatientlyAI bar + answer pane lives in its own component. It owns
	// its question/answer state, localStorage cache, keyword/sponsor matchers,
	// and the right-rail citations/visualizations toggle. The page just hands
	// it the active indication + the set of in-corpus fragment ids so it can
	// decide which citation clicks should defer to the page's drawer.

	const activeFragmentIdSet = $derived(new Set(activeFragments.map((f) => f.id)));

	const drawerFragment = $derived(
		drawerFragmentId ? (activeFragments.find((f) => f.id === drawerFragmentId) ?? null) : null
	);
	const drawerAnnotation = $derived(
		drawerFragmentId ? (activeAnnotations[drawerFragmentId] ?? null) : null
	);
	const drawerSpeakerId = $derived(drawerFragment ? speakerIdOf(drawerFragment) : null);
	const drawerSpeakerOtherFragments = $derived.by(() => {
		if (!drawerSpeakerId || !drawerFragmentId) return [];
		return activeFragments
			.filter((f) => speakerIdOf(f) === drawerSpeakerId && f.id !== drawerFragmentId)
			.slice(0, 20);
	});
</script>

<svelte:head><title>Journey Map</title></svelte:head>

<PageHeader
	eyebrow="PatientlyIQ · Persona corpus"
	title="Journey Workbench"
	subtitle="Persona-driven view, scoped to the app's active indication ({activeIndication}). Filter chips compose AND with the persona; click a dot to inspect a fragment plus its speaker's other voice."
/>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 py-10">
	{#if visiblePersonas.length === 0}
		<div class="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
			No personas applicable to <code>{activeIndication}</code>. Switch the app's indication or
			author a new persona.
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<!-- Left (wider): persona select, description, View JourneyMap -->
			<section class="flex flex-col gap-3 md:col-span-2">
				<div class="flex flex-wrap items-end gap-3">
					<label class="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
						Persona
						<select
							id="persona-select"
							bind:value={selectedId}
							class="min-w-72 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
						>
							{#each visiblePersonas as p (p.id)}
								<option value={p.id}>{p.label}</option>
							{/each}
						</select>
					</label>

					{#if activeCorpus}
						{#if selected}
							<Button
								href="/patientlyiq/journey-map/{activeCorpus.manifest.id}/{selected.id}"
								variant="secondary"
								size="sm"
								class="ml-auto"
							>
								View JourneyMap
							</Button>
						{/if}
					{:else}
						<span class="ml-2 text-xs text-red-600">No corpus compatible with this persona.</span>
					{/if}
				</div>
				{#if selected}
					<p class="text-sm leading-6 text-muted-foreground">{selected.description}</p>
				{/if}
			</section>

			<!-- Right (smaller): filter chips -->
			<section class="rounded border border-muted bg-gray-50/50 p-3 md:col-span-1">
				<div class="mb-2 flex items-baseline justify-between">
					<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Filters</h2>
					<div class="text-xs text-gray-600">
						{filteredMatched.length} of {matched.length} fragments
						{#if anyFilterActive}
							<button
								type="button"
								onclick={clearAllFilters}
								class="ml-2 rounded border border-gray-300 px-2 py-0.5 text-[10px] font-medium hover:bg-gray-100"
							>
								Clear all
							</button>
						{/if}
					</div>
				</div>

				<!--
					Four filter dropdowns share the same trigger shape as the
					indication picker in WctglpTopbar (kicker label on top, value
					below, chevron on the right). Each menu uses bits-ui's
					CheckboxItem with closeOnSelect={false} so multiple values can
					be toggled without re-opening the menu between picks.
				-->
				<div class="flex flex-wrap gap-2">
					{#if stageOptions.length > 0}
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								{#snippet child({ props })}
									<button {...props} type="button" class="filter-trigger" aria-label="Filter by stage">
										<span class="filter-trigger-label">
											<span class="filter-trigger-kicker">Stage</span>
											<span class="filter-trigger-value">
												{activeStageFilters.size === 0
													? 'All'
													: `${activeStageFilters.size} selected`}
											</span>
										</span>
										<ChevronDown class="size-3.5 shrink-0 text-muted-foreground" />
									</button>
								{/snippet}
							</DropdownMenu.Trigger>
							<DropdownMenu.Content
								align="start"
								sideOffset={6}
								class="max-h-[24rem] min-w-[14rem] overflow-y-auto"
							>
								{#each stageOptions as [id, count] (id)}
									{@const stage = stages.find((s) => s.id === id)}
									<DropdownMenu.CheckboxItem
										checked={activeStageFilters.has(id)}
										onCheckedChange={() => toggleStage(id)}
										closeOnSelect={false}
									>
										<span class="flex-1 truncate">{stage?.label ?? id}</span>
										<span class="ml-2 text-muted-foreground">{count}</span>
									</DropdownMenu.CheckboxItem>
								{/each}
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					{/if}

					{#if sentimentOptions.length > 0}
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								{#snippet child({ props })}
									<button {...props} type="button" class="filter-trigger" aria-label="Filter by sentiment">
										<span class="filter-trigger-label">
											<span class="filter-trigger-kicker">Sentiment</span>
											<span class="filter-trigger-value">
												{activeSentimentFilters.size === 0
													? 'All'
													: `${activeSentimentFilters.size} selected`}
											</span>
										</span>
										<ChevronDown class="size-3.5 shrink-0 text-muted-foreground" />
									</button>
								{/snippet}
							</DropdownMenu.Trigger>
							<DropdownMenu.Content align="start" sideOffset={6} class="min-w-[12rem]">
								{#each sentimentOptions as [n, count] (n)}
									<DropdownMenu.CheckboxItem
										checked={activeSentimentFilters.has(n)}
										onCheckedChange={() => toggleSentiment(n)}
										closeOnSelect={false}
									>
										<span class="flex flex-1 items-center gap-2">
											<span
												class="inline-block h-2 w-2 rounded-full"
												style:background-color={SENTIMENT_PALETTE[n]}
											></span>
											<span>{n > 0 ? '+' : ''}{n}</span>
										</span>
										<span class="ml-2 text-muted-foreground">{count}</span>
									</DropdownMenu.CheckboxItem>
								{/each}
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					{/if}

					{#if roleOptions.length > 0}
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								{#snippet child({ props })}
									<button {...props} type="button" class="filter-trigger" aria-label="Filter by role">
										<span class="filter-trigger-label">
											<span class="filter-trigger-kicker">Role</span>
											<span class="filter-trigger-value">
												{activeRoleFilters.size === 0
													? 'All'
													: `${activeRoleFilters.size} selected`}
											</span>
										</span>
										<ChevronDown class="size-3.5 shrink-0 text-muted-foreground" />
									</button>
								{/snippet}
							</DropdownMenu.Trigger>
							<DropdownMenu.Content
								align="start"
								sideOffset={6}
								class="max-h-[24rem] min-w-[14rem] overflow-y-auto"
							>
								{#each roleOptions as [r, count] (r)}
									<DropdownMenu.CheckboxItem
										checked={activeRoleFilters.has(r)}
										onCheckedChange={() => toggleRole(r)}
										closeOnSelect={false}
									>
										<span class="flex-1 truncate">{r}</span>
										<span class="ml-2 text-muted-foreground">{count}</span>
									</DropdownMenu.CheckboxItem>
								{/each}
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					{/if}

					{#if subthemeOptions.length > 0}
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								{#snippet child({ props })}
									<button {...props} type="button" class="filter-trigger" aria-label="Filter by subtheme">
										<span class="filter-trigger-label">
											<span class="filter-trigger-kicker">Subtheme</span>
											<span class="filter-trigger-value">
												{activeSubthemeFilters.size === 0
													? 'All'
													: `${activeSubthemeFilters.size} selected`}
											</span>
										</span>
										<ChevronDown class="size-3.5 shrink-0 text-muted-foreground" />
									</button>
								{/snippet}
							</DropdownMenu.Trigger>
							<DropdownMenu.Content
								align="start"
								sideOffset={6}
								class="max-h-[24rem] min-w-[16rem] overflow-y-auto"
							>
								{#each subthemeOptions as [id, count] (id)}
									<DropdownMenu.CheckboxItem
										checked={activeSubthemeFilters.has(id)}
										onCheckedChange={() => toggleSubtheme(id)}
										closeOnSelect={false}
									>
										<span class="flex-1 truncate">{id}</span>
										<span class="ml-2 text-muted-foreground">{count}</span>
									</DropdownMenu.CheckboxItem>
								{/each}
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					{/if}
				</div>
			</section>
		</div>

		<!--
			Chart breaks out of the page's max-w-6xl centering so it can use
			almost the full viewport width. The trick: relative positioning +
			left:50% + translateX(-50%) re-centers a wider element regardless
			of the surrounding container's narrower max-width, while
			min(...) keeps it from overflowing small viewports.
		-->
		<section
			class="rounded p-4"
			style="position: relative; left: 50%; transform: translateX(-50%); width: min(calc(100vw - 8rem), 1600px);"
		>
			<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Sentiment by journey stage</h2>
			<div class="mb-2 flex flex-wrap items-baseline justify-between gap-3">
				<div class="flex items-baseline gap-3">
					{#if isZoomed}
						{@const focusedStage = stages.find((s) => s.id === zoomedStageId)}
						{@const focusedStep = zoomedStepId
							? (focusedStage?.steps.find((st) => st.id === zoomedStepId) ?? null)
							: null}
						<span class="text-xs text-muted-foreground">
							Zoomed:
							<span class="font-medium text-secondary-foreground">
								{focusedStage?.label ?? zoomedStageId}{focusedStep
									? ` · ${focusedStep.label}`
									: ''}
							</span>
						</span>
						<Button
							variant="ghost"
							onclick={clearZoom}
							class="rounded border border-gray-300 px-2 py-0.5 text-[11px] font-medium text-secondary-foreground hover:bg-gray-50"
						>
							Reset Zoom
					</Button>
					{/if}
				</div>
				<div class="flex items-center gap-4 text-xs">
					<span class="text-muted-foreground">
						Color by:</span>
					{#each ['participant', 'sentiment', 'persona'] as const as mode (mode)}
						<label class="inline-flex cursor-pointer items-center gap-1">
							<input type="radio" bind:group={colorBy} value={mode} class="accent-secondary-foreground" />
							<span class="capitalize">{mode}</span>
						</label>
					{/each}
				</div>
			</div>

			<p class="mb-2 text-xs text-muted-foreground">
				{beeswarm.plotted} dots plotted
				{#if beeswarm.dropped_no_sentiment > 0}
					· {beeswarm.dropped_no_sentiment} fragments without sentiment dropped
				{/if}
				{#if beeswarm.dropped_no_stage > 0}
					· {beeswarm.dropped_no_stage} without stage
				{/if}
				{#if !isZoomed}
					· click a stage or step to zoom in
				{:else if zoomedStepId === null}
					· click a step to open its detail drawer
				{/if}
			</p>

			{#if stages.length === 0}
				<div class="rounded border border-dashed border-gray-300 bg-gray-50 px-4 py-12 text-center text-xs text-muted-foreground">
					No journey taxonomy available for this corpus's indication.
				</div>
			{:else}
				<!--
					Fixed-aspect chart container: viewBox keeps geometry constant so
					filter changes only add/remove circles, never resize the chart.
					Width is driven by the breakout wrapper above; the SVG just
					fills it and preserves the viewBox aspect ratio.
				-->
				<div class="w-full">
					<svg
						viewBox="0 0 {VIEWBOX_W} {VIEWBOX_H}"
						class="w-full select-none"
						style:aspect-ratio="{VIEWBOX_W} / {VIEWBOX_H}"
					>
						{#each SENT_VALUES as sv (sv)}
							{@const y = M.top + (SENT_VALUES[SENT_VALUES.length - 1] - sv) * (PLOT_H / (SENT_VALUES.length - 1))}
							<line
								x1={M.left}
								x2={VIEWBOX_W - M.right}
								y1={y}
								y2={y}
								stroke={sv === 0 ? '#9ca3af' : '#e5e7eb'}
								stroke-width={sv === 0 ? 1 : 0.5}
							/>
							<text
								x={M.left - 8}
								{y}
								dy="0.32em"
								text-anchor="end"
								class="fill-muted-foreground text-[10px]"
							>
								{sv > 0 ? '+' : ''}{sv}
							</text>
						{/each}

						<!-- Hover highlight rects, drawn under everything else. -->
						{#each stageLayout as sl (sl.stage_id)}
							{@const isStageHover = hoveredStageId === sl.stage_id}
							{@const stepIsZoomed = zoomedStageId === sl.stage_id && zoomedStepId !== null}
							<rect
								class="stage-highlight"
								x={sl.x_left}
								y={M.top}
								width={sl.x_width}
								height={PLOT_H}
								fill={isStageHover ? 'rgba(99, 102, 241, 0.06)' : 'transparent'}
								pointer-events="none"
							/>
							{#if isStageHover}
								{@const stage = stages.find((s) => s.id === sl.stage_id)!}
								{@const subCols = stage.steps.length + 1}
								{@const subW = sl.x_width / subCols}
								{#if hoveredStepId !== null}
									{@const stepIdx = stage.steps.findIndex((st) => st.id === hoveredStepId)}
									{#if stepIdx >= 0}
										{@const inZoomed = stepIsZoomed && stage.steps[stepIdx].id === zoomedStepId}
										<rect
											class="step-highlight"
											x={stepIsZoomed
												? inZoomed
													? M.left
													: sl.x_left + stepIdx * subW
												: sl.x_left + stepIdx * subW}
											y={M.top}
											width={stepIsZoomed ? (inZoomed ? PLOT_W : 0) : subW}
											height={PLOT_H}
											fill="rgba(99, 102, 241, 0.10)"
											pointer-events="none"
										/>
									{/if}
								{/if}
							{/if}
						{/each}

						{#each stageLayout as sl (sl.stage_id)}
							{@const subCols = stages.find((s) => s.id === sl.stage_id)!.steps.length + 1}
							{@const subW = sl.x_width / subCols}
							{@const stepIsZoomed = zoomedStageId === sl.stage_id && zoomedStepId !== null}
							{#each Array(subCols - 1) as _, k (k)}
								<line
									class="subcol-divider"
									x1={sl.x_left + (k + 1) * subW}
									x2={sl.x_left + (k + 1) * subW}
									y1={M.top}
									y2={M.top + PLOT_H}
									stroke="#f3f4f6"
									stroke-width="0.5"
									opacity={stepIsZoomed ? 0 : 1}
								/>
							{/each}
						{/each}

						{#each stageLayout as sl, i (sl.stage_id)}
							{#if i > 0}
								<line
									x1={sl.x_left}
									x2={sl.x_left}
									y1={M.top}
									y2={M.top + PLOT_H}
									stroke="#9ca3af"
									stroke-width="1"
									stroke-dasharray="4,3"
								/>
							{/if}
						{/each}

						<!--
							Column hit-rects.
							Stage rects sit BELOW step rects, so within the plot area a step
							rect captures the hover/click first. The stage rect still serves
							hits below the plot (over the rotated stage label), and is the
							fallback for the trailing "stage-only" sub-column hover.
						-->
						{#each stageLayout as sl (sl.stage_id)}
							{@const stage = stages.find((s) => s.id === sl.stage_id)!}
							<rect
								class="stage-hit"
								x={sl.x_left}
								y={M.top}
								width={sl.x_width}
								height={PLOT_H + 80}
								fill="transparent"
								pointer-events="all"
								role="button"
								tabindex="0"
								aria-label="Stage {stage.label} — click to inspect fragments"
								onmouseenter={(e) => setColumnTooltip(e, sl.stage_id, null)}
								onmousemove={(e) => moveColumnTooltip(e, sl.stage_id, null)}
								onmouseleave={queueClearHover}
								onfocus={() => setHover(sl.stage_id, null)}
								onblur={queueClearHover}
								onclick={() => onChartStageClick(sl.stage_id)}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										onChartStageClick(sl.stage_id);
									}
								}}
								style:cursor="pointer"
							/>
						{/each}
						{#each stageLayout as sl (sl.stage_id)}
							{@const stage = stages.find((s) => s.id === sl.stage_id)!}
							{@const subCols = stage.steps.length + 1}
							{@const subW = sl.x_width / subCols}
							{@const stepIsZoomed = zoomedStageId === sl.stage_id && zoomedStepId !== null}
							{#each stage.steps as step, k (step.id)}
								{@const inZoomed = stepIsZoomed && step.id === zoomedStepId}
								<rect
									class="step-hit"
									x={stepIsZoomed
										? inZoomed
											? M.left
											: sl.x_left + k * subW
										: sl.x_left + k * subW}
									y={M.top}
									width={stepIsZoomed ? (inZoomed ? PLOT_W : 0) : subW}
									height={PLOT_H}
									fill="transparent"
									pointer-events={stepIsZoomed && !inZoomed ? 'none' : 'all'}
									role="button"
									tabindex="0"
									aria-label="Step {step.label} in stage {stage.label} — click to inspect fragments"
									onmouseenter={(e) => setColumnTooltip(e, sl.stage_id, step.id)}
									onmousemove={(e) => moveColumnTooltip(e, sl.stage_id, step.id)}
									onmouseleave={queueClearHover}
									onfocus={() => setHover(sl.stage_id, step.id)}
									onblur={queueClearHover}
									onclick={(e) => {
										e.stopPropagation();
										onChartStepClick(sl.stage_id, step.id);
									}}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											e.stopPropagation();
											onChartStepClick(sl.stage_id, step.id);
										}
									}}
									style:cursor="pointer"
								/>
							{/each}
						{/each}

						{#each stageLayout as sl (sl.stage_id)}
							{@const stage = stages.find((s) => s.id === sl.stage_id)!}
							{@const isStageHover = hoveredStageId === sl.stage_id}
							{@const isFocused = zoomedStageId === sl.stage_id}
							{@const cx = sl.x_left + sl.x_width / 2}
							{@const cy = M.top + PLOT_H + 16}
							<text
								class="stage-label pointer-events-none"
								x={cx}
								y={cy}
								text-anchor={isFocused ? 'middle' : 'end'}
								transform={isFocused ? null : `rotate(-30, ${cx}, ${cy})`}
								class:fill-secondary-foreground={!isStageHover && !isFocused}
								class:fill-primary={isStageHover || isFocused}
								class:font-semibold={isStageHover || isFocused}
								class:text-xs={isFocused}
								class:text-[10px]={!isFocused}
							>
								{stage.label}
							</text>
							{#if isFocused}
								{#each stage.steps as step (step.id)}
									{@const stepCx = sl.stepCenters[step.id]}
									{#if stepCx >= 0 && stepCx <= VIEWBOX_W}
										<text
											class="step-label pointer-events-none text-[10px]"
											x={stepCx}
											y={M.top + PLOT_H + 38}
											text-anchor="middle"
											class:fill-indigo-700={hoveredStepId === step.id ||
												zoomedStepId === step.id}
											class:fill-muted-foreground={hoveredStepId !== step.id &&
												zoomedStepId !== step.id}
											class:font-medium={zoomedStepId === step.id}
											in:fade={{ duration: 480, easing: cubicOut, delay: 180 }}
											out:fade={{ duration: 240, easing: cubicOut }}
										>
											{step.label}
										</text>
									{/if}
								{/each}
							{/if}
						{/each}

						{#each beeswarm.dots as d, i (d.fragmentId + ':' + d.stageId + ':' + (d.stepId ?? ''))}
							{@const color = colorFor(d)}
							{@const isHover = tooltip && tooltip.dotIdx === i}
							{@const dimmed = isDimmed(d.stageId, d.stepId)}
							{@const popDelay = Math.round(
								hashf(d.fragmentId + d.stageId + (d.stepId ?? '')) * 520
							)}
							<circle
								class="dot viz-circle-pop"
								style:--viz-circle-delay="{popDelay}ms"
								style:--r-delay="{popDelay}ms"
								cx={d.cx}
								cy={d.cy}
								r={isHover ? (isZoomed ? 7 : 5) : isZoomed ? 5.5 : 3.5}
								fill={color}
								fill-opacity={isHover ? 1 : dimmed ? 0.18 : 0.65}
								stroke={isHover ? '#111827' : 'none'}
								stroke-width="1"
								role="button"
								tabindex="0"
								aria-label="Fragment {d.fragmentId} at stage {d.stageId}, sentiment {d.sentiment} — click for detail"
								onmouseenter={(e) => onDotEnter(e, i)}
								onmousemove={(e) => onDotMove(e, i)}
								onmouseleave={onDotLeave}
								onfocus={(e) => onDotEnter(e as unknown as MouseEvent, i)}
								onblur={onDotLeave}
								onclick={(e) => {
									e.stopPropagation();
									openDrawer(d.fragmentId);
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										e.stopPropagation();
										openDrawer(d.fragmentId);
									}
								}}
								out:fade={{ duration: 360, easing: cubicOut }}
								style:cursor="pointer"
							/>
						{/each}
					</svg>
				</div>
			{/if}

			<div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
				<div class="text-xs">
					<div class="font-medium text-secondary-foreground">Legend</div>
					<div class="mt-1 flex flex-wrap gap-3 text-gray-600">
						{#if colorBy === 'participant'}
							{#each topSpeakers as sid (sid)}
								<span class="inline-flex items-center gap-1">
									<span
										class="inline-block h-2.5 w-2.5 rounded-full"
										style:background-color={participantColor(sid)}
									></span>
									<span>{speakerLabelById(sid)}</span>
								</span>
							{/each}
							{#if extraSpeakerCount > 0}
								<span class="text-gray-400 italic">+{extraSpeakerCount} more</span>
							{/if}
						{:else if colorBy === 'sentiment'}
							{#each SENT_VALUES as sv (sv)}
								<span class="inline-flex items-center gap-1">
									<span
										class="inline-block h-2.5 w-2.5 rounded-full"
										style:background-color={SENTIMENT_PALETTE[sv]}
									></span>
									<span>{sv > 0 ? '+' : ''}{sv}</span>
								</span>
							{/each}
						{:else if colorBy === 'persona'}
							<span class="inline-flex items-center gap-1">
								<span
									class="inline-block h-2.5 w-2.5 rounded-full"
									style:background-color={selected?.color ?? FALLBACK_COLOR}
								></span>
								<span>{selected?.label ?? '(no persona)'}</span>
							</span>
						{/if}
					</div>
				</div>
				<div class="text-xs text-muted-foreground">
					<div class="font-medium text-secondary-foreground">Reading the X-axis</div>
					<p class="mt-1">
						Each stage column subdivides into one mini-column per step (left → right in step order),
						plus a trailing column for stage-only tags. Heavier dashed lines separate stages.
					</p>
				</div>
			</div>
		</section>

		<!--
			Below-chart detail panels (match count, speaker mix, stage distribution
			and sample fragments) collapse into a single accordion so they don't
			dominate the page when the user is focused on the chart above.
		-->
		<Accordion.Root type="single" class="rounded border border-muted bg-white">
			<Accordion.Item value="below-chart-details">
				<Accordion.Header>
					<Accordion.Trigger
						class="group flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-50"
					>
						<span>Match counts, speaker mix &amp; sample fragments</span>
						<ChevronDown
							strokeWidth={2.5}
							class="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180"
						/>
					</Accordion.Trigger>
				</Accordion.Header>
				<Accordion.Content class="border-t border-muted">
					<div class="space-y-4 p-4">

		<section class="grid grid-cols-1 gap-4 md:grid-cols-3">
			<div class="rounded border border-muted p-4">
				<h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Match count</h2>
				<p class="text-3xl font-bold">{filteredMatched.length}</p>
				<p class="text-xs text-muted-foreground">
					fragments from {Object.keys(bySpeaker).length} speaker(s)
				</p>
				<div class="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs">
					{#each sortedEntries(bySpeaker).slice(0, 30) as [sid, count] (sid)}
						<div class="flex items-center justify-between">
							<span class="flex items-center gap-1.5">
								<span
									class="inline-block h-2 w-2 rounded-full"
									style:background-color={participantColor(sid)}
								></span>{speakerLabelById(sid)}
							</span>
							<span class="font-mono">{count}</span>
						</div>
					{/each}
					{#if Object.keys(bySpeaker).length > 30}
						<div class="pt-1 text-muted-foreground italic">
							+{Object.keys(bySpeaker).length - 30} more
						</div>
					{/if}
				</div>
			</div>

			<div class="rounded border border-muted p-4">
				<h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Speaker mix</h2>
				<div class="space-y-3 text-xs">
					{#each Object.entries(demographicCounts) as [attr, vals] (attr)}
						<div>
							<div class="font-medium text-secondary-foreground">{attr}</div>
							{#each sortedEntries(vals) as [v, n] (v)}
								<div class="flex justify-between pl-2">
									<span>{v}</span>
									<span class="font-mono">{n}</span>
								</div>
							{/each}
						</div>
					{/each}
					{#if Object.keys(demographicCounts).length === 0}
						<p class="text-muted-foreground">(no resolved speaker attrs)</p>
					{/if}
				</div>
			</div>

			<div class="rounded border border-muted p-4">
				<h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Stage distribution</h2>
				{#if stageStats.tagged === 0}
					<p class="text-xs text-muted-foreground">No stage annotations for this persona's fragments.</p>
				{:else}
					<p class="mb-2 text-xs text-muted-foreground">
						{stageStats.tagged} of {filteredMatched.length} fragments tagged
					</p>
					<div class="space-y-1 text-xs">
						{#each sortedEntries(stageStats.counts) as [stage, n] (stage)}
							{@const stageDef = stages.find((s) => s.id === stage)}
							<button
								type="button"
								onclick={() => openStageDrawer(stage, null)}
								class="flex w-full justify-between rounded px-1 py-0.5 text-left hover:bg-gray-50"
							>
								<span>{stageDef?.label ?? stage}</span>
								<span class="font-mono">{n}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</section>

		<section class="rounded border border-muted p-4">
			<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
				Sample fragments {filteredMatched.length > 20
					? `(first 20 of ${filteredMatched.length})`
					: `(${filteredMatched.length})`}
			</h2>
			{#if filteredMatched.length === 0}
				<p class="text-xs text-muted-foreground">No matches.</p>
			{:else}
				<div class="space-y-3 text-xs">
					{#each filteredMatched.slice(0, 20) as f (f.id)}
						{@const ann = getAnn(f.id)}
						{@const stageTags = ann?.stages?.values ?? []}
						{@const sentiment = ann?.segment_tags?.sentiment_score}
						{@const themes = ann?.segment_tags?.themes ?? []}
						{@const subthemes = ann?.segment_tags?.subthemes ?? []}
						<div
							role="button"
							tabindex="0"
							onclick={() => openDrawer(f.id)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									openDrawer(f.id);
								}
							}}
							class="block w-full cursor-pointer border-b border-gray-100 pb-2 text-left last:border-b-0 hover:bg-gray-50"
						>
							<div class="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
								<span>{speakerLabel(f)}</span>
								<div class="flex flex-wrap items-center gap-1">
									{#if sentiment !== null && sentiment !== undefined}
										<span class="rounded bg-gray-100 px-1.5 py-0.5"
											>sentiment {sentiment > 0 ? '+' : ''}{sentiment}</span
										>
									{/if}
									{#each stageTags as s, i (i)}
										<span class="rounded bg-gray-100 px-1.5 py-0.5"
											>{s.stage_id}{s.step_id ? ' / ' + s.step_id : ''}</span
										>
									{/each}
								</div>
							</div>
							<p class="mt-1 text-primary">{f.text}</p>
							{#if themes.length > 0 || subthemes.length > 0}
								<div class="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
									{#each themes as t (t)}
										<span class="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">{t}</span>
									{/each}
									{#each subthemes as s (s)}
										<button
											type="button"
											onclick={(e) => {
												e.stopPropagation();
												openSubthemeStats(s);
											}}
											class="rounded bg-indigo-100/60 px-1.5 py-0.5 text-indigo-600 hover:bg-indigo-200/80"
											title="View study-wide stats for this subtheme"
										>{s}</button>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>

					</div>
				</Accordion.Content>
			</Accordion.Item>
		</Accordion.Root>
	{/if}
</div>

<!-- Hover tooltip (transient) -->
{#if tooltip && tooltipDot && tooltipFragment}
	{@const sid = tooltipDot.speakerId}
	{@const avatar = fragmentParticipantAvatarUrl(tooltipFragment)}
	{@const stage = stages.find((s) => s.id === tooltipDot.stageId)}
	{@const stepLabel = tooltipDot.stepId
		? stage?.steps.find((st) => st.id === tooltipDot.stepId)?.label
		: null}
	<div
		class="pointer-events-none fixed z-40 max-w-sm rounded-md border border-muted bg-white p-3 text-xs shadow-xl"
		style:left="{tooltip.x + 14}px"
		style:top="{tooltip.y + 14}px"
	>
		<div class="flex items-center gap-2">
			{#if avatar}
				<img
					src={avatar}
					alt={speakerLabel(tooltipFragment)}
					class="h-8 w-8 rounded-full object-cover"
				/>
			{:else}
				<span
					class="inline-flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold text-white"
					style:background-color={participantColor(sid)}
				>
					{speakerInitials(sid)}
				</span>
			{/if}
			<div class="flex flex-col">
				<span class="font-semibold text-primary">{speakerLabel(tooltipFragment)}</span>
			</div>
		</div>
		<p class="mt-2 text-primary italic">"{tooltipFragment.text}"</p>
		<div class="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-gray-600">
			<span class="rounded bg-gray-100 px-1.5 py-0.5">{stage?.label ?? tooltipDot.stageId}</span>
			{#if stepLabel}
				<span class="rounded bg-gray-100 px-1.5 py-0.5">→ {stepLabel}</span>
			{/if}
			<span class="rounded bg-gray-100 px-1.5 py-0.5"
				>sentiment {tooltipDot.sentiment > 0 ? '+' : ''}{tooltipDot.sentiment}</span
			>
			<span class="text-gray-400">· click for full detail</span>
		</div>
	</div>
{/if}

<!-- Column tooltip — shows the hovered stage / step name. Suppressed while a
     dot tooltip is showing, since both follow the cursor. -->
{#if columnTooltip && !tooltip}
	{@const ct = columnTooltip}
	{@const stage = stages.find((s) => s.id === ct.stageId)}
	{@const step = ct.stepId ? (stage?.steps.find((st) => st.id === ct.stepId) ?? null) : null}
	<div
		class="pointer-events-none fixed z-40 rounded-md border border-muted bg-white px-3 py-2 text-xs shadow-lg"
		style:left="{ct.x + 14}px"
		style:top="{ct.y + 14}px"
	>
		{#if step}
			<div class="text-[10px] uppercase tracking-wider text-muted-foreground">
				Step in {stage?.label ?? ct.stageId}
			</div>
			<div class="text-sm font-semibold text-primary">{step.label}</div>
		{:else}
			<div class="text-[10px] uppercase tracking-wider text-muted-foreground">Stage</div>
			<div class="text-sm font-semibold text-primary">{stage?.label ?? ct.stageId}</div>
		{/if}
		<div class="mt-1 text-[10px] text-gray-400">click to zoom in</div>
	</div>
{/if}

<!-- Primary drawer (persistent fragment detail) -->
<RightDrawer bind:open={drawerOpen}>
	{#if drawerFragment}
		{@const ann = drawerAnnotation}
		{@const sid = drawerSpeakerId ?? '?'}
		{@const avatar = fragmentParticipantAvatarUrl(drawerFragment)}
		{@const stageTags = ann?.stages?.values ?? []}
		{@const sentiment = ann?.segment_tags?.sentiment_score}
		{@const emotions = ann?.segment_tags?.emotions ?? []}
		{@const themes = ann?.segment_tags?.themes ?? []}
		{@const subthemes = ann?.segment_tags?.subthemes ?? []}
		<div class="flex h-full flex-col">
			<header class="border-b border-muted px-6 py-5">
				<div class="flex items-center gap-3">
					{#if avatar}
						<img
							src={avatar}
							alt={speakerLabel(drawerFragment)}
							class="h-12 w-12 rounded-full object-cover"
						/>
					{:else}
						<span
							class="inline-flex h-12 w-12 items-center justify-center rounded-full text-xs font-semibold text-white"
							style:background-color={participantColor(sid)}
						>
							{speakerInitials(sid)}
						</span>
					{/if}
					<div class="flex flex-col">
						<span class="text-base font-semibold text-primary">{speakerLabel(drawerFragment)}</span>
					</div>
				</div>
				<div class="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
					<span class="rounded bg-gray-100 px-1.5 py-0.5">{drawerFragment.content_source}</span>
					<span class="rounded bg-gray-100 px-1.5 py-0.5">{drawerFragment.indications.join(', ')}</span>
					<span class="rounded bg-gray-100 px-1.5 py-0.5">{drawerFragment.date_observed.slice(0, 10)}</span>
				</div>
			</header>

			<div class="flex-1 space-y-5 overflow-y-auto px-6 py-5">
				<div>
					<h3 class="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Fragment</h3>
					<p class="text-base leading-relaxed text-primary">"{drawerFragment.text}"</p>
				</div>

				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<h3 class="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Speaker attributes</h3>
						{#if Object.keys(drawerFragment.speaker_attrs ?? {}).length === 0}
							<p class="text-xs text-muted-foreground italic">(none declared)</p>
						{:else}
							<dl class="space-y-1 text-xs">
								{#each Object.entries(drawerFragment.speaker_attrs ?? {}) as [k, v] (k)}
									{#if v}
										<div class="flex items-baseline justify-between gap-2">
											<dt class="text-muted-foreground">{k}</dt>
											<dd class="text-primary">
												{v.value === null ? '(unknown)' : String(v.value)}
												<span class="ml-1 text-[10px] text-gray-400">
													[{v.evidence}{v.confidence !== undefined
														? `, ${(v.confidence * 100).toFixed(0)}%`
														: ''}]
												</span>
											</dd>
										</div>
									{/if}
								{/each}
							</dl>
						{/if}
					</div>

					<div>
						<h3 class="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Annotations</h3>
						<div class="space-y-2 text-xs">
							{#if sentiment !== null && sentiment !== undefined}
								<div class="flex items-center gap-2">
									<span class="font-medium text-secondary-foreground">Sentiment:</span>
									<span class="inline-flex items-center gap-1">
										<span
											class="inline-block h-2 w-2 rounded-full"
											style:background-color={SENTIMENT_PALETTE[sentiment]}
										></span>
										<span class="font-mono">{sentiment > 0 ? '+' : ''}{sentiment}</span>
									</span>
								</div>
							{/if}
							{#if emotions.length > 0}
								<div>
									<span class="font-medium text-secondary-foreground">Emotions:</span>
									<div class="mt-0.5 flex flex-wrap gap-1">
										{#each emotions as e (e)}
											<span class="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">{e}</span>
										{/each}
									</div>
								</div>
							{/if}
							{#if stageTags.length > 0}
								<div>
									<span class="font-medium text-secondary-foreground">Stages:</span>
									<div class="mt-0.5 flex flex-wrap gap-1">
										{#each stageTags as s, i (i)}
											{@const stageDef = stages.find((x) => x.id === s.stage_id)}
											{@const stepDef = s.step_id
												? stageDef?.steps.find((x) => x.id === s.step_id)
												: null}
											<span class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-secondary-foreground">
												{stageDef?.label ?? s.stage_id}{stepDef
													? ' / ' + stepDef.label
													: ''}
												<span class="opacity-60">({(s.confidence * 100).toFixed(0)}%)</span>
											</span>
										{/each}
									</div>
								</div>
							{/if}
							{#if themes.length > 0 || subthemes.length > 0}
								<div>
									<span class="font-medium text-secondary-foreground">Themes / subthemes:</span>
									<div class="mt-0.5 flex flex-wrap gap-1">
										{#each themes as t (t)}
											<span class="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700">{t}</span>
										{/each}
										{#each subthemes as s (s)}
											<button
												type="button"
												onclick={() => openSubthemeStats(s)}
												class="rounded bg-indigo-100/60 px-1.5 py-0.5 text-[10px] text-indigo-600 hover:bg-indigo-200/80"
												title="View study-wide stats for this subtheme"
											>{s}</button>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>

				{#if drawerSpeakerOtherFragments.length > 0}
					<div>
						<h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Other fragments by {speakerLabel(drawerFragment)} ({drawerSpeakerOtherFragments.length})
						</h3>
						<div class="space-y-2">
							{#each drawerSpeakerOtherFragments as f (f.id)}
								{@const fa = activeAnnotations[f.id]}
								{@const fSent = fa?.segment_tags?.sentiment_score}
								<button
									type="button"
									onclick={() => openDrawer(f.id)}
									class="block w-full rounded border border-muted p-2 text-left text-xs hover:bg-gray-50"
								>
									<div class="flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
										{#if fSent !== null && fSent !== undefined}
											<span class="inline-flex items-center gap-1">
												<span
													class="inline-block h-1.5 w-1.5 rounded-full"
													style:background-color={SENTIMENT_PALETTE[fSent]}
												></span>
												<span class="font-mono">{fSent > 0 ? '+' : ''}{fSent}</span>
											</span>
										{/if}
									</div>
									<p class="mt-1 text-primary">{f.text}</p>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</RightDrawer>

<!-- Stage / step drawer (opens when a column is clicked) -->
<RightDrawer bind:open={stageDrawerOpen}>
	{#if stageDrawerSelection && stageDrawerStage}
		{@const stage = stageDrawerStage}
		{@const step = stageDrawerStep}
		{@const totalSentiment = Object.values(stageDrawerSentimentCounts).reduce(
			(a, b) => a + b,
			0
		)}
		<div class="flex h-full flex-col">
			<header class="border-b border-muted px-6 py-5">
				<p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
					{step ? 'Step' : 'Stage'}
				</p>
				<h2 class="mt-1 text-xl font-semibold text-primary">
					{step ? step.label : stage.label}
				</h2>
				{#if step}
					<p class="mt-1 text-xs text-gray-600">
						in stage <span class="font-medium">{stage.label}</span>
					</p>
				{/if}
				<div class="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-gray-600">
					<span class="rounded bg-gray-100 px-1.5 py-0.5">
						<span class="font-mono">{stageDrawerFragments.length}</span> fragments
					</span>
					<span class="rounded bg-gray-100 px-1.5 py-0.5">
						<span class="font-mono">{stageDrawerSpeakerIds.length}</span> speaker(s)
					</span>
					{#if !step}
						<span class="rounded bg-gray-100 px-1.5 py-0.5">
							<span class="font-mono">{stage.steps.length}</span> step(s)
						</span>
					{/if}
				</div>
			</header>

			<div class="flex-1 space-y-5 overflow-y-auto px-6 py-5">
				{#if stageDrawerFragments.length === 0}
					<p class="text-xs text-muted-foreground italic">
						No fragments are tagged with this {step ? 'step' : 'stage'} under the
						current filters.
					</p>
				{:else}
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
								Sentiment mix
							</h3>
							<div class="space-y-1.5 text-xs">
								{#each SENT_VALUES as sv (sv)}
									{@const count = stageDrawerSentimentCounts[sv] ?? 0}
									{@const pct = totalSentiment > 0 ? (count / totalSentiment) * 100 : 0}
									<div class="flex items-center gap-2">
										<span class="inline-flex w-6 items-center gap-1">
											<span
												class="inline-block h-2 w-2 rounded-full"
												style:background-color={SENTIMENT_PALETTE[sv]}
											></span>
											<span class="font-mono text-[10px] text-gray-600"
												>{sv > 0 ? '+' : ''}{sv}</span
											>
										</span>
										<div class="h-1.5 flex-1 overflow-hidden rounded bg-gray-100">
											<div
												class="h-full rounded"
												style:width="{pct}%"
												style:background-color={SENTIMENT_PALETTE[sv]}
											></div>
										</div>
										<span class="w-8 text-right font-mono text-[10px] text-gray-600">{count}</span>
									</div>
								{/each}
							</div>
						</div>

						<div>
							<h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
								Speakers
							</h3>
							{#if stageDrawerSpeakerIds.length === 0}
								<p class="text-xs text-muted-foreground italic">(none)</p>
							{:else}
								<div class="flex flex-wrap gap-2">
									{#each stageDrawerSpeakerIds.slice(0, 12) as sid (sid)}
										<span
											class="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2 py-0.5 text-[11px]"
										>
											<span
												class="inline-block h-2 w-2 rounded-full"
												style:background-color={participantColor(sid)}
											></span>
											<span class="text-secondary-foreground">{sid}</span>
										</span>
									{/each}
									{#if stageDrawerSpeakerIds.length > 12}
										<span class="text-[11px] text-gray-400 italic">
											+{stageDrawerSpeakerIds.length - 12} more
										</span>
									{/if}
								</div>
							{/if}
						</div>
					</div>

					{#if stageDrawerTopThemes.length > 0}
						<div>
							<h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
								Top subthemes
							</h3>
							<div class="flex flex-wrap gap-1">
								{#each stageDrawerTopThemes as [t, n] (t)}
									<button
										type="button"
										onclick={() => openSubthemeStats(t)}
										class="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700 hover:bg-indigo-100"
										title="View study-wide stats for this subtheme"
									>
										{t} <span class="opacity-60">({n})</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}

					{#if !step && stage.steps.length > 0}
						<div>
							<h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
								Steps in this stage
							</h3>
							<div class="space-y-1">
								{#each stage.steps as st (st.id)}
									{@const stepCount = stageDrawerFragments.filter((f) =>
										(activeAnnotations[f.id]?.stages?.values ?? []).some(
											(s) => s.stage_id === stage.id && s.step_id === st.id
										)
									).length}
									<button
										type="button"
										onclick={() => openStageDrawer(stage.id, st.id)}
										class="flex w-full items-center justify-between rounded border border-muted px-2 py-1.5 text-xs hover:bg-gray-50"
									>
										<span class="text-primary">{st.label}</span>
										<span class="font-mono text-muted-foreground">{stepCount}</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}

					<div>
						<h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
							Fragments
							{#if stageDrawerFragments.length > 30}
								<span class="text-gray-400">(first 30 of {stageDrawerFragments.length})</span>
							{/if}
						</h3>
						<div class="space-y-2">
							{#each stageDrawerFragments.slice(0, 30) as f (f.id)}
								{@const fa = activeAnnotations[f.id]}
								{@const fSent = fa?.segment_tags?.sentiment_score}
								{@const fStageTags = fa?.stages?.values ?? []}
								<button
									type="button"
									onclick={() => openDrawer(f.id)}
									class="block w-full rounded border border-muted p-2 text-left text-xs hover:bg-gray-50"
								>
									<div
										class="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground"
									>
										<code>{fragmentLabel(f)}</code>
										<div class="flex flex-wrap items-center gap-1">
											{#if fSent !== null && fSent !== undefined}
												<span class="inline-flex items-center gap-1">
													<span
														class="inline-block h-1.5 w-1.5 rounded-full"
														style:background-color={SENTIMENT_PALETTE[fSent]}
													></span>
													<span class="font-mono">{fSent > 0 ? '+' : ''}{fSent}</span>
												</span>
											{/if}
											{#each fStageTags as s, i (i)}
												{#if s.stage_id === stage.id}
													<span class="rounded bg-gray-100 px-1.5 py-0.5">
														{s.step_id ?? '(stage-only)'}
													</span>
												{/if}
											{/each}
										</div>
									</div>
									<p class="mt-1 text-primary">{f.text}</p>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</RightDrawer>

<!-- Subtheme stats tertiary drawer — stacks above any primary fragment drawer -->
<GroupStatsDrawer stats={subthemeStats} onclose={closeSubthemeStats} level="secondary" />

<style>
	/*
		Smooth position / radius / opacity transitions for dots. The chart's
		viewBox is fixed, so when filters change only the SET of circles
		changes; individual circles that survive keep their cx/cy (deterministic
		jitter on fragment id + stage id + step id). The transitions here cover
		the cases where they do move — e.g., persona switch changes the stage
		taxonomy and jitter recomputes.
	*/
	/*
		Deliberate, slow easing on every chart transition so the pan/zoom
		motion reads as choreography rather than a snap. ~720ms is the
		"watchable" sweet spot: long enough to perceive the trajectory of
		individual dots, short enough that two consecutive clicks don't
		feel sluggish.
	*/
	/*
		`r` transition picks up `--r-delay`, a per-dot stagger seeded off the
		fragment/stage/step id. When the chart zooms in, each dot grows toward
		its larger radius at a slightly different moment — the result reads as
		a wave rather than a single block resize. The same delay drives the
		mount-time `viz-circle-pop` keyframe via `--viz-circle-delay`, so the
		two motions stay in sync.
	*/
	.dot {
		transition:
			cx 720ms cubic-bezier(0.22, 1, 0.36, 1),
			cy 720ms cubic-bezier(0.22, 1, 0.36, 1),
			r 360ms cubic-bezier(0.34, 1.56, 0.64, 1) var(--r-delay, 0ms),
			fill-opacity 260ms ease-out,
			stroke 200ms ease-out;
	}
	.stage-highlight,
	.step-highlight {
		transition:
			fill 240ms ease-out,
			x 720ms cubic-bezier(0.22, 1, 0.36, 1),
			width 720ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.stage-hit,
	.step-hit {
		transition:
			x 720ms cubic-bezier(0.22, 1, 0.36, 1),
			width 720ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.stage-label,
	.step-label {
		transition: x 720ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.subcol-divider {
		transition:
			opacity 320ms ease-out,
			x1 720ms cubic-bezier(0.22, 1, 0.36, 1),
			x2 720ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	/*
		Filter dropdown trigger — same kicker + value pill shape as the
		indication picker in WctglpTopbar, but sized for the workbench filter
		row (smaller, tighter padding). Stays understated until hover / open,
		mirroring the topbar's behavior so the family reads as one.
	*/
	.filter-trigger {
		display: inline-flex;
		flex-direction: row;
		align-items: center;
		gap: 0.625rem;
		min-width: 8.5rem;
		justify-content: space-between;
		height: 2rem;
		padding: 0 0.75rem;
		text-align: left;
		background: var(--card, #fff);
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 999px;
		cursor: pointer;
		transition:
			background-color 160ms ease,
			border-color 160ms ease,
			box-shadow 160ms ease;
	}

	.filter-trigger:hover {
		border-color: #94a3b8;
		background: #fafafa;
	}

	.filter-trigger[data-state='open'] {
		border-color: var(--primary, #312f28);
		box-shadow: 0 0 0 3px rgba(49, 47, 40, 0.08);
	}

	.filter-trigger-label {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}

	.filter-trigger-kicker {
		font-size: 0.5625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--muted-foreground, #64748b);
		line-height: 1;
	}

	.filter-trigger-value {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--primary, #312f28);
		line-height: 1.15;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

</style>


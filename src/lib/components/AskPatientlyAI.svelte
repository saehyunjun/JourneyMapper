<!--
	AskPatientlyAI — natural-language Q&A bar with answer pane.

	Sticky header bar with an input + ask button; once an answer arrives, an
	accordion pane expands underneath with a 2-column layout:
	  - Left (≈2/3): prose answer with **bold**, [frag:<id>] cite chips,
	    keyword chips (open lexicon-stats drawer), and sponsor chips (open the
	    local SponsorDrawer mounted at the bottom of this component).
	  - Right (≈1/3): a toggle between two views of the response:
	      • Citations — numbered fragment cards (the original right-rail).
	      • Visualizations — auto-generated charts derived from the citations'
	        sentiment / stage / speaker mix.

	Recent Q&A pairs are cached in localStorage so repeat questions return
	instantly without an API round-trip. The cache key is namespaced by
	indication so a question asked in one indication doesn't surface as a
	"recent" in another.
-->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import { Accordion } from 'bits-ui';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { Button } from '$lib/components/ui/button/index.js';
	import SponsorDrawer from '$lib/components/SponsorDrawer.svelte';
	import RadialDrillDonut from '$lib/charts/RadialDrillDonut.svelte';
	import type { DrillNode } from '$lib/charts/RadialDrillDonut.types';
	import { groupDrawer } from '$lib/stores/group-drawer.svelte.js';
	import { getEmotionMeta } from '$lib/utils/emotion-colors';
	import { countWords, tokenize } from '$lib/content/wctglpdemo-data/word-tokenize';
	import type { ObservedSponsor } from '$lib/types/observed-sponsor';

	type AskCitation = {
		id: string;
		text: string;
		speaker_id: string;
		speaker_label: string;
		sentiment: number | null;
		/** Plutchik emotion tag ids tagged on the cited fragment. */
		emotions?: string[];
		stages: Array<{ stage_id: string; step_id: string | null }>;
	};
	type AskResponse = {
		answer: string;
		citations: AskCitation[];
		missing_citations: string[];
		valid: boolean;
	};
	type HistoryEntry = {
		question: string;
		indication: string;
		response: AskResponse;
		timestamp: number;
	};
	let {
		indication,
		activeFragmentIds,
		onopenfragment
	}: {
		indication: string;
		/** IDs of fragments in the parent's active corpus. Used to decide
		 *  whether a citation click should defer to the parent (open its
		 *  fragment drawer) or stay in-component (scroll to the card). */
		activeFragmentIds: Set<string> | string[];
		/** Called when a citation refers to a fragment that lives in the
		 *  parent's active corpus. Parent decides what to do (typically open
		 *  its primary fragment drawer). */
		onopenfragment?: (id: string) => void;
	} = $props();

	const activeIdSet = $derived(
		activeFragmentIds instanceof Set ? activeFragmentIds : new Set(activeFragmentIds)
	);

	// v2 (2026-05-26): invalidate cache after sparse-data behavior was added to
	// the system prompt — old answers close with bare "dataset too small"
	// caveats that the new prompt is meant to replace.
	const HISTORY_KEY = 'workbench-ask-history-v2';
	const MAX_HISTORY = 20;
	const RECENT_VISIBLE = 5;
	const THINKING_STAGES = [
		'Loading taxonomy…',
		'Filtering matching fragments…',
		'Ranking topics…',
		'Pulling quotes…',
		'Validating citations…'
	];

	let question = $state('');
	let asking = $state(false);
	let askResponse = $state<AskResponse | null>(null);
	let askError = $state<string | null>(null);
	let thinkingIdx = $state(0);
	let history = $state<HistoryEntry[]>([]);
	let thinkingTimer: ReturnType<typeof setInterval> | null = null;
	let accordionValue = $state<string | undefined>(undefined);
	let rightPaneView = $state<'citations' | 'visualizations'>('visualizations');

	$effect(() => {
		const ind = indication;
		try {
			const raw = localStorage.getItem(HISTORY_KEY);
			if (raw) {
				const parsed = JSON.parse(raw) as HistoryEntry[];
				history = parsed;
				const latest = parsed.find((h) => h.indication === ind);
				if (latest) {
					question = latest.question;
					askResponse = latest.response;
					accordionValue = undefined;
				} else {
					askResponse = null;
				}
			}
		} catch {
			history = [];
		}
	});

	function startThinkingAnimation() {
		thinkingIdx = 0;
		if (thinkingTimer) clearInterval(thinkingTimer);
		thinkingTimer = setInterval(() => {
			thinkingIdx = (thinkingIdx + 1) % THINKING_STAGES.length;
		}, 1600);
	}
	function stopThinkingAnimation() {
		if (thinkingTimer) clearInterval(thinkingTimer);
		thinkingTimer = null;
	}

	function normalizeQ(q: string) {
		return q.trim().toLowerCase();
	}

	function cacheLookup(q: string, ind: string): HistoryEntry | null {
		const norm = normalizeQ(q);
		return history.find((h) => h.indication === ind && normalizeQ(h.question) === norm) ?? null;
	}

	function saveHistory(entry: HistoryEntry) {
		const next = [
			entry,
			...history.filter(
				(h) =>
					!(
						h.indication === entry.indication &&
						normalizeQ(h.question) === normalizeQ(entry.question)
					)
			)
		].slice(0, MAX_HISTORY);
		history = next;
		try {
			localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
		} catch {
			// Quota or storage disabled — keep in-memory only.
		}
	}

	const recentForIndication = $derived(
		history.filter((h) => h.indication === indication).slice(0, RECENT_VISIBLE)
	);

	async function ask() {
		const q = question.trim();
		if (!q || asking) return;
		askError = null;

		const hit = cacheLookup(q, indication);
		if (hit) {
			askResponse = hit.response;
			accordionValue = 'answer';
			return;
		}

		asking = true;
		askResponse = null;
		accordionValue = undefined;
		startThinkingAnimation();
		try {
			const res = await fetch('/api/workbench/ask', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ question: q, indication })
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
			}
			const response = body as AskResponse;
			askResponse = response;
			accordionValue = 'answer';
			saveHistory({
				question: q,
				indication,
				response: {
					answer: response.answer,
					citations: response.citations,
					missing_citations: response.missing_citations,
					valid: response.valid
				},
				timestamp: Date.now()
			});
		} catch (e) {
			askError = e instanceof Error ? e.message : String(e);
		} finally {
			asking = false;
			stopThinkingAnimation();
		}
	}

	function recallRecent(entry: HistoryEntry) {
		question = entry.question;
		askResponse = entry.response;
		askError = null;
		accordionValue = 'answer';
	}

	// === Keyword + sponsor matchers ===========================================
	// Lexicon and sponsor surface lists are loaded per-indication and rebuilt
	// into a single regex for matching keyword/sponsor mentions in answer text.

	type LexiconClusterLite = { id: string; label: string; variants: string[] };
	type KeywordMatcher = {
		re: RegExp;
		lookup: Map<string, { cluster_id: string; cluster_label: string }>;
	};

	let lexiconClusters = $state<LexiconClusterLite[]>([]);

	$effect(() => {
		const ind = indication;
		if (typeof window === 'undefined') return;
		let cancelled = false;
		fetch(`/api/lexicon?indication=${encodeURIComponent(ind)}`)
			.then((r) => (r.ok ? r.json() : null))
			.then((slice) => {
				if (cancelled || !slice) return;
				const arr = (slice.clusters ?? []) as Array<{
					id?: string;
					label?: string;
					variants?: unknown;
				}>;
				lexiconClusters = arr.map((c) => ({
					id: String(c.id ?? ''),
					label: String(c.label ?? c.id ?? ''),
					variants: Array.isArray(c.variants) ? c.variants.map(String) : []
				}));
			})
			.catch(() => {
				/* keep empty — keywords just won't highlight */
			});
		return () => {
			cancelled = true;
		};
	});

	function buildKeywordMatcher(clusters: LexiconClusterLite[]): KeywordMatcher | null {
		const lookup = new Map<string, { cluster_id: string; cluster_label: string }>();
		const surfaces: string[] = [];
		for (const c of clusters) {
			const label = c.label || c.id;
			for (const v of c.variants ?? []) {
				const surface = String(v).trim();
				if (!surface || surface.length < 4) continue;
				const key = surface.toLowerCase();
				if (!lookup.has(key)) {
					lookup.set(key, { cluster_id: c.id, cluster_label: label });
					surfaces.push(surface);
				}
			}
		}
		if (surfaces.length === 0) return null;
		surfaces.sort((a, b) => b.length - a.length);
		const pattern = surfaces.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
		const re = new RegExp(`\\b(?:${pattern})\\b`, 'gi');
		return { re, lookup };
	}

	const keywordMatcher = $derived(buildKeywordMatcher(lexiconClusters));

	type SponsorMatcher = {
		re: RegExp;
		lookup: Map<string, ObservedSponsor>;
	};

	let observedSponsors = $state<ObservedSponsor[]>([]);

	$effect(() => {
		const ind = indication;
		if (typeof window === 'undefined') return;
		let cancelled = false;
		fetch(`/api/sponsors-observed?indication=${encodeURIComponent(ind)}`)
			.then((r) => (r.ok ? r.json() : null))
			.then((slice) => {
				if (cancelled || !slice) return;
				observedSponsors = Array.isArray(slice.sponsors) ? slice.sponsors : [];
			})
			.catch(() => {
				// Keep empty — sponsors just won't highlight.
			});
		return () => {
			cancelled = true;
		};
	});

	function buildSponsorMatcher(sponsors: ObservedSponsor[]): SponsorMatcher | null {
		const lookup = new Map<string, ObservedSponsor>();
		const surfaces: string[] = [];
		for (const s of sponsors) {
			const name = s.name?.trim();
			if (!name || name.length < 4) continue;
			if (s.classes.length === 1 && s.classes[0] === 'INDIV') continue;
			const key = name.toLowerCase();
			if (!lookup.has(key)) {
				lookup.set(key, s);
				surfaces.push(name);
			}
		}
		if (surfaces.length === 0) return null;
		surfaces.sort((a, b) => b.length - a.length);
		const pattern = surfaces.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
		const re = new RegExp(`\\b(?:${pattern})\\b`, 'gi');
		return { re, lookup };
	}

	const sponsorMatcher = $derived(buildSponsorMatcher(observedSponsors));

	// === Answer parsing =======================================================

	type AnswerSegment =
		| { type: 'text'; text: string; bold?: boolean }
		| { type: 'keyword'; text: string; cluster_id: string; cluster_label: string; bold?: boolean }
		| { type: 'sponsor'; text: string; sponsor: ObservedSponsor; bold?: boolean }
		| { type: 'cite'; id: string; num: number };
	type ParsedAnswer = {
		segments: AnswerSegment[];
		citeOrder: Array<{ id: string; num: number }>;
		tryNext: string[];
	};

	function extractTryNext(answer: string): { body: string; tryNext: string[] } {
		const m = answer.match(/\n\s*Try next:\s*\n([\s\S]*)$/i);
		if (!m) return { body: answer, tryNext: [] };
		const block = m[1];
		const lines = block.split('\n');
		const tryNext: string[] = [];
		for (const raw of lines) {
			const line = raw.trim();
			if (!line) continue;
			const bm = line.match(/^[-*•]\s+(.*)$/) ?? line.match(/^\d+[.)]\s+(.*)$/);
			if (!bm) break;
			let q = bm[1].trim();
			q = q.replace(/^["“”'‘’](.*)["“”'‘’]$/, '$1').trim();
			if (q) tryNext.push(q);
		}
		const body = answer.slice(0, m.index).trimEnd();
		return { body, tryNext };
	}

	type Match =
		| { kind: 'keyword'; start: number; end: number; cluster_id: string; cluster_label: string }
		| { kind: 'sponsor'; start: number; end: number; sponsor: ObservedSponsor };

	function collectMatches(
		text: string,
		kw: KeywordMatcher | null,
		sp: SponsorMatcher | null
	): Match[] {
		const matches: Match[] = [];
		if (sp) {
			const localSp = new RegExp(sp.re.source, sp.re.flags);
			let m: RegExpExecArray | null;
			while ((m = localSp.exec(text)) !== null) {
				const meta = sp.lookup.get(m[0].toLowerCase());
				if (meta) {
					matches.push({
						kind: 'sponsor',
						start: m.index,
						end: m.index + m[0].length,
						sponsor: meta
					});
				}
			}
		}
		if (kw) {
			const localKw = new RegExp(kw.re.source, kw.re.flags);
			let m: RegExpExecArray | null;
			while ((m = localKw.exec(text)) !== null) {
				const meta = kw.lookup.get(m[0].toLowerCase());
				if (meta) {
					matches.push({
						kind: 'keyword',
						start: m.index,
						end: m.index + m[0].length,
						cluster_id: meta.cluster_id,
						cluster_label: meta.cluster_label
					});
				}
			}
		}
		matches.sort((a, b) => {
			if (a.start !== b.start) return a.start - b.start;
			const aLen = a.end - a.start;
			const bLen = b.end - b.start;
			if (aLen !== bLen) return bLen - aLen;
			if (a.kind !== b.kind) return a.kind === 'sponsor' ? -1 : 1;
			return 0;
		});
		const accepted: Match[] = [];
		let cursor = 0;
		for (const m of matches) {
			if (m.start >= cursor) {
				accepted.push(m);
				cursor = m.end;
			}
		}
		return accepted;
	}

	function splitByMatches(
		text: string,
		kw: KeywordMatcher | null,
		sp: SponsorMatcher | null,
		bold: boolean
	): AnswerSegment[] {
		if ((!kw && !sp) || !text) return text ? [{ type: 'text', text, bold }] : [];
		const matches = collectMatches(text, kw, sp);
		if (matches.length === 0) return [{ type: 'text', text, bold }];
		const out: AnswerSegment[] = [];
		let lastIdx = 0;
		for (const m of matches) {
			if (m.start > lastIdx) {
				out.push({ type: 'text', text: text.slice(lastIdx, m.start), bold });
			}
			const surface = text.slice(m.start, m.end);
			if (m.kind === 'keyword') {
				out.push({
					type: 'keyword',
					text: surface,
					cluster_id: m.cluster_id,
					cluster_label: m.cluster_label,
					bold
				});
			} else {
				out.push({ type: 'sponsor', text: surface, sponsor: m.sponsor, bold });
			}
			lastIdx = m.end;
		}
		if (lastIdx < text.length) {
			out.push({ type: 'text', text: text.slice(lastIdx), bold });
		}
		return out;
	}

	function parseAnswer(
		answer: string,
		kw: KeywordMatcher | null,
		sp: SponsorMatcher | null
	): ParsedAnswer {
		const { body, tryNext } = extractTryNext(answer);
		const segments: AnswerSegment[] = [];
		const citeMap = new Map<string, number>();
		const citeOrder: Array<{ id: string; num: number }> = [];
		const re = /(\*\*([^*]+)\*\*)|(\[frag:([a-zA-Z0-9_\-:.]+)\])/g;
		let lastIdx = 0;
		let m: RegExpExecArray | null;
		const pushText = (text: string, bold: boolean) => {
			segments.push(...splitByMatches(text, kw, sp, bold));
		};
		while ((m = re.exec(body)) !== null) {
			if (m.index > lastIdx) {
				pushText(body.slice(lastIdx, m.index), false);
			}
			if (m[1]) {
				pushText(m[2], true);
			} else if (m[3]) {
				const id = m[4];
				let num = citeMap.get(id);
				if (num === undefined) {
					num = citeMap.size + 1;
					citeMap.set(id, num);
					citeOrder.push({ id, num });
				}
				segments.push({ type: 'cite', id, num });
			}
			lastIdx = m.index + m[0].length;
		}
		if (lastIdx < body.length) {
			pushText(body.slice(lastIdx), false);
		}
		return { segments, citeOrder, tryNext };
	}

	const parsedAnswer = $derived<ParsedAnswer>(
		askResponse
			? parseAnswer(askResponse.answer, keywordMatcher, sponsorMatcher)
			: { segments: [], citeOrder: [], tryNext: [] }
	);

	function clickSuggestion(q: string) {
		question = q;
		ask();
	}

	function citationNumberFor(id: string): number | null {
		const found = parsedAnswer.citeOrder.find((c) => c.id === id);
		return found ? found.num : null;
	}

	function clickKeyword(clusterId: string) {
		groupDrawer.open('keyword', clusterId);
	}

	let activeSponsor = $state<ObservedSponsor | null>(null);
	function clickSponsor(sponsor: ObservedSponsor) {
		activeSponsor = sponsor;
	}
	function closeSponsorDrawer() {
		activeSponsor = null;
	}

	function openCitation(id: string) {
		if (activeIdSet.has(id)) {
			onopenfragment?.(id);
			return;
		}
		// Flip to the citations panel so the card is visible before we scroll.
		if (rightPaneView !== 'citations') rightPaneView = 'citations';
		queueMicrotask(() => {
			const el = document.getElementById(`citation-${id}`);
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
				el.classList.add('ring-2', 'ring-primary');
				setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 1500);
			}
		});
	}

	// === Visualizations derived from citations ================================
	// All breakdowns operate on the set of cited fragments, not the whole
	// corpus. This makes the right-rail charts a quick read of "what does this
	// answer rest on?" rather than a generic dashboard.

	// Sentiment → emotion hierarchy for the drill-down donut. Outer ring is
	// the sentiment band (positive / neutral / negative) of each cited
	// fragment; inner ring is the emotions actually tagged on the fragments
	// in that band. Emotions are counted by occurrence (one citation tagged
	// with two emotions contributes to both inner slices), so the inner total
	// can exceed the parent's citation count — that's intentional, since the
	// chart is reading "how is this slice emotionally textured", not a
	// disjoint partition.
	const SENTIMENT_BANDS: Array<{
		id: 'positive' | 'neutral' | 'negative';
		label: string;
		color: string;
		match: (n: number) => boolean;
	}> = [
		{ id: 'positive', label: 'Positive', color: '#34d399', match: (n) => n > 0 },
		{ id: 'neutral', label: 'Neutral', color: '#cbd5e1', match: (n) => n === 0 },
		{ id: 'negative', label: 'Negative', color: '#fb7185', match: (n) => n < 0 }
	];

	const sentimentEmotionHierarchy = $derived.by<DrillNode[]>(() => {
		const cs = askResponse?.citations ?? [];
		return SENTIMENT_BANDS.map((band) => {
			const inBand = cs.filter((c) => c.sentiment !== null && band.match(c.sentiment));
			const emotionCounts = new Map<string, number>();
			let untaggedFragments = 0;
			for (const c of inBand) {
				const tags = c.emotions ?? [];
				if (tags.length === 0) {
					untaggedFragments += 1;
					continue;
				}
				for (const eid of tags) {
					emotionCounts.set(eid, (emotionCounts.get(eid) ?? 0) + 1);
				}
			}
			const children: DrillNode[] = Array.from(emotionCounts.entries())
				.map(([id, value]) => {
					const meta = getEmotionMeta(id);
					return { id, label: meta.label || id, color: meta.color, value };
				})
				.sort((a, b) => b.value - a.value);
			// "Untagged" sits at the end as a quiet grey slice — so a band
			// with mostly-untagged fragments still drills into something the
			// reader can see, instead of leaving the inner ring empty.
			if (untaggedFragments > 0) {
				children.push({
					id: `untagged-${band.id}`,
					label: 'Untagged',
					color: '#e2e8f0',
					value: untaggedFragments
				});
			}
			return {
				id: band.id,
				label: band.label,
				value: inBand.length,
				color: band.color,
				children
			};
		}).filter((b) => b.value > 0);
	});

	let drillSelectedId = $state<string | null>(null);
	$effect(() => {
		void askResponse;
		drillSelectedId = null;
	});

	const hasVisualizations = $derived((askResponse?.citations.length ?? 0) > 0);

	// When a fresh answer arrives, surface the Visualizations view first —
	// the chart-led read is the primary entry point; citations are a drill-in.
	$effect(() => {
		void askResponse;
		rightPaneView = 'visualizations';
	});

	// Sentiment waffle, per topic. Each top-N word becomes a row; each cell
	// in the row is one fragment that mentions that word, coloured by the
	// fragment's sentiment band. Untagged fragments fall back to a quiet grey
	// so they're still clickable. Rows are ranked by fragment count.
	const SENTIMENT_UNTAGGED_COLOR = '#e2e8f0';
	const TOPIC_WAFFLE_ROWS = 8;

	function cellForCitation(c: AskCitation) {
		const band = SENTIMENT_BANDS.find(
			(b) => c.sentiment !== null && b.match(c.sentiment)
		);
		return {
			id: c.id,
			speaker_label: c.speaker_label,
			sentiment: c.sentiment,
			color: band ? band.color : SENTIMENT_UNTAGGED_COLOR,
			bandLabel: band ? band.label : 'Untagged'
		};
	}

	const sentimentWaffleRows = $derived.by(() => {
		const cs = askResponse?.citations ?? [];
		if (cs.length === 0) return [] as Array<{
			word: string;
			cells: ReturnType<typeof cellForCitation>[];
		}>;
		const ranked = countWords(cs.map((c) => c.text)).slice(0, TOPIC_WAFFLE_ROWS);
		const orderRank = (n: number | null) =>
			n === null ? 4 : n > 0 ? 0 : n === 0 ? 2 : 3;
		return ranked
			.map(({ word }) => {
				const cells = cs
					.filter((c) => tokenize(c.text).includes(word))
					.map(cellForCitation)
					.sort((a, b) => orderRank(a.sentiment) - orderRank(b.sentiment));
				return { word, cells };
			})
			.filter((row) => row.cells.length > 0);
	});

	const sentimentWaffleLegend = $derived.by(() => {
		const seen = new Map<string, { label: string; color: string }>();
		// Always show the three named bands in a stable order so the legend
		// doesn't reshuffle as different topics are inspected. Add Untagged
		// only if it actually appears in the data.
		for (const b of SENTIMENT_BANDS) {
			seen.set(b.label, { label: b.label, color: b.color });
		}
		const hasUntagged = sentimentWaffleRows.some((row) =>
			row.cells.some((c) => c.sentiment === null)
		);
		if (hasUntagged) {
			seen.set('Untagged', { label: 'Untagged', color: SENTIMENT_UNTAGGED_COLOR });
		}
		return Array.from(seen.values());
	});
</script>

<div
	class="sticky top-0 z-40 w-full border-b border-muted bg-linear-to-r from-mauve-200/70 via-white to-orange-100/70 shadow-sm backdrop-blur"
>
	<div class="mx-auto max-w-6xl px-6 py-2">
		<Accordion.Root type="single" bind:value={accordionValue}>
			<Accordion.Item value="answer">
				<div class="flex items-center gap-3">
					<h2 class="whitespace-nowrap text-sm font-medium text-orange-700">Ask PatientlyAI</h2>
					<form
						onsubmit={(e) => {
							e.preventDefault();
							ask();
						}}
						class="flex flex-1 gap-2"
					>
						<div
							class="flex-1 rounded-full bg-linear-to-r from-mauve-200 via-purple-200 to-orange-200 p-px shadow-sm"
						>
							<input
								type="text"
								bind:value={question}
								placeholder="e.g., What is the most discussed trial barrier?"
								disabled={asking}
								class="block w-full rounded-full bg-white px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-300 disabled:opacity-60"
							/>
						</div>
						<button
							type="submit"
							disabled={asking || !question.trim()}
							class="rounded-full bg-linear-to-r from-orange-200 to-orange-400 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition-all duration-600 hover:cursor-pointer hover:from-orange-100 hover:to-orange-200 disabled:opacity-50"
						>
							{asking ? 'Thinking…' : 'Ask'}
						</button>
					</form>
				</div>

				{#if recentForIndication.length > 0 && !asking && !askError && (!askResponse || accordionValue === 'answer')}
					<div class="mt-2 flex flex-wrap items-center gap-1.5">
						<span class="text-[10px] uppercase tracking-wider text-muted-foreground">Recent</span>
						{#each recentForIndication as r (r.question + r.timestamp)}
							<button
								type="button"
								onclick={() => recallRecent(r)}
								class="rounded-full border border-muted bg-white/70 px-2 py-0.5 text-[11px] text-secondary-foreground hover:border-indigo-300 hover:bg-indigo-50"
								title="Asked {new Date(r.timestamp).toLocaleString()} — instant from cache"
							>
								{r.question.length > 60 ? r.question.slice(0, 60) + '…' : r.question}
							</button>
						{/each}
					</div>
				{/if}

				{#if asking}
					<div class="mt-2 flex items-center gap-2 text-xs text-gray-600">
						<svg class="h-3.5 w-3.5 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
							<circle
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="3"
								stroke-opacity="0.2"
							/>
							<path
								d="M22 12a10 10 0 0 1-10 10"
								stroke="currentColor"
								stroke-width="3"
								stroke-linecap="round"
							/>
						</svg>
						{#key thinkingIdx}
							<span in:fade={{ duration: 220 }} out:fade={{ duration: 120 }}>
								{THINKING_STAGES[thinkingIdx]}
							</span>
						{/key}
					</div>
				{/if}

				{#if askError}
					<div class="mt-2 rounded border border-accent-orange bg-red-50 p-2 text-xs text-red-800">
						{askError}
					</div>
				{/if}

				<Accordion.Content class="ask-accordion-content overflow-hidden">
					{#if askResponse}
						<!--
							Outer content is height-capped so the toggle chevron pinned to
							top-full of the sticky parent never falls below the viewport
							when a long answer arrives. Each pane scrolls independently.
						-->
						<div
							class="space-y-3 pt-3"
							style="max-height: calc(100vh - 140px); display: flex; flex-direction: column;"
						>
							{#if !askResponse.valid}
								<div
									class="shrink-0 rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900"
								>
									Some citations couldn't be resolved against the corpus:
									{askResponse.missing_citations.join(', ')}
								</div>
							{/if}
							<!--
								Two-column layout: prose answer ≈2/3 on the left, citations
								or visualizations ≈1/3 on the right. Columns stack below lg.
								Both columns share the bounded height and scroll independently.
							-->
							<div
								class="grid min-h-0 flex-1 grid-cols-1 gap-10 md:gap-24 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
							>
								<div class="min-h-0 overflow-y-auto whitespace-pre-wrap pr-2 text-sm leading-relaxed text-primary overflow-y-auto">
									{#each parsedAnswer.segments as seg, i (i)}
										{#if seg.type === 'text'}
											{#if seg.bold}
												<strong class="font-semibold">{seg.text}</strong>
											{:else}
												<span>{seg.text}</span>
											{/if}
										{:else if seg.type === 'keyword'}
											<button
												type="button"
												onclick={() => clickKeyword(seg.cluster_id)}
												class="cursor-pointer underline decoration-indigo-300 decoration-dotted underline-offset-2 transition-colors hover:bg-indigo-50 hover:text-indigo-700 hover:decoration-indigo-500 hover:decoration-solid {seg.bold
													? 'font-semibold'
													: ''}"
												title="Open stats for {seg.cluster_label}"
											>{seg.text}</button>
										{:else if seg.type === 'sponsor'}
											<button
												type="button"
												onclick={() => clickSponsor(seg.sponsor)}
												class="cursor-pointer underline decoration-teal-400 decoration-dotted underline-offset-2 transition-colors hover:bg-teal-50 hover:text-teal-700 hover:decoration-teal-500 hover:decoration-solid {seg.bold
													? 'font-semibold'
													: ''}"
												title="Open sponsor detail · {seg.sponsor.total_count} trials in this indication"
											>{seg.text}</button>
										{:else}
											<button
												type="button"
												onclick={() => openCitation(seg.id)}
												class="mx-0.5 inline-flex h-4 w-4 -translate-y-px items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-purple-600 align-middle text-[9px] font-semibold leading-none text-white shadow-sm hover:from-indigo-400 hover:to-purple-500"
												title={seg.id}
												aria-label="Citation {seg.num}: {seg.id}"
											>
												{seg.num}
											</button>
										{/if}
									{/each}
									{#if parsedAnswer.tryNext.length > 0}
										<div class="mt-4 flex flex-col items-start gap-1.5">
											<p
												class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
											>
												Try next
											</p>
											{#each parsedAnswer.tryNext as q, i (i)}
												<Button
													variant="secondary"
													size="sm"
													onclick={() => clickSuggestion(q)}
													disabled={asking}
													title="Ask: {q}"
												>
													{q}
												</Button>
											{/each}
										</div>
									{/if}
								</div>

								{#if askResponse.citations.length > 0}
									<aside class="flex min-h-0 flex-col gap-3 overflow-y-auto pr-2 text-xs">
										<!-- Right-pane toggle: visualizations primary, citations as drill-in. -->
										<div
											class="inline-flex w-fit shrink-0 rounded-full border border-muted bg-white/70 p-0.5 text-[11px]"
											role="tablist"
											aria-label="Right column view"
										>
											<button
												type="button"
												role="tab"
												aria-selected={rightPaneView === 'visualizations'}
												onclick={() => (rightPaneView = 'visualizations')}
												disabled={!hasVisualizations}
												class="rounded-full px-2.5 py-1 transition-colors disabled:opacity-50 {rightPaneView ===
												'visualizations'
													? 'bg-linear-to-r from-indigo-600 to-purple-600 font-semibold text-white shadow-sm'
													: 'text-secondary-foreground hover:text-primary'}"
												title={hasVisualizations
													? 'View charts derived from the cited fragments'
													: 'Not enough citation metadata to chart'}
											>
												Visualizations
											</button>
											<button
												type="button"
												role="tab"
												aria-selected={rightPaneView === 'citations'}
												onclick={() => (rightPaneView = 'citations')}
												class="rounded-full px-2.5 py-1 transition-colors {rightPaneView ===
												'citations'
													? 'bg-linear-to-r from-indigo-600 to-purple-600 font-semibold text-white shadow-sm'
													: 'text-secondary-foreground hover:text-primary'}"
											>
												Citations ({askResponse.citations.length})
											</button>
										</div>

										{#if rightPaneView === 'citations'}
											<div class="flex flex-col gap-2">
												{#each askResponse.citations as c (c.id)}
													{@const num = citationNumberFor(c.id)}
													<button
														type="button"
														id="citation-{c.id}"
														onclick={() => openCitation(c.id)}
														class="group block w-full rounded border border-muted bg-white p-2 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
														title="Open fragment detail"
													>
														<div
															class="flex items-center justify-between gap-2 text-[10px] text-muted-foreground"
														>
															<span class="inline-flex min-w-0 items-center gap-1.5">
																{#if num !== null}
																	<span
																		class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-purple-600 text-[9px] font-semibold text-white"
																	>
																		{num}
																	</span>
																{/if}
																<span class="truncate">{c.speaker_label}</span>
															</span>
														</div>
														<p class="ask-cite-quote mt-1 text-primary">"{c.text}"</p>
														{#if c.sentiment !== null || c.stages.length > 0}
															<div
																class="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground"
															>
																{#if c.sentiment !== null}
																	<span class="rounded bg-gray-100 px-1.5 py-0.5">
																		sentiment {c.sentiment > 0 ? '+' : ''}{c.sentiment}
																	</span>
																{/if}
																{#each c.stages as s, j (j)}
																	<span
																		class="max-w-full truncate rounded bg-gray-100 px-1.5 py-0.5"
																	>
																		{s.stage_id}{s.step_id ? ' / ' + s.step_id : ''}
																	</span>
																{/each}
															</div>
														{/if}
													</button>
												{/each}
											</div>
										{:else}
											<!--
												Visualizations panel: sentiment+emotions donut on top,
												sentiment waffle bar below. Each cell in the waffle is one
												cited fragment — click to open the fragment drawer via the
												shared openCitation flow (linking up into the tertiary drawer
												stack when the citation lives in the parent corpus).
											-->
											<div class="flex flex-col gap-5">
												{#if sentimentEmotionHierarchy.length > 0}
													<section class="rounded border border-muted bg-white p-3">
														<div class="flex items-baseline justify-between gap-2">
															<p
																class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
															>
																Sentiment &amp; emotions
															</p>
															<p class="text-[10px] text-muted-foreground">
																Click a band to drill in
															</p>
														</div>
														<div class="mt-2 flex justify-center">
															<RadialDrillDonut
																data={sentimentEmotionHierarchy}
																size={200}
																outerThickness={20}
																innerThickness={16}
																gap={5}
																animate
																showLegend={false}
																bind:selectedId={drillSelectedId}
																emptyLabel="No emotions tagged"
															/>
														</div>
													</section>
												{/if}

												{#if sentimentWaffleRows.length > 0}
													<section class="rounded border border-muted bg-white p-3">
														<div class="flex items-baseline justify-between gap-2">
															<p
																class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
															>
																Sentiment waffle by topic ({sentimentWaffleRows.length})
															</p>
															<p class="text-[10px] text-muted-foreground">
																Click a cell to open fragment
															</p>
														</div>
														<ul class="mt-2 flex flex-col gap-2">
															{#each sentimentWaffleRows as row (row.word)}
																<li class="flex flex-col gap-1">
																	<div
																		class="flex items-baseline justify-between gap-2 text-[11px]"
																	>
																		<span class="truncate text-primary">{row.word}</span>
																		<span class="shrink-0 tabular-nums text-muted-foreground"
																			>{row.cells.length}</span
																		>
																	</div>
																	<div class="flex flex-wrap gap-1">
																		{#each row.cells as cell, idx (row.word + '|' + cell.id + '|' + idx)}
																			<button
																				type="button"
																				onclick={() => openCitation(cell.id)}
																				class="h-3.5 w-3.5 rounded-sm transition-transform hover:scale-125 hover:ring-2 hover:ring-indigo-300 hover:ring-offset-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
																				style:background-color={cell.color}
																				title="{cell.speaker_label} · {row.word} · sentiment {cell.sentiment ===
																				null
																					? 'untagged'
																					: cell.sentiment > 0
																						? '+' + cell.sentiment
																						: cell.sentiment} — click to open"
																				aria-label="Open fragment from {cell.speaker_label} mentioning {row.word}"
																			></button>
																		{/each}
																	</div>
																</li>
															{/each}
														</ul>
														{#if sentimentWaffleLegend.length > 0}
															<div
																class="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-muted pt-2 text-[10px] text-muted-foreground"
															>
																{#each sentimentWaffleLegend as band (band.label)}
																	<span class="inline-flex items-center gap-1">
																		<span
																			class="inline-block h-2 w-2 rounded-sm"
																			style:background-color={band.color}
																		></span>
																		{band.label}
																	</span>
																{/each}
															</div>
														{/if}
													</section>
												{/if}

												{#if !hasVisualizations}
													<p class="text-[11px] text-muted-foreground">
														No chartable metadata on the cited fragments yet.
													</p>
												{/if}
											</div>
										{/if}
									</aside>
								{/if}
							</div>
						</div>
					{/if}
				</Accordion.Content>
			</Accordion.Item>
		</Accordion.Root>
	</div>

	<!-- Animated bottom strip: idle muted → animated rainbow while thinking → steady green-blue when done -->
	<div
		class="ask-strip w-full"
		class:ask-strip-idle={!asking && !askResponse}
		class:ask-strip-thinking={asking}
		class:ask-strip-done={!asking && askResponse}
		aria-hidden="true"
	></div>

	{#if askResponse}
		<button
			type="button"
			onclick={() => (accordionValue = accordionValue === 'answer' ? undefined : 'answer')}
			aria-expanded={accordionValue === 'answer'}
			aria-label="Toggle answer panel"
			class="absolute left-1/2 top-full z-40 flex h-5 w-12 -translate-x-1/2 items-center justify-center rounded-b-md border border-t-0 border-gray-300 bg-white text-gray-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
		>
			<ChevronDown
				strokeWidth={2.5}
				class="h-4 w-4 transition-transform duration-200 {accordionValue === 'answer'
					? 'rotate-180'
					: ''}"
			/>
		</button>
	{/if}
</div>

<SponsorDrawer sponsor={activeSponsor} onclose={closeSponsorDrawer} level="top" />

<style>
	/*
		Sticky Ask-The-Workbench bottom strip.
		- idle: a barely-there gray stripe, just enough to anchor the bar.
		- thinking: rainbow gradient slides left-to-right on a 2.6s loop.
		- done: steady green-blue, no animation per spec.
	*/
	.ask-strip-idle {
		background: linear-gradient(90deg, #e5e7eb, #f3f4f6, #e5e7eb);
	}
	.ask-strip-thinking {
		background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #f59e0b, #a855f7, #6366f1);
		background-size: 300% 100%;
		animation: ask-strip-slide 2.6s linear infinite;
	}
	.ask-strip-done {
		background: linear-gradient(90deg, #10b981, #06b6d4);
	}
	@keyframes ask-strip-slide {
		0% {
			background-position: 0% 50%;
		}
		100% {
			background-position: 200% 50%;
		}
	}

	/*
		Cited-fragment quote — keep the right-rail card compact regardless of
		how long the underlying speech is.
	*/
	:global(.ask-cite-quote) {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.4;
	}

	:global(.ask-accordion-content[data-state='open']) {
		animation: ask-accordion-down 360ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	:global(.ask-accordion-content[data-state='closed']) {
		animation: ask-accordion-up 280ms cubic-bezier(0.32, 0.72, 0, 1);
	}
	@keyframes ask-accordion-down {
		from {
			height: 0;
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			height: var(--bits-accordion-content-height);
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes ask-accordion-up {
		from {
			height: var(--bits-accordion-content-height);
			opacity: 1;
			transform: translateY(0);
		}
		to {
			height: 0;
			opacity: 0;
			transform: translateY(-4px);
		}
	}
</style>

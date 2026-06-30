<!--
	AskPanel — inner content of the Ask PatientlyAI drawer.

	Reads its question/response state from the global askStore so the
	user can fire a question, close the drawer, navigate around, and
	open the drawer back up to find the answer waiting (or the same
	thinking indicator they left).

	Top: question form + comparison-with picker + recent pills + status
	(thinking spinner / error banner).
	Body: two-column layout — prose answer on the left, citations or
	visualizations on the right. When the answer spans >1 indication,
	a sentiment-by-indication bar chart appears in the visualizations
	pane above the existing donut + waffle.

	Citation clicks: if the cited fragment lives in the host page's
	"active corpus" (passed via onopenfragment), defer to the page;
	otherwise scroll to the in-drawer citation card.
-->
<script lang="ts">
	import { fade } from 'svelte/transition';
	import { Button } from '$lib/components/ui/button/index.js';
	import SponsorDrawer from '$lib/components/SponsorDrawer.svelte';
	import { groupDrawer } from '$lib/stores/group-drawer.svelte.js';
	import type { ObservedSponsor } from '$lib/types/observed-sponsor';
	import { askStore } from '$lib/stores/ask-patientlyai.svelte';
	import IndicationComparisonChart from './IndicationComparisonChart.svelte';
	import TopicsCitedChart from './TopicsCitedChart.svelte';
	import StagesCitedChart from './StagesCitedChart.svelte';
	import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
	import ThumbsDown from '@lucide/svelte/icons/thumbs-down';

	export type AskIndicationOption = { id: string; label: string };

	let {
		indication,
		activeFragmentIds = new Set<string>(),
		availableIndications = [],
		onopenfragment
	}: {
		indication: string;
		activeFragmentIds?: Set<string> | string[];
		availableIndications?: AskIndicationOption[];
		onopenfragment?: (id: string) => void;
	} = $props();

	const activeIdSet = $derived(
		activeFragmentIds instanceof Set ? activeFragmentIds : new Set(activeFragmentIds)
	);

	const THINKING_STAGES = [
		'Loading taxonomy…',
		'Filtering matching quotes…',
		'Ranking topics…',
		'Pulling quotes…',
		'Validating citations…'
	];

	const RECENT_VISIBLE = 5;

	let thinkingIdx = $state(0);
	let thinkingTimer: ReturnType<typeof setInterval> | null = null;
	let rightPaneView = $state<'citations' | 'visualizations'>('visualizations');

	const asking = $derived(askStore.asking);
	const askResponse = $derived(askStore.response);
	const askError = $derived(askStore.error);
	const selectedAdditional = $derived(askStore.selectedAdditional);

	$effect(() => {
		if (asking) {
			thinkingIdx = 0;
			thinkingTimer = setInterval(() => {
				thinkingIdx = (thinkingIdx + 1) % THINKING_STAGES.length;
			}, 1600);
			return () => {
				if (thinkingTimer) clearInterval(thinkingTimer);
				thinkingTimer = null;
			};
		}
	});

	// Recent pills: same-indication questions surfaced as instant-cache
	// shortcuts. Matches the legacy behaviour.
	const recentForIndication = $derived(
		askStore.history.filter((h) => h.indication === indication).slice(0, RECENT_VISIBLE)
	);

	const indicationLabelById = $derived.by(() => {
		const m = new Map<string, string>();
		for (const opt of availableIndications) m.set(opt.id, opt.label);
		return m;
	});

	// "Compare with" chips exclude the active indication — the user can't
	// compare the active indication against itself. The full
	// availableIndications list is kept for label lookup so the sentiment
	// chart and citation chips can humanize the active indication's slug.
	const comparablePicks = $derived(availableIndications.filter((opt) => opt.id !== indication));

	function labelForIndication(id: string): string {
		return indicationLabelById.get(id) ?? id;
	}

	function submitAsk() {
		void askStore.ask({ question: askStore.question, indication });
	}

	function toggleAdditional(id: string) {
		askStore.toggleAdditional(id);
	}

	function clickRecent(entry: ReturnType<typeof askStore.history.at>) {
		if (!entry) return;
		askStore.recall(entry);
	}

	// === Keyword + sponsor matchers ==========================================
	// Lexicon + sponsor surface lists fetched per indication and rebuilt into
	// a single regex for matching keyword/sponsor mentions in answer text.

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
		return { re: new RegExp(`\\b(?:${pattern})\\b`, 'gi'), lookup };
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
			.catch(() => {});
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
		return { re: new RegExp(`\\b(?:${pattern})\\b`, 'gi'), lookup };
	}

	const sponsorMatcher = $derived(buildSponsorMatcher(observedSponsors));

	// === Answer parsing ======================================================

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
		sp: SponsorMatcher | null,
		shared?: { citeMap: Map<string, number>; citeOrder: Array<{ id: string; num: number }> }
	): ParsedAnswer {
		const { body, tryNext } = extractTryNext(answer);
		const segments: AnswerSegment[] = [];
		const citeMap = shared?.citeMap ?? new Map<string, number>();
		const citeOrder = shared?.citeOrder ?? [];
		// Order matters: **bold** must match before single *…* so the regex
		// doesn't eat the inner content of a bold run. Single-asterisk runs
		// are rendered as bold too (per the no-italics hard rule [[no-italics]]) —
		// the model emits them around inline quote attribution, and leaving
		// them as literal asterisks makes the answer look broken.
		const re = /(\*\*([^*]+?)\*\*)|(\*([^*\n]+?)\*)|(\[frag:([a-zA-Z0-9_\-:.]+)\])/g;
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
				pushText(m[4], true);
			} else if (m[5]) {
				const id = m[6];
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

	function clickSuggestion(q: string) {
		askStore.setQuestion(q);
		submitAsk();
	}

	function citationNumberFor(id: string): number | null {
		const found = allCiteOrder.find((c) => c.id === id);
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

	// === Visualizations derived from citations ==============================
	// The viz pane stays focused on three orthogonal reads of the cited
	// quotes so each chart tells a distinct story instead of restating the
	// same sentiment polarity three times:
	//   1. Sentiment by indication        (IndicationComparisonChart)
	//   2. Topics referenced              (TopicsCitedChart)
	//   3. Journey stages cited           (StagesCitedChart)

	const hasVisualizations = $derived((askResponse?.citations.length ?? 0) > 0);
	const showIndicationChips = $derived((askResponse?.indications?.length ?? 0) > 1);
	const responseIndications = $derived(askResponse?.indications ?? []);
	const stageLabelsMap = $derived(askResponse?.stage_labels ?? {});

	$effect(() => {
		void askResponse;
		rightPaneView = 'visualizations';
	});

	// === Leading-summary extraction =========================================
	// The system prompt asks the model to lead with a 1–2 sentence headline
	// finding. We pluck that opening block off the front of the answer and
	// render it as a callout above the main prose so the reader gets the
	// takeaway before scrolling. Falls back gracefully if the model produced
	// a bullet-style or sub-headed first block.

	function splitSummary(answer: string): { summary: string | null; rest: string } {
		const trimmed = answer.trimStart();
		// Take the first paragraph (up to the first blank line). If it's not
		// too long and doesn't start with a list marker or bold heading,
		// promote it to the summary callout.
		const firstBreak = trimmed.search(/\n\s*\n/);
		const first = firstBreak === -1 ? trimmed : trimmed.slice(0, firstBreak);
		const rest = firstBreak === -1 ? '' : trimmed.slice(firstBreak).replace(/^\s+/, '');
		const looksLikeList = /^([-*•]\s|\d+[.)]\s|#+\s)/.test(first.trimStart());
		const wordCount = first.split(/\s+/).filter(Boolean).length;
		if (looksLikeList || wordCount < 6 || wordCount > 80) {
			return { summary: null, rest: answer };
		}
		return { summary: first.trim(), rest };
	}

	const summarySplit = $derived(
		askResponse ? splitSummary(askResponse.answer) : { summary: null as string | null, rest: '' }
	);

	// Parse summary + body with a shared citation map so the chip numbers
	// are continuous and unique across both regions (citation #1 in the
	// summary still reads as #1 in the body if it appears again).
	const parsedAnswer = $derived.by<{ summary: ParsedAnswer | null; body: ParsedAnswer }>(() => {
		if (!askResponse) {
			return {
				summary: null,
				body: { segments: [], citeOrder: [], tryNext: [] }
			};
		}
		const shared = { citeMap: new Map<string, number>(), citeOrder: [] as Array<{ id: string; num: number }> };
		const summary = summarySplit.summary
			? parseAnswer(summarySplit.summary, keywordMatcher, sponsorMatcher, shared)
			: null;
		const body = parseAnswer(
			summarySplit.rest || askResponse.answer,
			keywordMatcher,
			sponsorMatcher,
			shared
		);
		return { summary, body };
	});

	const allCiteOrder = $derived(parsedAnswer.body.citeOrder);

	// === Paragraph grouping for per-part feedback ===========================
	// The thumbs-up/down affordance lives at the end of each "part" of the
	// answer: part 0 is the summary callout; parts 1..N are the body
	// paragraphs split on blank-line boundaries. We re-walk the parsed body
	// segments and group them, preserving inline keyword / sponsor / cite
	// chips inside each paragraph.

	type Paragraph = { index: number; segments: AnswerSegment[] };

	function groupParagraphs(segments: AnswerSegment[], startIdx: number): Paragraph[] {
		const groups: Paragraph[] = [];
		let current: AnswerSegment[] = [];
		let idx = startIdx;
		const flush = () => {
			const meaningful = current.some(
				(s) => s.type !== 'text' || s.text.trim().length > 0
			);
			if (meaningful) groups.push({ index: idx++, segments: current });
			current = [];
		};
		for (const seg of segments) {
			if (seg.type !== 'text') {
				current.push(seg);
				continue;
			}
			const parts = seg.text.split(/\n\s*\n/);
			for (let i = 0; i < parts.length; i += 1) {
				if (i > 0) flush();
				if (parts[i]) {
					current.push({ type: 'text', text: parts[i], bold: seg.bold });
				}
			}
		}
		flush();
		return groups;
	}

	const bodyParagraphs = $derived(
		askResponse ? groupParagraphs(parsedAnswer.body.segments, 1) : []
	);

	const SUMMARY_PART = 0;

	function thumbsClass(active: boolean, kind: 'up' | 'down'): string {
		if (!active) {
			return 'text-slate-400 hover:text-slate-700';
		}
		return kind === 'up'
			? 'text-emerald-600'
			: 'text-rose-600';
	}
</script>

<div class="flex h-full flex-col gap-3 px-5 py-4">
	<!-- Header / input row -->
	<div class="flex flex-col gap-2 border-b border-muted pb-3">
		<div class="flex items-center justify-between gap-3">
			<div>
				<p class="text-[10px] font-semibold uppercase tracking-wider text-orange-700">
					Ask PatientlyAI
				</p>
				<p class="text-[11px] text-slate-500">
					Scoped to <span class="font-medium text-slate-700">{labelForIndication(indication)}</span>
					{#if selectedAdditional.length > 0}
						· comparing with {selectedAdditional.map(labelForIndication).join(', ')}
					{/if}
				</p>
			</div>
		</div>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				submitAsk();
			}}
			class="flex gap-2"
		>
			<div
				class="flex-1 rounded-full bg-linear-to-r from-mauve-200 via-purple-200 to-orange-200 p-px shadow-sm"
			>
				<input
					type="text"
					value={askStore.question}
					oninput={(e) => askStore.setQuestion(e.currentTarget.value)}
					placeholder="e.g., What is the most discussed trial barrier?"
					disabled={asking}
					class="block w-full rounded-full bg-white px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-300 disabled:opacity-60"
				/>
			</div>
			<button
				type="submit"
				disabled={asking || !askStore.question.trim()}
				class="rounded-full bg-linear-to-r from-orange-200 to-orange-400 px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition-all duration-600 hover:cursor-pointer hover:from-orange-100 hover:to-orange-200 disabled:opacity-50"
			>
				{asking ? 'Thinking…' : 'Ask'}
			</button>
		</form>

		{#if comparablePicks.length > 0}
			<div class="flex flex-wrap items-center gap-1.5">
				<span class="text-[10px] uppercase tracking-wider text-muted-foreground">Compare with</span>
				{#each comparablePicks as opt (opt.id)}
					{@const on = selectedAdditional.includes(opt.id)}
					<button
						type="button"
						onclick={() => toggleAdditional(opt.id)}
						disabled={asking}
						aria-pressed={on}
						class="rounded-full border px-2 py-0.5 text-[11px] transition-colors disabled:opacity-50 {on
							? 'border-indigo-400 bg-indigo-100 text-indigo-800'
							: 'border-muted bg-white/70 text-secondary-foreground hover:border-indigo-300 hover:bg-indigo-50'}"
						title={on
							? `Remove ${opt.label} from comparison`
							: `Fold ${opt.label} into the workbench pool for this question`}
					>
						{on ? '✓ ' : '+ '}{opt.label}
					</button>
				{/each}
				{#if selectedAdditional.length > 0}
					<button
						type="button"
						onclick={() => askStore.clearAdditional()}
						disabled={asking}
						class="text-[10px] text-muted-foreground underline hover:text-primary disabled:opacity-50"
					>
						clear
					</button>
				{/if}
			</div>
		{/if}

		{#if recentForIndication.length > 0 && !asking && !askError}
			<div class="flex flex-wrap items-center gap-1.5">
				<span class="text-[10px] uppercase tracking-wider text-muted-foreground">Recent</span>
				{#each recentForIndication as r (r.question + r.timestamp)}
					<button
						type="button"
						onclick={() => clickRecent(r)}
						class="rounded-full border border-muted bg-white/70 px-2 py-0.5 text-[11px] text-secondary-foreground hover:border-indigo-300 hover:bg-indigo-50"
						title="Asked {new Date(r.timestamp).toLocaleString()}{r.additional_indications?.length
							? ` · with ${r.additional_indications.map(labelForIndication).join(', ')}`
							: ''} — instant from cache"
					>
						{r.question.length > 60 ? r.question.slice(0, 60) + '…' : r.question}
					</button>
				{/each}
			</div>
		{/if}

		{#if asking}
			<div class="flex items-center gap-2 text-xs text-gray-600">
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
				<span class="ml-auto text-[10px] text-muted-foreground">
					Feel free to navigate — we'll notify you when the answer's ready.
				</span>
			</div>
		{/if}

		{#if askError}
			<div class="rounded border border-accent-orange bg-red-50 p-2 text-xs text-red-800">
				{askError}
			</div>
		{/if}
	</div>

	<!-- Body: answer + right pane -->
	{#if askResponse}
		<div class="flex min-h-0 flex-1 flex-col gap-3">
			{#if !askResponse.valid}
				<div class="shrink-0 rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
					Some quote references couldn't be resolved:
					{askResponse.missing_citations.join(', ')}
				</div>
			{/if}

			<div class="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
				<!--
					Inline-segment renderer. Shared between the summary callout
					and each body paragraph so the rich elements (bold text,
					keyword chips, sponsor chips, citation chips) render
					identically wherever they appear.
				-->
				{#snippet inlineSegments(segments: AnswerSegment[])}
					{#each segments as seg, i (i)}
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
							>{seg.num}</button>
						{/if}
					{/each}
				{/snippet}

				<!--
					Per-part feedback affordance. Lives at the trailing edge of
					each part (summary + each body paragraph) so users can flag
					"this specific point is wrong / useful" rather than rating
					the answer as a whole.
				-->
				{#snippet feedbackRow(partIdx: number)}
					{@const current = askStore.feedbackFor(partIdx)}
					<div class="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
						<span class="mr-1">Was this useful?</span>
						<button
							type="button"
							onclick={() => askStore.setFeedback(partIdx, 'up')}
							aria-pressed={current === 'up'}
							aria-label="Mark this part as helpful"
							class="rounded p-1 transition-colors {thumbsClass(current === 'up', 'up')}"
							title={current === 'up' ? 'Marked helpful — click to clear' : 'Mark helpful'}
						>
							<ThumbsUp size={12} strokeWidth={2} />
						</button>
						<button
							type="button"
							onclick={() => askStore.setFeedback(partIdx, 'down')}
							aria-pressed={current === 'down'}
							aria-label="Mark this part as not helpful"
							class="rounded p-1 transition-colors {thumbsClass(current === 'down', 'down')}"
							title={current === 'down' ? 'Marked not helpful — click to clear' : 'Mark not helpful'}
						>
							<ThumbsDown size={12} strokeWidth={2} />
						</button>
					</div>
				{/snippet}

				<!-- Prose answer -->
				<div class="min-h-0 overflow-y-auto pr-2 text-sm leading-relaxed text-primary">
					{#if parsedAnswer.summary}
						<!--
							Leading takeaway. The system prompt asks the model to open
							with a 1–2 sentence headline that a strategy doc could
							quote verbatim — surfaced here as a callout so it reads
							first regardless of where the user's eye lands.
						-->
						<aside
							class="mb-4 rounded-md border border-indigo-100 bg-linear-to-r from-indigo-50/80 via-white to-orange-50/60 p-3 text-[13px] leading-snug text-slate-800"
						>
							<p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
								Summary
							</p>
							{@render inlineSegments(parsedAnswer.summary.segments)}
							{@render feedbackRow(SUMMARY_PART)}
						</aside>
					{/if}

					<div class="flex flex-col gap-4">
						{#each bodyParagraphs as para (para.index)}
							<div class="whitespace-pre-wrap">
								{@render inlineSegments(para.segments)}
								{@render feedbackRow(para.index)}
							</div>
						{/each}
					</div>

					{#if parsedAnswer.body.tryNext.length > 0}
						<div class="mt-4 flex flex-col items-start gap-1.5">
							<p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
								Try next
							</p>
							{#each parsedAnswer.body.tryNext as q, i (i)}
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

				<!-- Right pane: visualizations / citations -->
				{#if askResponse.citations.length > 0}
					<aside class="flex min-h-0 flex-col gap-3 overflow-y-auto pr-2 text-xs">
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
							>
								Visualizations
							</button>
							<button
								type="button"
								role="tab"
								aria-selected={rightPaneView === 'citations'}
								onclick={() => (rightPaneView = 'citations')}
								class="rounded-full px-2.5 py-1 transition-colors {rightPaneView === 'citations'
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
										title="Open quote detail"
									>
										<div class="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
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
											{#if showIndicationChips && c.indication}
												<span
													class="shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-medium text-indigo-700"
													title="From {labelForIndication(c.indication)} voices"
												>
													{labelForIndication(c.indication)}
												</span>
											{/if}
										</div>
										<p class="ask-cite-quote mt-1 text-primary">"{c.text}"</p>
										{#if c.sentiment !== null || c.stages.length > 0}
											<div class="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
												{#if c.sentiment !== null}
													<span class="rounded bg-gray-100 px-1.5 py-0.5">
														sentiment {c.sentiment > 0 ? '+' : ''}{c.sentiment}
													</span>
												{/if}
												{#each c.stages as s, j (j)}
													<span class="max-w-full truncate rounded bg-gray-100 px-1.5 py-0.5">
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
								Three orthogonal reads of the cited quotes:
								  1. Sentiment by indication — WHO felt how (multi-indication only).
								  2. Topics referenced     — WHAT was discussed.
								  3. Journey stages cited  — WHERE in the journey.
								Each chart silently hides when its dimension is empty so the
								pane never shows a chart with one bar at zero.
							-->
							<div class="flex flex-col gap-5">
								{#if responseIndications.length > 1}
									<IndicationComparisonChart
										citations={askResponse.citations}
										indications={responseIndications}
										labelFor={labelForIndication}
									/>
								{/if}

								<TopicsCitedChart
									citations={askResponse.citations}
									indications={responseIndications.length > 0 ? responseIndications : [indication]}
									labelFor={labelForIndication}
								/>

								<StagesCitedChart
									citations={askResponse.citations}
									indications={responseIndications.length > 0 ? responseIndications : [indication]}
									labelFor={labelForIndication}
									stageLabels={stageLabelsMap}
								/>

								{#if !hasVisualizations}
									<p class="text-[11px] text-muted-foreground">
										No tagged metadata on the cited quotes yet.
									</p>
								{/if}
							</div>
						{/if}
					</aside>
				{/if}
			</div>
		</div>
	{:else if !asking}
		<!-- Empty state — primer + a few suggestion seeds. -->
		<div class="flex flex-1 flex-col items-start gap-3 pt-6 text-sm text-slate-600">
			<p class="text-[11px] uppercase tracking-wider text-muted-foreground">No answer yet</p>
			<p>
				Ask a question about <span class="font-medium text-slate-800"
					>{labelForIndication(indication)}</span
				>. Use
				<span class="font-medium">Compare with</span> to bring in patient + caregiver voices from
				another indication.
			</p>
			<ul class="list-disc pl-5 text-slate-500">
				<li>What barriers come up most often in pre-treatment?</li>
				<li>How does sentiment shift across journey stages?</li>
				<li>Which sponsor is most discussed and how?</li>
			</ul>
		</div>
	{/if}
</div>

<SponsorDrawer sponsor={activeSponsor} onclose={closeSponsorDrawer} level="top" />

<style>
	:global(.ask-cite-quote) {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.4;
	}
</style>

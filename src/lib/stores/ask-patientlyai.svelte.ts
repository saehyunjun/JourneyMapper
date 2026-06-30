/**
 * ask-patientlyai store — global state for the Ask PatientlyAI flow.
 *
 * Lives at module scope so the FAB + drawer can be mounted once in the
 * patientlyiq layout and survive across route navigations. The user can
 * fire a question, navigate elsewhere while the model thinks, and come
 * back to the answer via the FAB.
 *
 * State transitions driven by the FAB:
 *   idle     — no live response and not asking
 *   thinking — a request is in flight (animated gradient on the FAB)
 *   ready    — a response just arrived; drawer was closed at the time, so
 *              the FAB pulses mint-green with an alert bubble until the
 *              user clicks it (markRead())
 *
 * History is keyed on (indication + question + sorted-extras) so that the
 * same question against different comparison sets stays distinct.
 */

export type AskCitation = {
	id: string;
	text: string;
	speaker_id: string;
	speaker_label: string;
	sentiment: number | null;
	emotions?: string[];
	stages: Array<{ stage_id: string; step_id: string | null }>;
	themes?: string[];
	subthemes?: string[];
	topics?: string[];
	role?: string | null;
	indication?: string;
};

export type AskResponse = {
	answer: string;
	citations: AskCitation[];
	missing_citations: string[];
	valid: boolean;
	indications?: string[];
	/** Primary indication's journey-stage labels keyed by stage_id. The
	 *  UI uses this to render readable stage names on the stages chart
	 *  and citation cards without bundling the whole journey. */
	stage_labels?: Record<string, string>;
	step_labels?: Record<string, string>;
};

export type AskHistoryEntry = {
	question: string;
	indication: string;
	additional_indications?: string[];
	response: AskResponse;
	timestamp: number;
	/** Source of the entry. `user` entries are real Q&A pairs persisted to
	 *  localStorage. `seed` entries are demo-only canned answers from
	 *  $lib/content/ask-demo-seeds — never persisted; merged into the
	 *  visible history at read time so the "Recent" pills always have
	 *  something to click. Re-asking a seeded question triggers a
	 *  simulated thinking delay before the canned answer reveals. */
	source?: 'user' | 'seed';
};

export type FeedbackKind = 'up' | 'down';

// v4 (2026-05-29): system prompt rewritten for plain-language voice + leading
// summary, and citations gained themes/subthemes/topics/role + stage labels.
// Old cached answers carry the legacy "Excellent — I now have..." voice and
// lack the fields driving the new visualization pane, so they must not be
// surfaced under the new UI.
const HISTORY_KEY = 'workbench-ask-history-v4';
const MAX_HISTORY = 20;

function normalizeQ(q: string): string {
	return q.trim().toLowerCase();
}

function additionalKey(extras: string[] | undefined): string {
	return [...(extras ?? [])].sort().join('|');
}

let question = $state('');
let asking = $state(false);
let askResponse = $state<AskResponse | null>(null);
let askError = $state<string | null>(null);
let drawerOpen = $state(false);
/** Flips true when an answer arrives while the drawer is closed; cleared
 *  when the user opens the drawer (markRead). Drives the alert bubble. */
let unreadAnswer = $state(false);
let selectedAdditional = $state<string[]>([]);
let history = $state<AskHistoryEntry[]>([]);
/** Demo seeds merged on read into the visible history. Injected once at
 *  initial load, never persisted to localStorage. */
let seedHistory = $state<AskHistoryEntry[]>([]);
/** Indication the current response (and current question) belongs to.
 *  Used by the layout to detect indication switches and clear stale
 *  state. */
let currentIndication = $state<string | null>(null);
let historyLoaded = false;
/** Counter so concurrent asks (rare — the second cancels the first
 *  visually) don't deliver stale results into the store. */
let inflightId = 0;
/** Per-part thumbs-up/down on the currently visible response. Keys are
 *  the part indices set by the panel (0 = summary, 1..N = body
 *  paragraphs). Reset whenever a new response arrives. */
let feedback = $state<Record<number, FeedbackKind>>({});
/** Primer questions injected per indication: when the drawer opens and
 *  the input is blank, we prefill the current indication's primer so
 *  the user has a one-click "ask" ready. Set by the layout via
 *  registerPrimers(). */
let primers = $state<Record<string, string>>({});

function loadHistoryOnce(): void {
	if (historyLoaded) return;
	historyLoaded = true;
	if (typeof window === 'undefined') return;
	try {
		const raw = localStorage.getItem(HISTORY_KEY);
		if (raw) history = JSON.parse(raw) as AskHistoryEntry[];
	} catch {
		history = [];
	}
}

function persistHistory(next: AskHistoryEntry[]): void {
	history = next;
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
	} catch {
		// Quota or storage disabled — keep in-memory only.
	}
}

function cacheLookup(q: string, ind: string, extras: string[]): AskHistoryEntry | null {
	const norm = normalizeQ(q);
	const ek = additionalKey(extras);
	const pred = (h: AskHistoryEntry) =>
		h.indication === ind &&
		normalizeQ(h.question) === norm &&
		additionalKey(h.additional_indications) === ek;
	// Seeds win over user-cached entries so a stale "real" cached entry
	// can't accidentally short-circuit the demo path. Demo seeds are
	// authored to match the current UI; user entries may be older.
	return seedHistory.find(pred) ?? history.find(pred) ?? null;
}

/** Combined view: seeds first (so demo pills are stable), then real
 *  user history. The Recent pills surface this. */
function visibleHistory(): AskHistoryEntry[] {
	loadHistoryOnce();
	const userKeys = new Set(
		history.map(
			(h) =>
				`${h.indication}|${normalizeQ(h.question)}|${additionalKey(h.additional_indications)}`
		)
	);
	const seedsNotShadowed = seedHistory.filter(
		(s) =>
			!userKeys.has(
				`${s.indication}|${normalizeQ(s.question)}|${additionalKey(s.additional_indications)}`
			)
	);
	return [...seedsNotShadowed, ...history];
}

function saveHistory(entry: AskHistoryEntry): void {
	const ek = additionalKey(entry.additional_indications);
	const next = [
		entry,
		...history.filter(
			(h) =>
				!(
					h.indication === entry.indication &&
					normalizeQ(h.question) === normalizeQ(entry.question) &&
					additionalKey(h.additional_indications) === ek
				)
		)
	].slice(0, MAX_HISTORY);
	persistHistory(next);
}

/** Simulated thinking delay before a seeded answer reveals. Long
 *  enough to feel like a real model call (the FAB rainbow + spinner
 *  cycle through ~3 stages), short enough to keep demos snappy. */
const SEED_THINK_MIN_MS = 2200;
const SEED_THINK_MAX_MS = 3400;

function pickSeedDelay(): number {
	return Math.round(
		SEED_THINK_MIN_MS + Math.random() * (SEED_THINK_MAX_MS - SEED_THINK_MIN_MS)
	);
}

async function ask(opts: { question: string; indication: string }): Promise<void> {
	loadHistoryOnce();
	const q = opts.question.trim();
	if (!q || asking) return;
	askError = null;

	const extras = [...selectedAdditional];
	const ind = opts.indication;

	const hit = cacheLookup(q, ind, extras);
	if (hit) {
		// Seeded hits should feel like a fresh model call — animate the
		// FAB / spinner for a moment, then drop the canned answer in. Real
		// user-cache hits resolve instantly as before.
		if (hit.source === 'seed') {
			feedback = {};
			asking = true;
			askResponse = null;
			const ticket = ++inflightId;
			await new Promise((r) => setTimeout(r, pickSeedDelay()));
			if (ticket !== inflightId) return;
			asking = false;
			askResponse = hit.response;
			currentIndication = ind;
			if (!drawerOpen) unreadAnswer = true;
			return;
		}
		feedback = {};
		askResponse = hit.response;
		currentIndication = ind;
		if (!drawerOpen) unreadAnswer = true;
		return;
	}

	asking = true;
	askResponse = null;
	const ticket = ++inflightId;
	try {
		const res = await fetch('/api/workbench/ask', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				question: q,
				indication: ind,
				additional_indications: extras
			})
		});
		const body = await res.json().catch(() => ({}));
		if (ticket !== inflightId) return;
		if (!res.ok) {
			throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
		}
		const response = body as AskResponse;
		askResponse = response;
		currentIndication = ind;
		feedback = {};
		saveHistory({
			question: q,
			indication: ind,
			additional_indications: extras,
			response: {
				answer: response.answer,
				citations: response.citations,
				missing_citations: response.missing_citations,
				valid: response.valid,
				indications: response.indications,
				stage_labels: response.stage_labels,
				step_labels: response.step_labels
			},
			timestamp: Date.now(),
			source: 'user'
		});
		if (!drawerOpen) unreadAnswer = true;
	} catch (e) {
		if (ticket !== inflightId) return;
		askError = e instanceof Error ? e.message : String(e);
	} finally {
		if (ticket === inflightId) {
			asking = false;
		}
	}
}

function recall(entry: AskHistoryEntry): void {
	question = entry.question;
	askResponse = entry.response;
	askError = null;
	feedback = {};
	currentIndication = entry.indication;
	selectedAdditional = [...(entry.additional_indications ?? [])];
}

/** Register demo seeds + primers once at app boot. Subsequent calls are
 *  idempotent (same indication keys merge / overwrite). */
function registerSeeds(opts: {
	seeds: AskHistoryEntry[];
	primers: Record<string, string>;
}): void {
	const tagged = opts.seeds.map((s) => ({ ...s, source: 'seed' as const }));
	seedHistory = tagged;
	primers = { ...primers, ...opts.primers };
}

/** Returns the primer question for the given indication, if any. The
 *  layout uses this to prefill the input when the drawer opens. */
function primerFor(indication: string): string | null {
	return primers[indication] ?? null;
}

function setFeedback(partIdx: number, kind: FeedbackKind): void {
	if (feedback[partIdx] === kind) {
		// Second click on the same thumb clears it (toggle off).
		const next = { ...feedback };
		delete next[partIdx];
		feedback = next;
		return;
	}
	feedback = { ...feedback, [partIdx]: kind };
}

function feedbackFor(partIdx: number): FeedbackKind | null {
	return feedback[partIdx] ?? null;
}

/** Called by the layout when the active indication changes. Clears
 *  stale answer + comparison set so the next question starts fresh,
 *  and prefills the input with this indication's primer if one is
 *  registered and the user hasn't started typing. */
function syncIndication(activeIndication: string): void {
	loadHistoryOnce();
	if (currentIndication === activeIndication) {
		// First call on session start: still install the primer.
		if (!question.trim()) {
			const seed = primerFor(activeIndication);
			if (seed) question = seed;
		}
		return;
	}
	currentIndication = activeIndication;
	askResponse = null;
	askError = null;
	feedback = {};
	selectedAdditional = [];
	const seed = primerFor(activeIndication);
	question = seed ?? '';
	// Don't auto-restore — let the user re-ask. Restoring across an
	// indication switch tends to surface a stale comparison the user
	// didn't ask for.
}

function openDrawer(): void {
	drawerOpen = true;
	unreadAnswer = false;
}

function closeDrawer(): void {
	drawerOpen = false;
}

function setQuestion(q: string): void {
	question = q;
}

function setSelectedAdditional(next: string[]): void {
	selectedAdditional = [...next];
}

function toggleAdditional(id: string): void {
	if (selectedAdditional.includes(id)) {
		selectedAdditional = selectedAdditional.filter((x) => x !== id);
	} else {
		selectedAdditional = [...selectedAdditional, id];
	}
}

function clearAdditional(): void {
	selectedAdditional = [];
}

function clearError(): void {
	askError = null;
}

export const askStore = {
	get question() {
		return question;
	},
	get asking() {
		return asking;
	},
	get response() {
		return askResponse;
	},
	get error() {
		return askError;
	},
	get drawerOpen() {
		return drawerOpen;
	},
	set drawerOpen(v: boolean) {
		const next = !!v;
		if (next === drawerOpen) return;
		drawerOpen = next;
		// Opening the drawer counts as "viewing" the latest answer — clear
		// the unread alert so the FAB drops out of the ready-pulse state.
		if (next) unreadAnswer = false;
	},
	get unreadAnswer() {
		return unreadAnswer;
	},
	get selectedAdditional() {
		return selectedAdditional;
	},
	get history() {
		return visibleHistory();
	},
	get feedback() {
		return feedback;
	},
	get currentIndication() {
		return currentIndication;
	},
	/** True when no question has ever been answered in the current
	 *  indication context — FAB sits in pure idle state. */
	get isIdle() {
		return !asking && !askResponse && !askError;
	},
	get fabState(): 'idle' | 'thinking' | 'ready' | 'viewed' | 'error' {
		if (asking) return 'thinking';
		if (askError) return 'error';
		if (askResponse && unreadAnswer) return 'ready';
		if (askResponse) return 'viewed';
		return 'idle';
	},
	ask,
	recall,
	syncIndication,
	openDrawer,
	closeDrawer,
	setQuestion,
	setSelectedAdditional,
	toggleAdditional,
	clearAdditional,
	clearError,
	registerSeeds,
	primerFor,
	setFeedback,
	feedbackFor
};

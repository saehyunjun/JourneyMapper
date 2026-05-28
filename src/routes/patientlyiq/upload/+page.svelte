<script lang="ts">
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import StarIcon from '@lucide/svelte/icons/star';
	import MergeIcon from '@lucide/svelte/icons/merge';
	import SplitIcon from '@lucide/svelte/icons/split';
	import EraserIcon from '@lucide/svelte/icons/eraser';
	import TagIcon from '@lucide/svelte/icons/tag';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import XIcon from '@lucide/svelte/icons/x';


	import questionBankRaw from '$lib/content/wctglpdemo-data/questions.json';
	import SegmentTagDrawer from '$lib/components/SegmentTagDrawer.svelte';
	import FragmentTagDrawer from '$lib/components/FragmentTagDrawer.svelte';
	import type { Fragment, FragmentAnnotation } from '$lib/content/corpora/types';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import wctLogoUrl from '$lib/content/wctglpdemo-data/avatars/WCTLogo.png?url';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import KeywordText from '$lib/components/KeywordText.svelte';
	import { buildKeywordMatcher } from '$lib/content/wctglpdemo-data/keywords';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import EmotionDyadChip from '$lib/components/EmotionDyadChip.svelte';
	import { toasts } from '$lib/stores/toasts.svelte.js';
	import type { AutotagJob } from '$lib/server/autotag';
	import {
		AGE_RANGES,
		GENDERS,
		emptyProfile,
		type ParticipantProfile,
		type ParticipantType
	} from '$lib/types/participant-profile';

	// Tags shown inline on a segment card before the rest collapse into a +N
	// badge. A fixed cap keeps the row predictable — no layout measurement.
	const TAG_CAP = 5;
	type CardTag = { kind: 'theme' | 'emotion'; id: string };
	import type { Annotation, TaggableSegment } from '$lib/types/segment-tags';
	import type { PageProps } from './$types';

	let { form, data }: PageProps = $props();

	// Analyst-starred segments — seeded once from the server, then updated
	// locally on each toggle.
	let starredSegments = $state(new Set<string>(untrack(() => data.starredSegmentIds)));
	let togglingSegment = $state('');

	async function toggleStar(segmentId: string) {
		if (togglingSegment) return;
		togglingSegment = segmentId;
		try {
			const res = await fetch('/patientlyiq/highlights', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ kind: 'segment', id: segmentId })
			});
			if (res.ok) {
				const { starredSegmentIds } = await res.json();
				starredSegments = new Set<string>(starredSegmentIds);
				const starred = starredSegments.has(segmentId);
				toasts.push({
					message: starred
						? 'Quote starred — added to highlights.'
						: 'Quote removed from highlights.',
					href: starred && result ? `/patientlyiq/personas?interview=${result.interviewId}` : undefined,
					linkLabel: 'View on the persona →'
				});
			}
		} finally {
			togglingSegment = '';
		}
	}

	// Mirror of the segment-star helpers, but keyed on fragment id. The highlights
	// store is now polymorphic on `kind: 'segment' | 'quote' | 'fragment'`.
	let starredFragments = $state(
		new Set<string>(untrack(() => data.starredFragmentIds ?? []))
	);
	let togglingFragmentStar = $state('');

	async function toggleFragmentStar(fragmentId: string) {
		if (togglingFragmentStar) return;
		togglingFragmentStar = fragmentId;
		try {
			const res = await fetch('/patientlyiq/highlights', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ kind: 'fragment', id: fragmentId })
			});
			if (res.ok) {
				const { starredFragmentIds } = await res.json();
				starredFragments = new Set<string>(starredFragmentIds);
				const starred = starredFragments.has(fragmentId);
				toasts.push({
					message: starred
						? 'Fragment starred — added to highlights.'
						: 'Fragment removed from highlights.'
				});
			}
		} finally {
			togglingFragmentStar = '';
		}
	}

	// The question bank — canonical interview questions, in guide order.
	const questionBank = [...questionBankRaw.questions].sort((a, b) => a.order - b.order);

	let transcript = $state('');
	let participantId = $state('');
	let submitting = $state(false);
	let savingQuestions = $state(false);

	function loadFile(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			transcript = String(reader.result ?? '');
		};
		reader.readAsText(file);
	}

	// The review view is driven by the interview loaded via ?interview=, except
	// right after a question-mapping save, when the action result carries the
	// freshly propagated turns/segments. A fresh upload navigates to
	// ?interview=, so the `parse` result never drives this view.
	const result = $derived(form?.stage === 'questionMap' ? form : (data.review ?? null));

	const segmentsByTurn = $derived.by(() => {
		const segs = result?.segments ?? [];
		const map = new Map<number, typeof segs>();
		for (const s of segs) {
			const arr = map.get(s.turn_index) ?? [];
			arr.push(s);
			map.set(s.turn_index, arr);
		}
		for (const arr of map.values()) arr.sort((a, b) => a.segment_index - b.segment_index);
		return map;
	});

	const interviewerTurns = $derived((result?.turns ?? []).filter((t) => t.speaker === 'interviewer'));

	// turn_index -> question_id. Seeded per interview from question_map.json
	// (the AI proposal written by scripts/propose-questions.mjs), then edited
	// by the reviewer.
	let questionAssignments = $state<Record<number, string>>({});
	let lastInterview = '';

	// --- Upload modal + autotag job tracking ---
	let uploadOpen = $state(false);
	let uploadError = $state('');
	// The autotag job for the interview in view. `autotagStep` is kept separate
	// so live step updates from polling don't retrigger the polling effect.
	let autotagJob = $state<AutotagJob | null>(null);
	let autotagStep = $state('');

	$effect(() => {
		const id = result?.interviewId ?? '';
		if (id && id !== lastInterview) {
			lastInterview = id;
			const seed: Record<number, string> = {};
			for (const m of result?.questionMap ?? []) seed[m.turn_index] = m.question_id;
			questionAssignments = seed;
			annotations = { ...(result?.annotations ?? {}) };
			recentlyUntagged = {};
			autotagJob = data.review?.autotagJob ?? null;
			autotagStep = autotagJob?.step ?? '';
			seedPersona(data.review?.profile ?? emptyProfile(id));
		}
	});

	// While an interview is autotagging, poll the job; when it finishes,
	// reload so the freshly proposed tags populate this view.
	$effect(() => {
		const job = autotagJob;
		if (job?.state !== 'running') return;
		const id = job.interviewId;
		const timer = setInterval(async () => {
			try {
				const res = await fetch(`/patientlyiq/autotag?interview=${id}`);
				if (!res.ok) return;
				const { job: cur } = (await res.json()) as { job: AutotagJob | null };
				if (!cur || cur.state !== 'running') {
					lastInterview = ''; // force the seeding effect to re-run
					await invalidateAll();
				} else {
					autotagStep = cur.step;
				}
			} catch {
				// Transient fetch failure — keep polling.
			}
		}, 3000);
		return () => clearInterval(timer);
	});

	async function retryAutotag() {
		const id = result?.interviewId;
		if (!id) return;
		const res = await fetch('/patientlyiq/autotag', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ interview_id: id })
		});
		if (res.ok) {
			const { job } = (await res.json()) as { job: AutotagJob };
			autotagJob = job;
			autotagStep = job.step;
		}
	}

	const assignedCount = $derived(
		interviewerTurns.filter((t) => questionAssignments[t.turn_index]).length
	);

	const titleCase = (id: string) => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

	// First-sentence preview of a thread, used in headers and (later) the
	// sidebar picker. Falls back to the post_id if the OP has no recognizable
	// first sentence (empty text, only punctuation, etc.).
	function threadTitle(items: Fragment[]): string {
		const op = items.find((f) => f.content_source === 'social_post') ?? items[0];
		if (!op?.text) return '(no OP)';
		const m = op.text.match(/^[^.!?\n]+[.!?]?/);
		const raw = (m?.[0] ?? op.text).trim();
		return raw.length > 80 ? raw.slice(0, 77) + '…' : raw;
	}

	// Per-segment tag annotations — seeded from the server per interview, then
	// kept in sync as the drawer saves. `openSegment` drives the tag drawer.
	let annotations = $state<Record<string, Annotation>>({});
	let openSegment = $state<TaggableSegment | null>(null);

	// === Corpus mode state ====================================================
	// Mirrors the interview-side `annotations` + `openSegment` pair. Seeded
	// from server load() and updated locally when the FragmentTagDrawer saves.
	let fragmentAnnotations = $state<Record<string, FragmentAnnotation>>(
		untrack(() => (data.mode === 'corpus' ? { ...data.fragmentAnnotations } : {}))
	);
	let openFragment = $state<Fragment | null>(null);

	// Sibling stack for the open fragment. Split children of a long forum post
	// share source_ref.post_id + comment_id and carry char_start offsets into
	// the parent post text; the drawer uses this list to render prev/next nav
	// without needing to know how the corpus is partitioned.
	type ForumRef = {
		post_id?: string;
		comment_id?: string;
		char_start?: number;
	};
	const openSiblings = $derived.by((): Fragment[] => {
		if (!openFragment || data.mode !== 'corpus') return [];
		const ref = openFragment.source_ref as unknown as ForumRef;
		if (!ref.post_id || typeof ref.char_start !== 'number') return [];
		const postId = ref.post_id;
		const commentId = ref.comment_id;
		const stack = data.fragments.filter((f) => {
			const r = f.source_ref as unknown as ForumRef;
			if (r.post_id !== postId) return false;
			if (r.comment_id !== commentId) return false;
			return typeof r.char_start === 'number';
		});
		stack.sort((a, b) => {
			const ax = (a.source_ref as unknown as ForumRef).char_start ?? 0;
			const bx = (b.source_ref as unknown as ForumRef).char_start ?? 0;
			return ax - bx;
		});
		return stack;
	});

	// Multi-select for merging fragments into a comprehensive quote. Reset
	// when the corpus / view changes (the URL change triggers re-seed via the
	// effect below). Same-thread constraint enforced at submit time by the
	// server; the client-side `canMerge` mirror keeps the floating bar honest.
	let selectedFragments = $state(new Set<string>());
	let mergeDialogOpen = $state(false);
	let mergeNote = $state('');
	let mergingFragments = $state(false);
	let mergeError = $state('');

	function toggleSelectFragment(id: string) {
		const next = new Set(selectedFragments);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedFragments = next;
	}
	function clearSelection() {
		selectedFragments = new Set();
	}

	// === Add-rows-to-corpus dialog state ====================================
	// Analyst paste/upload of forum-row CSV or JSON into the active corpus.
	// Mirrors scripts/import-forum-as-fragments.mjs's input shape: per-row
	// { Anonymized Username, Timestamp, Text, Thread, Conversation, Comment?,
	//   Context?, Username? }. Parsing happens client-side so we can show a
	// row-count preview + per-row validation before submitting; the server
	// receives a clean JSON rows[].
	let addRowsOpen = $state(false);
	let addRowsFormat = $state<'csv' | 'json'>('csv');
	let addRowsContent = $state('');
	let addRowsSubmitting = $state(false);
	let addRowsError = $state('');
	let addRowsFileInput = $state<HTMLInputElement | null>(null);
	// Auto-renumber the input's Thread ids so they start above the corpus's
	// current max Thread — prevents a fresh export's Thread=1 from colliding
	// with an existing Thread=1. Default on. When off, the input's Threads are
	// passed through verbatim (an analyst re-ingesting the same source on
	// purpose wants exact id reuse).
	let autoRenumberThreads = $state(true);
	// Run AI tagging (themes, sentiment, stages) on the new fragments after
	// they're written. Opt-in because each pass is a paid Claude call per
	// thread; analysts re-ingesting a known-good source can skip.
	let runAutotag = $state(false);
	// Two-step flow: 'edit' = paste + parse + preview-button; 'confirm' = server
	// dry-run summary shown, awaiting analyst sign-off. Going back to 'edit'
	// re-enables the textarea and discards the cached preview.
	type AddRowsStage = 'edit' | 'confirm';
	let addRowsStage = $state<AddRowsStage>('edit');
	type AddRowsPreview = {
		totalNew: number;
		totalOverwrite: number;
		perPartition: Record<string, { new: number; overwrite: number }>;
		overwriteSample: string[];
	};
	let addRowsPreview = $state<AddRowsPreview | null>(null);

	const REQUIRED_ROW_FIELDS = ['Anonymized Username', 'Timestamp', 'Text'] as const;
	type ForumRow = {
		'Anonymized Username'?: string;
		Username?: string;
		Timestamp?: string;
		Text?: string;
		Thread?: string;
		Conversation?: string;
		Comment?: string;
		Context?: string;
	};

	/** Minimal CSV reader: RFC-4180 quotes (double-quote escape), comma delim,
	 *  CR/LF tolerant. First non-empty line is the header. Cells trim outer
	 *  whitespace only when not quoted. Good enough for the analyst-paste
	 *  schema; we don't ship a full csv-parse library for this. */
	function parseCsv(text: string): Record<string, string>[] {
		const rows: string[][] = [];
		let cur: string[] = [];
		let cell = '';
		let inQuotes = false;
		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			if (inQuotes) {
				if (ch === '"') {
					if (text[i + 1] === '"') {
						cell += '"';
						i += 1;
					} else {
						inQuotes = false;
					}
				} else {
					cell += ch;
				}
				continue;
			}
			if (ch === '"') {
				inQuotes = true;
				continue;
			}
			if (ch === ',') {
				cur.push(cell);
				cell = '';
				continue;
			}
			if (ch === '\r') continue;
			if (ch === '\n') {
				cur.push(cell);
				rows.push(cur);
				cur = [];
				cell = '';
				continue;
			}
			cell += ch;
		}
		if (cell.length > 0 || cur.length > 0) {
			cur.push(cell);
			rows.push(cur);
		}
		const nonEmpty = rows.filter((r) => r.some((c) => c.trim().length > 0));
		if (nonEmpty.length === 0) return [];
		const header = nonEmpty[0].map((c) => c.trim());
		return nonEmpty.slice(1).map((cells) => {
			const obj: Record<string, string> = {};
			header.forEach((h, idx) => {
				obj[h] = cells[idx] ?? '';
			});
			return obj;
		});
	}

	/** Parse the current content according to addRowsFormat. Returns rows + an
	 *  optional error message. Empty content gives [] with no error so the
	 *  preview can render "0 rows" instead of red. */
	const parsedRows = $derived.by((): { rows: ForumRow[]; error: string } => {
		const content = addRowsContent.trim();
		if (!content) return { rows: [], error: '' };
		try {
			if (addRowsFormat === 'json') {
				const parsed = JSON.parse(content);
				if (!Array.isArray(parsed)) {
					return { rows: [], error: 'JSON must be an array of row objects.' };
				}
				return { rows: parsed as ForumRow[], error: '' };
			}
			const rows = parseCsv(content) as unknown as ForumRow[];
			return { rows, error: '' };
		} catch (err) {
			return { rows: [], error: (err as Error).message };
		}
	});

	const parsedRowProblems = $derived.by((): string[] => {
		const { rows } = parsedRows;
		const issues: string[] = [];
		for (let i = 0; i < rows.length; i += 1) {
			const r = rows[i];
			const missing = REQUIRED_ROW_FIELDS.filter((k) => !(r[k] ?? '').toString().trim());
			if (missing.length === REQUIRED_ROW_FIELDS.length) continue; // metadata-only row, server will skip
			if (missing.length > 0) {
				issues.push(`row ${i}: missing ${missing.join(', ')}`);
			}
		}
		return issues;
	});

	// Highest integer Thread already in the corpus, extracted from the
	// `${corpusId}-T<N>-C<N>` shape of each fragment's post_id. Non-numeric
	// Thread values are ignored — the auto-renumber path only protects against
	// numeric-Thread collisions, which is the format every existing forum
	// ingester produces. Returns 0 when the corpus has no forum fragments.
	const maxExistingThread = $derived.by((): number => {
		if (data.mode !== 'corpus' || !data.corpus) return 0;
		const re = /-T(\d+)-C/;
		let max = 0;
		for (const f of data.fragments) {
			const ref = f.source_ref;
			if (
				ref.kind === 'social_post' ||
				ref.kind === 'social_comment' ||
				ref.kind === 'forum_post' ||
				ref.kind === 'forum_comment' ||
				ref.kind === 'blog_post' ||
				ref.kind === 'blog_comment'
			) {
				const m = ref.post_id.match(re);
				if (m) {
					const n = Number(m[1]);
					if (Number.isFinite(n) && n > max) max = n;
				}
			}
		}
		return max;
	});

	// Stable Thread remap for the current input. Each distinct Thread in the
	// parsed rows is assigned a fresh integer starting at
	// `maxExistingThread + 1`, in order of first appearance — so an input file
	// with Threads (1, 2, 1, 3) and a corpus that already has Thread 14
	// becomes (15, 16, 15, 17). Rows with no Thread are left as-is (the
	// projector's fallback id path catches them).
	const threadRemap = $derived.by((): Map<string, string> => {
		const map = new Map<string, string>();
		if (!autoRenumberThreads) return map;
		const { rows } = parsedRows;
		let next = maxExistingThread + 1;
		for (const r of rows) {
			const raw = (r.Thread ?? '').toString().trim();
			if (!raw) continue;
			if (!map.has(raw)) {
				map.set(raw, String(next));
				next += 1;
			}
		}
		return map;
	});

	const remappedRows = $derived.by((): ForumRow[] => {
		const { rows } = parsedRows;
		if (!autoRenumberThreads || threadRemap.size === 0) return rows;
		return rows.map((r) => {
			const raw = (r.Thread ?? '').toString().trim();
			const mapped = raw ? threadRemap.get(raw) : undefined;
			return mapped ? { ...r, Thread: mapped } : r;
		});
	});

	function loadAddRowsFile(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		// Default the format from the extension so the user doesn't have to
		// toggle separately after picking a file.
		if (file.name.toLowerCase().endsWith('.json')) addRowsFormat = 'json';
		else if (file.name.toLowerCase().endsWith('.csv')) addRowsFormat = 'csv';
		const reader = new FileReader();
		reader.onload = () => {
			addRowsContent = String(reader.result ?? '');
		};
		reader.readAsText(file);
	}

	function resetAddRowsDialog() {
		addRowsContent = '';
		addRowsError = '';
		addRowsStage = 'edit';
		addRowsPreview = null;
		runAutotag = false;
		if (addRowsFileInput) addRowsFileInput.value = '';
	}

	/** Shared POST helper for the addToCorpus action. `dryRun` flips the server
	 *  behavior between "compute the breakdown" and "write to disk." Sends the
	 *  Thread-remapped rows when auto-renumber is on; the verbatim parse
	 *  otherwise. */
	async function callAddToCorpus(dryRun: boolean) {
		if (data.mode !== 'corpus' || !data.corpus) return null;
		const { error } = parsedRows;
		const rows = remappedRows;
		if (error) {
			addRowsError = error;
			return null;
		}
		if (rows.length === 0) {
			addRowsError = 'Paste or upload at least one row before submitting.';
			return null;
		}
		const fd = new FormData();
		fd.append('corpus_id', data.corpus.id);
		fd.append('rows', JSON.stringify(rows));
		if (dryRun) fd.append('dry_run', '1');
		// run_autotag is honored only on the real write; the dry-run preview
		// computes the breakdown but never spawns the propose-* scripts.
		if (!dryRun && runAutotag) fd.append('run_autotag', '1');
		const res = await fetch('/patientlyiq/upload?/addToCorpus', {
			method: 'POST',
			body: fd
		});
		const text = await res.text();
		return (await import('$app/forms')).deserialize(text) as
			| {
					type: 'success';
					data?: {
						stage?: string;
						added?: number;
						summary?: AddRowsPreview;
						partitions?: Record<string, number>;
						stats?: Record<string, number>;
						autotagStarted?: boolean;
						autotagError?: string | null;
						error?: string;
					};
			  }
			| { type: 'failure'; data?: { error?: string } }
			| { type: 'error'; error?: { message?: string } }
			| { type: 'redirect' };
	}

	async function previewAddRows() {
		if (addRowsSubmitting) return;
		addRowsSubmitting = true;
		addRowsError = '';
		try {
			const result = await callAddToCorpus(true);
			if (!result) return;
			if (result.type === 'success' && result.data?.summary) {
				addRowsPreview = result.data.summary;
				addRowsStage = 'confirm';
				return;
			}
			if (result.type === 'failure') {
				addRowsError = result.data?.error ?? 'Could not preview rows.';
			} else if (result.type === 'error') {
				addRowsError = result.error?.message ?? 'Server error.';
			}
		} catch (err) {
			addRowsError = `Preview failed: ${(err as Error).message}`;
		} finally {
			addRowsSubmitting = false;
		}
	}

	async function confirmAddRows() {
		if (data.mode !== 'corpus' || !data.corpus || addRowsSubmitting) return;
		addRowsSubmitting = true;
		addRowsError = '';
		try {
			const result = await callAddToCorpus(false);
			if (!result) return;
			if (result.type === 'success' && typeof result.data?.added === 'number') {
				addRowsOpen = false;
				const added = result.data.added;
				const overwrite = result.data.summary?.totalOverwrite ?? 0;
				const autotag = result.data.autotagStarted;
				const autotagError = result.data.autotagError;
				const corpusId = data.corpus.id;
				const corpusLabel = data.corpus.label;
				resetAddRowsDialog();
				const writeLine =
					overwrite > 0
						? `Added ${added} fragment${added === 1 ? '' : 's'} (${overwrite} overwrote existing) to ${corpusLabel}.`
						: `Added ${added} fragment${added === 1 ? '' : 's'} to ${corpusLabel}.`;
				if (autotagError) {
					toasts.push({
						message: `${writeLine} Autotag could not start: ${autotagError}`,
						variant: 'error',
						duration: 0
					});
				} else if (autotag) {
					// The write toast is a short success confirmation; the
					// persistent progress toast tracks the propose-* chain and
					// upgrades itself to success / error when polling ends.
					toasts.push({ message: writeLine });
					trackCorpusAutotag(corpusId, corpusLabel);
				} else {
					toasts.push({ message: writeLine });
				}
				await invalidateAll();
				return;
			}
			if (result.type === 'failure') {
				addRowsError = result.data?.error ?? 'Could not add rows.';
			} else if (result.type === 'error') {
				addRowsError = result.error?.message ?? 'Server error.';
			}
		} catch (err) {
			addRowsError = `Could not add rows: ${(err as Error).message}`;
		} finally {
			addRowsSubmitting = false;
		}
	}

	function backToEdit() {
		addRowsStage = 'edit';
		addRowsPreview = null;
		addRowsError = '';
	}

	// --- Corpus autotag progress tracking -----------------------------------
	// Maps a server step label to a 0..1 progress fraction so the toast bar
	// advances visibly between polls. Mid-point of each step gives a steady
	// rise rather than a step function: starting → 0%, themes → ~17%,
	// sentiment → ~50%, stages → ~83%, done → 100%.
	const STEP_PROGRESS: Record<string, number> = {
		'Starting…': 0.02,
		'Proposing themes': 1 / 6,
		'Proposing sentiment + emotions': 3 / 6,
		'Proposing journey stages': 5 / 6,
		Done: 1
	};
	type CorpusAutotagJob = {
		corpusId: string;
		state: 'running' | 'done' | 'error';
		step: string;
		error?: string;
		startedAt: number;
		finishedAt?: number;
	};

	function trackCorpusAutotag(corpusId: string, corpusLabel: string) {
		const toastId = toasts.push({
			message: `Autotagging ${corpusLabel}…`,
			variant: 'progress',
			progress: STEP_PROGRESS['Starting…'],
			progressLabel: 'Starting…',
			duration: 0
		});

		const corpusHref = `/patientlyiq/upload?source=corpus&corpus=${encodeURIComponent(corpusId)}`;
		// Cap the total runtime so a stuck server-side job doesn't leave the
		// toast spinning forever. 20 minutes covers a corpus an order of
		// magnitude larger than today's ln_reddit (3 propose calls × tens of
		// threads each, ~10s/thread).
		const MAX_RUNTIME_MS = 20 * 60 * 1000;
		const startedAt = Date.now();

		const tick = async () => {
			if (Date.now() - startedAt > MAX_RUNTIME_MS) {
				toasts.update(toastId, {
					variant: 'error',
					message: 'Autotagging timed out without a final state.',
					progress: undefined,
					progressLabel: undefined
				});
				clearInterval(timer);
				// Promote the in-place error toast into a separate, persistent one
				// so it survives this toast's eventual dismissal pattern.
				return;
			}
			try {
				const res = await fetch(`/patientlyiq/autotag-corpus?corpus=${encodeURIComponent(corpusId)}`);
				if (!res.ok) return; // Transient — keep polling.
				const { job } = (await res.json()) as { job: CorpusAutotagJob | null };
				if (!job) return;
				if (job.state === 'running') {
					const frac = STEP_PROGRESS[job.step] ?? 0.1;
					toasts.update(toastId, {
						progress: frac,
						progressLabel: job.step
					});
					return;
				}
				clearInterval(timer);
				if (job.state === 'done') {
					toasts.dismiss(toastId);
					toasts.push({
						message: `Autotagging complete for ${corpusLabel}.`,
						href: corpusHref,
						linkLabel: 'Open the corpus →',
						duration: 0
					});
					// Refresh the page so the new annotations appear on the
					// fragment cards.
					void invalidateAll();
					return;
				}
				// state === 'error'
				toasts.dismiss(toastId);
				toasts.push({
					message: `Autotagging failed for ${corpusLabel}: ${job.error ?? 'unknown error'}`,
					href: corpusHref,
					linkLabel: 'Open the corpus →',
					variant: 'error',
					duration: 0
				});
			} catch {
				// Network blip — keep polling.
			}
		};

		const timer = setInterval(tick, 3000);
		void tick();
	}

	// Toolbar Autotag button — starts the chain over the active corpus, then
	// hands off to the same progress toast the upload flow uses. The propose
	// scripts self-skip already-tagged batches, so this only acts on untagged
	// fragments.
	let autotagStarting = $state(false);
	async function startAutotagFromToolbar() {
		if (data.mode !== 'corpus' || !data.corpus || autotagStarting) return;
		autotagStarting = true;
		const corpusId = data.corpus.id;
		const corpusLabel = data.corpus.label;
		try {
			const res = await fetch('/patientlyiq/autotag-corpus', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ corpus_id: corpusId })
			});
			const body = (await res.json()) as {
				ok: boolean;
				started?: boolean;
				error?: string;
			};
			if (!res.ok || !body.ok) {
				toasts.push({
					message: `Could not start autotag: ${body.error ?? 'server error'}`,
					variant: 'error',
					duration: 0
				});
				return;
			}
			if (body.started === false) {
				toasts.push({
					message: `Autotag is already running for ${corpusLabel}.`
				});
				return;
			}
			trackCorpusAutotag(corpusId, corpusLabel);
		} catch (err) {
			toasts.push({
				message: `Could not start autotag: ${(err as Error).message}`,
				variant: 'error',
				duration: 0
			});
		} finally {
			autotagStarting = false;
		}
	}

	// Re-seed when the corpus changes (URL nav causes load() to re-run).
	$effect(() => {
		if (data.mode === 'corpus') {
			fragmentAnnotations = { ...data.fragmentAnnotations };
			// Clearing selection on corpus / view changes prevents a stale multi-
			// select from leaking across navigations.
			clearSelection();
			mergeError = '';
		}
	});

	// Derived items for the active thread / participant — needed both for render
	// and for the merge-action helper, so I compute the candidate fragment array
	// once. These are forward references to `activeThreadItems` etc. defined
	// below; Svelte's `$derived` graph handles the ordering.
	const selectedFragmentObjects = $derived.by(() => {
		if (data.mode !== 'corpus') return [] as Fragment[];
		return data.fragments.filter((f) => selectedFragments.has(f.id));
	});
	const canMergeFragments = $derived.by(() => {
		if (selectedFragmentObjects.length < 2) return false;
		const threads = new Set(
			selectedFragmentObjects.map((f) => {
				const ref = f.source_ref;
				if (
					ref.kind === 'social_post' ||
					ref.kind === 'social_comment' ||
					ref.kind === 'forum_post' ||
					ref.kind === 'forum_comment' ||
					ref.kind === 'blog_post' ||
					ref.kind === 'blog_comment'
				) {
					return ref.post_id;
				}
				return '__non_forum';
			})
		);
		return threads.size === 1 && !threads.has('__non_forum');
	});
	const mergePreviewText = $derived(
		[...selectedFragmentObjects]
			.sort((a, b) => new Date(a.date_observed).getTime() - new Date(b.date_observed).getTime())
			.map((f) => f.text)
			.join('\n\n')
	);

	async function mergeSelectedFragments() {
		if (!canMergeFragments || mergingFragments || data.mode !== 'corpus' || !data.corpus) return;
		mergingFragments = true;
		mergeError = '';
		try {
			const fd = new FormData();
			fd.append('corpus_id', data.corpus.id);
			fd.append('fragment_ids', JSON.stringify([...selectedFragments]));
			fd.append('note', mergeNote);
			const res = await fetch('/patientlyiq/upload?/mergeFragments', {
				method: 'POST',
				body: fd
			});
			const text = await res.text();
			const result = (await import('$app/forms')).deserialize(text) as
				| { type: 'success'; data?: { mergedId?: string; error?: string } }
				| { type: 'failure'; data?: { error?: string } }
				| { type: 'error'; error?: { message?: string } }
				| { type: 'redirect' };
			if (result.type === 'success' && result.data?.mergedId) {
				mergeDialogOpen = false;
				mergeNote = '';
				clearSelection();
				toasts.push({
					message: 'Merged fragment created.',
					linkLabel: 'Open the new merged quote →'
				});
				await invalidateAll();
				return;
			}
			if (result.type === 'failure') {
				mergeError = result.data?.error ?? 'Merge failed.';
			} else if (result.type === 'error') {
				mergeError = result.error?.message ?? 'Server error.';
			}
		} catch (err) {
			mergeError = `Merge failed: ${(err as Error).message}`;
		} finally {
			mergingFragments = false;
		}
	}

	// Predicate distinguishing analyst-merged fragments from the original OP.
	function isMergedFragment(f: Fragment): boolean {
		return Array.isArray(f.derived_from) && f.derived_from.length > 0;
	}

	const corpusFragments = $derived(data.mode === 'corpus' ? data.fragments : []);
	const corpusView = $derived(data.mode === 'corpus' ? data.view : 'thread');

	// Thread view: group by source_ref.post_id, OP first then comments by date.
	const threadGroups = $derived.by((): Array<[string, Fragment[]]> => {
		if (data.mode !== 'corpus') return [];
		const groups = new Map<string, Fragment[]>();
		for (const f of data.fragments) {
			const ref = f.source_ref;
			const key =
				ref.kind === 'social_post' ||
				ref.kind === 'social_comment' ||
				ref.kind === 'forum_post' ||
				ref.kind === 'forum_comment' ||
				ref.kind === 'blog_post' ||
				ref.kind === 'blog_comment'
					? ref.post_id
					: '__orphan';
			const arr = groups.get(key) ?? [];
			arr.push(f);
			groups.set(key, arr);
		}
		for (const arr of groups.values()) {
			arr.sort((a, b) => {
				const aPost = a.content_source === 'social_post' ? 0 : 1;
				const bPost = b.content_source === 'social_post' ? 0 : 1;
				if (aPost !== bPost) return aPost - bPost;
				return new Date(a.date_observed).getTime() - new Date(b.date_observed).getTime();
			});
		}
		return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
	});

	// Participant view: group by source_ref.author_handle_hash, sort by date.
	const participantGroups = $derived.by((): Array<[string, Fragment[]]> => {
		if (data.mode !== 'corpus') return [];
		const groups = new Map<string, Fragment[]>();
		for (const f of data.fragments) {
			const ref = f.source_ref;
			const key =
				(ref.kind === 'social_post' ||
				ref.kind === 'social_comment' ||
				ref.kind === 'forum_post' ||
				ref.kind === 'forum_comment' ||
				ref.kind === 'blog_post' ||
				ref.kind === 'blog_comment') &&
				ref.author_handle_hash
					? ref.author_handle_hash
					: '__anonymous';
			const arr = groups.get(key) ?? [];
			arr.push(f);
			groups.set(key, arr);
		}
		for (const arr of groups.values()) {
			arr.sort(
				(a, b) => new Date(a.date_observed).getTime() - new Date(b.date_observed).getTime()
			);
		}
		return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
	});

	const confirmedFragmentCount = $derived.by(() => {
		let n = 0;
		for (const ann of Object.values(fragmentAnnotations)) {
			if (
				ann.segment_tags?.review_status === 'human_confirmed' ||
				ann.stages?.review_status === 'human_confirmed'
			) {
				n++;
			}
		}
		return n;
	});

	// Fragments that haven't been touched by any AI tagging pass. Matches the
	// "untagged" badge shown on each fragment card (no annotation at all);
	// drives the toolbar Autotag button's enabled state. The propose-* scripts
	// self-skip batches that already carry a *_generator marker, so calling
	// autotag on the corpus only acts on these fragments.
	const untaggedFragmentCount = $derived.by(() => {
		if (data.mode !== 'corpus') return 0;
		let n = 0;
		for (const f of data.fragments) {
			if (!fragmentAnnotations[f.id]) n++;
		}
		return n;
	});

	async function selectSource(source: 'interview' | 'corpus') {
		if (source === 'interview') {
			await goto('?', { invalidateAll: true });
			return;
		}
		const params = new URLSearchParams();
		params.set('source', 'corpus');
		const firstCorpus = data.corpora?.[0];
		if (firstCorpus) params.set('corpus', firstCorpus.id);
		params.set('view', 'thread');
		await goto(`?${params.toString()}`, { invalidateAll: true });
	}

	async function selectCorpus(id: string) {
		const params = new URLSearchParams();
		params.set('source', 'corpus');
		params.set('corpus', id);
		params.set('view', data.mode === 'corpus' ? data.view : 'thread');
		await goto(`?${params.toString()}`, { invalidateAll: true });
	}

	async function setCorpusView(v: 'thread' | 'participant') {
		if (data.mode !== 'corpus' || !data.corpus) return;
		const params = new URLSearchParams();
		params.set('source', 'corpus');
		params.set('corpus', data.corpus.id);
		params.set('view', v);
		await goto(`?${params.toString()}`, { invalidateAll: true });
	}

	// Sidebar selection — driven by `?thread=<post_id>` or `?participant=<hash>`.
	// Defaults to the first available group when the URL param is missing or
	// stale. Re-reads `page.url` so client-side navigations re-derive.
	const selectedThreadId = $derived.by(() => {
		if (data.mode !== 'corpus' || corpusView !== 'thread') return null;
		const requested = page.url.searchParams.get('thread');
		const ids = threadGroups.map(([id]) => id);
		if (requested && ids.includes(requested)) return requested;
		return ids[0] ?? null;
	});
	const selectedParticipantId = $derived.by(() => {
		if (data.mode !== 'corpus' || corpusView !== 'participant') return null;
		const requested = page.url.searchParams.get('participant');
		const ids = participantGroups.map(([id]) => id);
		if (requested && ids.includes(requested)) return requested;
		return ids[0] ?? null;
	});
	const activeThreadItems = $derived(
		threadGroups.find(([id]) => id === selectedThreadId)?.[1] ?? []
	);
	const activeParticipantItems = $derived(
		participantGroups.find(([id]) => id === selectedParticipantId)?.[1] ?? []
	);

	async function selectThread(postId: string) {
		if (data.mode !== 'corpus' || !data.corpus) return;
		const params = new URLSearchParams();
		params.set('source', 'corpus');
		params.set('corpus', data.corpus.id);
		params.set('view', 'thread');
		params.set('thread', postId);
		await goto(`?${params.toString()}`, { invalidateAll: false, keepFocus: true, noScroll: true });
	}

	async function selectParticipant(hash: string) {
		if (data.mode !== 'corpus' || !data.corpus) return;
		const params = new URLSearchParams();
		params.set('source', 'corpus');
		params.set('corpus', data.corpus.id);
		params.set('view', 'participant');
		params.set('participant', hash);
		await goto(`?${params.toString()}`, { invalidateAll: false, keepFocus: true, noScroll: true });
	}

	// Indication-scoped keyword matcher built once from the active LexiconSlice.
	// Plumbed into <KeywordText> for fragment cards + the FragmentTagDrawer so
	// bolding follows the active indication's clusters, not the legacy
	// statically-bundled lexicon. Re-derived if the indication changes (the URL
	// triggers a fresh layout load).
	const corpusMatcher = $derived(
		buildKeywordMatcher(data.slice.clusters, data.slice.themes, data.slice.drugs)
	);

	// Per-group annotation tally for sidebar entries. Cheap to compute over the
	// already-grouped items; runs on every annotation update.
	function tallyConfirmed(items: Fragment[]): { confirmed: number; total: number } {
		let confirmed = 0;
		for (const f of items) {
			const ann = fragmentAnnotations[f.id];
			if (
				ann?.segment_tags?.review_status === 'human_confirmed' ||
				ann?.stages?.review_status === 'human_confirmed'
			) {
				confirmed += 1;
			}
		}
		return { confirmed, total: items.length };
	}

	// In-session cache of just-untagged annotations so the bubble's retag button
	// can undo an accidental untag by re-POSTing the same annotation. Cleared
	// when the interview changes (annotations re-seed from disk) and when a
	// retag succeeds. Not persisted across page reloads — by then the user
	// would have to re-tag manually from the drawer.
	let recentlyUntagged = $state<Record<string, Annotation>>({});

	// --- Segment selection — drives the merge / untag toolbar ---
	let selectedSegments = $state(new Set<string>());
	let merging = $state(false);
	let unmerging = $state(false);
	let untagging = $state(false);
	let segmentActionError = $state('');

	function toggleSelect(segmentId: string) {
		const next = new Set(selectedSegments);
		if (next.has(segmentId)) next.delete(segmentId);
		else next.add(segmentId);
		selectedSegments = next;
	}

	// --- Merge / untag toolbar position ---
	// The toolbar aligns to the topmost selected segment (rather than sticking
	// to the top of the gutter), so it sits beside what the analyst picked.
	let transcriptWrap = $state<HTMLElement | null>(null);
	let toolbarTop = $state(0);

	function alignToolbar() {
		if (selectedSegments.size === 0 || !transcriptWrap) return;
		const wrapTop = transcriptWrap.getBoundingClientRect().top;
		let top = Infinity;
		for (const id of selectedSegments) {
			const el = transcriptWrap.querySelector(`[data-segment-id="${CSS.escape(id)}"]`);
			if (el) top = Math.min(top, el.getBoundingClientRect().top - wrapTop);
		}
		if (top !== Infinity) toolbarTop = Math.max(0, top);
	}

	$effect(() => {
		selectedSegments; // re-align whenever the selection changes
		alignToolbar();
	});

	const selectedList = $derived(
		(result?.segments ?? []).filter((s) => selectedSegments.has(s.segment_id))
	);

	// Merge needs 2+ segments from one turn with contiguous segment_index.
	const canMerge = $derived.by(() => {
		if (selectedList.length < 2) return false;
		const turn = selectedList[0].turn_index;
		if (!selectedList.every((s) => s.turn_index === turn)) return false;
		const idx = selectedList.map((s) => s.segment_index).sort((a, b) => a - b);
		return idx.every((n, i) => i === 0 || n === idx[i - 1] + 1);
	});

	// Unmerge needs exactly one selected segment that was previously merged.
	const canUnmerge = $derived(
		selectedList.length === 1 && (selectedList[0].flags ?? []).includes('merged')
	);

	async function mergeSelected() {
		if (!canMerge || merging || !result) return;
		merging = true;
		segmentActionError = '';
		try {
			const res = await fetch('/patientlyiq/segments', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					interview_id: result.interviewId,
					segment_ids: [...selectedSegments]
				})
			});
			const body = await res.json();
			if (res.ok && body.ok) {
				selectedSegments = new Set();
				// Renumbered ids and the merged annotation come from a fresh load;
				// clearing lastInterview lets the seeding effect re-run.
				lastInterview = '';
				await goto(`?interview=${result.interviewId}`, {
					invalidateAll: true,
					keepFocus: true,
					noScroll: true
				});
			} else {
				segmentActionError = body.error ?? 'Could not merge segments.';
			}
		} finally {
			merging = false;
		}
	}

	async function unmergeSelected() {
		if (!canUnmerge || unmerging || !result) return;
		unmerging = true;
		segmentActionError = '';
		try {
			const res = await fetch('/patientlyiq/segments', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'unmerge',
					interview_id: result.interviewId,
					segment_id: selectedList[0].segment_id
				})
			});
			const body = await res.json();
			if (res.ok && body.ok) {
				selectedSegments = new Set();
				// Renumbered ids come from a fresh load; clearing lastInterview lets
				// the seeding effect re-run.
				lastInterview = '';
				await goto(`?interview=${result.interviewId}`, {
					invalidateAll: true,
					keepFocus: true,
					noScroll: true
				});
			} else {
				segmentActionError = body.error ?? 'Could not unmerge segment.';
			}
		} finally {
			unmerging = false;
		}
	}

	// Per-segment untag — drops one segment's annotation. Caches the prior
	// annotation in `recentlyUntagged` so the retag button can undo the action
	// by re-POSTing the same tags.
	async function untagSegment(segmentId: string) {
		const prev = annotations[segmentId];
		if (!prev || untagging) return;
		untagging = true;
		segmentActionError = '';
		try {
			const res = await fetch('/patientlyiq/segment-tags', {
				method: 'DELETE',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ segment_id: segmentId })
			});
			if (res.ok) {
				recentlyUntagged = { ...recentlyUntagged, [segmentId]: prev };
				const next = { ...annotations };
				delete next[segmentId];
				annotations = next;
			} else {
				segmentActionError = 'Could not untag the segment.';
			}
		} finally {
			untagging = false;
		}
	}

	// Per-segment retag — restores the annotation that the previous untag
	// removed, by POSTing the cached payload back at /patientlyiq/segment-tags.
	// Only operates when the cache has an entry for the segment; if there's
	// nothing to undo, the bubble button falls back to opening the drawer.
	async function retagSegment(segmentId: string) {
		const prev = recentlyUntagged[segmentId];
		if (!prev || untagging) return;
		untagging = true;
		segmentActionError = '';
		try {
			const res = await fetch('/patientlyiq/segment-tags', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					segment_id: prev.segment_id,
					interview_id: prev.interview_id,
					question_id: prev.question_id,
					themes: prev.themes,
					subthemes: prev.subthemes,
					emotions: prev.emotions,
					sentiment: prev.sentiment,
					reviewer_notes: prev.reviewer_notes
				})
			});
			const data = await res.json().catch(() => null);
			if (res.ok && data?.ok) {
				annotations = { ...annotations, [segmentId]: data.annotation as Annotation };
				const nextCache = { ...recentlyUntagged };
				delete nextCache[segmentId];
				recentlyUntagged = nextCache;
			} else {
				segmentActionError = data?.error ?? 'Could not re-tag the segment.';
			}
		} finally {
			untagging = false;
		}
	}

	// --- Persona details panel ---
	// The interview-in-review's participant profile, edited inline beside the
	// transcript. Mirrors the fields of the ParticipantDrawer; seeded from the
	// server per interview, then kept current as saves come back.
	let personaProfile = $state<ParticipantProfile | null>(null);
	let personaFirstName = $state('');
	let personaLastInitial = $state('');
	let personaGender = $state('');
	let personaCountry = $state('');
	let personaAgeRange = $state('');
	let personaType = $state<ParticipantType>('individual');
	let personaSaving = $state(false);
	let personaUploading = $state(false);
	let personaJustSaved = $state(false);
	let personaError = $state('');
	let personaFileInput = $state<HTMLInputElement | null>(null);

	// Seed the persona form from a stored profile.
	function seedPersona(p: ParticipantProfile) {
		personaProfile = p;
		personaFirstName = p.first_name;
		personaLastInitial = p.last_initial;
		personaGender = p.gender;
		personaCountry = p.country;
		personaAgeRange = p.age_range;
		personaType = p.participant_type;
		personaJustSaved = false;
		personaError = '';
	}

	async function savePersona() {
		const id = result?.interviewId;
		if (!id || personaSaving) return;
		personaSaving = true;
		personaError = '';
		try {
			const res = await fetch('/patientlyiq/participant-profiles', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					interviewId: id,
					profile: {
						first_name: personaFirstName,
						last_initial: personaLastInitial,
						gender: personaGender,
						country: personaCountry,
						age_range: personaAgeRange,
						participant_type: personaType
					}
				})
			});
			if (!res.ok) {
				personaError = 'Could not save persona details.';
				return;
			}
			const { profile: saved } = await res.json();
			personaProfile = saved;
			personaJustSaved = true;
		} catch {
			personaError = 'Could not save persona details.';
		} finally {
			personaSaving = false;
		}
	}

	async function uploadPersonaAvatar(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		const id = result?.interviewId;
		if (!file || !id || personaUploading) return;
		personaUploading = true;
		personaError = '';
		try {
			const body = new FormData();
			body.append('interviewId', id);
			body.append('file', file);
			const res = await fetch('/patientlyiq/participant-avatar', { method: 'POST', body });
			if (!res.ok) {
				personaError = 'Could not upload avatar.';
				return;
			}
			const { profile: saved } = await res.json();
			personaProfile = saved;
		} catch {
			personaError = 'Could not upload avatar.';
		} finally {
			personaUploading = false;
			input.value = '';
		}
	}

	// Themes and emotions of an annotation, flattened and
	// type-tagged for the segment card's tag row + overflow popover.
	function cardTags(ann: Annotation | undefined): CardTag[] {
		if (!ann) return [];
		return [
			...ann.themes.map((id): CardTag => ({ kind: 'theme', id })),
			...ann.emotions.map((id): CardTag => ({ kind: 'emotion', id }))
		];
	}
</script>

<svelte:window onresize={alignToolbar} />

{#snippet tagChip(kind: CardTag['kind'], id: string)}
	{#if kind === 'emotion'}
		<span
			class="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600"
		>
			<EmotionDyadChip {id} showLabel={false} />
			{titleCase(id)}
		</span>
	{:else}
		<span
			class="rounded-full bg-mauve-300 px-2 py-0.5 text-[10px] font-medium text-accent-orange"
		>
			{titleCase(id)}
		</span>
	{/if}
{/snippet}

<div class="flex flex-1 flex-col bg-slate-50">
	<PageHeader
		eyebrow="Pipeline"
		title="Review interviews"
	>
		{#snippet actions()}
			<Button onclick={() => { uploadError = ''; uploadOpen = true; }}>
				<UploadIcon />
				Upload transcript
			</Button>
		{/snippet}
	</PageHeader>

	<div class="mx-auto flex w-full md:max-w-7xl lg:w-full flex-col gap-6 px-8 py-10">
		<!-- Source switcher — interview transcripts vs. fragment corpora. Drives
			 the URL (?source=corpus&corpus=…&view=thread|participant) so deep links
			 reload directly into the corpus pane. -->
		<div class="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
			<span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Source</span>
			<button
				type="button"
				onclick={() => selectSource('interview')}
				aria-pressed={data.mode === 'interview'}
				class="rounded-full border px-3 py-1 text-xs transition-colors {data.mode === 'interview'
					? 'border-accent-orange bg-accent-orange text-white'
					: 'border-slate-200 text-slate-600 hover:border-slate-400'} disabled:cursor-not-allowed disabled:opacity-50"
			>
				Interview transcript
			</button>
			<button
				type="button"
				onclick={() => selectSource('corpus')}
				aria-pressed={data.mode === 'corpus'}
				disabled={!data.corpora || data.corpora.length === 0}
				class="rounded-full border px-3 py-1 text-xs transition-colors {data.mode === 'corpus'
					? 'border-accent-orange bg-accent-orange text-white'
					: 'border-slate-200 text-slate-600 hover:border-slate-400'} disabled:cursor-not-allowed disabled:opacity-50"
			>
				Forum corpus
				{#if !data.corpora || data.corpora.length === 0}
					<span class="ml-1 text-[10px] opacity-70">(no corpora)</span>
				{/if}
			</button>
		</div>

		{#if data.mode === 'interview'}
		<!-- Primary action: pick an ingested interview to review, or upload one. -->

		<!-- Autotag status — shown while a freshly uploaded interview is being
			 tagged by the AI pipeline, or if that run failed. -->
		{#if autotagJob && autotagJob.state !== 'done'}
			{#if autotagJob.state === 'running'}
				<div
					class="flex items-center gap-3 rounded-lg border border-accent-orange/50 bg-accent-orange/5 p-4 text-sm text-slate-700"
				>
					<LoaderIcon class="size-5 shrink-0 animate-spin text-accent-orange-background" />
					<div>
						<p class="font-medium text-slate-800">Autotagging {autotagJob.interviewId}…</p>
						<p class="text-xs text-slate-500">
							{autotagStep || 'Starting…'} — the AI is proposing the question mapping and segment
							tags. This view fills in automatically when it finishes.
						</p>
					</div>
				</div>
			{:else}
				<div
					class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900"
				>
					<div>
						<p class="font-medium">Autotagging failed for {autotagJob.interviewId}</p>
						<p class="text-xs text-rose-700">
							{autotagJob.error ?? 'The tagging pipeline errored.'}
						</p>
					</div>
					<div class="flex items-center gap-2">
						<Button variant="outline" size="sm" onclick={retryAutotag}>Retry autotag</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							onclick={() => (autotagJob = null)}
							aria-label="Dismiss"
							title="Dismiss"
						>
							<XIcon />
						</Button>
					</div>
				</div>
			{/if}
		{/if}

		{#if form?.stage === 'questionMap'}
			<div class="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
				<p class="font-semibold">Question mapping saved for {form.interviewId}</p>
				<p class="mt-1">
					{form.mappedCount} of {form.interviewerCount} interviewer turns mapped · {form.segmentsUpdated}
					segments updated with their question. Written to
					<code class="text-xs">question_map.json</code>.
				</p>
			</div>
		{:else if form?.error}
			<div class="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
				{form.error}
			</div>
		{/if}

		{#if result}
			<section class="flex flex-col gap-3">
				<div class="flex flex-col gap-1">
					<h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">
						Review · {result.interviewId}
					</h2>
					<p class="text-sm text-muted-foreground">
						Each interviewer turn's question is AI-proposed — confirm or correct it. Each tinted
						box is one participant segment; click it to confirm or edit its theme, emotion,
						and sentiment. Tick the checkboxes to select segments — then merge
						sequential ones, or untag them, from the toolbar beside the transcript.
					</p>
				</div>

				<!-- Persona panel + transcript. The panel sticks to the left while the
					 transcript scrolls; below lg it stacks above the transcript. -->
				<div class="flex flex-col gap-6 lg:flex-row lg:items-start">
					<!-- Persona details — editable participant profile for the interview
						 in review, mirroring the fields of the participant drawer. -->
					<aside
						class="flex w-full shrink-0 flex-col gap-4 self-start rounded-lg border border-muted bg-white p-5 lg:sticky lg:top-6 lg:w-72"
					>
						<div class="flex flex-col gap-0.5">
							<span class="font-heading text-sm font-medium text-accent-orange-background capitalize">Participant details</span>
							<p class="text-xs text-muted-foreground">
								Persona details provide more depth to each transcript and quote. Add and edit them for this interviewee.
							</p>
						</div>

						<!-- Interview selector — switches which participant's details and
							 transcript are in view. Lives in the same container as the
							 details it drives. -->
						<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
							Interview
							<select
								value={data.review?.interviewId ?? ''}
								onchange={(e) => goto(`?interview=${e.currentTarget.value}`, { keepFocus: true })}
								class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
							>
								<option value="">— pick an interview —</option>
								{#each data.interviewIds as id (id)}
									<option value={id}>{id}</option>
								{/each}
							</select>
						</label>

						<!-- Avatar -->
						<div class="flex items-center gap-3">
							<ParticipantAvatar
								interviewId={result.interviewId}
								size="lg"
								src={personaProfile?.avatar_url}
							/>
							<Button
								variant="link"
								size="xs"
								onclick={() => personaFileInput?.click()}
								disabled={personaUploading}
							>
								{personaUploading
									? 'Uploading…'
									: personaProfile?.avatar_url
										? 'Change avatar'
										: 'Upload avatar'}
							</Button>
							<input
								bind:this={personaFileInput}
								type="file"
								accept="image/png,image/jpeg,image/webp,image/gif"
								class="hidden"
								onchange={uploadPersonaAvatar}
							/>
						</div>

						<!-- Name -->
						<div class="grid grid-cols-[1fr_4rem] gap-2">
							<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
								First name
								<input
									type="text"
									bind:value={personaFirstName}
									placeholder="Jane"
									class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
								/>
							</label>
							<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
								Last init.
								<input
									type="text"
									bind:value={personaLastInitial}
									maxlength="1"
									placeholder="D"
									class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
								/>
							</label>
						</div>

						<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
							Gender
							<select
								bind:value={personaGender}
								class="rounded border border-slate-300 px-2 py-1.5 text-sm capitalize text-slate-800"
							>
								<option value="">—</option>
								{#each GENDERS as g (g)}
									<option value={g} class="capitalize">{g}</option>
								{/each}
							</select>
						</label>

						<div class="grid grid-cols-2 gap-2">
							<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
								Country
								<input
									type="text"
									bind:value={personaCountry}
									placeholder="United States"
									class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
								/>
							</label>
							<label class="flex flex-col gap-1 text-xs font-medium text-slate-500">
								Age range
								<select
									bind:value={personaAgeRange}
									class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
								>
									<option value="">—</option>
									{#each AGE_RANGES as a (a)}
										<option value={a}>{a}</option>
									{/each}
								</select>
							</label>
						</div>

						<div class="flex flex-col gap-1.5">
							<span class="text-xs font-medium text-slate-500">Participant type</span>
							<div class="flex overflow-hidden rounded-md border border-muted">
								{#each ['individual', 'composite'] as const as type (type)}
									<button
										type="button"
										onclick={() => (personaType = type)}
										aria-pressed={personaType === type}
										class="flex-1 px-2 py-1.5 text-xs font-medium capitalize transition-colors
											{personaType === type
											? 'bg-accent-orange text-white'
											: 'bg-white text-slate-600 hover:bg-slate-50'}"
									>
										{type}
									</button>
								{/each}
							</div>
							<p class="text-xs text-slate-400">
								{personaType === 'composite'
									? 'A blended persona drawn from several interviews.'
									: 'A single, real interviewee.'}
							</p>
						</div>

						{#if personaError}
							<p
								class="rounded border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700"
							>
								{personaError}
							</p>
						{/if}

						<div class="flex items-center gap-3">
							<Button size="sm" onclick={savePersona} disabled={personaSaving}>
								{personaSaving ? 'Saving…' : 'Save details'}
							</Button>
							{#if personaJustSaved}
								<span class="text-xs font-medium text-emerald-600">✓ Saved</span>
							{/if}
						</div>
					</aside>

					<!-- Main column — question-mapping save bar + transcript -->
					<div class="flex min-w-0 flex-1 flex-col gap-3">
						<!-- Question-mapping save bar -->
						<form
							method="POST"
							action="?/saveQuestions"
							class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-muted bg-white p-4"
							use:enhance={() => {
								savingQuestions = true;
								return async ({ update }) => {
									await update({ reset: false });
									savingQuestions = false;
								};
							}}
						>
							<input type="hidden" name="interviewId" value={result.interviewId} />
							<input
								type="hidden"
								name="assignments"
								value={JSON.stringify(questionAssignments)}
							/>
							<span class="text-sm text-slate-600">
								<span class="font-medium text-slate-800">{assignedCount}</span>
								of {interviewerTurns.length} interviewer turns have a question
							</span>
							<button
								type="submit"
								disabled={savingQuestions || assignedCount === 0}
								class="rounded bg-accent-orange px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-orange/90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{savingQuestions ? 'Saving…' : 'Save question mapping'}
							</button>
						</form>

						<!-- Transcript window — a single context-aware merge/unmerge button
							 sits absolutely at the left edge, beside the topmost selected
							 segment. Per-bubble controls (select / untag / star) live in a
							 column outside each bubble to its left. -->
						<div class="flex flex-col gap-3">
					<!-- Transcript with per-turn question assignment + segments. The
						 Tooltip.Provider wraps everything so the merge/unmerge button and
						 every per-bubble icon button share one delayed hover behaviour. -->
					<div
						class="relative flex min-w-0 flex-col gap-4 rounded-lg border border-muted bg-white p-5 md:flex-1"
						bind:this={transcriptWrap}
					>
						<Tooltip.Provider delayDuration={150}>
						<!-- Single merge/unmerge button — visible when a selection is
							 actionable. Merge for 2+ sequential, unmerge for one merged. -->
						{#if selectedSegments.size > 0 && (canMerge || canUnmerge || selectedList.length === 1)}
							{@const isUnmerge = canUnmerge}
							{@const busy = isUnmerge ? unmerging : merging}
							{@const enabled = isUnmerge ? !unmerging : canMerge && !merging}
							<div class="absolute left-10 z-10" style="top: {toolbarTop}px">
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<Button
												{...props}
												variant="action"
												size="icon-sm"
												disabled={!enabled}
												onclick={isUnmerge ? unmergeSelected : mergeSelected}
												aria-label={isUnmerge ? 'Unmerge segment' : 'Merge segments'}
											>
												{#if isUnmerge}
													<SplitIcon />
												{:else}
													<MergeIcon />
												{/if}
											</Button>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content side="right">
										{isUnmerge
											? busy
												? 'Unmerging…'
												: 'Split this merged segment back into sentences'
											: canMerge
												? busy
													? 'Merging…'
													: 'Merge selected segments'
												: 'Select 2+ sequential segments in one turn'}
									</Tooltip.Content>
								</Tooltip.Root>
								{#if segmentActionError}
									<p class="mt-1.5 max-w-sm text-xs text-rose-600">{segmentActionError}</p>
								{/if}
							</div>
						{/if}
					{#each result.turns as turn (turn.turn_index)}
						{#if turn.speaker === 'interviewer'}
							<!-- Interviewer turn — left-aligned speech bubble with avatar on the left. -->
							<div class="flex items-start gap-3">
								<img
									src={wctLogoUrl}
									alt="WCT interviewer"
									class="mt-5 size-9 shrink-0 rounded-full border border-muted bg-white object-contain"
								/>
								<div class="flex min-w-0 flex-1 flex-col gap-1.5">
									<div class="flex flex-wrap items-center justify-between gap-2">
										<span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
											Interviewer
										</span>
										<select
											bind:value={questionAssignments[turn.turn_index]}
											class="max-w-md rounded border px-2 py-1 text-xs text-slate-700
												{questionAssignments[turn.turn_index]
												? 'border-accent-orange bg-accent-orange/5'
												: 'border-slate-300'}"
										>
											<option value="">— assign interview question —</option>
											{#each questionBank as q (q.question_id)}
												<option value={q.question_id}>{q.order}. {q.canonical_question}</option>
											{/each}
										</select>
									</div>
									<div class="max-w-[85%] self-start rounded-2xl rounded-tl-none bg-slate-100 px-4 py-3">
										<p class="text-sm leading-relaxed text-slate-600">{turn.text}</p>
									</div>
								</div>
							</div>
						{:else}
							<!-- Participant turn — right-aligned bubbles, avatar on the right.
								 One bubble per segment in the turn. -->
							<div class="flex flex-row-reverse items-start gap-3">
								<ParticipantAvatar interviewId={result.interviewId} size="md" class="mt-5" />
								<div class="flex min-w-0 flex-1 flex-col items-end gap-1.5">
									<span
										class="text-xs font-semibold uppercase tracking-wide text-accent-orange"
									>
										{result.interviewId}
									</span>
									{#each segmentsByTurn.get(turn.turn_index) ?? [] as seg, segIdx (seg.segment_id)}
										{@const ann = annotations[seg.segment_id]}
										{@const tags = cardTags(ann)}
										{@const visibleTags = tags.slice(0, TAG_CAP)}
										{@const hiddenCount = tags.length - visibleTags.length}
										{@const tagAction = ann
											? 'untag'
											: recentlyUntagged[seg.segment_id]
												? 'retag'
												: 'add'}
										{@const tagLabel = tagAction === 'untag'
											? 'Untag this segment'
											: tagAction === 'retag'
												? 'Re-tag this segment (restore previous tags)'
												: 'Add tags to this segment'}
										<!-- Segment row — controls in a left column outside the bubble
											 (checkbox at top, untag/retag + star grouped at bottom). -->
										<div class="flex w-full max-w-[85%] items-stretch gap-6">
											<!-- Controls column — outside the bubble on its left. -->
											<div class="flex shrink-0 flex-col items-center justify-between py-1.5">
												<input
													type="checkbox"
													checked={selectedSegments.has(seg.segment_id)}
													onchange={() => toggleSelect(seg.segment_id)}
													title="Select for merge"
													class="size-4 cursor-pointer accent-accent-orange"
												/>
												<div class="flex flex-col items-center gap-0.5">
													<Tooltip.Root>
														<Tooltip.Trigger>
															{#snippet child({ props })}
																<Button
																	{...props}
																	variant="ghost"
																	size="xs"
																	onclick={() => {
																		if (tagAction === 'untag') untagSegment(seg.segment_id);
																		else if (tagAction === 'retag') retagSegment(seg.segment_id);
																		else openSegment = seg;
																	}}
																	disabled={untagging}
																	aria-label={tagLabel}
																>
																	{#if tagAction === 'untag'}
																		<EraserIcon size={14} />
																	{:else}
																		<TagIcon size={14} />
																	{/if}
																</Button>
															{/snippet}
														</Tooltip.Trigger>
														<Tooltip.Content side="left">
															{tagLabel}
														</Tooltip.Content>
													</Tooltip.Root>
													<Tooltip.Root>
														<Tooltip.Trigger>
															{#snippet child({ props })}
																<Button
																	{...props}
																	variant="ghost"
																	size="xs"
																	onclick={() => toggleStar(seg.segment_id)}
																	disabled={togglingSegment === seg.segment_id}
																	aria-pressed={starredSegments.has(seg.segment_id)}
																	class="
																		{starredSegments.has(seg.segment_id)
																		? 'text-amber-400'
																		: 'text-slate-300 hover:text-amber-400'}"
																>
																	<StarIcon
																		size={14}
																		fill={starredSegments.has(seg.segment_id)
																			? 'currentColor'
																			: 'none'}
																	/>
																</Button>
															{/snippet}
														</Tooltip.Trigger>
														<Tooltip.Content side="left">
															{starredSegments.has(seg.segment_id)
																? 'Starred highlight — click to unstar'
																: 'Star as an important highlight'}
														</Tooltip.Content>
													</Tooltip.Root>
												</div>
											</div>

											<!-- Bubble — the quote itself and its tag row. -->
											<div
												role="button"
												tabindex="0"
												data-segment-id={seg.segment_id}
												onclick={() => (openSegment = seg)}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														openSegment = seg;
													}
												}}
												class="relative flex-1 cursor-pointer rounded-2xl px-4 py-3 transition-colors
													{segIdx === 0 ? 'rounded-tr-none' : ''}
													{ann
													? 'bg-accent-orange/10 hover:bg-mauve-300'
													: 'bg-slate-100 hover:bg-accent-orange/5'}
													{selectedSegments.has(seg.segment_id)
													? 'ring-2 ring-accent-orange ring-inset'
													: ''}"
											>
												<p class="text-sm leading-relaxed text-slate-800">
													<KeywordText text={seg.text} onpick={() => (openSegment = seg)} />
												</p>

												<!-- Tag row — only shown when the segment carries an annotation.
													 An untagged segment has nothing to display, so the row and the
													 "click to edit tags" link both collapse. -->
												{#if ann}
													<div class="mt-2 flex flex-wrap items-center justify-end gap-1.5">
														{#each visibleTags as tag (tag.kind + tag.id)}
															{@render tagChip(tag.kind, tag.id)}
														{/each}
														{#if hiddenCount > 0}
															<Popover.Root>
																<Popover.Trigger
																	onclick={(e) => e.stopPropagation()}
																	title="{hiddenCount} more tag{hiddenCount === 1 ? '' : 's'}"
																	class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1 text-[10px] font-semibold text-slate-500 transition-colors hover:bg-slate-200"
																>
																	+{hiddenCount}
																</Popover.Trigger>
																<Popover.Content align="start" class="w-64">
																	<p class="mb-2 text-xs font-semibold text-slate-700">All tags</p>
																	<div class="flex flex-col gap-2">
																		{#if ann.themes.length}
																			<div>
																				<p
																					class="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400"
																				>
																					Themes
																				</p>
																				<div class="flex flex-wrap gap-1">
																					{#each ann.themes as th (th)}
																						{@render tagChip('theme', th)}
																					{/each}
																				</div>
																			</div>
																		{/if}
																		{#if ann.emotions.length}
																			<div>
																				<p
																					class="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400"
																				>
																					Emotions
																				</p>
																				<div class="flex flex-wrap gap-1">
																					{#each ann.emotions as em (em)}
																						{@render tagChip('emotion', em)}
																					{/each}
																				</div>
																			</div>
																		{/if}
																	</div>
																</Popover.Content>
															</Popover.Root>
														{/if}
														<Button
															variant="link"
															size="xs"
															onclick={(e) => {
																e.stopPropagation();
																openSegment = seg;
															}}
														>
															click to edit tags
															<ArrowRightIcon />
														</Button>
													</div>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					{/each}
					</Tooltip.Provider>
					</div>
				</div>
					</div>
				</div>
			</section>
		{:else if data.interviewIds.length === 0}
			<div
				class="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500"
			>
				<p class="font-medium text-slate-700">
					No interview data for {titleCase(data.activeIndication)} yet
				</p>
				<p class="mt-1">
					Switch indication in the sidebar, or upload a new transcript to seed this dataset.
				</p>
			</div>
		{:else}
			<div
				class="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500"
			>
				<p class="font-medium text-slate-700">No interview selected</p>
				<p class="mt-1">
					Pick an ingested interview above to review its segments and tags, or upload a new
					transcript to add one.
				</p>
			</div>
		{/if}
		{:else if data.mode === 'corpus'}
		<!-- Shared fragment-card snippet — used in both Thread (op + reply) and
			 Participant (flat) views. `kind` drives the visual treatment:
			   - op: OP card, distinctive accent border, flush-left in the panel
			   - reply: comment, plainer styling; the descender line is on the
			     parent container, not the card itself
			   - participant: shown in Participant view; carries the post_id so the
			     analyst can see which thread each comment came from -->
		{#snippet fragmentCard(
			f: Fragment,
			opts: { kind: 'op' | 'reply' | 'merged' | 'participant' }
		)}
			{@const ann = fragmentAnnotations[f.id] ?? null}
			{@const reviewed =
				ann?.segment_tags?.review_status === 'human_confirmed' ||
				ann?.stages?.review_status === 'human_confirmed'}
			{@const isStarred = starredFragments.has(f.id)}
			{@const isSelectable = opts.kind !== 'participant'}
			{@const isSelected = selectedFragments.has(f.id)}
			<!-- A wrapping div (not a button) hosts the card click handler so we
				 can nest a real <button> for the star icon without breaking
				 nested-interactive-element rules. Keyboard support via key handler. -->
			<div
				role="button"
				tabindex="0"
				onclick={() => (openFragment = f)}
				onkeydown={(e: KeyboardEvent) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						openFragment = f;
					}
				}}
				class="flex cursor-pointer flex-col gap-2 rounded-md border p-3 text-left transition-colors
					{opts.kind === 'op'
					? 'border-accent-orange/40 bg-accent-orange/5 hover:border-accent-orange hover:bg-accent-orange/10'
					: opts.kind === 'merged'
						? 'border-violet-300 bg-violet-50 hover:border-violet-500 hover:bg-violet-100'
						: 'border-slate-200 bg-slate-50/40 hover:border-accent-orange hover:bg-accent-orange/5'}
					{isSelected ? 'ring-2 ring-accent-orange ring-offset-1' : ''}"
			>
				<div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
					{#if isSelectable}
						<!-- Multi-select checkbox for merging. Lives in the first row so
							 it doesn't disturb the card's text rhythm. -->
						<input
							type="checkbox"
							checked={isSelected}
							onclick={(e) => {
								e.stopPropagation();
								toggleSelectFragment(f.id);
							}}
							onkeydown={(e) => e.stopPropagation()}
							aria-label="Select for merge"
							class="size-3.5 cursor-pointer rounded border-slate-300 accent-accent-orange"
						/>
					{/if}
					<span
						class="rounded-full px-1.5 py-0.5 font-medium {opts.kind === 'op'
							? 'bg-accent-orange text-white'
							: opts.kind === 'merged'
								? 'bg-violet-600 text-white'
								: 'bg-slate-200 text-slate-600'}"
					>
						{opts.kind === 'op'
							? 'OP'
							: opts.kind === 'merged'
								? 'merged'
								: 'comment'}
					</span>
					{#if opts.kind === 'merged' && Array.isArray(f.derived_from)}
						<span
							class="text-[10px] text-violet-700"
							title={`Combined from ${f.derived_from.join(', ')}`}
						>
							from {f.derived_from.length} fragments
						</span>
					{/if}
					{#if f.source_ref.kind === 'social_post' || f.source_ref.kind === 'social_comment' || f.source_ref.kind === 'forum_post' || f.source_ref.kind === 'forum_comment' || f.source_ref.kind === 'blog_post' || f.source_ref.kind === 'blog_comment'}
						{#if f.source_ref.author_handle_hash && opts.kind !== 'participant'}
							<span>{f.source_ref.author_handle_hash}</span>
							<span>·</span>
						{/if}
						{#if opts.kind === 'participant'}
							<span class="font-mono">{f.source_ref.post_id}</span>
							{#if f.source_ref.comment_id}
								<span class="font-mono text-slate-400">/{f.source_ref.comment_id}</span>
							{/if}
							<span>·</span>
						{/if}
					{/if}
					<span>{new Date(f.date_observed).toLocaleDateString()}</span>
					<span
						class="ml-auto rounded-full px-1.5 py-0.5 {reviewed
							? 'bg-emerald-100 text-emerald-700'
							: ann
								? 'bg-amber-100 text-amber-700'
								: 'bg-slate-100 text-slate-500'}"
					>
						{reviewed ? 'confirmed' : ann ? 'AI-proposed' : 'untagged'}
					</span>
					<button
						type="button"
						onclick={(e: MouseEvent) => {
							e.stopPropagation();
							toggleFragmentStar(f.id);
						}}
						disabled={togglingFragmentStar === f.id}
						aria-pressed={isStarred}
						title={isStarred ? 'Starred — click to unstar' : 'Star this fragment'}
						class="ml-1 inline-flex items-center justify-center rounded p-0.5 transition-colors {isStarred
							? 'text-amber-400'
							: 'text-slate-300 hover:text-amber-400'}"
					>
						<StarIcon size={14} fill={isStarred ? 'currentColor' : 'none'} />
					</button>
				</div>
				<p class="text-sm text-slate-700 line-clamp-4 whitespace-pre-wrap">
					<KeywordText text={f.text} matcher={corpusMatcher} />
				</p>
				{#if ann}
					<div class="flex flex-wrap gap-1">
						{#each (ann.segment_tags?.subthemes ?? []).slice(0, 5) as sub (sub)}
							<span
								class="rounded-full bg-mauve-300 px-2 py-0.5 text-[10px] font-medium text-accent-orange"
							>
								{titleCase(sub)}
							</span>
						{/each}
						{#each (ann.segment_tags?.emotions ?? []).slice(0, 3) as emo (emo)}
							<span
								class="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600"
							>
								<EmotionDyadChip id={emo} showLabel={false} />
								{titleCase(emo)}
							</span>
						{/each}
						{#if ann.stages?.values?.length}
							<span
								class="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700"
							>
								{ann.stages.values.length} stage{ann.stages.values.length === 1 ? '' : 's'}
							</span>
						{/if}
					</div>
				{/if}
			</div>
		{/snippet}

		<!-- Corpus toolbar — corpus picker + Thread/Participant toggle + tallies. -->
		<section
			class="flex flex-wrap items-center gap-3 rounded-lg border border-muted bg-white p-4"
		>
			<label class="flex items-center gap-2 text-xs font-medium text-slate-500">
				Corpus
				<select
					value={data.corpus?.id ?? ''}
					onchange={(e) => selectCorpus((e.currentTarget as HTMLSelectElement).value)}
					class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
				>
					{#each data.corpora as c (c.id)}
						<option value={c.id}>{c.label}</option>
					{/each}
				</select>
			</label>

			<!--
				Sliding-thumb toggle. inline-grid + grid-cols-2 forces both buttons to
				the same column width (the wider button's intrinsic size), so the
				absolutely-positioned thumb can translateX(0 → 100%) and land
				exactly under the second button without measurement.
			-->
			<div
				role="tablist"
				aria-label="Corpus view"
				class="relative inline-grid grid-cols-2 rounded-full border border-slate-200 bg-white p-1"
			>
				<span
					aria-hidden="true"
					class="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-accent-orange transition-transform duration-200 ease-out"
					style:transform={corpusView === 'thread' ? 'translateX(0)' : 'translateX(100%)'}
				></span>
				<button
					type="button"
					role="tab"
					onclick={() => setCorpusView('thread')}
					aria-pressed={corpusView === 'thread'}
					aria-selected={corpusView === 'thread'}
					class="relative z-10 whitespace-nowrap rounded-full px-4 py-1 text-xs transition-colors {corpusView ===
					'thread'
						? 'text-white'
						: 'text-slate-600 hover:text-slate-800'}"
				>
					Thread
				</button>
				<button
					type="button"
					role="tab"
					onclick={() => setCorpusView('participant')}
					aria-pressed={corpusView === 'participant'}
					aria-selected={corpusView === 'participant'}
					class="relative z-10 whitespace-nowrap rounded-full px-4 py-1 text-xs transition-colors {corpusView ===
					'participant'
						? 'text-white'
						: 'text-slate-600 hover:text-slate-800'}"
				>
					Participant
				</button>
			</div>

			<span class="ml-auto text-xs text-slate-500">
				{corpusFragments.length} fragment{corpusFragments.length === 1 ? '' : 's'} ·
				{confirmedFragmentCount} confirmed
				{#if untaggedFragmentCount > 0}
					· <span class="text-amber-700">{untaggedFragmentCount} untagged</span>
				{/if}
			</span>
			{#if data.corpus}
				<!-- Autotag button — only meaningful when there's untagged work. The
					 button stays mounted (rather than disappearing) so its disabled
					 state acknowledges that the corpus is fully tagged, which is more
					 informative than the absence of a button. -->
				<Button
					size="sm"
					variant="outline"
					onclick={startAutotagFromToolbar}
					disabled={untaggedFragmentCount === 0 || autotagStarting}
					title={untaggedFragmentCount === 0
						? 'All fragments are already tagged.'
						: `Autotag ${untaggedFragmentCount} untagged fragment${untaggedFragmentCount === 1 ? '' : 's'} — runs themes, sentiment, and stages passes.`}
				>
					<SparklesIcon />
					{autotagStarting
						? 'Starting…'
						: untaggedFragmentCount > 0
							? `Autotag (${untaggedFragmentCount})`
							: 'Autotag'}
				</Button>
				<Button
					size="sm"
					variant="action"
					onclick={() => {
						addRowsError = '';
						addRowsOpen = true;
					}}
				>
					<UploadIcon />
					Add rows
				</Button>
			{/if}
		</section>

		{#if !data.corpus && data.corpora.length === 0}
			<div
				class="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500"
			>
				<p class="font-medium text-slate-700">
					No corpora for {titleCase(data.activeIndication)} yet
				</p>
				<p class="mt-1">
					Switch indication in the sidebar, or ingest a corpus targeting this indication.
				</p>
			</div>
		{:else if !data.corpus}
			<div
				class="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500"
			>
				<p class="font-medium text-slate-700">No corpus selected</p>
				<p class="mt-1">Pick a corpus above to start reviewing fragments.</p>
			</div>
		{:else if corpusFragments.length === 0}
			<div
				class="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500"
			>
				<p class="font-medium text-slate-700">No fragments in this corpus yet</p>
				<p class="mt-1">
					Run a propose-fragment-* script to seed AI-proposed tags, then come back here to confirm.
				</p>
			</div>
		{:else}
			<!-- Sidebar picker + selected-group right panel. Mirrors the interview
				 view's participant-aside + transcript-pane layout. -->
			<div class="flex flex-col gap-6 lg:flex-row lg:items-start">
				<aside
					class="flex w-full shrink-0 flex-col gap-1 self-start rounded-lg border border-muted bg-white p-3 lg:sticky lg:top-6 lg:w-72 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
				>
					<p class="px-2 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
						{corpusView === 'thread' ? 'Threads' : 'Participants'}
					</p>
					{#if corpusView === 'thread'}
						{#each threadGroups as [postId, items] (postId)}
							{@const isActive = postId === selectedThreadId}
							{@const tally = tallyConfirmed(items)}
							<button
								type="button"
								onclick={() => selectThread(postId)}
								aria-pressed={isActive}
								class="flex flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors
									{isActive
									? 'border-accent-orange bg-accent-orange/10 text-slate-800'
									: 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'}"
							>
								<span class="line-clamp-2 text-xs font-medium leading-snug">
									{threadTitle(items)}
								</span>
								<span class="flex items-center gap-2 text-[10px] text-slate-400">
									<span>{tally.total} frag</span>
									<span>·</span>
									<span
										class={tally.confirmed === tally.total && tally.total > 0
											? 'text-emerald-600'
											: 'text-amber-600'}
									>
										{tally.confirmed}/{tally.total} confirmed
									</span>
								</span>
							</button>
						{/each}
					{:else}
						{#each participantGroups as [author, items] (author)}
							{@const isActive = author === selectedParticipantId}
							{@const tally = tallyConfirmed(items)}
							<button
								type="button"
								onclick={() => selectParticipant(author)}
								aria-pressed={isActive}
								class="flex flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors
									{isActive
									? 'border-accent-orange bg-accent-orange/10 text-slate-800'
									: 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'}"
							>
								<span class="text-xs font-medium">{author}</span>
								<span class="flex items-center gap-2 text-[10px] text-slate-400">
									<span>{tally.total} frag</span>
									<span>·</span>
									<span
										class={tally.confirmed === tally.total && tally.total > 0
											? 'text-emerald-600'
											: 'text-amber-600'}
									>
										{tally.confirmed}/{tally.total} confirmed
									</span>
								</span>
							</button>
						{/each}
					{/if}
				</aside>

				<!--
					Right panel: the selected group's fragments. {#key} on the view +
					selection makes the transcript content fade in when the user
					toggles Thread/Participant or picks a different row in the
					sidebar, instead of snapping instantly.
				-->
				<div class="min-w-0 flex-1">
				{#key corpusView + ':' + (selectedThreadId ?? selectedParticipantId ?? '')}
				<div class="flex flex-col gap-3" in:fade={{ duration: 180, easing: cubicOut }}>
					{#if corpusView === 'thread' && selectedThreadId}
						{@const items = activeThreadItems}
						{@const op = items.find(
							(f) => f.content_source === 'social_post' && !isMergedFragment(f)
						)}
						{@const merges = items.filter(isMergedFragment)}
						{@const replies = items.filter(
							(f) => f.content_source !== 'social_post' && !isMergedFragment(f)
						)}
						<header class="flex flex-col gap-1">
							<h3 class="text-base font-semibold text-slate-800">{threadTitle(items)}</h3>
							<span class="font-mono text-[11px] text-slate-400">{selectedThreadId}</span>
						</header>

						<!-- Floating merge bar — appears when 2+ fragments selected. -->
						{#if selectedFragments.size >= 2}
							<div
								class="sticky top-2 z-10 flex items-center justify-between gap-3 rounded-md border border-accent-orange/40 bg-accent-orange/10 px-3 py-2 text-xs"
							>
								<span class="font-medium text-slate-700">
									{selectedFragments.size} selected
									{#if !canMergeFragments}
										<span class="ml-1 text-rose-600">(must be same thread)</span>
									{/if}
								</span>
								<div class="flex items-center gap-2">
									<button
										type="button"
										onclick={clearSelection}
										class="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-600 hover:bg-slate-50"
									>
										Clear
									</button>
									<button
										type="button"
										onclick={() => {
											mergeError = '';
											mergeDialogOpen = true;
										}}
										disabled={!canMergeFragments}
										class="rounded-full bg-accent-orange px-3 py-1 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:bg-accent-orange/85"
									>
										Merge into one quote
									</button>
								</div>
							</div>
						{/if}

						{#if op}
							{@render fragmentCard(op, { kind: 'op' })}
						{/if}
						{#each merges as f (f.id)}
							{@render fragmentCard(f, { kind: 'merged' })}
						{/each}
						{#if replies.length}
							<!-- Replies indented under the OP with a descender line for
								 the parent→child visual cue. depth-2+ isn't supported yet
								 because the source CSV has no parent_comment_id. -->
							<div class="relative ml-3 flex flex-col gap-2 border-l-2 border-accent-orange/30 pl-4">
								{#each replies as f (f.id)}
									{@render fragmentCard(f, { kind: 'reply' })}
								{/each}
							</div>
						{/if}
					{:else if corpusView === 'participant' && selectedParticipantId}
						<header class="flex flex-col gap-1">
							<h3 class="text-base font-semibold text-slate-800">{selectedParticipantId}</h3>
							<span class="text-[11px] text-slate-400">
								{activeParticipantItems.length} fragment{activeParticipantItems.length === 1
									? ''
									: 's'} across {new Set(
									activeParticipantItems.map((f) =>
										f.source_ref.kind === 'social_post' ||
										f.source_ref.kind === 'social_comment' ||
										f.source_ref.kind === 'forum_post' ||
										f.source_ref.kind === 'forum_comment' ||
										f.source_ref.kind === 'blog_post' ||
										f.source_ref.kind === 'blog_comment'
											? f.source_ref.post_id
											: '?'
									)
								).size} thread(s)
							</span>
						</header>
						{#each activeParticipantItems as f (f.id)}
							{@render fragmentCard(f, { kind: 'participant' })}
						{/each}
					{/if}
				</div>
				{/key}
				</div>
			</div>
		{/if}
		{/if}
	</div>
</div>

<!-- Upload modal — paste or load a transcript; on submit the interview is
	 parsed, segmented, and queued for AI autotagging. -->
<Dialog.Root bind:open={uploadOpen}>
	<Dialog.Content class="sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Upload a transcript</Dialog.Title>
			<Dialog.Description>
				Paste or load a raw interview transcript. On submit it's parsed and segmented, then the AI
				proposes its question mapping and segment tags automatically.
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/parse"
			class="flex flex-col gap-4"
			use:enhance={() => {
				submitting = true;
				uploadError = '';
				return async ({ result: actionResult }) => {
					submitting = false;
					if (actionResult.type === 'success' && actionResult.data?.success) {
						const newId = String(actionResult.data.interviewId);
						uploadOpen = false;
						transcript = '';
						participantId = '';
						lastInterview = '';
						await goto(`?interview=${newId}`, { invalidateAll: true });
					} else if (actionResult.type === 'failure') {
						uploadError = String(actionResult.data?.error ?? 'Upload failed.');
					} else if (actionResult.type === 'error') {
						uploadError = 'Could not reach the server.';
					}
				};
			}}
		>
			<label class="flex flex-col gap-1.5">
				<span class="text-sm font-medium text-slate-700">Participant number</span>
				<input
					name="participantId"
					bind:value={participantId}
					placeholder="e.g. 11 — leave blank to read from a “Participant N” title line"
					class="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800"
				/>
			</label>

			<div class="flex items-center justify-between">
				<span class="text-sm font-medium text-slate-700">Transcript text</span>
				<label class="cursor-pointer text-xs text-accent-orange hover:underline">
					Load from .txt / .md file
					<input type="file" accept=".txt,.md,text/plain" class="hidden" onchange={loadFile} />
				</label>
			</div>
			<textarea
				name="transcript"
				bind:value={transcript}
				rows="14"
				placeholder={'Paste the raw transcript. Speaker turns are detected from lines like:\n\nInterviewer: …\nParticipant: …'}
				class="rounded border border-slate-300 p-3 font-mono text-xs leading-relaxed text-slate-800"
			></textarea>

			{#if uploadError}
				<p class="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
					{uploadError}
				</p>
			{/if}

			<div class="flex items-center justify-between">
				<span class="text-xs text-slate-400">{transcript.length.toLocaleString()} characters</span>
				<Button type="submit" disabled={submitting || transcript.trim().length === 0}>
					{submitting ? 'Parsing…' : 'Parse & autotag'}
				</Button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Merge-fragments confirm dialog. Shown when the floating "Merge into one
	 quote" button is clicked. Preview is the joined-by-blank-line text the
	 server will write; analyst may add a note that gets prepended to the
	 merged annotation's segment_tags.note. -->
<Dialog.Root bind:open={mergeDialogOpen}>
	<Dialog.Content class="sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Merge {selectedFragments.size} fragments</Dialog.Title>
			<Dialog.Description>
				Combine these fragments into one comprehensive quote. The originals stay in
				place; a new "merged" fragment is added with provenance pointing back to
				each source.
			</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-3">
			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-medium text-slate-500">Preview (chronological)</span>
				<textarea
					readonly
					rows="10"
					value={mergePreviewText}
					class="rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-700"
				></textarea>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-medium text-slate-500">Reviewer note (optional)</span>
				<textarea
					bind:value={mergeNote}
					rows="2"
					placeholder="Why merge? Optional context for the next reviewer."
					class="rounded border border-slate-200 px-3 py-2 text-sm text-slate-700"
				></textarea>
			</label>
			{#if mergeError}
				<p class="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
					{mergeError}
				</p>
			{/if}
			<div class="flex items-center justify-end gap-2">
				<Button variant="outline" size="sm" onclick={() => (mergeDialogOpen = false)}>
					Cancel
				</Button>
				<Button onclick={mergeSelectedFragments} disabled={mergingFragments || !canMergeFragments}>
					{mergingFragments ? 'Merging…' : 'Confirm merge'}
				</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Add-rows-to-corpus dialog. Pastes/uploads forum-schema CSV or JSON; the
	 server projects rows into fragments via the same logic the offline
	 import-forum-as-fragments.mjs script uses, then appends to the corpus's
	 existing partitions. -->
{#if data.mode === 'corpus' && data.corpus}
	<Dialog.Root bind:open={addRowsOpen}>
		<Dialog.Content class="sm:max-w-2xl">
			<Dialog.Header>
				<Dialog.Title>Add rows to {data.corpus.label}</Dialog.Title>
				<Dialog.Description>
					{#if addRowsStage === 'edit'}
						Paste or upload forum-row data. Required columns: Anonymized Username, Timestamp,
						Text. Optional: Thread, Conversation, Comment, Context, Username. Long rows split
						at ingest using the corpus's existing split thresholds.
					{:else}
						Review the impact before writing. Overwriting an existing fragment id replaces
						its text + metadata; any annotations on that id stay but may no longer match.
					{/if}
				</Dialog.Description>
			</Dialog.Header>

			{#if addRowsStage === 'edit'}
				<div class="flex flex-col gap-4">
					<!-- Format toggle. Default CSV (most common analyst paste); JSON when
						 the analyst already has a normalized array. -->
					<div class="flex items-center gap-2 text-xs">
						<span class="font-medium text-slate-500">Format</span>
						<div class="inline-flex overflow-hidden rounded-md border border-muted">
							{#each ['csv', 'json'] as const as fmt (fmt)}
								<button
									type="button"
									onclick={() => (addRowsFormat = fmt)}
									aria-pressed={addRowsFormat === fmt}
									class="px-3 py-1 text-xs font-medium uppercase transition-colors {addRowsFormat ===
									fmt
										? 'bg-accent-orange text-white'
										: 'bg-white text-slate-600 hover:bg-slate-50'}"
								>
									{fmt}
								</button>
							{/each}
						</div>
						<label class="ml-auto cursor-pointer text-xs text-accent-orange hover:underline">
							Load from .csv / .json file
							<input
								bind:this={addRowsFileInput}
								type="file"
								accept=".csv,.json,text/csv,application/json"
								class="hidden"
								onchange={loadAddRowsFile}
							/>
						</label>
					</div>

					<textarea
						bind:value={addRowsContent}
						rows="12"
						placeholder={addRowsFormat === 'csv'
							? 'Anonymized Username,Timestamp,Text,Thread,Conversation,Comment,Context\nParticipant 010,2025-02-04T00:00:00Z,"Hello, world.",2,1,1 a,Diagnosed SLE'
							: '[\n  {\n    "Anonymized Username": "Participant 010",\n    "Timestamp": "2025-02-04T00:00:00Z",\n    "Text": "Hello, world.",\n    "Thread": "2",\n    "Conversation": "1",\n    "Comment": "1 a",\n    "Context": "Diagnosed SLE"\n  }\n]'}
						class="rounded border border-slate-300 p-3 font-mono text-xs leading-relaxed text-slate-800"
					></textarea>

					<!-- Thread renumbering — default on. When the corpus already has
						 forum fragments, this is the difference between a fresh upload
						 landing in its own namespace vs silently overwriting older
						 Thread=1 entries. -->
					<label class="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50/60 p-2.5 text-xs">
						<input
							type="checkbox"
							bind:checked={autoRenumberThreads}
							class="mt-0.5 size-3.5 cursor-pointer rounded border-slate-300 bg-accent"
						/>
						<div class="flex flex-col gap-0.5">
							<span class="font-medium text-slate-700">
								Auto-renumber Thread ids to avoid conflicts
							</span>
							<span class="text-slate-500">
								{#if maxExistingThread === 0}
									This corpus has no existing forum threads yet — input Thread ids will be
									used as-is.
								{:else if threadRemap.size === 0}
									Highest existing Thread is <span class="font-mono">{maxExistingThread}</span>.
									New threads will start at <span class="font-mono">{maxExistingThread + 1}</span>.
								{:else}
									Renumbering <span class="font-mono">{threadRemap.size}</span> distinct
									Thread{threadRemap.size === 1 ? '' : 's'} starting at
									<span class="font-mono">{maxExistingThread + 1}</span>.
								{/if}
							</span>
						</div>
					</label>

					<!-- Live preview: row count from the client-side parse + any
						 structural problems. The server re-validates and is the source of
						 truth, but this shortens the feedback loop. -->
					<div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
						{#if parsedRows.error}
							<span class="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-rose-700">
								Parse error: {parsedRows.error}
							</span>
						{:else}
							<span>
								<span class="font-semibold text-slate-700">{parsedRows.rows.length}</span>
								row{parsedRows.rows.length === 1 ? '' : 's'} detected
							</span>
							{#if parsedRowProblems.length > 0}
								<span class="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-800">
									{parsedRowProblems.length} row{parsedRowProblems.length === 1 ? '' : 's'} missing
									required fields
								</span>
							{/if}
						{/if}
						<span class="ml-auto text-slate-400">
							{addRowsContent.length.toLocaleString()} characters
						</span>
					</div>

					{#if parsedRowProblems.length > 0}
						<details class="text-xs text-slate-600">
							<summary class="cursor-pointer hover:text-slate-800">
								Show first {Math.min(5, parsedRowProblems.length)} problem{parsedRowProblems.length ===
								1
									? ''
									: 's'}
							</summary>
							<ul class="mt-1 list-disc pl-5">
								{#each parsedRowProblems.slice(0, 5) as issue (issue)}
									<li>{issue}</li>
								{/each}
							</ul>
						</details>
					{/if}

					{#if addRowsError}
						<p class="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
							{addRowsError}
						</p>
					{/if}

					<div class="flex items-center justify-end gap-2">
						<Button
							variant="outline"
							size="sm"
							onclick={() => {
								addRowsOpen = false;
								resetAddRowsDialog();
							}}
						>
							Cancel
						</Button>
						<Button
							onclick={previewAddRows}
							disabled={addRowsSubmitting ||
								parsedRows.rows.length === 0 ||
								parsedRows.error.length > 0}
						>
							{addRowsSubmitting ? 'Previewing…' : 'Preview changes →'}
						</Button>
					</div>
				</div>
			{:else if addRowsPreview}
				<!-- Confirmation stage — server returned a dry-run summary; show
					 the new-vs-overwrite breakdown before committing. -->
				<div class="flex flex-col gap-4">
					<div class="grid grid-cols-2 gap-3">
						<div class="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
							<p class="text-xs font-medium uppercase tracking-wide text-emerald-700">
								New fragments
							</p>
							<p class="mt-1 text-2xl font-semibold text-emerald-900">
								{addRowsPreview.totalNew.toLocaleString()}
							</p>
						</div>
						<div
							class="rounded-lg border p-4 {addRowsPreview.totalOverwrite > 0
								? 'border-amber-300 bg-amber-50'
								: 'border-slate-200 bg-slate-50'}"
						>
							<p
								class="text-xs font-medium uppercase tracking-wide {addRowsPreview.totalOverwrite >
								0
									? 'text-amber-700'
									: 'text-slate-500'}"
							>
								Will overwrite existing
							</p>
							<p
								class="mt-1 text-2xl font-semibold {addRowsPreview.totalOverwrite > 0
									? 'text-amber-900'
									: 'text-slate-600'}"
							>
								{addRowsPreview.totalOverwrite.toLocaleString()}
							</p>
						</div>
					</div>

					{#if Object.keys(addRowsPreview.perPartition).length > 0}
						<div class="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-600">
							<p class="mb-1.5 font-medium uppercase tracking-wide text-slate-500">By partition</p>
							<ul class="flex flex-col gap-0.5">
								{#each Object.entries(addRowsPreview.perPartition) as [part, counts] (part)}
									<li class="flex items-center justify-between gap-3">
										<span class="font-mono">{part}</span>
										<span>
											<span class="text-emerald-700">+{counts.new} new</span>
											{#if counts.overwrite > 0}
												<span class="ml-2 text-amber-700">{counts.overwrite} overwrite</span>
											{/if}
										</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if autoRenumberThreads && threadRemap.size > 0}
						<div class="rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
							<p class="font-medium">
								Renumbered {threadRemap.size} Thread id{threadRemap.size === 1 ? '' : 's'}
							</p>
							<p class="mt-0.5 text-sky-800">
								Input Threads were remapped to start above the corpus's existing max
								(<span class="font-mono">{maxExistingThread}</span>) so they can't collide
								with prior fragments.
							</p>
							<details class="mt-1.5">
								<summary class="cursor-pointer hover:text-sky-950">
									Show mapping
								</summary>
								<ul class="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[11px]">
									{#each [...threadRemap.entries()] as [oldT, newT] (oldT)}
										<li>
											<span class="text-slate-500">{oldT}</span>
											<span class="text-slate-400"> → </span>
											<span class="text-sky-900">{newT}</span>
										</li>
									{/each}
								</ul>
							</details>
						</div>
					{/if}

					{#if addRowsPreview.totalOverwrite > 0}
						<div class="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
							<p class="font-medium">
								Heads-up: {addRowsPreview.totalOverwrite} existing fragment{addRowsPreview.totalOverwrite ===
								1
									? ''
									: 's'} will be replaced.
							</p>
							<p class="mt-1">
								The replacement happens whenever a row's (Thread, Conversation, Comment) key
								matches a fragment already in the corpus. Re-uploading the same source file
								does this on purpose; otherwise it's usually a sign the input overlaps with
								earlier data.
							</p>
							{#if addRowsPreview.overwriteSample.length > 0}
								<details class="mt-1.5">
									<summary class="cursor-pointer hover:text-amber-950">
										Show {Math.min(5, addRowsPreview.overwriteSample.length)} affected id{addRowsPreview
											.overwriteSample.length === 1
											? ''
											: 's'}
									</summary>
									<ul class="mt-1 list-disc pl-5 font-mono text-[10px]">
										{#each addRowsPreview.overwriteSample as id (id)}
											<li>{id}</li>
										{/each}
									</ul>
								</details>
							{/if}
						</div>
					{/if}

					<!-- AI tagging opt-in. Lives on the confirm step (not edit) so the
						 analyst already knows how many fragments will be tagged before
						 toggling — keeps the cost decision honest. -->
					<label
						class="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50/60 p-2.5 text-xs"
					>
						<input
							type="checkbox"
							bind:checked={runAutotag}
							class="mt-0.5 size-3.5 cursor-pointer rounded border-slate-300 accent-accent-mint"
						/>
						<div class="flex flex-col gap-0.5">
							<span class="font-medium text-slate-700">
								Run AI autotagging on the new fragments
							</span>
							<span class="text-slate-500">
								Spawns propose-fragment-themes / sentiment / stages in the background once
								the write succeeds. Each pass is a paid Claude call per thread — skip when
								re-ingesting a source that's already been tagged.
							</span>
						</div>
					</label>

					{#if addRowsError}
						<p class="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
							{addRowsError}
						</p>
					{/if}

					<div class="flex items-center justify-between gap-2">
						<Button variant="ghost" size="sm" onclick={backToEdit}>← Back to edit</Button>
						<div class="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onclick={() => {
									addRowsOpen = false;
									resetAddRowsDialog();
								}}
							>
								Cancel
							</Button>
							<Button onclick={confirmAddRows} disabled={addRowsSubmitting}>
								{addRowsSubmitting
									? 'Adding…'
									: `Confirm and add ${addRowsPreview.totalNew + addRowsPreview.totalOverwrite}${runAutotag ? ' + autotag' : ''}`}
							</Button>
						</div>
					</div>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Root>
{/if}

<!-- Per-segment tag editing — opened by clicking a segment in the review view. -->
<SegmentTagDrawer
	segment={openSegment}
	annotation={openSegment ? (annotations[openSegment.segment_id] ?? null) : null}
	starred={openSegment ? starredSegments.has(openSegment.segment_id) : false}
	togglingStar={openSegment ? togglingSegment === openSegment.segment_id : false}
	onToggleStar={toggleStar}
	onclose={() => (openSegment = null)}
	onsaved={(a) => {
		annotations = { ...annotations, [a.segment_id]: a };
		toasts.push({
			message: `Tags saved for ${titleCase(a.interview_id)}.`,
			href: `/patientlyiq/personas?interview=${a.interview_id}`,
			linkLabel: "View this participant's persona →"
		});
	}}
	onedited={() => {
		// Segment text was rewritten on disk — refresh so the transcript list
		// reflects the new wording. The drawer keeps its own local copy in sync.
		lastInterview = '';
		invalidateAll();
	}}
/>

<!-- Per-fragment tag editing — opened by clicking a fragment in the corpus
	 pane. Parallel to SegmentTagDrawer but driven by the fragment shape. -->
{#if data.mode === 'corpus' && data.corpus}
	<FragmentTagDrawer
		fragment={openFragment}
		annotation={openFragment ? (fragmentAnnotations[openFragment.id] ?? null) : null}
		journey={data.journey}
		corpusId={data.corpus.id}
		matcher={corpusMatcher}
		fragmentKeywordTags={(() => {
			const f = openFragment;
			if (!f) return [];
			return data.fragmentKeywordTags?.filter((t) => t.fragment_id === f.id) ?? [];
		})()}
		starred={openFragment ? starredFragments.has(openFragment.id) : false}
		togglingStar={openFragment ? togglingFragmentStar === openFragment.id : false}
		onToggleStar={toggleFragmentStar}
		onTagsChanged={() => invalidateAll()}
		onTextEdited={() => invalidateAll()}
		onclose={() => (openFragment = null)}
		onsaved={(a) => {
			if (openFragment) {
				fragmentAnnotations = { ...fragmentAnnotations, [openFragment.id]: a };
				toasts.push({ message: `Tags saved for ${openFragment.id}.` });
			}
		}}
		siblings={openSiblings}
		onNavigate={(target) => (openFragment = target)}
	/>
{/if}

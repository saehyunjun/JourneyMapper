<!--
  TranscriptUploadDialog — one dialog window for every transcript shape.

  Type picker at the top swaps the body between two input modes:
  - speaker-prefixed text  (interview, podcast_transcript, youtube_transcript)
  - row-based CSV/JSON     (forum/social, blog)

  Each type also drives an ID-preview line that shows what fragment ids the
  upload will land on — same affordance the forum dialog had implicitly via
  the Thread/Conversation columns; here it's surfaced for every type.

  Replaces the two prior in-page dialogs (interview upload + corpus add-rows).
  Server actions reused:
    interview              → ?/parse
    forum / blog           → ?/addToCorpus  (content_source_kind=forum|blog)
    podcast / youtube      → ?/parseTranscriptToCorpus
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
	import {
		interviewIdFromParticipantId,
		rowFragmentId,
		transcriptEpisodeSlug,
		transcriptFragmentId
	} from '$lib/ingest/conventions';
	import type { Fragment } from '$lib/content/corpora/types';

	type TranscriptType = 'interview' | 'forum' | 'blog' | 'podcast' | 'youtube';
	type InputMode = 'speaker' | 'rows';

	type CorpusSummary = { id: string; label: string; indications: string[] };

	// Discriminated result the caller sees on a successful submit. Lets the
	// page surface its own toasts + autotag-progress tracking without the dialog
	// having to know about the toast store.
	export type UploadResult =
		| {
				kind: 'interview';
				interviewId: string;
		  }
		| {
				kind: 'corpus_rows';
				corpusId: string;
				added: number;
				overwrite: number;
				autotagStarted: boolean;
				autotagError: string | null;
		  }
		| {
				kind: 'transcript_to_corpus';
				corpusId: string;
				transcriptKind: 'podcast_transcript' | 'youtube_transcript';
				episodeSlug: string;
				added: number;
				overwrite: number;
				autotagStarted: boolean;
				autotagError: string | null;
		  };

	type Props = {
		open: boolean;
		// Caller may pre-select a type (e.g. opening from the corpus pane defaults
		// to forum). Defaults to interview.
		defaultType?: TranscriptType;
		// Every corpus the analyst could write into. Filtered by indication on the
		// caller; we just render the list.
		corpora: CorpusSummary[];
		// When the dialog is opened from the corpus pane, this fixes the target
		// corpus and hides the selector. Null means "pick from corpora".
		lockedCorpus: { id: string; label: string } | null;
		// Existing fragments of the locked corpus (or all corpora) — used to
		// compute max-existing-thread so the rows-mode preview can show what
		// thread numbers a fresh paste will land on.
		existingFragmentsByCorpus?: Record<string, Fragment[]>;
		// Called after a successful write so the page can toast / track autotag.
		onSuccess?: (result: UploadResult) => void;
	};

	let {
		open = $bindable(),
		defaultType = 'interview',
		corpora,
		lockedCorpus,
		existingFragmentsByCorpus = {},
		onSuccess
	}: Props = $props();

	// ------------------------------------------------------------------ Config

	const TYPE_CONFIG: Record<
		TranscriptType,
		{
			label: string;
			mode: InputMode;
			needsCorpus: boolean;
			// One-line description shown under the dialog title once this type is
			// picked. Steers the analyst on what the body expects.
			hint: string;
			// File picker accept list. Match the body's mode.
			accept: string;
			// For the live-preview line: short verb describing what the dialog will
			// produce ("Will create the interview …").
			previewVerb: string;
		}
	> = {
		interview: {
			label: 'Interview',
			mode: 'speaker',
			needsCorpus: false,
			hint: 'Paste or upload a raw interview transcript. Speaker turns are detected from lines like "Interviewer: …" / "Participant: …".',
			accept: '.txt,.md,text/plain',
			previewVerb: 'interview'
		},
		forum: {
			label: 'Forum / social',
			mode: 'rows',
			needsCorpus: true,
			hint: 'Paste or upload row data (CSV or JSON). Required: Anonymized Username, Timestamp, Text. Optional: Thread, Conversation, Comment, Context, Username.',
			accept: '.csv,.json,text/csv,application/json',
			previewVerb: 'social_post / social_comment'
		},
		blog: {
			label: 'Blog',
			mode: 'rows',
			needsCorpus: true,
			hint: 'Same row shape as forum/social — Anonymized Username, Timestamp, Text, plus Thread/Conversation/Comment for blog post + reader-comment hierarchy. Lands as blog_post / blog_comment.',
			accept: '.csv,.json,text/csv,application/json',
			previewVerb: 'blog_post / blog_comment'
		},
		podcast: {
			label: 'Podcast',
			mode: 'speaker',
			needsCorpus: true,
			hint: 'Paste a podcast episode transcript with speaker prefixes (e.g. "Host: …" / "Guest: …"). One episode at a time — id is required so fragment ids stay stable on re-upload.',
			accept: '.txt,.md,text/plain',
			previewVerb: 'podcast transcript'
		},
		youtube: {
			label: 'YouTube',
			mode: 'speaker',
			needsCorpus: true,
			hint: 'Paste a YouTube video transcript with speaker prefixes. Provide a video id (e.g. "dQw4w9WgXcQ") so fragment ids re-resolve cleanly on re-upload.',
			accept: '.txt,.md,text/plain',
			previewVerb: 'YouTube transcript'
		}
	};

	// ----------------------------------------------------------------- State

	let type = $state<TranscriptType>(untrack(() => defaultType));
	$effect(() => {
		// Caller may swap the dialog target without closing it (corpus pane
		// reopen after switching corpora). Keep the type in sync.
		type = defaultType;
	});

	// Shared submit / error state across types.
	let submitting = $state(false);
	let errorMessage = $state('');

	// Corpus selector — used by all types except interview. When lockedCorpus is
	// set the picker is read-only.
	let pickedCorpusId = $state<string>(untrack(() => lockedCorpus?.id ?? ''));
	$effect(() => {
		if (lockedCorpus) pickedCorpusId = lockedCorpus.id;
		else if (!pickedCorpusId && corpora.length) pickedCorpusId = corpora[0].id;
	});
	const effectiveCorpusId = $derived(lockedCorpus?.id ?? pickedCorpusId);

	// Interview / podcast / youtube shared text state.
	let speakerTranscript = $state('');
	let participantId = $state('');
	let episodeId = $state('');
	let episodeLabel = $state('');
	let episodeUrl = $state('');

	// Forum / blog row state.
	let rowsFormat = $state<'csv' | 'json'>('csv');
	let rowsContent = $state('');
	let autoRenumberThreads = $state(true);
	let runAutotag = $state(false);

	function close() {
		open = false;
	}

	function resetAll() {
		speakerTranscript = '';
		participantId = '';
		episodeId = '';
		episodeLabel = '';
		episodeUrl = '';
		rowsContent = '';
		rowsFormat = 'csv';
		autoRenumberThreads = true;
		runAutotag = false;
		errorMessage = '';
	}

	function loadTextFile(event: Event, target: 'speaker' | 'rows') {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		if (target === 'rows') {
			const lower = file.name.toLowerCase();
			if (lower.endsWith('.json')) rowsFormat = 'json';
			else if (lower.endsWith('.csv')) rowsFormat = 'csv';
		}
		const reader = new FileReader();
		reader.onload = () => {
			const text = String(reader.result ?? '');
			if (target === 'speaker') speakerTranscript = text;
			else rowsContent = text;
		};
		reader.readAsText(file);
	}

	// ------------------------------------------------------------- Live preview

	const interviewIdPreview = $derived.by(() => {
		if (type !== 'interview') return null;
		const direct = interviewIdFromParticipantId(participantId);
		if (direct) return direct;
		const titleLine = speakerTranscript.split('\n')[0] ?? '';
		const m = titleLine.match(/Participant\s+(\d+)/i);
		return m ? `participant_${String(Number(m[1])).padStart(2, '0')}` : null;
	});

	const transcriptIdPreview = $derived.by(() => {
		if (type !== 'podcast' && type !== 'youtube') return null;
		const slug = transcriptEpisodeSlug(episodeId);
		if (!slug || !effectiveCorpusId) return null;
		const kind = type === 'podcast' ? 'podcast_transcript' : 'youtube_transcript';
		return {
			first: transcriptFragmentId({
				corpusId: effectiveCorpusId,
				kind,
				episodeSlug: slug,
				segmentIndex: 0
			}),
			slug
		};
	});

	// Tiny CSV parser, sufficient for the live preview. The server re-validates
	// on submit — this is just so the analyst sees a row count + sample id
	// before they click.
	function parseCsv(text: string): Record<string, string>[] {
		const out: Record<string, string>[] = [];
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
					} else inQuotes = false;
				} else cell += ch;
				continue;
			}
			if (ch === '"') { inQuotes = true; continue; }
			if (ch === ',') { cur.push(cell); cell = ''; continue; }
			if (ch === '\r') continue;
			if (ch === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = ''; continue; }
			cell += ch;
		}
		if (cell.length > 0 || cur.length > 0) { cur.push(cell); rows.push(cur); }
		const nonEmpty = rows.filter((r) => r.some((c) => c.trim().length > 0));
		if (nonEmpty.length === 0) return [];
		const header = nonEmpty[0].map((c) => c.trim());
		for (const cells of nonEmpty.slice(1)) {
			const obj: Record<string, string> = {};
			header.forEach((h, idx) => (obj[h] = cells[idx] ?? ''));
			out.push(obj);
		}
		return out;
	}

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

	const parsedRows = $derived.by((): { rows: ForumRow[]; error: string } => {
		const content = rowsContent.trim();
		if (!content) return { rows: [], error: '' };
		try {
			if (rowsFormat === 'json') {
				const parsed = JSON.parse(content);
				if (!Array.isArray(parsed)) return { rows: [], error: 'JSON must be an array.' };
				return { rows: parsed as ForumRow[], error: '' };
			}
			return { rows: parseCsv(content) as unknown as ForumRow[], error: '' };
		} catch (err) {
			return { rows: [], error: (err as Error).message };
		}
	});

	const REQUIRED_ROW_FIELDS = ['Anonymized Username', 'Timestamp', 'Text'] as const;
	const rowProblems = $derived.by((): string[] => {
		const { rows } = parsedRows;
		const issues: string[] = [];
		for (let i = 0; i < rows.length; i += 1) {
			const r = rows[i];
			const missing = REQUIRED_ROW_FIELDS.filter((k) => !(r[k] ?? '').toString().trim());
			if (missing.length === REQUIRED_ROW_FIELDS.length) continue; // metadata row
			if (missing.length > 0) issues.push(`row ${i}: missing ${missing.join(', ')}`);
		}
		return issues;
	});

	const maxExistingThread = $derived.by((): number => {
		if (!effectiveCorpusId) return 0;
		const frags = existingFragmentsByCorpus[effectiveCorpusId] ?? [];
		const re = /-T(\d+)-C/;
		let max = 0;
		for (const f of frags) {
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

	const rowsSampleFragmentId = $derived.by((): string | null => {
		const rows = remappedRows;
		if (!rows.length || !effectiveCorpusId) return null;
		const r = rows[0];
		return rowFragmentId({
			corpusId: effectiveCorpusId,
			thread: r.Thread,
			conversation: r.Conversation,
			comment: r.Comment,
			rowIndex: 0
		});
	});

	// ------------------------------------------------------------------- Submit

	const config = $derived(TYPE_CONFIG[type]);

	// Per-type submit guard. The action wiring sits inside the form element via
	// use:enhance so each submission carries the right serialized payload.
	const submitDisabled = $derived.by(() => {
		if (submitting) return true;
		if (config.mode === 'speaker') {
			if (speakerTranscript.trim().length === 0) return true;
			if (config.needsCorpus && !effectiveCorpusId) return true;
			if ((type === 'podcast' || type === 'youtube') && !transcriptEpisodeSlug(episodeId)) return true;
		} else {
			if (parsedRows.rows.length === 0) return true;
			if (!effectiveCorpusId) return true;
		}
		return false;
	});

	const submitLabel = $derived.by(() => {
		if (submitting) return 'Uploading…';
		switch (type) {
			case 'interview':
				return 'Parse & autotag';
			case 'forum':
			case 'blog':
				return 'Preview & confirm';
			case 'podcast':
			case 'youtube':
				return 'Parse & write fragments';
		}
	});

	function actionForType(t: TranscriptType): string {
		switch (t) {
			case 'interview':
				return '?/parse';
			case 'forum':
			case 'blog':
				return '?/addToCorpus';
			case 'podcast':
			case 'youtube':
				return '?/parseTranscriptToCorpus';
		}
	}

	// Forum / blog has a two-stage flow (preview → confirm). We mirror what the
	// old add-rows dialog did: first POST runs dry_run=1; the server returns a
	// summary; user clicks "Confirm" → second POST without dry_run.
	type RowsPreview = {
		totalNew: number;
		totalOverwrite: number;
		perPartition: Record<string, { new: number; overwrite: number }>;
		overwriteSample: string[];
	};
	let rowsPreview = $state<RowsPreview | null>(null);
	let rowsStage = $state<'edit' | 'confirm'>('edit');
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title>Upload transcript</Dialog.Title>
			<Dialog.Description>{config.hint}</Dialog.Description>
		</Dialog.Header>

		<!-- Type picker — five mutually exclusive transcript shapes. Mirrors the
			 source switcher on the parent page so the analyst doesn't have to
			 learn a new control pattern. -->
		<div class="flex flex-col gap-2">
			<span class="text-xs font-medium text-slate-500">Transcript type</span>
			<ButtonGroup.Root aria-label="Transcript type">
				{#each (['interview', 'forum', 'blog', 'podcast', 'youtube'] as TranscriptType[]) as t (t)}
					<Button
						variant={type === t ? 'default' : 'outline'}
						size="sm"
						onclick={() => {
							type = t;
							errorMessage = '';
							rowsStage = 'edit';
							rowsPreview = null;
						}}
						pressed={type === t}
					>
						{TYPE_CONFIG[t].label}
					</Button>
				{/each}
			</ButtonGroup.Root>
		</div>

		<!-- Corpus picker — shown for every type except interview. When the
			 caller passes lockedCorpus (analyst already on a corpus pane), the
			 picker is a read-only label so they know where the upload lands. -->
		{#if config.needsCorpus}
			<label class="flex flex-col gap-1.5">
				<span class="text-sm font-medium text-slate-700">Target corpus</span>
				{#if lockedCorpus}
					<div class="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
						{lockedCorpus.label}
						<span class="text-slate-400">· {lockedCorpus.id}</span>
					</div>
				{:else if corpora.length === 0}
					<div class="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
						No corpora available for the active indication. Create one before uploading non-interview transcripts.
					</div>
				{:else}
					<select
						bind:value={pickedCorpusId}
						class="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800"
					>
						{#each corpora as c (c.id)}
							<option value={c.id}>{c.label} · {c.id}</option>
						{/each}
					</select>
				{/if}
			</label>
		{/if}

		<!-- ------------------------------------------------------------------ -->
		<!-- Speaker-mode body (interview / podcast / youtube)                  -->
		<!-- ------------------------------------------------------------------ -->
		{#if config.mode === 'speaker'}
			<form
				method="POST"
				action={actionForType(type)}
				class="flex flex-col gap-4"
				use:enhance={({ formData }) => {
					submitting = true;
					errorMessage = '';
					// For podcast / youtube we tag the payload with a kind discriminator
					// so the single ?/parseTranscriptToCorpus action knows which content
					// source to write into.
					if (type === 'podcast') formData.set('kind', 'podcast_transcript');
					if (type === 'youtube') formData.set('kind', 'youtube_transcript');
					return async ({ result }) => {
						submitting = false;
						if (result.type === 'success' && result.data?.success) {
							if (type === 'interview' && result.data?.interviewId) {
								open = false;
								const interviewId = String(result.data.interviewId);
								resetAll();
								onSuccess?.({ kind: 'interview', interviewId });
								await goto(`?interview=${interviewId}`, { invalidateAll: true });
								return;
							}
							if (result.data?.stage === 'transcriptToCorpus') {
								open = false;
								const payload = result.data as {
									corpusId: string;
									kind: 'podcast_transcript' | 'youtube_transcript';
									episodeSlug: string;
									added: number;
									overwriteCount: number;
									autotagStarted: boolean;
									autotagError: string | null;
								};
								resetAll();
								onSuccess?.({
									kind: 'transcript_to_corpus',
									corpusId: payload.corpusId,
									transcriptKind: payload.kind,
									episodeSlug: payload.episodeSlug,
									added: payload.added,
									overwrite: payload.overwriteCount,
									autotagStarted: payload.autotagStarted,
									autotagError: payload.autotagError
								});
								await invalidateAll();
								return;
							}
						}
						if (result.type === 'failure') {
							errorMessage = String(result.data?.error ?? 'Upload failed.');
						} else if (result.type === 'error') {
							errorMessage = 'Could not reach the server.';
						}
					};
				}}
			>
				{#if type === 'interview'}
					<label class="flex flex-col gap-1.5">
						<span class="text-sm font-medium text-slate-700">Participant number</span>
						<input
							name="participantId"
							bind:value={participantId}
							placeholder="e.g. 11 — leave blank to read from a “Participant N” title line"
							class="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800"
						/>
					</label>
				{:else}
					<!-- Podcast / YouTube header fields — episode id is required so
						 per-segment fragment ids round-trip on re-upload. Optional
						 label + URL are kept on the partition meta. -->
					<input type="hidden" name="corpus_id" value={effectiveCorpusId} />
					<div class="grid grid-cols-2 gap-3">
						<label class="flex flex-col gap-1.5">
							<span class="text-sm font-medium text-slate-700">
								{type === 'podcast' ? 'Episode id' : 'Video id'} *
							</span>
							<input
								name="episode_id"
								bind:value={episodeId}
								placeholder={type === 'podcast' ? 'e.g. ep042' : 'e.g. dQw4w9WgXcQ'}
								class="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800"
							/>
						</label>
						<label class="flex flex-col gap-1.5">
							<span class="text-sm font-medium text-slate-700">Display label</span>
							<input
								name="episode_label"
								bind:value={episodeLabel}
								placeholder="Optional — shown in review UI"
								class="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800"
							/>
						</label>
					</div>
					<label class="flex flex-col gap-1.5">
						<span class="text-sm font-medium text-slate-700">Source URL</span>
						<input
							name="episode_url"
							bind:value={episodeUrl}
							placeholder="Optional — pasted on source_ref so a future review can deep-link"
							class="rounded border border-slate-300 px-3 py-2 text-sm text-slate-800"
						/>
					</label>
				{/if}

				<div class="flex items-center justify-between">
					<span class="text-sm font-medium text-slate-700">Transcript text</span>
					<label class="cursor-pointer text-xs text-accent-orange hover:underline">
						Load from .txt / .md file
						<input
							type="file"
							accept={config.accept}
							class="hidden"
							onchange={(e) => loadTextFile(e, 'speaker')}
						/>
					</label>
				</div>
				<textarea
					name="transcript"
					bind:value={speakerTranscript}
					rows="12"
					placeholder={type === 'interview'
						? 'Paste the raw transcript. Speaker turns are detected from lines like:\n\nInterviewer: …\nParticipant: …'
						: 'Paste the transcript. One speaker per line, prefix with their role:\n\nHost: …\nGuest: …'}
					class="rounded border border-slate-300 p-3 font-mono text-xs leading-relaxed text-slate-800"
				></textarea>

				<!-- Live ID preview — the "same affordance as forum" promised above.
					 Shows what the upload will end up named so analysts catch a
					 wrong participant/episode id before it lands. -->
				<div class="flex flex-wrap items-center gap-2 text-xs">
					{#if type === 'interview'}
						{#if interviewIdPreview}
							<span class="text-slate-500">Will create interview</span>
							<span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700">
								{interviewIdPreview}
							</span>
						{:else}
							<span class="text-slate-400">
								Add a participant number above or include a "Participant N" title line.
							</span>
						{/if}
					{:else if transcriptIdPreview}
						<span class="text-slate-500">First fragment id:</span>
						<span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700">
							{transcriptIdPreview.first}
						</span>
					{:else}
						<span class="text-slate-400">
							{config.needsCorpus && !effectiveCorpusId
								? 'Pick a target corpus to see the fragment id preview.'
								: 'Enter an episode id to see the fragment id preview.'}
						</span>
					{/if}
					<span class="ml-auto text-slate-400">
						{speakerTranscript.length.toLocaleString()} characters
					</span>
				</div>

				{#if errorMessage}
					<p class="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
						{errorMessage}
					</p>
				{/if}

				{#if type !== 'interview'}
					<label class="flex items-center gap-2 text-xs text-slate-600">
						<input
							type="checkbox"
							name="run_autotag"
							value="1"
							bind:checked={runAutotag}
							class="size-3.5 cursor-pointer rounded border-slate-300"
						/>
						Run AI tagging (themes / sentiment / stages) after writing.
					</label>
				{/if}

				<div class="flex items-center justify-end gap-2">
					<Button variant="outline" size="sm" onclick={close}>Cancel</Button>
					<Button type="submit" disabled={submitDisabled}>{submitLabel}</Button>
				</div>
			</form>
		{/if}

		<!-- ------------------------------------------------------------------ -->
		<!-- Rows-mode body (forum/social + blog)                                -->
		<!-- ------------------------------------------------------------------ -->
		{#if config.mode === 'rows'}
			<form
				method="POST"
				action={actionForType(type)}
				class="flex flex-col gap-4"
				use:enhance={({ formData }) => {
					submitting = true;
					errorMessage = '';
					formData.set('corpus_id', effectiveCorpusId);
					formData.set('content_source_kind', type === 'blog' ? 'blog' : 'forum');
					formData.set('rows', JSON.stringify(remappedRows));
					if (rowsStage === 'edit') {
						// First click — server returns a preview without writing.
						formData.set('dry_run', '1');
					} else {
						// Confirm click — write for real. Carry the autotag opt-in.
						if (runAutotag) formData.set('run_autotag', '1');
					}
					return async ({ result }) => {
						submitting = false;
						if (result.type === 'success' && result.data?.success) {
							if (result.data?.stage === 'corpusAppendPreview') {
								rowsPreview = result.data.summary as RowsPreview;
								rowsStage = 'confirm';
								return;
							}
							if (result.data?.stage === 'corpusAppend') {
								open = false;
								const payload = result.data as {
									corpusId: string;
									added: number;
									summary: { totalOverwrite: number };
									autotagStarted: boolean;
									autotagError: string | null;
								};
								resetAll();
								rowsStage = 'edit';
								rowsPreview = null;
								onSuccess?.({
									kind: 'corpus_rows',
									corpusId: payload.corpusId,
									added: payload.added,
									overwrite: payload.summary?.totalOverwrite ?? 0,
									autotagStarted: payload.autotagStarted,
									autotagError: payload.autotagError
								});
								await invalidateAll();
								return;
							}
						}
						if (result.type === 'failure') {
							errorMessage = String(result.data?.error ?? 'Upload failed.');
						} else if (result.type === 'error') {
							errorMessage = 'Could not reach the server.';
						}
					};
				}}
			>
				{#if rowsStage === 'edit'}
					<div class="flex items-center gap-2 text-xs">
						<span class="font-medium text-slate-500">Format</span>
						<div class="inline-flex overflow-hidden rounded-md border border-slate-200">
							{#each ['csv', 'json'] as const as fmt (fmt)}
								<button
									type="button"
									onclick={() => (rowsFormat = fmt)}
									aria-pressed={rowsFormat === fmt}
									class="px-3 py-1 text-xs font-medium uppercase transition-colors {rowsFormat ===
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
								type="file"
								accept={config.accept}
								class="hidden"
								onchange={(e) => loadTextFile(e, 'rows')}
							/>
						</label>
					</div>

					<textarea
						bind:value={rowsContent}
						rows="12"
						placeholder={rowsFormat === 'csv'
							? 'Anonymized Username,Timestamp,Text,Thread,Conversation,Comment,Context\nParticipant 010,2025-02-04T00:00:00Z,"Hello, world.",2,1,1 a,Diagnosed SLE'
							: '[\n  {\n    "Anonymized Username": "Participant 010",\n    "Timestamp": "2025-02-04T00:00:00Z",\n    "Text": "Hello, world.",\n    "Thread": "2",\n    "Conversation": "1",\n    "Comment": "1 a",\n    "Context": "Diagnosed SLE"\n  }\n]'}
						class="rounded border border-slate-300 p-3 font-mono text-xs leading-relaxed text-slate-800"
					></textarea>

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
									This corpus has no existing threads yet — input Thread ids will be used as-is.
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
							{#if rowProblems.length > 0}
								<span class="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-800">
									{rowProblems.length} row{rowProblems.length === 1 ? '' : 's'} missing required fields
								</span>
							{/if}
							{#if rowsSampleFragmentId}
								<span class="text-slate-500">
									First fragment id:
									<span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700">
										{rowsSampleFragmentId}
									</span>
								</span>
							{/if}
						{/if}
						<span class="ml-auto text-slate-400">
							{rowsContent.length.toLocaleString()} characters
						</span>
					</div>

					<label class="flex items-center gap-2 text-xs text-slate-600">
						<input
							type="checkbox"
							bind:checked={runAutotag}
							class="size-3.5 cursor-pointer rounded border-slate-300"
						/>
						Run AI tagging (themes / sentiment / stages) after the write.
					</label>

					{#if errorMessage}
						<p class="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
							{errorMessage}
						</p>
					{/if}

					<div class="flex items-center justify-end gap-2">
						<Button variant="outline" size="sm" onclick={close}>Cancel</Button>
						<Button type="submit" disabled={submitDisabled}>{submitLabel}</Button>
					</div>
				{:else}
					<!-- Confirm stage — show the preview the server computed and let
						 the analyst sign off before the actual write. -->
					{#if rowsPreview}
						<div class="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
							<div class="flex flex-wrap items-center gap-2 text-slate-700">
								<span class="font-semibold">{rowsPreview.totalNew}</span> new fragments,
								<span class="font-semibold">{rowsPreview.totalOverwrite}</span> overwrites
							</div>
							{#if Object.keys(rowsPreview.perPartition).length > 0}
								<ul class="ml-4 list-disc text-xs text-slate-600">
									{#each Object.entries(rowsPreview.perPartition) as [k, v] (k)}
										<li>
											<span class="font-mono">{k}</span>: {v.new} new
											{#if v.overwrite > 0}· {v.overwrite} overwrite{/if}
										</li>
									{/each}
								</ul>
							{/if}
							{#if rowsPreview.overwriteSample.length > 0}
								<details class="text-xs text-slate-600">
									<summary class="cursor-pointer hover:text-slate-800">
										First {rowsPreview.overwriteSample.length} overwrites
									</summary>
									<ul class="mt-1 ml-4 list-disc font-mono">
										{#each rowsPreview.overwriteSample as id (id)}
											<li>{id}</li>
										{/each}
									</ul>
								</details>
							{/if}
						</div>
					{/if}

					{#if errorMessage}
						<p class="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">
							{errorMessage}
						</p>
					{/if}

					<div class="flex items-center justify-end gap-2">
						<Button variant="outline" size="sm" onclick={() => { rowsStage = 'edit'; rowsPreview = null; }}>
							Back to edit
						</Button>
						<Button type="submit" disabled={submitting}>
							{submitting ? 'Writing…' : 'Confirm write'}
						</Button>
					</div>
				{/if}
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

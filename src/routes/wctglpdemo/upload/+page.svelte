<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import StarIcon from '@lucide/svelte/icons/star';
	import questionBankRaw from '$lib/content/wctglpdemo-data/questions.json';
	import SegmentTagDrawer from '$lib/components/SegmentTagDrawer.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
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
			const res = await fetch('/wctglpdemo/highlights', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ kind: 'segment', id: segmentId })
			});
			if (res.ok) {
				const { starredSegmentIds } = await res.json();
				starredSegments = new Set<string>(starredSegmentIds);
			}
		} finally {
			togglingSegment = '';
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

	// The review view is driven by either a form action (a fresh parse / save)
	// or, when no form result is present, an interview loaded via ?interview=.
	const result = $derived(form?.success ? form : (data.review ?? null));

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
	$effect(() => {
		const id = result?.interviewId ?? '';
		if (id && id !== lastInterview) {
			lastInterview = id;
			const seed: Record<number, string> = {};
			for (const m of result?.questionMap ?? []) seed[m.turn_index] = m.question_id;
			questionAssignments = seed;
			annotations = { ...(result?.annotations ?? {}) };
		}
	});

	const assignedCount = $derived(
		interviewerTurns.filter((t) => questionAssignments[t.turn_index]).length
	);

	const titleCase = (id: string) => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

	// Per-segment tag annotations — seeded from the server per interview, then
	// kept in sync as the drawer saves. `openSegment` drives the tag drawer.
	let annotations = $state<Record<string, Annotation>>({});
	let openSegment = $state<TaggableSegment | null>(null);

	// Surfaced after a drawer save so the reviewer can jump to the fingerprint.
	let showSavedDialog = $state(false);
	let savedInterviewId = $state('');
</script>

<div class="flex flex-1 flex-col bg-slate-50">
	<!-- Hero -->
	<div
		class="flex h-60 w-full flex-col justify-center bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten"
	>
		<div class="mx-auto flex w-full max-w-3xl flex-col gap-3 px-8">
			<span class="figcaption text-white">WCT GLP-1 Interviews · Pipeline</span>
			<h1 class="font-heading text-4xl font-light uppercase text-primary-foreground md:text-5xl">
				Upload a transcript
			</h1>
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-10">
		<!-- Pipeline-scope note -->
		<div class="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
			<p>
				Paste or upload a raw interview transcript. On submit it runs the
				<span class="font-medium text-slate-800">deterministic pipeline stages — parse and
					segmentation</span>: the text is saved under
				<code class="text-xs">wctglpdemo-data/uploads/</code>, the structured interview is merged
				into <code class="text-xs">interviews_structured.json</code>, and its sentence segments
				into <code class="text-xs">segments.json</code>.
			</p>
			<p class="mt-2">
				Question normalization is auto-proposed by
				<code class="text-xs">scripts/propose-questions.mjs</code> — run it after parsing, then
				pick the interview below to review the proposal. In the review step you confirm or correct
				each interviewer turn's question; that is saved to
				<code class="text-xs">question_map.json</code> and propagated into the segments. Tagging and
				the quote bank run separately.
			</p>
		</div>

		<!-- Reopen the review view for an already-ingested interview, no re-paste. -->
		<div class="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
			<span class="text-sm font-medium text-slate-700">Review an ingested interview</span>
			<select
				value={data.review?.interviewId ?? ''}
				onchange={(e) => goto(`?interview=${e.currentTarget.value}`, { keepFocus: true })}
				class="rounded border border-slate-300 px-2 py-1 text-sm text-slate-700"
			>
				<option value="">— pick an interview —</option>
				{#each data.interviewIds as id (id)}
					<option value={id}>{id}</option>
				{/each}
			</select>
			<span class="text-xs text-slate-400">
				Opens its question mapping and segments below — no need to re-paste the transcript.
			</span>
		</div>

		{#if form?.stage === 'upload'}
			<div class="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
				<p class="font-semibold">
					{form.replaced ? 'Re-ingested' : 'Ingested'}
					{form.interviewId}
				</p>
				<p class="mt-1">
					{form.turnCount} turns parsed ({form.interviewerTurns} interviewer, {form.participantTurns}
					participant) · {form.segmentCount} segments{form.demographics
						? ` · ${form.demographics}`
						: ''}.
				</p>
				<p class="mt-1 text-emerald-800">
					Added to <code class="text-xs">interviews_structured.json</code> and
					<code class="text-xs">segments.json</code>. Next, run
					<code class="text-xs">node scripts/propose-questions.mjs {form.interviewId}</code> to
					auto-propose the question mapping, then pick it from “Review an ingested interview” above.
				</p>
				{#if form.warnings?.length}
					<ul class="mt-2 list-disc pl-5 text-xs text-emerald-800">
						{#each form.warnings as w (w)}<li>{w}</li>{/each}
					</ul>
				{/if}
			</div>
		{:else if form?.stage === 'questionMap'}
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
						Each interviewer turn's question is auto-proposed by
						<code class="text-xs">scripts/propose-questions.mjs</code> — confirm or correct it. Each
						tinted box is one participant segment; click it to confirm or edit its theme, emotion,
						sentiment, and semantic tags.
					</p>
				</div>

				<!-- Question-mapping save bar -->
				<form
					method="POST"
					action="?/saveQuestions"
					class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4"
					use:enhance={() => {
						savingQuestions = true;
						return async ({ update }) => {
							await update({ reset: false });
							savingQuestions = false;
						};
					}}
				>
					<input type="hidden" name="interviewId" value={result.interviewId} />
					<input type="hidden" name="assignments" value={JSON.stringify(questionAssignments)} />
					<span class="text-sm text-slate-600">
						<span class="font-medium text-slate-800">{assignedCount}</span>
						of {interviewerTurns.length} interviewer turns have a question
					</span>
					<button
						type="submit"
						disabled={savingQuestions || assignedCount === 0}
						class="rounded bg-accent-mint px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-mint/90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{savingQuestions ? 'Saving…' : 'Save question mapping'}
					</button>
				</form>

				<!-- Transcript with per-turn question assignment + segments -->
				<div class="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5">
					{#each result.turns as turn (turn.turn_index)}
						{#if turn.speaker === 'interviewer'}
							<div class="flex flex-col gap-1.5">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<span class="text-xs font-semibold uppercase tracking-wide text-slate-500">
										Interviewer
									</span>
									<select
										bind:value={questionAssignments[turn.turn_index]}
										class="max-w-md rounded border px-2 py-1 text-xs text-slate-700
											{questionAssignments[turn.turn_index]
											? 'border-accent-mint bg-accent-mint/5'
											: 'border-slate-300'}"
									>
										<option value="">— assign interview question —</option>
										{#each questionBank as q (q.question_id)}
											<option value={q.question_id}>{q.order}. {q.canonical_question}</option>
										{/each}
									</select>
								</div>
								<p class="text-sm leading-relaxed text-slate-500">{turn.text}</p>
							</div>
						{:else}
							<div class="flex flex-col gap-1.5">
								<span class="text-xs font-semibold uppercase tracking-wide text-accent-mint">
									Participant
								</span>
								{#each segmentsByTurn.get(turn.turn_index) ?? [] as seg (seg.segment_id)}
									{@const ann = annotations[seg.segment_id]}
									<div
										role="button"
										tabindex="0"
										onclick={() => (openSegment = seg)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												openSegment = seg;
											}
										}}
										class="relative cursor-pointer rounded-md border-l-2 border-accent-mint bg-accent-mint/5 py-1.5 pr-9 pl-3 transition-colors hover:bg-accent-mint/10"
									>
										<button
											type="button"
											onclick={(e) => {
												e.stopPropagation();
												toggleStar(seg.segment_id);
											}}
											disabled={togglingSegment === seg.segment_id}
											aria-pressed={starredSegments.has(seg.segment_id)}
											title={starredSegments.has(seg.segment_id)
												? 'Starred highlight — click to unstar'
												: 'Star as an important highlight'}
											class="absolute right-1.5 top-1.5 rounded p-1 transition-colors hover:bg-accent-mint/15 disabled:opacity-40
												{starredSegments.has(seg.segment_id)
												? 'text-amber-400'
												: 'text-slate-300 hover:text-amber-400'}"
										>
											<StarIcon
												size={16}
												fill={starredSegments.has(seg.segment_id) ? 'currentColor' : 'none'}
											/>
										</button>
										<p class="text-sm leading-relaxed text-slate-800">{seg.text}</p>
										<div
											class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-slate-400"
										>
											<span>{seg.segment_id}</span>
											<span>{seg.word_count} words</span>
											<span>chars {seg.char_start}–{seg.char_end}</span>
											{#if seg.question_id}
												<span class="text-accent-mint">{seg.question_id}</span>
											{/if}
											{#if seg.flags.includes('very_short')}
												<span class="text-amber-600">very short</span>
											{/if}
											<span class="ml-auto font-sans font-medium text-accent-mint">
												{ann ? 'Edit tags' : 'Add tags'}
											</span>
										</div>
										{#if ann && (ann.themes.length || ann.emotions.length || ann.semantic_tags.length)}
											<div class="mt-1.5 flex flex-wrap gap-1">
												{#each ann.themes as th (th)}
													<span
														class="rounded-full bg-accent-mint/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-mint"
													>
														{titleCase(th)}
													</span>
												{/each}
												{#each ann.emotions as em (em)}
													<span
														class="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
													>
														{titleCase(em)}
													</span>
												{/each}
												{#each ann.semantic_tags as st (st)}
													<span
														class="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700"
													>
														{titleCase(st)}
													</span>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					{/each}
				</div>
			</section>
		{/if}

		<form
			method="POST"
			action="?/parse"
			class="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update({ reset: false });
					submitting = false;
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
				<label class="cursor-pointer text-xs text-accent-mint hover:underline">
					Load from .txt / .md file
					<input type="file" accept=".txt,.md,text/plain" class="hidden" onchange={loadFile} />
				</label>
			</div>
			<textarea
				name="transcript"
				bind:value={transcript}
				rows="16"
				placeholder={'Paste the raw transcript. Speaker turns are detected from lines like:\n\nInterviewer: …\nParticipant: …'}
				class="rounded border border-slate-300 p-3 font-mono text-xs leading-relaxed text-slate-800"
			></textarea>

			<div class="flex items-center justify-between">
				<span class="text-xs text-slate-400">{transcript.length.toLocaleString()} characters</span>
				<button
					type="submit"
					disabled={submitting || transcript.trim().length === 0}
					class="rounded bg-accent-mint px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-mint/90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{submitting ? 'Parsing…' : 'Parse & add to dataset'}
				</button>
			</div>
		</form>
	</div>
</div>

<!-- Per-segment tag editing — opened by clicking a segment in the review view. -->
<SegmentTagDrawer
	segment={openSegment}
	annotation={openSegment ? (annotations[openSegment.segment_id] ?? null) : null}
	onclose={() => (openSegment = null)}
	onsaved={(a) => {
		annotations = { ...annotations, [a.segment_id]: a };
		savedInterviewId = a.interview_id;
		showSavedDialog = true;
	}}
/>

<!-- After a tag save, offer a jump to the interview's theme fingerprint. -->
<AlertDialog.Root bind:open={showSavedDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Tags saved</AlertDialog.Title>
			<AlertDialog.Description>
				Confirmed tags for a segment of {titleCase(savedInterviewId)}. See how its themes stack up
				as a fingerprint, or keep tagging.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Keep tagging</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={() => goto(`/wctglpdemo/fingerprint?interview=${savedInterviewId}`)}
			>
				View {titleCase(savedInterviewId)}'s fingerprint
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

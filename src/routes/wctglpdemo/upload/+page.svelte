<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import StarIcon from '@lucide/svelte/icons/star';
	import MergeIcon from '@lucide/svelte/icons/merge';
	import EraserIcon from '@lucide/svelte/icons/eraser';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import questionBankRaw from '$lib/content/wctglpdemo-data/questions.json';
	import SegmentTagDrawer from '$lib/components/SegmentTagDrawer.svelte';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import wctLogoUrl from '$lib/content/wctglpdemo-data/avatars/WCTLogo.png?url';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { AutotagJob } from '$lib/server/autotag';

	// Tags shown inline on a segment card before the rest collapse into a +N
	// badge. A fixed cap keeps the row predictable — no layout measurement.
	const TAG_CAP = 5;
	type CardTag = { kind: 'theme' | 'emotion' | 'semantic'; id: string };
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
			autotagJob = data.review?.autotagJob ?? null;
			autotagStep = autotagJob?.step ?? '';
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
				const res = await fetch(`/wctglpdemo/autotag?interview=${id}`);
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
		const res = await fetch('/wctglpdemo/autotag', {
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

	// Per-segment tag annotations — seeded from the server per interview, then
	// kept in sync as the drawer saves. `openSegment` drives the tag drawer.
	let annotations = $state<Record<string, Annotation>>({});
	let openSegment = $state<TaggableSegment | null>(null);

	// Surfaced after a drawer save so the reviewer can jump to the fingerprint.
	let showSavedDialog = $state(false);
	let savedInterviewId = $state('');

	// --- Segment selection — drives the merge / untag toolbar ---
	let selectedSegments = $state(new Set<string>());
	let merging = $state(false);
	let untagging = $state(false);
	let segmentActionError = $state('');

	function toggleSelect(segmentId: string) {
		const next = new Set(selectedSegments);
		if (next.has(segmentId)) next.delete(segmentId);
		else next.add(segmentId);
		selectedSegments = next;
	}

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

	// Untag applies to whichever selected segments actually carry an annotation.
	const untaggable = $derived(selectedList.filter((s) => annotations[s.segment_id]));

	async function mergeSelected() {
		if (!canMerge || merging || !result) return;
		merging = true;
		segmentActionError = '';
		try {
			const res = await fetch('/wctglpdemo/segments', {
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

	async function untagSelected() {
		if (untaggable.length === 0 || untagging) return;
		untagging = true;
		segmentActionError = '';
		try {
			for (const seg of untaggable) {
				const res = await fetch('/wctglpdemo/segment-tags', {
					method: 'DELETE',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ segment_id: seg.segment_id })
				});
				if (res.ok) {
					const next = { ...annotations };
					delete next[seg.segment_id];
					annotations = next;
				} else {
					segmentActionError = 'Could not untag one or more segments.';
				}
			}
			selectedSegments = new Set();
		} finally {
			untagging = false;
		}
	}

	// Themes, emotions, and semantic tags of an annotation, flattened and
	// type-tagged for the segment card's tag row + overflow popover.
	function cardTags(ann: Annotation | undefined): CardTag[] {
		if (!ann) return [];
		return [
			...ann.themes.map((id): CardTag => ({ kind: 'theme', id })),
			...ann.emotions.map((id): CardTag => ({ kind: 'emotion', id })),
			...ann.semantic_tags.map((id): CardTag => ({ kind: 'semantic', id }))
		];
	}
</script>

{#snippet tagChip(kind: CardTag['kind'], label: string)}
	<span
		class="rounded-full px-2 py-0.5 text-[10px] font-medium
			{kind === 'theme'
			? 'bg-accent-mint/15 text-accent-mint'
			: kind === 'emotion'
				? 'bg-slate-200 text-slate-600'
				: 'bg-violet-100 text-violet-700'}"
	>
		{label}
	</span>
{/snippet}

<div class="flex flex-1 flex-col bg-slate-50">
	<!-- Hero -->
	<div
		class="flex h-60 w-full flex-col justify-center bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten"
	>
		<div class="mx-auto flex w-full max-w-3xl flex-col gap-3 px-8">
			<span class="figcaption text-white">WCT GLP-1 Interviews · Pipeline</span>
			<h1 class="font-heading text-4xl font-light uppercase text-primary-foreground md:text-5xl">
				Review interviews
			</h1>
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-8 py-10">
		<!-- Primary action: pick an ingested interview to review, or upload one. -->
		<div
			class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4"
		>
			<label class="flex flex-wrap items-center gap-3">
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
			</label>
			<Button onclick={() => { uploadError = ''; uploadOpen = true; }}>
				<UploadIcon />
				Upload transcript
			</Button>
		</div>

		<!-- Autotag status — shown while a freshly uploaded interview is being
			 tagged by the AI pipeline, or if that run failed. -->
		{#if autotagJob && autotagJob.state !== 'done'}
			{#if autotagJob.state === 'running'}
				<div
					class="flex items-center gap-3 rounded-lg border border-accent-mint/50 bg-accent-mint/5 p-4 text-sm text-slate-700"
				>
					<LoaderIcon class="size-5 shrink-0 animate-spin text-accent-mint" />
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
					<Button variant="outline" size="sm" onclick={retryAutotag}>Retry autotag</Button>
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
						sentiment, and semantic tags. Tick the checkboxes to select segments — then merge
						sequential ones, or untag them, from the toolbar.
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

				<!-- Transcript, with the segment-selection toolbar beside it on md+.
					 On md+ the toolbar sits in the left gutter (absolutely positioned)
					 so it never narrows the transcript column. -->
				<div class="relative flex flex-col gap-3">
					<!-- Segment-selection toolbar — appears once a segment is ticked. -->
					{#if selectedSegments.size > 0}
						<div class="md:absolute md:top-0 md:bottom-0 md:right-full md:mr-4 md:w-60">
							<div
								class="sticky top-2 z-10 flex flex-col gap-3 rounded-lg border border-accent-mint/50 bg-white p-3 shadow-sm md:top-4"
							>
							<div class="flex flex-col gap-0.5 text-sm text-slate-600">
								<span>
									<span class="font-medium text-slate-800">{selectedSegments.size}</span>
									segment{selectedSegments.size === 1 ? '' : 's'} selected
								</span>
								{#if segmentActionError}
									<span class="text-xs text-rose-600">{segmentActionError}</span>
								{/if}
							</div>
							<div class="flex flex-col gap-2">
								<ButtonGroup.Root class="w-full">
									<Button
										variant="outline"
										size="sm"
										class="flex-1 justify-center"
										disabled={!canMerge || merging}
										title={canMerge
											? 'Merge the selected segments into one'
											: 'Select 2 or more sequential segments in the same turn'}
										onclick={mergeSelected}
									>
										<MergeIcon />
										{merging ? 'Merging…' : 'Merge'}
									</Button>
									<Button
										variant="outline"
										size="sm"
										class="flex-1 justify-center"
										disabled={untaggable.length === 0 || untagging}
										title={untaggable.length > 0
											? 'Remove tags from the selected segments'
											: 'No selected segment has tags to remove'}
										onclick={untagSelected}
									>
										<EraserIcon />
										{untagging
											? 'Untagging…'
											: `Untag${untaggable.length ? ` (${untaggable.length})` : ''}`}
									</Button>
								</ButtonGroup.Root>
									<Button
										variant="ghost"
										size="sm"
										class="justify-center"
										onclick={() => (selectedSegments = new Set())}
									>
										Clear
									</Button>
								</div>
							</div>
						</div>
					{/if}

					<!-- Transcript with per-turn question assignment + segments -->
					<div
						class="flex min-w-0 flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 md:flex-1"
					>
					{#each result.turns as turn (turn.turn_index)}
						{#if turn.speaker === 'interviewer'}
							<div class="flex flex-col gap-1.5">
								<div class="flex flex-row align- flex-wrap items-center justify-between gap-2">
									<span
										class="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground"
									>
										<img
											src={wctLogoUrl}
											alt="WCT interviewer"
											class="size-8 shrink-0 rounded-full border border-slate-200 bg-white object-contain"
										/>
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
								<span
									class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent-mint"
								>
									<ParticipantAvatar interviewId={result.interviewId} size="sm" />
									{result.interviewId}
						
								</span>
								{#each segmentsByTurn.get(turn.turn_index) ?? [] as seg (seg.segment_id)}
									{@const ann = annotations[seg.segment_id]}
									{@const tags = cardTags(ann)}
									{@const visibleTags = tags.slice(0, TAG_CAP)}
									{@const hiddenCount = tags.length - visibleTags.length}
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
										class="relative cursor-pointer border-l-2 border-accent-mint px-8 py-3 transition-colors
											{ann ? 'bg-accent-mint/5 hover:bg-accent-mint/10' : 'hover:bg-accent-mint/5'}
											{selectedSegments.has(seg.segment_id)
											? 'ring-2 ring-accent-mint ring-inset'
											: ''}"
									>
										<!-- Select + star — grouped together on the same side. -->
										<div class="absolute right-3 top-3 flex items-center gap-2">
											<input
												type="checkbox"
												checked={selectedSegments.has(seg.segment_id)}
												onclick={(e) => e.stopPropagation()}
												onchange={() => toggleSelect(seg.segment_id)}
												title="Select for merge / untag"
												class="size-3.5 cursor-pointer accent-accent-mint"
											/>
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
												class="rounded p-0.5 transition-colors hover:bg-accent-mint/15 disabled:opacity-40
													{starredSegments.has(seg.segment_id)
													? 'text-amber-400'
													: 'text-slate-300 hover:text-amber-400'}"
											>
												<StarIcon
													size={16}
													fill={starredSegments.has(seg.segment_id) ? 'currentColor' : 'none'}
												/>
											</button>
										</div>

										<p class="pr-12 text-sm leading-relaxed text-slate-800">{seg.text}</p>

										<!-- Tag row — current tags, an overflow badge, and the edit-tags link. -->
										<div class="mt-2 flex flex-wrap items-center gap-1.5">
											{#each visibleTags as tag (tag.kind + tag.id)}
												{@render tagChip(tag.kind, titleCase(tag.id))}
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
															{#if ann?.themes.length}
																<div>
																	<p
																		class="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400"
																	>
																		Themes
																	</p>
																	<div class="flex flex-wrap gap-1">
																		{#each ann.themes as th (th)}
																			{@render tagChip('theme', titleCase(th))}
																		{/each}
																	</div>
																</div>
															{/if}
															{#if ann?.emotions.length}
																<div>
																	<p
																		class="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400"
																	>
																		Emotions
																	</p>
																	<div class="flex flex-wrap gap-1">
																		{#each ann.emotions as em (em)}
																			{@render tagChip('emotion', titleCase(em))}
																		{/each}
																	</div>
																</div>
															{/if}
															{#if ann?.semantic_tags.length}
																<div>
																	<p
																		class="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400"
																	>
																		Semantic
																	</p>
																	<div class="flex flex-wrap gap-1">
																		{#each ann.semantic_tags as st (st)}
																			{@render tagChip('semantic', titleCase(st))}
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
												onclick={(e) => {
													e.stopPropagation();
													openSegment = seg;
												}}
												class="ml-auto text-xs font-medium capitalize text-accent-mint hover:underline"
											>
												{ann ? 'click to edit tags' : 'click to add tags'}
												<ArrowRightIcon />
											</Button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{/each}
					</div>
				</div>
			</section>
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
				<label class="cursor-pointer text-xs text-accent-mint hover:underline">
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

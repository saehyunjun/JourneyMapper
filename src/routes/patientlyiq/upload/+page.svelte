<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import StarIcon from '@lucide/svelte/icons/star';
	import MergeIcon from '@lucide/svelte/icons/merge';
	import SplitIcon from '@lucide/svelte/icons/split';
	import EraserIcon from '@lucide/svelte/icons/eraser';
	import TagIcon from '@lucide/svelte/icons/tag';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import XIcon from '@lucide/svelte/icons/x';


	import questionBankRaw from '$lib/content/wctglpdemo-data/questions.json';
	import SegmentTagDrawer from '$lib/components/SegmentTagDrawer.svelte';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import wctLogoUrl from '$lib/content/wctglpdemo-data/avatars/WCTLogo.png?url';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import KeywordText from '$lib/components/KeywordText.svelte';
	import { emotionDots } from '$lib/utils/emotion-colors';
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
					href: starred && result ? `/patientlyiq/fingerprint?interview=${result.interviewId}` : undefined,
					linkLabel: 'View on the fingerprint →'
				});
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

	// Per-segment tag annotations — seeded from the server per interview, then
	// kept in sync as the drawer saves. `openSegment` drives the tag drawer.
	let annotations = $state<Record<string, Annotation>>({});
	let openSegment = $state<TaggableSegment | null>(null);

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
		{@const c = emotionDots(id)}
		<span
			class="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600"
		>
			{#if c.c2}
				<span class="relative inline-block h-2 w-3.5" aria-hidden="true">
					<span
						class="absolute left-0 top-0 size-2 rounded-full border border-black/10"
						style="background: {c.c1}"
					></span>
					<span
						class="absolute left-1.5 top-0 size-2 rounded-full border border-black/10"
						style="background: {c.c2}"
					></span>
				</span>
			{:else}
				<span
					class="inline-block size-2 rounded-full border border-black/10"
					style="background: {c.c1}"
					aria-hidden="true"
				></span>
			{/if}
			{titleCase(id)}
		</span>
	{:else}
		<span
			class="rounded-full bg-accent-mint/15 px-2 py-0.5 text-[10px] font-medium text-accent-mint"
		>
			{titleCase(id)}
		</span>
	{/if}
{/snippet}

<div class="flex flex-1 flex-col bg-slate-50">
	<!-- Hero -->
	<div
		class="flex h-60 w-full flex-col justify-center bg-green-200 bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten"
	>
		<div class="mx-auto flex w-full max-w-3xl flex-col gap-3 px-8">
			<span class="figcaption text-primary">GLP-1 Interviews · Pipeline</span>
			<h1 class="font-heading text-4xl font-light uppercase text-primary md:text-5xl">
				Review interviews
			</h1>
		</div>
	</div>
	<div
		class="flex flex-row justify-end gap-2 border-b border-primary-foreground bg-white p-4"
	>
		<Button onclick={() => { uploadError = ''; uploadOpen = true; }}>
			<UploadIcon />
			Upload transcript
		</Button>
	</div>

	<div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-10">
		<!-- Primary action: pick an ingested interview to review, or upload one. -->
		
		<!-- Autotag status — shown while a freshly uploaded interview is being
			 tagged by the AI pipeline, or if that run failed. -->
		{#if autotagJob && autotagJob.state !== 'done'}
			{#if autotagJob.state === 'running'}
				<div
					class="flex items-center gap-3 rounded-lg border border-accent-mint/50 bg-accent-mint/5 p-4 text-sm text-slate-700"
				>
					<LoaderIcon class="size-5 shrink-0 animate-spin text-accent-mint-background" />
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
							<span class="font-heading text-sm font-medium text-accent-mint-background capitalize">Participant details</span>
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
											? 'bg-accent-mint text-white'
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
								class="rounded bg-accent-mint px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-mint/90 disabled:cursor-not-allowed disabled:opacity-50"
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
												? 'border-accent-mint bg-accent-mint/5'
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
										class="text-xs font-semibold uppercase tracking-wide text-accent-mint"
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
													class="size-4 cursor-pointer accent-accent-mint"
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
													? 'bg-accent-mint/10 hover:bg-accent-mint/15'
													: 'bg-slate-100 hover:bg-accent-mint/5'}
													{selectedSegments.has(seg.segment_id)
													? 'ring-2 ring-accent-mint ring-inset'
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
	starred={openSegment ? starredSegments.has(openSegment.segment_id) : false}
	togglingStar={openSegment ? togglingSegment === openSegment.segment_id : false}
	onToggleStar={toggleStar}
	onclose={() => (openSegment = null)}
	onsaved={(a) => {
		annotations = { ...annotations, [a.segment_id]: a };
		toasts.push({
			message: `Tags saved for ${titleCase(a.interview_id)}.`,
			href: `/patientlyiq/fingerprint?interview=${a.interview_id}`,
			linkLabel: "View this participant's fingerprint →"
		});
	}}
	onedited={() => {
		// Segment text was rewritten on disk — refresh so the transcript list
		// reflects the new wording. The drawer keeps its own local copy in sync.
		lastInterview = '';
		invalidateAll();
	}}
/>

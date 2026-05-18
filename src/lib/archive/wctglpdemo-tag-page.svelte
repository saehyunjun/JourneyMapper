<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import codebook from '$lib/content/wctglpdemo-data/codebook.json';
	import questionsRaw from '$lib/content/wctglpdemo-data/questions.json';
	import KeywordText from '$lib/components/KeywordText.svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Theme = { id: string; description: string; subthemes?: { id: string; description: string }[] };
	const themeTags = codebook.theme_tags as Theme[];
	const emotionTags = codebook.emotion_tags;
	const semanticTags = codebook.semantic_tags;
	const themeById = new Map(themeTags.map((t) => [t.id, t]));

	const sentiments = [
		{ v: -2, label: '−2' },
		{ v: -1, label: '−1' },
		{ v: 0, label: '0' },
		{ v: 1, label: '+1' },
		{ v: 2, label: '+2' }
	];
	const sentimentScale = codebook.meta.sentiment_scale as Record<string, string>;

	const questionLabelById = new Map(
		questionsRaw.questions.map((q) => [q.question_id, q.canonical_question])
	);
	const titleCase = (id: string) =>
		id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

	type SegTag = {
		themes: string[];
		subthemes: string[];
		emotions: string[];
		semantic_tags: string[];
		sentiment: number;
		reviewer_notes: string;
		discarded: boolean;
	};

	function initTags(): Record<string, SegTag> {
		const t: Record<string, SegTag> = {};
		for (const seg of data.segments) {
			const e = data.existing[seg.segment_id];
			t[seg.segment_id] = {
				themes: e ? [...e.themes] : [],
				subthemes: e ? [...e.subthemes] : [],
				emotions: e ? [...e.emotions] : [],
				semantic_tags: e ? [...e.semantic_tags] : [],
				sentiment: e ? e.sentiment : 0,
				reviewer_notes: e ? e.reviewer_notes : '',
				discarded: e ? e.review_status === 'discarded' : false
			};
		}
		return t;
	}

	let tags = $state<Record<string, SegTag>>(initTags());
	let saving = $state(false);
	// Opened by a successful save so the reviewer notices the tags are now
	// explorable, with a one-click path to the updated interview-words view.
	let showSavedDialog = $state(false);

	// Navigating to another interview reruns `load`; re-seed the form when the
	// selected interview actually changes (not on a post-save reload).
	let loadedInterview = untrack(() => data.interviewId);
	$effect(() => {
		if (data.interviewId !== loadedInterview) {
			loadedInterview = data.interviewId;
			tags = initTags();
		}
	});

	function toggleTheme(segId: string, themeId: string) {
		const t = tags[segId];
		if (t.themes.includes(themeId)) {
			t.themes = t.themes.filter((x) => x !== themeId);
			// Drop subthemes orphaned by removing their parent theme.
			const kids = new Set((themeById.get(themeId)?.subthemes ?? []).map((s) => s.id));
			t.subthemes = t.subthemes.filter((s) => !kids.has(s));
		} else {
			t.themes = [...t.themes, themeId];
		}
	}
	function toggleIn(segId: string, key: 'subthemes' | 'emotions' | 'semantic_tags', id: string) {
		const list = tags[segId][key];
		tags[segId][key] = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
	}

	const totalSegments = $derived(data.segments.length);
	const themedSegments = $derived(
		data.segments.filter((s) => (tags[s.segment_id]?.themes.length ?? 0) > 0).length
	);
	const discardedSegments = $derived(
		data.segments.filter((s) => tags[s.segment_id]?.discarded).length
	);

	// Participant segments grouped by their turn, for interleaving interviewer context.
	const segmentsByTurn = $derived.by(() => {
		const m = new Map<number, typeof data.segments>();
		for (const s of data.segments) {
			const arr = m.get(s.turn_index) ?? [];
			arr.push(s);
			m.set(s.turn_index, arr);
		}
		return m;
	});

	const currentStatus = $derived(
		data.interviewOptions.find((o) => o.id === data.interviewId)?.status ?? 'pending'
	);

	// A save reruns `load`, so `interviewOptions` already reflects the new
	// statuses — the post-save hand-off reads from it to point at what's next.
	const nextPending = $derived(
		data.interviewOptions.find((o) => o.status === 'pending' && o.id !== data.interviewId)?.id ??
			null
	);
	const pendingCount = $derived(
		data.interviewOptions.filter((o) => o.status === 'pending').length
	);

	function selectInterview(event: Event) {
		const id = (event.currentTarget as HTMLSelectElement).value;
		goto(`?interview=${id}`, { keepFocus: true, noScroll: true });
	}
</script>

{#snippet chip(active: boolean, label: string, title: string, onToggle: () => void, activeClass: string)}
	<button
		type="button"
		{title}
		onclick={onToggle}
		aria-pressed={active}
		class="rounded-full border px-2.5 py-0.5 text-xs transition-colors
			{active ? activeClass : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400'}"
	>
		{label}
	</button>
{/snippet}

<div class="flex flex-1 flex-col bg-slate-50">
	<!-- Hero -->
	<div
		class="flex h-60 w-full flex-col justify-center bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten"
	>
		<div class="mx-auto flex w-full max-w-4xl flex-col gap-3 px-8">
			<span class="figcaption text-white">WCT GLP-1 Interviews · Pipeline · Step 5</span>
			<h1 class="font-heading text-4xl font-light uppercase text-primary-foreground md:text-5xl">
				Tag segments
			</h1>
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-4xl flex-col gap-5 px-8 py-8">
		<div class="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
			Apply <span class="font-medium text-slate-800">theme, emotion, sentiment, and semantic</span>
			tags from the codebook to each participant segment. Tags are saved to
			<code class="text-xs">segment_tags.json</code> as confirmed, human-sourced annotations, and
			the interview moves from <em>pending</em> to <em>tagged</em> — feeding the Themes and Quote
			bank views. A subtheme can only be applied when its parent theme is.
		</div>

		{#if form?.success}
			<div class="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
				<p class="font-semibold">Tags saved for {titleCase(form.interviewId)}</p>
				<p class="mt-1">
					{form.segmentCount} segments annotated · {form.themedCount} carry at least one theme{form.discardedCount
						? ` · ${form.discardedCount} discarded`
						: ''}. Written to <code class="text-xs">segment_tags.json</code>.
				</p>
			</div>
		{:else if form?.error}
			<div class="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
				{form.error}
			</div>
		{/if}

		{#if data.interviewId}
			<!-- Toolbar: pick interview · progress · save -->
			<form
				method="POST"
				action="?/saveTags"
				use:enhance={() => {
					saving = true;
					return async ({ result, update }) => {
						await update();
						saving = false;
						if (result.type === 'success' && result.data?.success) {
							showSavedDialog = true;
						}
					};
				}}
				class="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
			>
				<input type="hidden" name="interviewId" value={data.interviewId} />
				<input type="hidden" name="annotations" value={JSON.stringify(tags)} />

				<label class="flex items-center gap-2 text-xs font-medium text-slate-500">
					Interview
					<select
						value={data.interviewId}
						onchange={selectInterview}
						class="rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
					>
						{#each data.interviewOptions as opt (opt.id)}
							<option value={opt.id}>
								{titleCase(opt.id)} · {opt.status} · {opt.segmentCount} segs
							</option>
						{/each}
					</select>
				</label>

				{#if currentStatus === 'tagged'}
					<span class="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
						✓ tagged
					</span>
				{:else}
					<span class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
						pending
					</span>
				{/if}

				<span class="text-sm text-slate-600">
					<span class="font-medium text-slate-800">{themedSegments}</span>
					of {totalSegments} segments themed{#if discardedSegments > 0}
						· {discardedSegments} discarded{/if}
				</span>

				<button
					type="submit"
					disabled={saving}
					class="ml-auto rounded bg-accent-mint px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-mint/90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{saving ? 'Saving…' : currentStatus === 'tagged' ? 'Update tags' : 'Save tags'}
				</button>
			</form>

			<!-- Transcript, interleaving interviewer context with taggable segments -->
			<div class="flex flex-col gap-3">
				{#each data.turns as turn (turn.turn_index)}
					{#if turn.speaker === 'interviewer'}
						<div class="flex flex-col gap-0.5 pt-2">
							<span class="text-xs font-semibold uppercase tracking-wide text-slate-400">
								Interviewer
							</span>
							<p class="text-sm leading-relaxed text-slate-500">{turn.text}</p>
						</div>
					{:else}
						{#each segmentsByTurn.get(turn.turn_index) ?? [] as seg (seg.segment_id)}
							{@const t = tags[seg.segment_id]}
							<div
								class="flex flex-col gap-3 rounded-lg border bg-white p-4
									{t.discarded ? 'border-slate-200 opacity-60' : 'border-slate-200'}"
							>
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0 flex-1">
										<p
											class="text-sm leading-relaxed {t.discarded
												? 'text-slate-400 line-through'
												: 'text-slate-800'}"
										>
											<KeywordText text={seg.text} />
										</p>
										<div class="mt-1 flex flex-wrap gap-x-3 font-mono text-xs text-slate-400">
											<span>{seg.segment_id}</span>
											<span>{seg.word_count} words</span>
											{#if seg.question_id}
												<span>{questionLabelById.get(seg.question_id) ?? seg.question_id}</span>
											{/if}
											{#if seg.flags.includes('very_short')}
												<span class="text-amber-600">very short</span>
											{/if}
											{#if t.discarded}
												<span class="text-rose-500">discarded</span>
											{/if}
										</div>
									</div>
									<button
										type="button"
										onclick={() => (t.discarded = !t.discarded)}
										class="shrink-0 rounded border px-2 py-1 text-xs font-medium transition-colors
											{t.discarded
											? 'border-slate-300 text-slate-600 hover:bg-slate-50'
											: 'border-rose-200 text-rose-600 hover:bg-rose-50'}"
									>
										{t.discarded ? 'Restore' : 'Discard'}
									</button>
								</div>

								{#if !t.discarded}
									<!-- Sentiment -->
								<div class="flex items-center gap-2">
									<span class="w-20 shrink-0 text-xs font-medium text-slate-500">Sentiment</span>
									<div class="flex gap-1">
										{#each sentiments as s (s.v)}
											<button
												type="button"
												title={sentimentScale[String(s.v)]}
												onclick={() => (t.sentiment = s.v)}
												aria-pressed={t.sentiment === s.v}
												class="w-9 rounded border py-1 text-xs tabular-nums transition-colors
													{t.sentiment === s.v
													? s.v < 0
														? 'border-rose-400 bg-rose-500 text-white'
														: s.v > 0
															? 'border-emerald-400 bg-emerald-500 text-white'
															: 'border-slate-400 bg-slate-500 text-white'
													: 'border-slate-200 bg-white text-slate-500 hover:border-slate-400'}"
											>
												{s.label}
											</button>
										{/each}
									</div>
								</div>

								<!-- Themes -->
								<div class="flex items-start gap-2">
									<span class="w-20 shrink-0 pt-0.5 text-xs font-medium text-slate-500">Themes</span>
									<div class="flex flex-wrap gap-1.5">
										{#each themeTags as theme (theme.id)}
											{@render chip(
												t.themes.includes(theme.id),
												titleCase(theme.id),
												theme.description,
												() => toggleTheme(seg.segment_id, theme.id),
												'border-accent-mint bg-accent-mint text-white'
											)}
										{/each}
									</div>
								</div>

								<!-- Subthemes — only for selected themes that have them -->
								{#each t.themes as themeId (themeId)}
									{@const theme = themeById.get(themeId)}
									{#if theme?.subthemes?.length}
										<div class="flex items-start gap-2">
											<span class="w-20 shrink-0 pt-0.5 text-xs text-slate-400">
												↳ {titleCase(themeId)}
											</span>
											<div class="flex flex-wrap gap-1.5">
												{#each theme.subthemes as sub (sub.id)}
													{@render chip(
														t.subthemes.includes(sub.id),
														titleCase(sub.id),
														sub.description,
														() => toggleIn(seg.segment_id, 'subthemes', sub.id),
														'border-accent-mint bg-accent-mint/15 text-accent-mint'
													)}
												{/each}
											</div>
										</div>
									{/if}
								{/each}

								<!-- Emotions -->
								<div class="flex items-start gap-2">
									<span class="w-20 shrink-0 pt-0.5 text-xs font-medium text-slate-500">Emotions</span>
									<div class="flex flex-wrap gap-1.5">
										{#each emotionTags as emotion (emotion.id)}
											{@render chip(
												t.emotions.includes(emotion.id),
												titleCase(emotion.id),
												emotion.description,
												() => toggleIn(seg.segment_id, 'emotions', emotion.id),
												'border-slate-500 bg-slate-600 text-white'
											)}
										{/each}
									</div>
								</div>

								<!-- Semantic tags -->
								<div class="flex items-start gap-2">
									<span class="w-20 shrink-0 pt-0.5 text-xs font-medium text-slate-500">Semantic</span>
									<div class="flex flex-wrap gap-1.5">
										{#each semanticTags as sem (sem.id)}
											{@render chip(
												t.semantic_tags.includes(sem.id),
												titleCase(sem.id),
												sem.description,
												() => toggleIn(seg.segment_id, 'semantic_tags', sem.id),
												'border-violet-400 bg-violet-500 text-white'
											)}
										{/each}
									</div>
								</div>

								{/if}

								<!-- Reviewer note — kept visible so a discard can be explained -->
								<div class="flex items-center gap-2">
									<span class="w-20 shrink-0 text-xs font-medium text-slate-500">Note</span>
									<input
										bind:value={t.reviewer_notes}
										placeholder="Optional reviewer note"
										class="flex-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-700"
									/>
								</div>
							</div>
						{/each}
					{/if}
				{/each}
			</div>
		{:else}
			<p class="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
				No interviews found. Upload a transcript first.
			</p>
		{/if}
	</div>
</div>

<!-- Surfaced after a save so the reviewer can advance through the pipeline. -->
<AlertDialog.Root bind:open={showSavedDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Tags updated</AlertDialog.Title>
			<AlertDialog.Description>
				{#if form?.success}
					{form.segmentCount} segments annotated · {form.themedCount} carry at least one theme{form.discardedCount
						? ` · ${form.discardedCount} discarded`
						: ''}. These tags feed the Themes and Word views.
					{#if nextPending}
						{pendingCount}
						{pendingCount === 1 ? 'interview' : 'interviews'} still need tagging.
					{:else}
						Every interview is now tagged — the quote bank is the next review stage.
					{/if}
				{:else}
					Your tags were saved.
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Stay on this interview</AlertDialog.Cancel>
			{#if nextPending}
				<AlertDialog.Action
					onclick={() => goto(`?interview=${nextPending}`, { keepFocus: true, noScroll: true })}
				>
					Tag next: {titleCase(nextPending)}
				</AlertDialog.Action>
			{:else}
				<AlertDialog.Action onclick={() => goto('/wctglpdemo')}>
					Back to pipeline overview
				</AlertDialog.Action>
			{/if}
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

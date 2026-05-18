<!--
	SegmentTagDrawer — right-hand drawer for confirming/editing one segment's
	codebook tags (themes, subthemes, emotions, sentiment, semantic tags).

	Driven by the `segment` prop: non-null opens the drawer for that segment;
	`onclose` is called to dismiss it. Saving POSTs to /wctglpdemo/segment-tags
	and reports the stored annotation back through `onsaved`.
-->
<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import codebook from '$lib/content/wctglpdemo-data/codebook.json';
	import type { Annotation, TaggableSegment } from '$lib/types/segment-tags';

	let {
		segment = null,
		annotation = null,
		onclose,
		onsaved
	}: {
		segment: TaggableSegment | null;
		annotation: Annotation | null;
		onclose: () => void;
		onsaved: (a: Annotation) => void;
	} = $props();

	type Theme = {
		id: string;
		description: string;
		subthemes?: { id: string; description: string }[];
	};
	const themeTags = codebook.theme_tags as Theme[];
	const emotionTags = codebook.emotion_tags;
	const semanticTags = codebook.semantic_tags;
	const themeById = new Map(themeTags.map((t) => [t.id, t]));
	const sentimentScale = codebook.meta.sentiment_scale as Record<string, string>;
	const sentiments = [
		{ v: -2, label: '−2' },
		{ v: -1, label: '−1' },
		{ v: 0, label: '0' },
		{ v: 1, label: '+1' },
		{ v: 2, label: '+2' }
	];
	const titleCase = (id: string) => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

	// Working copy — re-seeded each time a different segment opens the drawer.
	let themes = $state<string[]>([]);
	let subthemes = $state<string[]>([]);
	let emotions = $state<string[]>([]);
	let semantic = $state<string[]>([]);
	let sentiment = $state(0);
	let note = $state('');
	let saving = $state(false);
	let errorMsg = $state('');

	let seededFor = '';
	$effect(() => {
		const id = segment?.segment_id ?? '';
		if (id && id !== seededFor) {
			seededFor = id;
			themes = annotation ? [...annotation.themes] : [];
			subthemes = annotation ? [...annotation.subthemes] : [];
			emotions = annotation ? [...annotation.emotions] : [];
			semantic = annotation ? [...annotation.semantic_tags] : [];
			sentiment = annotation ? annotation.sentiment : 0;
			note = annotation ? annotation.reviewer_notes : '';
			errorMsg = '';
		} else if (!id) {
			seededFor = '';
		}
	});

	function toggleTheme(themeId: string) {
		if (themes.includes(themeId)) {
			themes = themes.filter((x) => x !== themeId);
			// Drop subthemes orphaned by removing their parent theme.
			const kids = new Set((themeById.get(themeId)?.subthemes ?? []).map((s) => s.id));
			subthemes = subthemes.filter((s) => !kids.has(s));
		} else {
			themes = [...themes, themeId];
		}
	}
	const toggle = (list: string[], id: string) =>
		list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

	const tagCount = $derived(
		themes.length + subthemes.length + emotions.length + semantic.length
	);

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	async function save() {
		if (!segment || saving) return;
		saving = true;
		errorMsg = '';
		try {
			const res = await fetch('/wctglpdemo/segment-tags', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					segment_id: segment.segment_id,
					interview_id: segment.interview_id,
					question_id: segment.question_id,
					themes,
					subthemes,
					emotions,
					sentiment,
					semantic_tags: semantic,
					reviewer_notes: note
				})
			});
			const data = await res.json().catch(() => null);
			if (!res.ok || !data?.ok) {
				errorMsg = data?.error ?? 'Could not save tags.';
				return;
			}
			onsaved(data.annotation as Annotation);
			onclose();
		} catch {
			errorMsg = 'Could not reach the server.';
		} finally {
			saving = false;
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet chip(
	active: boolean,
	label: string,
	title: string,
	onToggle: () => void,
	activeClass: string
)}
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

{#if segment}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40 bg-slate-900/30"
		transition:fade={{ duration: 200 }}
		onclick={onclose}
		aria-hidden="true"
	></div>

	<!-- Drawer -->
	<aside
		class="fixed inset-y-0 right-0 z-50 flex w-full max-w-[30rem] flex-col bg-white shadow-2xl"
		transition:fly={{ x: 120, duration: 320, easing: cubicOut }}
		aria-label="Edit segment tags"
	>
		<!-- Header -->
		<div class="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
			<div class="min-w-0">
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Edit segment tags</p>
				<p class="truncate font-mono text-xs text-slate-400">{segment.segment_id}</p>
			</div>
			<button
				type="button"
				onclick={onclose}
				aria-label="Close"
				class="shrink-0 rounded p-1 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
			>
				✕
			</button>
		</div>

		<!-- Scrollable body -->
		<div class="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
			<!-- Segment text + current status -->
			<div>
				<p
					class="rounded-md border-l-2 border-accent-mint bg-accent-mint/5 p-3 text-sm leading-relaxed text-slate-800"
				>
					{segment.text}
				</p>
				<div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
					<span>{segment.word_count} words</span>
					{#if segment.flags.includes('very_short')}
						<span class="text-amber-600">very short</span>
					{/if}
					{#if annotation && annotation.source === 'human'}
						<span class="rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-700">confirmed</span>
					{:else if annotation}
						<span class="rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700">
							AI-proposed · {annotation.review_status}
						</span>
					{:else}
						<span class="rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-500">untagged</span>
					{/if}
				</div>
			</div>

			<!-- Sentiment -->
			<section>
				<p class="mb-1.5 text-xs font-medium text-slate-500">Sentiment</p>
				<div class="flex gap-1">
					{#each sentiments as s (s.v)}
						<button
							type="button"
							title={sentimentScale[String(s.v)]}
							onclick={() => (sentiment = s.v)}
							aria-pressed={sentiment === s.v}
							class="w-11 rounded border py-1 text-xs tabular-nums transition-colors
								{sentiment === s.v
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
			</section>

			<!-- Themes -->
			<section>
				<p class="mb-1.5 text-xs font-medium text-slate-500">Themes</p>
				<div class="flex flex-wrap gap-1.5">
					{#each themeTags as theme (theme.id)}
						{@render chip(
							themes.includes(theme.id),
							titleCase(theme.id),
							theme.description,
							() => toggleTheme(theme.id),
							'border-accent-mint bg-accent-mint text-white'
						)}
					{/each}
				</div>
			</section>

			<!-- Subthemes — only for selected themes that have them -->
			{#each themes as themeId (themeId)}
				{@const theme = themeById.get(themeId)}
				{#if theme?.subthemes?.length}
					<section>
						<p class="mb-1.5 text-xs text-slate-400">↳ {titleCase(themeId)} subthemes</p>
						<div class="flex flex-wrap gap-1.5">
							{#each theme.subthemes as sub (sub.id)}
								{@render chip(
									subthemes.includes(sub.id),
									titleCase(sub.id),
									sub.description,
									() => (subthemes = toggle(subthemes, sub.id)),
									'border-accent-mint bg-accent-mint/15 text-accent-mint'
								)}
							{/each}
						</div>
					</section>
				{/if}
			{/each}

			<!-- Emotions -->
			<section>
				<p class="mb-1.5 text-xs font-medium text-slate-500">Emotions</p>
				<div class="flex flex-wrap gap-1.5">
					{#each emotionTags as emotion (emotion.id)}
						{@render chip(
							emotions.includes(emotion.id),
							titleCase(emotion.id),
							emotion.description,
							() => (emotions = toggle(emotions, emotion.id)),
							'border-slate-500 bg-slate-600 text-white'
						)}
					{/each}
				</div>
			</section>

			<!-- Semantic tags -->
			<section>
				<p class="mb-1.5 text-xs font-medium text-slate-500">Semantic</p>
				<div class="flex flex-wrap gap-1.5">
					{#each semanticTags as sem (sem.id)}
						{@render chip(
							semantic.includes(sem.id),
							titleCase(sem.id),
							sem.description,
							() => (semantic = toggle(semantic, sem.id)),
							'border-violet-400 bg-violet-500 text-white'
						)}
					{/each}
				</div>
			</section>

			<!-- Reviewer note -->
			<section>
				<p class="mb-1.5 text-xs font-medium text-slate-500">Reviewer note</p>
				<input
					bind:value={note}
					placeholder="Optional note"
					class="w-full rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700"
				/>
			</section>
		</div>

		<!-- Footer -->
		<div class="flex items-center justify-between gap-3 border-t border-slate-200 p-4">
			<span class="text-xs text-slate-500">{tagCount} tag{tagCount === 1 ? '' : 's'} applied</span>
			<div class="flex items-center gap-2">
				{#if errorMsg}<span class="text-xs text-rose-600">{errorMsg}</span>{/if}
				<button
					type="button"
					onclick={onclose}
					class="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={save}
					disabled={saving}
					class="rounded bg-accent-mint px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-mint/90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{saving ? 'Saving…' : 'Save tags'}
				</button>
			</div>
		</div>
	</aside>
{/if}

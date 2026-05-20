<!--
	SegmentTagDrawer — right-hand drawer for confirming/editing one segment's
	codebook tags (themes, subthemes, emotions, sentiment).

	Driven by the `segment` prop: non-null opens the drawer for that segment;
	`onclose` is called to dismiss it. Saving POSTs to /wctglpdemo/segment-tags
	and reports the stored annotation back through `onsaved`.

	Layout is two columns. The left pins the segment, its overall sentiment,
	the Plutchik emotion picker, and the reviewer note. The right organizes the
	codebook's themes into `tag_groups`: open a group to reveal and tag them.
-->
<script lang="ts">
	import { fly, fade, slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import codebook from '$lib/content/wctglpdemo-data/codebook.json';
	import lexiconRaw from '$lib/content/wctglpdemo-data/keyword_lexicon.json';
	import phraseLexRaw from '$lib/content/wctglpdemo-data/phrase_lexicon.json';
	import { EMOTION_PICKER } from '$lib/journeymapper2/plutchikEmotionsConfig.js';
	import { emotionDots } from '$lib/utils/emotion-colors';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import KeywordText from '$lib/components/KeywordText.svelte';
	import KeywordTagDrawer from '$lib/components/KeywordTagDrawer.svelte';
	import PhraseLinkDrawer from '$lib/components/PhraseLinkDrawer.svelte';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { Annotation, TaggableSegment } from '$lib/types/segment-tags';
	import { XIcon } from '@lucide/svelte';

	let {
		segment = null,
		annotation = null,
		onclose,
		onsaved,
		onedited
	}: {
		segment: TaggableSegment | null;
		annotation: Annotation | null;
		onclose: () => void;
		onsaved: (a: Annotation) => void;
		/** Called after a successful segment-text edit so the parent can refresh
		 *  its segment list (segments.json was rewritten on the server). */
		onedited?: () => void;
	} = $props();

	type Theme = {
		id: string;
		description: string;
		group?: string;
		subthemes?: { id: string; description: string }[];
		terms?: string[];
	};
	type TagGroup = { id: string; label: string; description: string };
	type TagGroupView = TagGroup & { themes: Theme[] };
	type Keyword = { id: string; label: string; variants: string[] };
	type Category = { id: string; label: string; description: string; keywords: Keyword[] };
	type PhraseVariant = {
		text: string;
		segment_id: string;
		interview_id: string;
		created_at: string;
	};
	type KeyPhrase = { id: string; label: string; variants: PhraseVariant[] };
	type EmotionLevel = { id: string; intensity: string };
	type EmotionDyad = { id: string; with: string };
	type EmotionPrimary = {
		id: string;
		label: string;
		color: string;
		textColor: string;
		valence: string;
		levels: EmotionLevel[];
		dyads: EmotionDyad[];
	};

	const tagGroups = codebook.tag_groups as TagGroup[];
	// The Plutchik picker (8 primaries, each with 3 intensity levels + dyads).
	const emotionPrimaries = EMOTION_PICKER as EmotionPrimary[];
	// Descriptions for chip tooltips, keyed by emotion id.
	const emotionDesc = new Map(
		(codebook.emotion_tags as { id: string; description: string }[]).map((e) => [
			e.id,
			e.description
		])
	);

	// Emotion indicator colour resolution lives in $lib/utils/emotion-colors —
	// shared with CodedFragmentCard and the upload-page tag chips so the picker
	// and the transcript draw from one source of truth.

	// Themes and the keyword lexicon are reactive: the right-click "add to
	// keyword / theme" menu replaces them with the server's updated copy.
	let themeTags = $state<Theme[]>(codebook.theme_tags as Theme[]);
	let lexicon = $state<{ categories: Category[] }>(lexiconRaw as { categories: Category[] });
	// Key phrases — canonical labels with semantic variants drawn from segments.
	let keyPhrases = $state<KeyPhrase[]>((phraseLexRaw.key_phrases ?? []) as KeyPhrase[]);
	const themeById = $derived(new Map(themeTags.map((t) => [t.id, t])));

	// Themes bucketed into the codebook's tag groups. Themes created from the
	// right-click menu may lack a group — they fall into a trailing
	// "Other themes" bucket so they stay reachable.
	const grouped = $derived.by((): TagGroupView[] => {
		const known = new Set(tagGroups.map((g) => g.id));
		const out: TagGroupView[] = tagGroups.map((g) => ({
			...g,
			themes: themeTags.filter((t) => t.group === g.id)
		}));
		const orphans = themeTags.filter((t) => !t.group || !known.has(t.group));
		if (orphans.length) {
			out.push({
				id: '__ungrouped',
				label: 'Other themes',
				description: 'Themes added from the codebook menu, not yet assigned to a group.',
				themes: orphans
			});
		}
		return out;
	});

	const sentimentScale = codebook.meta.sentiment_scale as Record<string, string>;
	// Diverging −2..+2 colour scale — matches the keyword constellation.
	const sentiments = [
		{ v: -2, color: '#e11d48' },
		{ v: -1, color: '#fb7185' },
		{ v: 0, color: '#94a3b8' },
		{ v: 1, color: '#34d399' },
		{ v: 2, color: '#059669' }
	];
	// Human-readable scale label, e.g. "Strongly positive" — shown on hover.
	const sentimentLabel = (v: number) => {
		const raw = sentimentScale[String(v)] ?? '';
		return raw.charAt(0).toUpperCase() + raw.slice(1);
	};
	const titleCase = (id: string) => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

	// Working copy — re-seeded each time a different segment opens the drawer.
	let themes = $state<string[]>([]);
	let subthemes = $state<string[]>([]);
	let emotions = $state<string[]>([]);
	let sentiment = $state(0);
	let note = $state('');
	let saving = $state(false);
	let errorMsg = $state('');

	// Disclosure state: which tag groups are open, and which emotion family.
	let expandedGroups = $state<string[]>([]);
	let expandedEmotion = $state('');

	// Right-click "add to keyword / theme" menu state.
	let selectionText = $state('');
	let lexBusy = $state(false);
	let flashMsg = $state('');
	let flashTimer: ReturnType<typeof setTimeout> | undefined;

	// "New theme from selection" dialog — lets the reviewer give the theme a
	// real id, description, and group instead of dropping the raw selection
	// into the codebook with placeholder fields.
	let newThemeOpen = $state(false);
	let newThemeSeed = $state(''); // the highlighted phrase that becomes the first term
	let newThemeId = $state('');
	let newThemeDescription = $state('');
	let newThemeGroup = $state('');

	const slugifyId = (t: string) =>
		t
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 40);

	function openNewThemeDialog() {
		if (!selectionText) return;
		newThemeSeed = selectionText;
		newThemeId = slugifyId(selectionText);
		newThemeDescription = '';
		newThemeGroup = '';
		errorMsg = '';
		newThemeOpen = true;
	}

	async function submitNewTheme() {
		if (lexBusy) return;
		if (!newThemeId.trim()) {
			errorMsg = 'Pick an id for the new theme.';
			return;
		}
		if (!newThemeDescription.trim()) {
			errorMsg = 'Write a short description.';
			return;
		}
		if (!newThemeGroup) {
			errorMsg = 'Pick a tag group.';
			return;
		}
		// applyLexicon reads `selectionText` as the seed term. Pin it to the
		// snapshot taken when the dialog opened in case the live selection has
		// drifted while the form was open.
		selectionText = newThemeSeed;
		await applyLexicon('create_theme', {
			id: newThemeId.trim(),
			description: newThemeDescription.trim(),
			group: newThemeGroup
		});
		// applyLexicon clears errorMsg on success; close only if no error.
		if (!errorMsg) newThemeOpen = false;
	}

	// Tertiary drawer state — opened from the right-click menu. Each drawer
	// snapshots the live selection at open time so the surface text it operates
	// on can't drift while the analyst works in the drawer.
	let keywordDrawerOpen = $state(false);
	let phraseDrawerOpen = $state(false);
	let tertiarySelection = $state('');

	function openKeywordDrawer() {
		if (!selectionText) return;
		tertiarySelection = selectionText;
		errorMsg = '';
		keywordDrawerOpen = true;
	}

	function openPhraseDrawer() {
		if (!selectionText) return;
		tertiarySelection = selectionText;
		errorMsg = '';
		phraseDrawerOpen = true;
	}

	// applyLexicon reads `selectionText` directly. Pin it to the snapshot the
	// drawer was opened with so a stray browser selection inside the drawer
	// can't redirect the action to the wrong phrase.
	async function applyFromKeywordDrawer(
		action: 'add_keyword_variant' | 'create_keyword',
		payload: Record<string, string>
	) {
		selectionText = tertiarySelection;
		await applyLexicon(action, payload);
	}

	// Inline edit-selection state — when the reviewer chooses "Edit selection"
	// from the right-click menu, the highlighted phrase becomes editable below
	// the quote. `currentText` mirrors segment.text so the drawer reflects the
	// edit immediately, without waiting for the parent to re-seed.
	let currentText = $state('');
	let editingSelection = $state(false);
	let editFind = $state('');
	let editReplace = $state('');
	let editBusy = $state(false);

	// Live document selection — drives the enabled state of the key-phrase
	// chips so the reviewer knows when clicking will actually tag.
	let hasLiveSelection = $state(false);
	$effect(() => {
		if (typeof document === 'undefined') return;
		const update = () => {
			hasLiveSelection = (window.getSelection()?.toString().trim().length ?? 0) > 0;
		};
		update();
		document.addEventListener('selectionchange', update);
		return () => document.removeEventListener('selectionchange', update);
	});

	let seededFor = '';
	$effect(() => {
		const id = segment?.segment_id ?? '';
		if (id && id !== seededFor) {
			seededFor = id;
			themes = annotation ? [...annotation.themes] : [];
			subthemes = annotation ? [...annotation.subthemes] : [];
			emotions = annotation ? [...annotation.emotions] : [];
			sentiment = annotation ? annotation.sentiment : 0;
			note = annotation ? annotation.reviewer_notes : '';
			errorMsg = '';
			flashMsg = '';
			selectionText = '';
			currentText = segment?.text ?? '';
			editingSelection = false;
			editFind = '';
			editReplace = '';
			clearTimeout(flashTimer);
			// Open the groups and the emotion family that already carry tags, so
			// an AI proposal is visible without hunting through collapsed panels.
			expandedGroups = grouped
				.filter((g) =>
					g.themes.some(
						(t) =>
							themes.includes(t.id) ||
							(t.subthemes ?? []).some((s) => subthemes.includes(s.id))
					)
				)
				.map((g) => g.id);
			expandedEmotion =
				emotionPrimaries.find(
					(p) =>
						p.levels.some((l) => emotions.includes(l.id)) ||
						p.dyads.some((d) => emotions.includes(d.id))
				)?.id ?? '';
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

	const toggleGroup = (id: string) =>
		(expandedGroups = expandedGroups.includes(id)
			? expandedGroups.filter((x) => x !== id)
			: [...expandedGroups, id]);
	const toggleEmotionFamily = (id: string) =>
		(expandedEmotion = expandedEmotion === id ? '' : id);

	// How many tags are applied within a group / an emotion family — shown as
	// a badge so collapsed panels still reveal where the tags are.
	function groupTagCount(g: TagGroupView) {
		let n = g.themes.filter((t) => themes.includes(t.id)).length;
		for (const t of g.themes) {
			n += (t.subthemes ?? []).filter((s) => subthemes.includes(s.id)).length;
		}
		return n;
	}
	const emotionFamilyCount = (p: EmotionPrimary) =>
		p.levels.filter((l) => emotions.includes(l.id)).length +
		p.dyads.filter((d) => emotions.includes(d.id)).length;

	const truncate = (s: string, n = 36) => (s.length > n ? s.slice(0, n) + '…' : s);

	// Snapshot the current text selection — read on right-click, before the
	// context menu opens, so we know which phrase the reviewer highlighted.
	function captureSelection() {
		const sel = typeof window !== 'undefined' ? window.getSelection() : null;
		selectionText = sel ? sel.toString().replace(/\s+/g, ' ').trim() : '';
	}

	// File the highlighted phrase into a keyword or theme. The server persists
	// the edit and returns the refreshed lists, keeping the menus consistent.
	async function applyLexicon(action: string, payload: Record<string, string>) {
		if (lexBusy || !selectionText) return;
		lexBusy = true;
		flashMsg = '';
		errorMsg = '';
		try {
			const res = await fetch('/wctglpdemo/lexicon', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action, text: selectionText, ...payload })
			});
			const data = await res.json().catch(() => null);
			if (!res.ok || !data?.ok) {
				errorMsg = data?.error ?? 'Could not update the list.';
				return;
			}
			lexicon = { categories: data.categories as Category[] };
			themeTags = data.themes as Theme[];
			// Surface a success alert overlaid on the drawer; the drawer itself
			// stays open so the reviewer can keep tagging the same segment.
			flashMsg = data.message ?? 'List updated.';
			clearTimeout(flashTimer);
			flashTimer = setTimeout(() => (flashMsg = ''), 4000);
		} catch {
			errorMsg = 'Could not reach the server.';
		} finally {
			lexBusy = false;
		}
	}

	// Open the inline editor with the reviewer's current selection as the
	// starting point — they tweak it and click Apply to rewrite that phrase.
	function startEditSelection() {
		if (!selectionText) return;
		editFind = selectionText;
		editReplace = selectionText;
		editingSelection = true;
		errorMsg = '';
	}

	function cancelEditSelection() {
		editingSelection = false;
		editFind = '';
		editReplace = '';
	}

	// Rewrite the highlighted phrase in segments.json and reflect it locally so
	// the quote, word count, and any keyword/theme highlights update on screen.
	async function applyEditSelection() {
		if (!segment || editBusy || !editFind) return;
		const replacement = editReplace.replace(/\s+/g, ' ').trim();
		if (!replacement || replacement === editFind) {
			cancelEditSelection();
			return;
		}
		editBusy = true;
		errorMsg = '';
		flashMsg = '';
		try {
			const res = await fetch('/wctglpdemo/segments', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action: 'edit_text',
					interview_id: segment.interview_id,
					segment_id: segment.segment_id,
					find: editFind,
					replace: replacement
				})
			});
			const data = await res.json().catch(() => null);
			if (!res.ok || !data?.ok) {
				errorMsg = data?.error ?? 'Could not edit segment text.';
				return;
			}
			const updated = (data.segments as { segment_id: string; text: string }[]).find(
				(s) => s.segment_id === segment.segment_id
			);
			if (updated) currentText = updated.text;
			cancelEditSelection();
			flashMsg = 'Segment text updated.';
			clearTimeout(flashTimer);
			flashTimer = setTimeout(() => (flashMsg = ''), 4000);
			onedited?.();
		} catch {
			errorMsg = 'Could not reach the server.';
		} finally {
			editBusy = false;
		}
	}

	// File the highlighted snippet under a key phrase. Variants carry the
	// segment_id and interview_id, so the canonical phrase can back-link to
	// every utterance it stands for.
	async function applyPhrase(action: string, payload: Record<string, string>) {
		if (lexBusy || !selectionText || !segment) return;
		lexBusy = true;
		flashMsg = '';
		errorMsg = '';
		try {
			const res = await fetch('/wctglpdemo/phrases', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					action,
					text: selectionText,
					segment_id: segment.segment_id,
					interview_id: segment.interview_id,
					...payload
				})
			});
			const data = await res.json().catch(() => null);
			if (!res.ok || !data?.ok) {
				errorMsg = data?.error ?? 'Could not update the key-phrase lexicon.';
				return;
			}
			keyPhrases = data.key_phrases as KeyPhrase[];
			flashMsg = data.message ?? 'Key phrase updated.';
			clearTimeout(flashTimer);
			flashTimer = setTimeout(() => (flashMsg = ''), 4000);
		} catch {
			errorMsg = 'Could not reach the server.';
		} finally {
			lexBusy = false;
		}
	}

	const tagCount = $derived(themes.length + subthemes.length + emotions.length);

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
	<Button
		variant="outline"
		size="xs"
		{title}
		onclick={onToggle}
		pressed={active}
		{activeClass}
	>
		{label}
	</Button>
{/snippet}

<!-- Section header + one-line definition, so reviewers know what each tag
	 family actually answers about the segment. -->
{#snippet sectionHead(title: string, hint: string)}
	<div class="mb-2">
		<p class="text-xs font-semibold tracking-wide text-slate-700">{title}</p>
		<p class="text-[11px] leading-snug text-slate-400">{hint}</p>
	</div>
{/snippet}

<!-- Small uppercase label separating tag kinds inside a panel. -->
{#snippet subLabel(text: string)}
	<p class="mb-1.5 text-[11px] font-medium tracking-wide text-slate-400 uppercase">{text}</p>
{/snippet}

<!-- Emotion indicator — one circle for an intensity level, two overlapping
	 circles for a dyad's two primaries. Kept compact so it sits inside a chip. -->
{#snippet emotionDot(id: string)}
	{@const colors = emotionDots(id)}
	{#if colors.c2}
		<span class="relative inline-block h-2.5 w-[18px] shrink-0" aria-hidden="true">
			<span
				class="absolute left-0 top-0 size-2.5 rounded-full border border-black/10"
				style="background: {colors.c1}"
			></span>
			<span
				class="absolute left-2 top-0 size-2.5 rounded-full border border-black/10"
				style="background: {colors.c2}"
			></span>
		</span>
	{:else}
		<span
			class="inline-block size-2.5 shrink-0 rounded-full border border-black/10"
			style="background: {colors.c1}"
			aria-hidden="true"
		></span>
	{/if}
{/snippet}

{#if segment}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40 bg-slate-900/30"
		transition:fade={{ duration: 200 }}
		onclick={(e) => {
			// Only a direct click on the backdrop closes the drawer — never a
			// click that bubbled out of the context menu portaled inside it.
			if (e.target === e.currentTarget) onclose();
		}}
		aria-hidden="true"
	></div>

	<!-- Drawer — wide, two-column: the segment on the left, codebook tags right -->
	<aside
		class="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl lg:max-w-4xl xl:max-w-5xl"
		transition:fly={{ x: 120, duration: 320, easing: cubicOut }}
		aria-label="Edit segment tags"
	>
		<!-- Success alert — overlaid on the drawer after a keyword/theme edit -->
		{#if flashMsg}
			<div
				class="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-4"
				transition:fly={{ y: -14, duration: 220, easing: cubicOut }}
			>
				<div
					role="status"
					class="pointer-events-auto flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 shadow-lg"
				>
					<CircleCheckIcon class="size-4 shrink-0 text-emerald-600" />
					<span>{flashMsg}</span>
				</div>
			</div>
		{/if}

		<!-- Header -->
		<div class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
			<div class="min-w-0">
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Edit segment tags</p>
				<p class="truncate font-mono text-xs text-slate-400">{segment.segment_id}</p>
			</div>
			<div class="flex flex-col items-end gap-2">
				{#if errorMsg}<span class="text-xs text-rose-600">{errorMsg}</span>{/if}
					<Button
						variant="outline"
						size='xs'
						onclick={onclose}
						aria-label="Close">
						<XIcon
						size=lg />
					</Button>
				<Button
					variant="secondary"
					onclick={save}
					disabled={saving}
				>
					{saving ? 'Saving…' : 'Save tags'}
				</Button>
			</div>
		</div>
		

		<!-- Body — full-width quote on top, two tag columns underneath -->
		<Tooltip.Provider delayDuration={120}>
		<div class="flex flex-1 flex-col overflow-hidden">
			<!-- TOP — the segment quote, full width -->
			<div class="shrink-0 border-b border-slate-200 p-5">
				<ContextMenu.Root>
					<ContextMenu.Trigger>
						{#snippet child({ props })}
						<!-- Distinguish "maintain the codebook" (right-click) from
						"tag this segment" (the chips below and to the right). -->
						<p class="mb-2 text-sm leading-snug text-muted-foreground">
						Highlight a phrase and right-click to edit it, or add it to the keyword lexicon or a theme.
						</p>
								<p
									{...props}
									oncontextmenu={(e: MouseEvent) => {
										// Snapshot the selection, then hand off to bits-ui to open the menu.
										captureSelection();
										(props.oncontextmenu as ((e: MouseEvent) => void) | undefined)?.(e);
									}}
									class="cursor-text border-l-2 border-accent-mint px-4 text-2xl text-primary select-text"
								>
									<KeywordText text={currentText} />
								</p>
							{/snippet}
						</ContextMenu.Trigger>
						<ContextMenu.Content class="w-72">
							{#if !selectionText}
								<ContextMenu.Label>
									Select a word or phrase in the text, then right-click to add it to a keyword or
									theme.
								</ContextMenu.Label>
							{:else}
								<ContextMenu.Label>
									<span class="font-medium text-slate-700">“{truncate(selectionText)}”</span>
								</ContextMenu.Label>
								<ContextMenu.Separator />
								<!-- Rewrite the highlighted phrase directly in the segment text. -->
								<ContextMenu.Item onSelect={startEditSelection}>
									Edit selection…
								</ContextMenu.Item>
								<ContextMenu.Separator />
								<!-- Two tertiary drawers handle the heavy lifting: a Keyword
									 drawer with the full lexicon, and a Phrase-link drawer for
									 attaching the selection to a phrase wordlist. Themes are
									 tagged from the right-side panel, not from this menu. -->
								<ContextMenu.Item onSelect={openKeywordDrawer}>
									Tag as keyword…
								</ContextMenu.Item>
								<ContextMenu.Item onSelect={openPhraseDrawer}>
									Link to a phrase…
								</ContextMenu.Item>
							{/if}
						</ContextMenu.Content>
					</ContextMenu.Root>

				<!-- Inline editor — replaces the highlighted phrase in segments.json
					 when the reviewer chose "Edit selection" from the menu. -->
				{#if editingSelection}
					<div
						class="mt-3 rounded-md border border-accent-mint/40 bg-accent-mint/5 p-3"
						transition:slide={{ duration: 180 }}
					>
						<p class="mb-2 text-xs text-slate-500">
							Replacing
							<span class="font-medium text-slate-700">“{truncate(editFind)}”</span>
							with:
						</p>
						<textarea
							bind:value={editReplace}
							rows="2"
							class="mb-2 w-full resize-y rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700"
						></textarea>
						<div class="flex justify-end gap-2">
							<Button
								variant="ghost"
								size="xs"
								onclick={cancelEditSelection}
								disabled={editBusy}
							>
								Cancel
							</Button>
							<Button
								variant="secondary"
								size="xs"
								onclick={applyEditSelection}
								disabled={editBusy || !editReplace.trim() || editReplace.trim() === editFind}
							>
								{editBusy ? 'Saving…' : 'Apply edit'}
							</Button>
						</div>
					</div>
				{/if}
			</div>

			<!-- BELOW — two tag columns -->
			<div class="flex flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
				<!-- LEFT — sentiment, emotions, reviewer note -->
				<div
					class="flex shrink-0 flex-col gap-5 border-b border-slate-200 p-5
						md:w-96 md:overflow-y-auto md:border-r md:border-b-0"
				>
					<!-- Sentiment — a diverging colour scale; hover a swatch for its label -->
					<section>
					{@render sectionHead('Sentiment', 'How positive or negative the segment reads overall.')}
					<div class="flex">
						{#each sentiments as s (s.v)}
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<button
											{...props}
											type="button"
											onclick={() => (sentiment = s.v)}
											aria-pressed={sentiment === s.v}
											aria-label={sentimentLabel(s.v)}
											class="h-7 hover:cursor-pointer flex-1 border transition-all
												{sentiment === s.v
												? 'ring-2 ring-primary ring-offset-1'
												: 'opacity-40 hover:opacity-75'}"
											style="background-color: {s.color}; border-color: {s.color}"
										></button>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content>{sentimentLabel(s.v)}</Tooltip.Content>
							</Tooltip.Root>
						{/each}
					</div>
				</section>

				<!-- Emotions — Plutchik picker: pick a primary, then an intensity
					 level or a dyad blend. -->
				<section>
					{@render sectionHead(
						'Emotions',
						'What the participant feels. Pick a primary emotion to choose an intensity or a blend.'
					)}
					{#if emotions.length}
						<div class="mb-2 flex flex-wrap gap-1.5">
							{#each emotions as e (e)}
								<button
									type="button"
									title={emotionDesc.get(e) ?? ''}
									onclick={() => (emotions = emotions.filter((x) => x !== e))}
									class="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"
								>
									{@render emotionDot(e)}
									{titleCase(e)}<span class="opacity-70">✕</span>
								</button>
							{/each}
						</div>
					{/if}
					<div class="flex flex-wrap gap-1.5">
						{#each emotionPrimaries as p (p.id)}
							{@const cnt = emotionFamilyCount(p)}
							<button
								type="button"
								onclick={() => toggleEmotionFamily(p.id)}
								aria-expanded={expandedEmotion === p.id}
								class="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors
									{expandedEmotion === p.id
									? 'border-slate-700 bg-slate-100 text-slate-800'
									: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}"
							>
								<span class="size-2 rounded-full" style="background-color: {p.color}"></span>
								{p.label}
								{#if cnt}
									<span
										class="rounded-full bg-slate-700 px-1 text-[10px] leading-tight text-white"
										>{cnt}</span
									>
								{/if}
							</button>
						{/each}
					</div>
					{#each emotionPrimaries as p (p.id)}
						{#if expandedEmotion === p.id}
							<div class="mt-2 rounded-md bg-slate-50 p-2.5" transition:slide={{ duration: 180 }}>
								<!-- Intensity — low / medium / high, each a shade of the emotion -->
								{@render subLabel('Intensity')}
								<div class="flex flex-wrap gap-1.5">
									{#each p.levels as lvl (lvl.id)}
										{@const on = emotions.includes(lvl.id)}
										<button
											type="button"
											title={emotionDesc.get(lvl.id) ?? ''}
											onclick={() => (emotions = toggle(emotions, lvl.id))}
											aria-pressed={on}
											class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors
												{on
												? 'border-slate-700 bg-slate-100 text-slate-800'
												: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}"
										>
											{@render emotionDot(lvl.id)}
											{titleCase(lvl.id)}
										</button>
									{/each}
								</div>
								{#if p.dyads.length}
									<!-- Blends — a dyad gradient of its two primaries; hover for the
										 second emotion in the blend. -->
									<div class="mt-2.5">
										{@render subLabel('Blends with another emotion')}
										<div class="flex flex-wrap gap-1.5">
											{#each p.dyads as d (d.id)}
												{@const on = emotions.includes(d.id)}
												<Tooltip.Root>
													<Tooltip.Trigger>
														{#snippet child({ props })}
															<button
																{...props}
																type="button"
																onclick={() => (emotions = toggle(emotions, d.id))}
																aria-pressed={on}
																class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors
																	{on
																	? 'border-slate-700 bg-slate-100 text-slate-800'
																	: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}"
															>
																{@render emotionDot(d.id)}
																{titleCase(d.id)}
															</button>
														{/snippet}
													</Tooltip.Trigger>
													<Tooltip.Content class="flex flex-col gap-0.5">
														<span class="font-semibold">+ {titleCase(d.with)}</span>
														{#if emotionDesc.get(d.id)}
															<span class="max-w-52 text-[11px] opacity-80"
																>{emotionDesc.get(d.id)}</span
															>
														{/if}
													</Tooltip.Content>
												</Tooltip.Root>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{/if}
					{/each}
				</section>

				<!-- Reviewer note -->
				<section>
					{@render sectionHead('Reviewer note', 'Optional context for the next reviewer.')}
					<textarea
						bind:value={note}
						rows="3"
						placeholder="Optional note"
						class="w-full resize-y rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700"
					></textarea>
				</section>
			</div>

			<!-- RIGHT — themes, grouped into the codebook's tag groups -->
			<div class="flex flex-1 flex-col gap-6 p-5 md:overflow-y-auto">
				<!-- Key phrases — the global bank of canonical labels. Highlight a
					 phrase in the quote, then click a key phrase to file the snippet
					 under it, or create a new one. -->
				<section>
					{@render sectionHead(
						'Key phrases',
						'Canonical phrases that unify disparate participant phrasings. Highlight a quote, then click to file the snippet.'
					)}
					{#if selectionText && hasLiveSelection}
						<p class="mb-2 text-[11px] text-slate-500">
							Tagging:
							<span class="font-medium text-slate-700">“{truncate(selectionText)}”</span>
						</p>
					{:else if !hasLiveSelection}
						<p class="mb-2 text-[11px] text-slate-400">
							Highlight a phrase in the quote above, then click a key phrase to tag it.
						</p>
					{/if}
					<div class="flex flex-wrap gap-1.5">
						{#each keyPhrases as kp (kp.id)}
							<button
								type="button"
								title={kp.variants
									.slice(0, 4)
									.map((v) => `“${v.text}”`)
									.join('\n') || 'No variants yet'}
								onmousedown={captureSelection}
								onclick={() =>
									applyPhrase('add_phrase_variant', { key_phrase_id: kp.id })}
								disabled={!hasLiveSelection || lexBusy}
								class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors
									{!hasLiveSelection || lexBusy
									? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
									: 'border-slate-200 bg-white text-slate-700 hover:border-accent-mint hover:bg-accent-mint/10'}"
							>
								{kp.label}
								<span
									class="rounded-full bg-slate-100 px-1.5 text-[10px] leading-tight text-slate-500"
								>
									{kp.variants.length}
								</span>
							</button>
						{/each}
						<button
							type="button"
							onmousedown={captureSelection}
							onclick={() => applyPhrase('create_key_phrase', {})}
							disabled={!hasLiveSelection || lexBusy}
							class="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs transition-colors
								{!hasLiveSelection || lexBusy
								? 'cursor-not-allowed border-slate-200 text-slate-400'
								: 'border-accent-mint text-accent-mint hover:bg-accent-mint/10'}"
						>
							+ New key phrase
						</button>
					</div>
					{#if !keyPhrases.length}
						<p class="mt-2 text-[11px] text-slate-400">
							No key phrases yet — highlight a snippet and click <em>+ New key phrase</em> to start the bank.
						</p>
					{/if}
				</section>

				<section>
					{@render sectionHead(
						'Themes',
						'What the segment is about and how the participant reasons. Open a group to tag.'
					)}
					<div class="flex flex-col gap-1.5">
						{#each grouped as g (g.id)}
							{@const open = expandedGroups.includes(g.id)}
							{@const cnt = groupTagCount(g)}
							<div class="overflow-hidden rounded-md border border-slate-200">
								<button
									type="button"
									onclick={() => toggleGroup(g.id)}
									aria-expanded={open}
									class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:cursor-pointer hover:bg-slate-50"
								>
									<span class="min-w-0">
										<span class="text-sm font-medium text-slate-700">{g.label}</span>
										<span class="block truncate text-[11px] text-slate-400">{g.description}</span>
									</span>
									<span class="flex shrink-0 items-center gap-2">
										{#if cnt}
											<span
												class="rounded-full bg-accent-mint px-1.5 py-0.5 text-[11px] font-medium text-white"
												>{cnt}</span
											>
										{/if}
										<span class="text-slate-400">{open ? '▾' : '▸'}</span>
									</span>
								</button>
								{#if open && g.themes.length}
									<div
										class="border-t border-slate-100 p-3"
										transition:slide={{ duration: 180 }}
									>
										<div class="flex flex-wrap gap-1.5">
											{#each g.themes as theme (theme.id)}
												{@render chip(
													themes.includes(theme.id),
													titleCase(theme.id),
													theme.description,
													() => toggleTheme(theme.id),
													'border-accent-mint bg-accent-mint text-white'
												)}
											{/each}
										</div>
										<!-- Subthemes — one block per selected theme that has them -->
										{#each g.themes as theme (theme.id)}
											{#if themes.includes(theme.id) && theme.subthemes?.length}
												<div class="mt-2 rounded-md bg-slate-50 p-2.5">
													<p class="mb-1.5 text-xs text-slate-400">
														↳ {titleCase(theme.id)} subthemes
													</p>
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
												</div>
											{/if}
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</section>
			</div>
		</div>
		</div>
		</Tooltip.Provider>

		<!-- Technical notes — kept off the review card so it stays streamlined. -->
		<div
			class="flex flex-row items-center justify-between bg-secondary p-2 font-mono text-xs text-muted-foreground"
		>
			<div class="flex flex-row gap-4">
				<span>{segment.word_count} words</span>
				{#if segment.char_start != null}
					<span>chars {segment.char_start}–{segment.char_end}</span>
				{/if}
				{#if segment.question_id}
					<span class="text-accent-mint">{segment.question_id}</span>
				{/if}
				{#if segment.flags.includes('merged')}
					<span class="text-violet-600">merged</span>
				{/if}
				{#if segment.flags.includes('very_short')}
					<span class="text-amber-600">very short</span>
				{/if}
			</div>
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

		<!-- Footer -->
		<div class="flex items-center justify-between gap-3 border-t border-slate-200 px-5">
			<span class="text-xs text-muted-foreground">{tagCount} tag{tagCount === 1 ? '' : 's'} applied</span>
		</div>
	</aside>

	<!-- New-theme dialog — opened from the right-click "New theme from…" item.
		 Lets the reviewer give the new theme a real id, description, and group
		 instead of dumping the raw selection into the codebook. -->
	<Dialog.Root bind:open={newThemeOpen}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>New theme</Dialog.Title>
				<Dialog.Description>
					“{newThemeSeed}” becomes the first term of the new theme.
				</Dialog.Description>
			</Dialog.Header>
			<form
				class="flex flex-col gap-3"
				onsubmit={(e) => {
					e.preventDefault();
					submitNewTheme();
				}}
			>
				<label class="flex flex-col gap-1 text-xs">
					<span class="font-medium text-slate-600">Id</span>
					<input
						type="text"
						bind:value={newThemeId}
						class="rounded border border-slate-200 px-2 py-1 font-mono text-sm focus:border-slate-400 focus:outline-none"
						placeholder="snake_case_id"
					/>
				</label>
				<label class="flex flex-col gap-1 text-xs">
					<span class="font-medium text-slate-600">Description</span>
					<textarea
						bind:value={newThemeDescription}
						rows="3"
						class="rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
						placeholder="What does this theme cover?"
					></textarea>
				</label>
				<label class="flex flex-col gap-1 text-xs">
					<span class="font-medium text-slate-600">Group</span>
					<select
						bind:value={newThemeGroup}
						class="rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
					>
						<option value="">Pick a group…</option>
						{#each tagGroups as g (g.id)}
							<option value={g.id}>{g.label}</option>
						{/each}
					</select>
				</label>
				{#if errorMsg}
					<p class="text-xs text-rose-600">{errorMsg}</p>
				{/if}
				<div class="flex justify-end gap-2 pt-1">
					<Button type="button" variant="ghost" size="sm" onclick={() => (newThemeOpen = false)}>
						Cancel
					</Button>
					<Button type="submit" size="sm" disabled={lexBusy}>
						{lexBusy ? 'Creating…' : 'Create theme'}
					</Button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Root>

	<!-- Tertiary drawers — keyword tagging and phrase linking. Open from the
		 right-click menu; stack above the segment drawer (z-60/70). -->
	<KeywordTagDrawer
		bind:open={keywordDrawerOpen}
		selection={tertiarySelection}
		categories={lexicon.categories}
		busy={lexBusy}
		{errorMsg}
		onapplyVariant={(keywordId) =>
			applyFromKeywordDrawer('add_keyword_variant', { keyword_id: keywordId })}
		oncreate={(categoryId) =>
			applyFromKeywordDrawer('create_keyword', { category_id: categoryId })}
	/>
	<PhraseLinkDrawer bind:open={phraseDrawerOpen} selection={tertiarySelection} />
{/if}

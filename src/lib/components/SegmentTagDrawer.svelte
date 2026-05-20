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
	import { EMOTION_PICKER, PLUTCHIK_DYADS } from '$lib/journeymapper2/plutchikEmotionsConfig.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import KeywordText from '$lib/components/KeywordText.svelte';
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

	// --- Emotion colour helpers -----------------------------------------------
	// Intensity chips use three shades of the primary's base colour; a dyad
	// blends its two primaries into a gradient, matching the keyword constellation.
	type Rgb = { r: number; g: number; b: number };
	function hexToRgb(hex: string): Rgb {
		let h = hex.replace('#', '');
		if (h.length === 3)
			h = h
				.split('')
				.map((c) => c + c)
				.join('');
		return {
			r: parseInt(h.slice(0, 2), 16),
			g: parseInt(h.slice(2, 4), 16),
			b: parseInt(h.slice(4, 6), 16)
		};
	}
	const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
		r: Math.round(a.r + (b.r - a.r) * t),
		g: Math.round(a.g + (b.g - a.g) * t),
		b: Math.round(a.b + (b.b - a.b) * t)
	});
	const rgbCss = ({ r, g, b }: Rgb) => `rgb(${r} ${g} ${b})`;
	const WHITE: Rgb = { r: 255, g: 255, b: 255 };
	const BLACK: Rgb = { r: 0, g: 0, b: 0 };
	// Black or white text, whichever reads better on the given fill.
	const textOn = (rgb: Rgb) =>
		(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255 > 0.6 ? '#1e293b' : '#ffffff';

	// low / medium / high shades of one primary emotion's base colour.
	function emotionShades(hex: string): Record<string, Rgb> {
		const base = hexToRgb(hex);
		return { low: mixRgb(base, WHITE, 0.6), medium: base, high: mixRgb(base, BLACK, 0.34) };
	}

	// Dyad label -> the two primaries it blends, for the blend gradient.
	const dyadColors = new Map<string, { c1: string; c2: string }>();
	for (const group of Object.values(PLUTCHIK_DYADS) as {
		label: string;
		color_1: string;
		color_2: string;
	}[][]) {
		for (const d of group) dyadColors.set(d.label, { c1: d.color_1, c2: d.color_2 });
	}
	const dyadGradient = (id: string) => {
		const d = dyadColors.get(id);
		return d ? `linear-gradient(135deg, ${d.c1}, ${d.c2})` : '#475569';
	};

	// Resolved fill for any emotion id — a shade for an intensity level, a
	// gradient for a dyad — so the selected-emotion summary pills match the
	// picker chips that set them.
	type EmotionStyle = { background: string; color: string; gradient: boolean };
	const emotionStyle = new Map<string, EmotionStyle>();
	for (const p of EMOTION_PICKER as EmotionPrimary[]) {
		const shades = emotionShades(p.color);
		for (const lvl of p.levels) {
			const rgb = shades[lvl.intensity];
			emotionStyle.set(lvl.id, { background: rgbCss(rgb), color: textOn(rgb), gradient: false });
		}
	}
	for (const [label] of dyadColors) {
		emotionStyle.set(label, { background: dyadGradient(label), color: '#ffffff', gradient: true });
	}
	const styleFor = (id: string): EmotionStyle =>
		emotionStyle.get(id) ?? { background: '#475569', color: '#ffffff', gradient: false };

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

	// Inline edit-selection state — when the reviewer chooses "Edit selection"
	// from the right-click menu, the highlighted phrase becomes editable below
	// the quote. `currentText` mirrors segment.text so the drawer reflects the
	// edit immediately, without waiting for the parent to re-seed.
	let currentText = $state('');
	let editingSelection = $state(false);
	let editFind = $state('');
	let editReplace = $state('');
	let editBusy = $state(false);

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
								<!-- Keywords — each category is its own submenu of keywords -->
								<ContextMenu.Group>
									<ContextMenu.GroupHeading>As a keyword</ContextMenu.GroupHeading>
									{#each lexicon.categories as cat (cat.id)}
										<ContextMenu.Sub>
											<ContextMenu.SubTrigger>{cat.label}</ContextMenu.SubTrigger>
											<ContextMenu.SubContent side="left" class="max-h-80">
												{#each cat.keywords as kw (kw.id)}
													<ContextMenu.Item
														onSelect={() =>
															applyLexicon('add_keyword_variant', { keyword_id: kw.id })}
													>
														{kw.label}
													</ContextMenu.Item>
												{/each}
												<ContextMenu.Separator />
												<ContextMenu.Item
													onSelect={() => applyLexicon('create_keyword', { category_id: cat.id })}
												>
													New keyword from “{truncate(selectionText, 20)}”
												</ContextMenu.Item>
											</ContextMenu.SubContent>
										</ContextMenu.Sub>
									{/each}
								</ContextMenu.Group>
								<ContextMenu.Separator />
								<!-- Key phrases — canonical labels that unify disparate
									 phrasings under one concept. -->
								<ContextMenu.Group>
									<ContextMenu.GroupHeading>As a key phrase</ContextMenu.GroupHeading>
									{#each keyPhrases as kp (kp.id)}
										<ContextMenu.Item
											onSelect={() =>
												applyPhrase('add_phrase_variant', { key_phrase_id: kp.id })}
										>
											{kp.label}
											<span class="ml-auto text-[10px] text-slate-400"
												>{kp.variants.length}</span
											>
										</ContextMenu.Item>
									{/each}
									{#if keyPhrases.length}
										<ContextMenu.Separator />
									{/if}
									<ContextMenu.Item onSelect={() => applyPhrase('create_key_phrase', {})}>
										New key phrase from “{truncate(selectionText, 22)}”
									</ContextMenu.Item>
								</ContextMenu.Group>
								<ContextMenu.Separator />
								<!-- Add as theme — one submenu per tag group, mirroring the
									 grouped tag panel on the right. -->
								<ContextMenu.Group>
									<ContextMenu.GroupHeading>As a theme</ContextMenu.GroupHeading>
									{#each grouped as g (g.id)}
										{#if g.themes.length}
											<ContextMenu.Sub>
												<ContextMenu.SubTrigger>{g.label}</ContextMenu.SubTrigger>
												<ContextMenu.SubContent side="left" class="max-h-80">
													{#each g.themes as theme (theme.id)}
														<ContextMenu.Item
															onSelect={() =>
																applyLexicon('add_theme_term', { theme_id: theme.id })}
														>
															{titleCase(theme.id)}
														</ContextMenu.Item>
													{/each}
												</ContextMenu.SubContent>
											</ContextMenu.Sub>
										{/if}
									{/each}
									<ContextMenu.Separator />
									<ContextMenu.Item onSelect={() => applyLexicon('create_theme', {})}>
										New theme from “{truncate(selectionText, 22)}”
									</ContextMenu.Item>
								</ContextMenu.Group>
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
					<div class="flex gap-1.5">
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
											class="h-7 flex-1 rounded-md border transition-all
												{sentiment === s.v
												? 'ring-2 ring-slate-900 ring-offset-1'
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
								{@const st = styleFor(e)}
								<button
									type="button"
									title={emotionDesc.get(e) ?? ''}
									onclick={() => (emotions = emotions.filter((x) => x !== e))}
									class="flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium"
									style="background: {st.background}; color: {st.color};
										{st.gradient ? 'text-shadow: 0 1px 2px rgba(0,0,0,.55);' : ''}"
								>
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
							{@const shades = emotionShades(p.color)}
							<div class="mt-2 rounded-md bg-slate-50 p-2.5" transition:slide={{ duration: 180 }}>
								<!-- Intensity — low / medium / high, each a shade of the emotion -->
								{@render subLabel('Intensity')}
								<div class="flex flex-wrap gap-1.5">
									{#each p.levels as lvl (lvl.id)}
										{@const on = emotions.includes(lvl.id)}
										{@const rgb = shades[lvl.intensity]}
										<button
											type="button"
											title={emotionDesc.get(lvl.id) ?? ''}
											onclick={() => (emotions = toggle(emotions, lvl.id))}
											aria-pressed={on}
											class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all
												{on
												? 'border-transparent'
												: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}"
											style={on
												? `background: ${rgbCss(rgb)}; color: ${textOn(rgb)};`
												: ''}
										>
											<span
												class="size-2.5 rounded-full border border-black/10"
												style="background: {rgbCss(rgb)}"
											></span>
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
																class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all
																	{on
																	? 'border-transparent text-white'
																	: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}"
																style={on
																	? `background: ${dyadGradient(
																			d.id
																		)}; text-shadow: 0 1px 2px rgba(0,0,0,.55);`
																	: ''}
															>
																<span
																	class="size-2.5 rounded-full border border-black/10"
																	style="background: {dyadGradient(d.id)}"
																></span>
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
									class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-50"
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
{/if}

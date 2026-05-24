<!--
	Fingerprint — one interviewee's distinctive theme profile.

	The themes a single participant raised, pooled across every interview
	question, drawn as a SortableBarChart, plus a word cloud of their spoken
	vocabulary. Reached from the upload page's post-tag modal; the participant
	row lets you browse the other interviewees.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button } from "$lib/components/ui/button/index.ts";
	import {
		annotations,
		buildRadialTree,
		subthemeLabel,
		segments,
		segmentsForTheme,
		segmentsForSubtheme,
		segmentsForKeyword,
		themedParticipantIds,
		participantLabel,
		titleCase,
		themeTags,
		questions,
		questionLabel,
		SENTIMENT_LABELS,
		type RadialNode
	} from '$lib/content/wctglpdemo-data/analysis';
	import RadialThemeChart from '$lib/charts/glp/RadialThemeChart.svelte';
	import SentimentDonut from '$lib/components/SentimentDonut.svelte';
	import WordCloud, {
		type WordCloudDatum,
		type CloudShape,
		type CuratedWord
	} from '$lib/charts/glp/WordCloud.svelte';
	import { participantWords, type CloudWord } from '$lib/content/wctglpdemo-data/word-frequency';
	import { scaleLinear } from 'd3-scale';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import KeyQuotesSection from '$lib/components/KeyQuotesSection.svelte';
	import ParticipantDrawer from '$lib/components/ParticipantDrawer.svelte';
	import CodedFragmentCard from '$lib/components/CodedFragmentCard.svelte';
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import StatBlock from '$lib/components/StatBlock.svelte';
	import { profileName, participantBio } from '$lib/types/participant-profile';
	import type { PageProps } from './$types';
	import { ArrowRight, ChevronDown, Check } from '@lucide/svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';

	let { data }: PageProps = $props();

	// Participant profiles, seeded from the server load and updated locally
	// when the drawer persists an edit.
	let profiles = $state(untrack(() => data.participantProfiles));

	// Analyst-starred segments — seeded from the server, updated on each toggle.
	let starredSegments = $state(new Set<string>(untrack(() => data.starredSegmentIds)));
	let togglingSegment = $state('');

	async function toggleSegmentStar(segmentId: string) {
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
			}
		} finally {
			togglingSegment = '';
		}
	}

	// --- Participant details drawer ---
	let participantDrawerOpen = $state(false);
	let participantDrawerId = $state<string | null>(null);

	function openParticipant(id: string) {
		participantDrawerId = id;
		participantDrawerOpen = true;
	}

	let selectedParticipant = $state(
		data.interview ?? themedParticipantIds[themedParticipantIds.length - 1] ?? ''
	);

	// Tabs over the same participant: profile facts, starred quotes, vocabulary,
	// themes. Participant strip + identity header stay above the tabs so switching
	// tabs doesn't disrupt who you're looking at.
	let activeTab = $state<'profile' | 'quotes' | 'vocabulary' | 'themes'>('profile');

	// Demographic key/value rows for the expanded Profile tab. Falls back to "—"
	// where the analyst hasn't filled the field in yet.
	const demographics = $derived.by(() => {
		const p = profiles[selectedParticipant];
		const typeLabel = p?.participant_type === 'composite' ? 'Composite persona' : 'Individual';
		return [
			{ label: 'Age', value: p?.age_range ? p.age_range.replace(/-/g, '–') : '—' },
			{ label: 'Gender', value: p?.gender ? titleCase(p.gender) : '—' },
			{ label: 'Country', value: p?.country?.trim() || '—' },
			{ label: 'Type', value: typeLabel }
		];
	});

	// Three-level tree (themes -> subthemes -> keywords) filtered to the
	// selected participant — passed straight into the zoomable RadialThemeChart.
	const radialTree = $derived(
		buildRadialTree(
			(a) => a.interview_id === selectedParticipant,
			(m) => m.interview_id === selectedParticipant
		)
	);

	// Flat subtheme rows (across all themes) for the bio/header readout.
	const fingerprintSubthemes = $derived(
		radialTree.flatMap((t) =>
			(t.children ?? []).map((s) => ({ label: s.label, count: s.count }))
		)
	);
	const themeCount = $derived(fingerprintSubthemes.length);
	const segmentCount = $derived(fingerprintSubthemes.reduce((n, b) => n + b.count, 0));

	// Programmatic prose bio — demographics plus the participant's top themes.
	const bio = $derived(
		participantBio(
			profiles[selectedParticipant],
			participantLabel(selectedParticipant),
			fingerprintSubthemes.map((b) => b.label),
			segmentCount
		)
	);

	// --- Word cloud — the participant's spoken vocabulary ---
	// 'common' sizes by raw frequency; 'distinctive' surfaces the words this
	// participant over-indexes on versus the other interviewees.
	let wordMode = $state<'common' | 'distinctive'>('common');

	// Scope the cloud to a theme/subtheme OR a question — the two axes are
	// mutually exclusive. 'all' = no constraint on that axis.
	let filterTheme = $state('all');
	let filterSubtheme = $state('all');
	let filterQuestion = $state('all');

	// Which axis is currently constraining the cloud — used to grey out the other.
	const themeFilterActive = $derived(filterTheme !== 'all' || filterSubtheme !== 'all');
	const questionFilterActive = $derived(filterQuestion !== 'all');
	const hasActiveFilter = $derived(themeFilterActive || questionFilterActive);

	// Every annotation for the selected participant — the source for which
	// themes/subthemes are actually available to filter on.
	const participantAnnotations = $derived(
		annotations.filter((a) => a.interview_id === selectedParticipant)
	);
	const presentSubthemes = $derived(
		new Set(participantAnnotations.flatMap((a) => a.subthemes))
	);

	// Filter options, restricted to what this participant actually has so we
	// never offer a choice that yields an empty cloud. The theme menu nests each
	// theme's present subthemes (the right-click tagger's theme→subtheme shape).
	const availableThemes = $derived.by(() => {
		const present = new Set(participantAnnotations.flatMap((a) => a.themes));
		return themeTags.filter((t) => present.has(t.id));
	});
	const themeMenu = $derived(
		availableThemes.map((t) => ({
			id: t.id,
			label: t.label ?? titleCase(t.id),
			subthemes: (t.subthemes ?? []).filter((s) => presentSubthemes.has(s.id))
		}))
	);
	const availableQuestions = $derived.by(() => {
		const present = new Set(
			segments
				.filter(
					(s) =>
						s.interview_id === selectedParticipant && s.speaker === 'participant' && s.question_id
				)
				.map((s) => s.question_id as string)
		);
		return questions.filter((q) => present.has(q.question_id));
	});

	// Switching participants can strand a selection on an option that no longer
	// exists — fall back to 'all' when that happens.
	$effect(() => {
		if (filterTheme !== 'all' && !availableThemes.some((t) => t.id === filterTheme))
			filterTheme = 'all';
	});
	$effect(() => {
		if (filterSubtheme !== 'all' && !presentSubthemes.has(filterSubtheme)) filterSubtheme = 'all';
	});
	$effect(() => {
		if (filterQuestion !== 'all' && !availableQuestions.some((q) => q.question_id === filterQuestion))
			filterQuestion = 'all';
	});

	// Selecting on one axis clears the other so the two never apply at once.
	function selectTheme(themeId: string) {
		filterTheme = themeId;
		filterSubtheme = 'all';
		filterQuestion = 'all';
	}
	function selectSubtheme(themeId: string, subthemeId: string) {
		filterTheme = themeId;
		filterSubtheme = subthemeId;
		filterQuestion = 'all';
	}
	function selectQuestion(questionId: string) {
		filterQuestion = questionId;
		filterTheme = 'all';
		filterSubtheme = 'all';
	}
	function clearFilters() {
		filterTheme = 'all';
		filterSubtheme = 'all';
		filterQuestion = 'all';
	}

	// Trigger labels for the two filter dropdowns.
	const themeTriggerLabel = $derived.by(() => {
		const themeLabel =
			filterTheme !== 'all' ? (themeLabelById.get(filterTheme) ?? titleCase(filterTheme)) : '';
		if (filterSubtheme !== 'all')
			return themeLabel ? `${themeLabel} › ${subthemeLabel(filterSubtheme)}` : subthemeLabel(filterSubtheme);
		return themeLabel || 'All themes';
	});
	const questionTriggerLabel = $derived(
		filterQuestion !== 'all' ? questionLabel(filterQuestion) : 'All questions'
	);

	// Shared look for the two filter triggers — a bordered "select" that opens a
	// menu window.
	const filterTriggerClass =
		'inline-flex items-center gap-2 rounded-md border border-(--ink)/15 bg-(--paper) px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-(--ink)/5 disabled:cursor-not-allowed disabled:opacity-40';

	const participantCloud = $derived(
		participantWords(selectedParticipant, {
			mode: wordMode,
			limit: 60,
			filter: {
				theme: filterTheme === 'all' ? null : filterTheme,
				subtheme: filterSubtheme === 'all' ? null : filterSubtheme,
				question: filterQuestion === 'all' ? null : filterQuestion
			}
		})
	);
	const WORD_MODES: { id: 'common' | 'distinctive'; label: string }[] = [
		{ id: 'common', label: 'Most common' },
		{ id: 'distinctive', label: 'Most distinctive' }
	];

	// --- Cloud display controls ---
	let cloudShape = $state<CloudShape>('circle');
	let autoSize = $state(true);
	let sizeBoost = $state(1);
	let minFont = $state(12);
	let maxFont = $state(34);
	let cloudRef = $state<WordCloud>();
	let curatedWords = $state<CuratedWord[]>([]);

	const CLOUD_SHAPES: { id: CloudShape; label: string }[] = [
		{ id: 'circle', label: 'Circle' },
		{ id: 'square', label: 'Square' },
		{ id: 'wide-rectangle', label: 'Wide' }
	];

	// Diverging colour for a word's average sentiment: rose (negative) →
	// slate (neutral) → emerald (positive), echoing the bar chart's palette.
	const sentimentColor = scaleLinear<string>()
		.domain([-2, 0, 2])
		.range(['#e11d48', '#94a3b8', '#059669'])
		.clamp(true);

	// Negative / neutral / positive tagged-segment counts for the selected
	// participant, taken from the per-segment annotations.
	const sentimentCounts = $derived.by(() => {
		const counts = { negative: 0, neutral: 0, positive: 0 };
		for (const a of annotations) {
			if (a.interview_id !== selectedParticipant) continue;
			if (a.sentiment < 0) counts.negative++;
			else if (a.sentiment > 0) counts.positive++;
			else counts.neutral++;
		}
		return counts;
	});

	const sentimentTotal = $derived(
		sentimentCounts.negative + sentimentCounts.neutral + sentimentCounts.positive
	);
	const sentimentPct = $derived({
		pos: sentimentTotal ? Math.round((sentimentCounts.positive / sentimentTotal) * 100) : 0,
		neu: sentimentTotal ? Math.round((sentimentCounts.neutral / sentimentTotal) * 100) : 0,
		neg: sentimentTotal ? Math.round((sentimentCounts.negative / sentimentTotal) * 100) : 0
	});

	function select(id: string) {
		selectedParticipant = id;
		// Keep the URL shareable/refreshable without a full navigation.
		goto(`?interview=${id}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	// --- Node drawer (theme / subtheme / keyword) ---
	/** Theme id -> pretty label, for the word-cloud tooltip. */
	const themeLabelById = new Map(
		themeTags.map((t) => [t.id, t.label ?? titleCase(t.id)] as const)
	);

	let themeDrawerOpen = $state(false);
	let drawerNode = $state<RadialNode | null>(null);

	function openNodeDrawer(node: RadialNode) {
		drawerNode = node;
		themeDrawerOpen = true;
	}

	/**
	 * Click a word in the cloud → open the drawer for that word's dominant
	 * subtheme (the subtheme most often tagged on the segments where the
	 * selected participant used the word). Words with no tagged segments fall
	 * through silently.
	 */
	function openWordDrawer(d: WordCloudDatum) {
		const w = d as CloudWord;
		if (!w.subtheme) return;
		drawerNode = {
			id: w.subtheme,
			label: subthemeLabel(w.subtheme),
			kind: 'subtheme',
			count: 0,
			blocks: []
		};
		themeDrawerOpen = true;
	}

	/** Bucket the average sentiment (-2..2) into the named bands. */
	function sentimentBand(s: number): string {
		const rounded = Math.max(-2, Math.min(2, Math.round(s)));
		return SENTIMENT_LABELS[rounded];
	}

	// Every segment for the open node, scoped to the selected participant.
	const drawerFragments = $derived.by(() => {
		const n = drawerNode;
		if (!n) return [];
		if (n.kind === 'theme')
			return segmentsForTheme(n.id, (a) => a.interview_id === selectedParticipant);
		if (n.kind === 'subtheme')
			return segmentsForSubtheme(n.id, (a) => a.interview_id === selectedParticipant);
		return segmentsForKeyword(n.id, (m) => m.interview_id === selectedParticipant);
	});

	const drawerLabel = $derived(drawerNode?.label ?? '');
	const drawerKindLabel = $derived(
		drawerNode?.kind === 'keyword'
			? 'Keyword'
			: drawerNode?.kind === 'subtheme'
				? 'Subtheme'
				: drawerNode?.kind === 'theme'
					? 'Theme'
					: ''
	);

	// `id` of the chart row whose drawer is open, so it stays highlighted.
	const selectedRow = $derived(themeDrawerOpen && drawerNode ? drawerNode.id : null);

</script>

<div class="flex flex-1 flex-col">
	<!-- Hero -->
	<div
		class="flex h-48 w-full flex-col justify-center bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten"
	>
		<div class="mx-auto flex w-full max-w-7xl flex-col gap-2 px-8">
			<span class="figcaption text-white">In their own words · Fingerprint</span>
			<h1 class="font-heading text-4xl font-light capitalize text-primary-foreground md:text-5xl">
				Each patient's fingerprint
			</h1>
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 py-14">
		{#if themedParticipantIds.length}
			<!-- Participant browser -->
			<div class="flex flex-col gap-3 border-b border-(--ink)/15 pb-5">
				<span class="figcaption text-accent-mint">
					Narrative Explorer
				</span>
				<div class="flex flex-wrap gap-2">
					{#each themedParticipantIds as id (id)}
						<Button
							variant="secondary"
							class="flex items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm transition-colors duration-350
								{selectedParticipant === id
								? 'border-(--orange) bg-(--orange) text-(--paper)'
								: 'border-(-muted) bg-(-muted) text-foreground hover:bg-(--ink)/5'}"
							aria-pressed={selectedParticipant === id}
							onclick={() => select(id)}
						>
							<ParticipantAvatar interviewId={id} size="sm" />
							{profileName(profiles[id], participantLabel(id))}
						</Button>
					{/each}
				</div>
			</div>

			<!-- The selected participant — tabbed view -->
			<Tabs.Root value={activeTab} onValueChange={(v) => (activeTab = v as typeof activeTab)}>
				<Tabs.List variant="line" class="w-full justify-start gap-4 border-b border-(--ink)/15">
					<Tabs.Trigger value="profile">Profile</Tabs.Trigger>
					<Tabs.Trigger value="quotes">Key Quotes</Tabs.Trigger>
					<Tabs.Trigger value="vocabulary">Vocabulary</Tabs.Trigger>
					<Tabs.Trigger value="themes">Themes</Tabs.Trigger>
				</Tabs.List>

				<!-- Profile tab — expanded identity, demographics, and tagging activity -->
				<Tabs.Content value="profile" class="flex flex-col gap-10 pt-10">
					<header class="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
						<ParticipantAvatar
							interviewId={selectedParticipant}
							size="lg"
							src={profiles[selectedParticipant]?.avatar_url}
						/>
						<div class="flex min-w-0 flex-1 flex-col gap-4">
							<h2 class="font-heading text-4xl font-light uppercase text-primary md:text-5xl">
								{profileName(profiles[selectedParticipant], participantLabel(selectedParticipant))}
							</h2>
							<div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
								<p class="flex-1 text-lg leading-8 text-muted-foreground">
									{bio}
								</p>
								<dl class="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-md bg-(--ink)/15">
									{#each demographics as item (item.label)}
										<div class="flex flex-col gap-1 bg-(--paper) p-4">
											<dt class="text-xs uppercase tracking-wide text-muted-foreground">
												{item.label}
											</dt>
											<dd class="text-base font-medium text-foreground">{item.value}</dd>
										</div>
									{/each}
								</dl>
							</div>
							<Button
								variant="default"
								class="self-start"
								onclick={() => openParticipant(selectedParticipant)}
								title="View participant details"
							>
								View Participant Details
								<ArrowRight />
							</Button>
						</div>
					</header>

					<!-- Tagging activity — bigger numbered cards instead of chips -->
					<section class="flex flex-col gap-3">
						<h3 class="figcaption text-accent-mint">Tagging activity</h3>
						<div class="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-(--ink)/15 md:grid-cols-5">
							<StatBlock value={themeCount} label={themeCount === 1 ? 'theme' : 'themes'} />
							<StatBlock value={segmentCount} label="tagged {segmentCount === 1 ? 'segment' : 'segments'}" />
							<StatBlock
								value={sentimentCounts.negative}
								label="negative"
								fraction={sentimentTotal ? sentimentCounts.negative / sentimentTotal : 0}
								valueClass="text-rose-700"
								labelClass="text-rose-700/70"
								barClass="bg-rose-500"
								class="bg-rose-50"
							/>
							<StatBlock
								value={sentimentCounts.neutral}
								label="neutral"
								fraction={sentimentTotal ? sentimentCounts.neutral / sentimentTotal : 0}
								valueClass="text-slate-700"
								labelClass="text-slate-700/70"
								barClass="bg-slate-400"
								class="bg-slate-50"
							/>
							<StatBlock
								value={sentimentCounts.positive}
								label="positive"
								fraction={sentimentTotal ? sentimentCounts.positive / sentimentTotal : 0}
								valueClass="text-emerald-700"
								labelClass="text-emerald-700/70"
								barClass="bg-emerald-500"
								class="bg-emerald-50"
							/>
						</div>
						{#if sentimentTotal > 0}
							<div class="flex items-center gap-5 rounded-md bg-(--paper) py-2">
								<SentimentDonut
									positive={sentimentCounts.positive}
									neutral={sentimentCounts.neutral}
									negative={sentimentCounts.negative}
									size={72}
									motionMode="dashboard"
									showTotal
								/>
								<div class="flex flex-1 flex-col gap-2">
									<div class="flex h-2.5 w-full overflow-hidden rounded-full">
										<div class="bg-emerald-400" style="width: {sentimentPct.pos}%"></div>
										<div class="bg-slate-200" style="width: {sentimentPct.neu}%"></div>
										<div class="bg-rose-400" style="width: {sentimentPct.neg}%"></div>
									</div>
									<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
										<span class="flex items-center gap-1.5">
											<span class="size-2 rounded-full bg-emerald-400"></span>
											Positive · {sentimentCounts.positive} ({sentimentPct.pos}%)
										</span>
										<span class="flex items-center gap-1.5">
											<span class="size-2 rounded-full bg-slate-200 ring-1 ring-slate-300"></span>
											Neutral · {sentimentCounts.neutral} ({sentimentPct.neu}%)
										</span>
										<span class="flex items-center gap-1.5">
											<span class="size-2 rounded-full bg-rose-400"></span>
											Negative · {sentimentCounts.negative} ({sentimentPct.neg}%)
										</span>
									</div>
								</div>
							</div>
						{/if}
					</section>
				</Tabs.Content>

				<!-- Key Quotes tab -->
				<Tabs.Content value="quotes" class="flex flex-col gap-6 pt-10">
					<KeyQuotesSection
						starredQuoteIds={data.starredQuoteIds}
						starredSegmentIds={[...starredSegments]}
						{profiles}
						onparticipant={openParticipant}
						participantId={selectedParticipant}
					/>
				</Tabs.Content>

				<!-- Vocabulary tab — word cloud + scope filters + shape + legend -->
				<Tabs.Content value="vocabulary" class="flex flex-col gap-4 pt-10">
					<div class="flex flex-col p-5">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div class="flex flex-col gap-0.5">
							<span class="figcaption text-accent-mint">
								In their own words
							</span>
							
							<p class="caption text-muted-foreground">
								{participantCloud.totalWords} counted words · {participantCloud.uniqueWords} unique ·
								{participantCloud.hapaxWords.length} said just once
							</p>
						</div>
						<div class="flex flex-row gap-1" role="group">
							{#each WORD_MODES as opt (opt.id)}
								<Button
									variant="secondary"
									class="px-2.5 py-1.5 text-xs font-medium transition-colors duration-150
										{wordMode === opt.id
										? 'bg-(--darkgrayblue) text-(--paper)'
										: 'bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
									aria-pressed={wordMode === opt.id}
									onclick={() => (wordMode = opt.id)}
								>
									{opt.label}
								</Button>
							{/each}
						</div>
					</div>

					<!-- Scope filters — narrow the cloud to a theme/subtheme OR a question.
						 The two axes are mutually exclusive: choosing one greys out the
						 other. Theme→subtheme uses the right-click tagger's nested menu. -->
					<div class="mt-3 flex flex-wrap items-end gap-3">
						<!-- Theme / subtheme -->
						<div class="flex flex-col gap-1">
							<span class="text-xs font-medium text-muted-foreground">Theme / subtheme</span>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger
									class={filterTriggerClass}
									disabled={questionFilterActive || !themeMenu.length}
								>
									<span class="max-w-56 truncate">{themeTriggerLabel}</span>
									<ChevronDown class="size-4 shrink-0 text-muted-foreground" />
								</DropdownMenu.Trigger>
								<DropdownMenu.Content class="max-h-80 w-64 overflow-y-auto" align="start">
									<DropdownMenu.Item onSelect={() => selectTheme('all')}>
										<span class="flex-1">All themes</span>
										{#if !themeFilterActive}<Check class="size-4 text-accent-mint" />{/if}
									</DropdownMenu.Item>
									<DropdownMenu.Separator />
									{#each themeMenu as t (t.id)}
										{#if t.subthemes.length}
											<DropdownMenu.Sub>
												<DropdownMenu.SubTrigger>{t.label}</DropdownMenu.SubTrigger>
												<DropdownMenu.SubContent class="max-h-80 w-60 overflow-y-auto">
													<DropdownMenu.Item onSelect={() => selectTheme(t.id)}>
														<span class="flex-1">All of {t.label}</span>
														{#if filterTheme === t.id && filterSubtheme === 'all'}
															<Check class="size-4 text-accent-mint" />
														{/if}
													</DropdownMenu.Item>
													<DropdownMenu.Separator />
													{#each t.subthemes as s (s.id)}
														<DropdownMenu.Item
															class="items-start"
															onSelect={() => selectSubtheme(t.id, s.id)}
														>
															<span class="flex-1 whitespace-normal">{s.label ?? titleCase(s.id)}</span>
															{#if filterSubtheme === s.id}<Check class="size-4 text-accent-mint" />{/if}
														</DropdownMenu.Item>
													{/each}
												</DropdownMenu.SubContent>
											</DropdownMenu.Sub>
										{:else}
											<DropdownMenu.Item onSelect={() => selectTheme(t.id)}>
												<span class="flex-1">{t.label}</span>
												{#if filterTheme === t.id && filterSubtheme === 'all'}
													<Check class="size-4 text-accent-mint" />
												{/if}
											</DropdownMenu.Item>
										{/if}
									{/each}
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>

						<span class="pb-1.5 text-xs text-muted-foreground">or</span>

						<!-- Question -->
						<div class="flex flex-col gap-1">
							<span class="text-xs font-medium text-muted-foreground">Question</span>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger
									class={filterTriggerClass}
									disabled={themeFilterActive || !availableQuestions.length}
								>
									<span class="max-w-72 truncate">{questionTriggerLabel}</span>
									<ChevronDown class="size-4 shrink-0 text-muted-foreground" />
								</DropdownMenu.Trigger>
								<DropdownMenu.Content class="max-h-80 w-80 overflow-y-auto" align="start">
									<DropdownMenu.Item onSelect={() => selectQuestion('all')}>
										<span class="flex-1">All questions</span>
										{#if !questionFilterActive}<Check class="size-4 text-accent-mint" />{/if}
									</DropdownMenu.Item>
									<DropdownMenu.Separator />
									{#each availableQuestions as q (q.question_id)}
										<DropdownMenu.Item
											class="items-start"
											onSelect={() => selectQuestion(q.question_id)}
										>
											<span class="flex-1 whitespace-normal">{questionLabel(q.question_id)}</span>
											{#if filterQuestion === q.question_id}
												<Check class="mt-0.5 size-4 shrink-0 text-accent-mint" />
											{/if}
										</DropdownMenu.Item>
									{/each}
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>

						{#if hasActiveFilter}
							<Button
								variant="secondary"
								class="px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-(--ink)/5"
								onclick={clearFilters}
							>
								Clear filters
							</Button>
						{/if}
					</div>

					<!-- Display controls — shape + sizing + font range + actions -->
					<div class="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3 border-t border-(--ink)/10 pt-3">
						<!-- Shape -->
						<div class="flex flex-col gap-1">
							<span class="text-xs font-medium text-muted-foreground">Shape</span>
							<div class="flex flex-row gap-1" role="group" aria-label="Cloud shape">
								{#each CLOUD_SHAPES as s (s.id)}
									<Button
										variant="secondary"
										class="px-2.5 py-1.5 text-xs font-medium transition-colors duration-150
											{cloudShape === s.id
											? 'bg-(--darkgrayblue) text-(--paper)'
											: 'bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
										aria-pressed={cloudShape === s.id}
										onclick={() => (cloudShape = s.id)}
									>
										{s.label}
									</Button>
								{/each}
							</div>
						</div>

						<!-- Sizing -->
						<div class="flex flex-col gap-1">
							<span class="text-xs font-medium text-muted-foreground">Size</span>
							<div class="flex items-center gap-3">
								<Button
									variant="secondary"
									class="px-2.5 py-1.5 text-xs font-medium transition-colors duration-150
										{autoSize
										? 'bg-(--darkgrayblue) text-(--paper)'
										: 'bg-(--paper) text-foreground hover:bg-(--ink)/5'}"
									aria-pressed={autoSize}
									onclick={() => (autoSize = !autoSize)}
									title="Scale text up when few words are shown, down when crowded"
								>
									Auto
								</Button>
								<label class="flex items-center gap-1.5 text-xs text-muted-foreground">
									Boost
									<input
										type="range"
										min="0.6"
										max="2"
										step="0.1"
										bind:value={sizeBoost}
										class="w-24 accent-(--darkgrayblue)"
									/>
									<span class="w-8 tabular-nums">{sizeBoost.toFixed(1)}×</span>
								</label>
							</div>
						</div>

						<!-- Font range -->
						<div class="flex flex-col gap-1">
							<span class="text-xs font-medium text-muted-foreground">Font range</span>
							<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
								<span>min</span>
								<input
									type="number"
									min="6"
									max="40"
									bind:value={minFont}
									class="w-14 rounded border border-(--ink)/15 bg-(--paper) px-1.5 py-1 text-foreground"
								/>
								<span>max</span>
								<input
									type="number"
									min="12"
									max="80"
									bind:value={maxFont}
									class="w-14 rounded border border-(--ink)/15 bg-(--paper) px-1.5 py-1 text-foreground"
								/>
							</div>
						</div>

						<!-- Action buttons -->
						<div class="flex items-end gap-1">
							<Button
								variant="secondary"
								class="px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-(--ink)/5"
								onclick={() => cloudRef?.cleanUp()}
								title="Adjust spacing to pull apart any overlapping words"
							>
								Clean up
							</Button>
							<Button
								variant="secondary"
								class="px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-(--ink)/5"
								onclick={() => cloudRef?.undo()}
								title="Undo the last merge or removal"
							>
								Undo
							</Button>
							<Button
								variant="secondary"
								class="px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-(--ink)/5"
								onclick={() => cloudRef?.restoreRemoved()}
								title="Bring trashed words back into the cloud"
							>
								Restore removed
							</Button>
							<Button
								variant="secondary"
								class="px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-(--ink)/5"
								onclick={() => cloudRef?.resetToSource()}
								title="Return words to the original layout"
							>
								↺ Reset
							</Button>
						</div>

						{#if curatedWords.length}
							<span class="pb-1.5 text-xs text-muted-foreground">
								{curatedWords.length} curated {curatedWords.length === 1 ? 'word' : 'words'} ready for export
							</span>
						{/if}

						<span
							class="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"
							title="Word colour = average sentiment of its segments"
						>
							<span>negative</span>
							<span
								class="h-2 w-20 rounded-full"
								style="background: linear-gradient(to right, #e11d48, #94a3b8, #059669)"
							></span>
							<span>positive</span>
						</span>
					</div>

					{#if participantCloud.words.length}
						<WordCloud
							bind:this={cloudRef}
							words={participantCloud.words}
							color={(d) => sentimentColor(d.sentiment ?? 0)}
							onpick={openWordDrawer}
							editable
							onchange={(w) => (curatedWords = w)}
							{cloudShape}
							{autoSize}
							{sizeBoost}
							minFontSize={Math.min(minFont, maxFont - 2)}
							maxFontSize={Math.max(maxFont, minFont + 2)}
						>
							{#snippet tooltip(d)}
								{@const w = d as CloudWord}
								{@const themeLabel = w.theme ? themeLabelById.get(w.theme) : null}
								{@const subLabel = w.subtheme ? subthemeLabel(w.subtheme) : null}
								<div
									class="rounded-md border border-slate-200 bg-secondary p-3 shadow-lg"
								>
									<div class="flex items-baseline justify-between gap-3">
										<p class="text-sm font-semibold text-slate-800">{w.text}</p>
										<span class="text-[10px] font-mono uppercase tracking-wide text-slate-400">
											×{w.count}
										</span>
									</div>
									{#if themeLabel || subLabel}
										<div class="mt-2 flex flex-col gap-0.5 text-xs text-slate-600">
											{#if themeLabel}
												<div>
													<span class="text-[10px] uppercase tracking-wide text-slate-400">Theme</span>
													<span class="ml-1">{themeLabel}</span>
												</div>
											{/if}
											{#if subLabel}
												<div>
													<span class="text-[10px] uppercase tracking-wide text-slate-400">Subtheme</span>
													<span class="ml-1">{subLabel}</span>
												</div>
											{/if}
										</div>
									{:else}
										<p class="mt-2 text-xs italic text-slate-400">
											Not tied to a tagged segment.
										</p>
									{/if}
									<div class="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
										<span
											class="size-2.5 shrink-0 rounded-full"
											style:background-color={sentimentColor(w.sentiment ?? 0)}
										></span>
										<span>{sentimentBand(w.sentiment ?? 0)}</span>
										<span class="ml-auto tabular-nums text-slate-400">
											{(w.sentiment ?? 0).toFixed(2)}
										</span>
									</div>
									{#if subLabel}
										<p class="mt-2 text-[10px] uppercase tracking-wide text-accent-mint">
											Click to open segments
										</p>
									{/if}
								</div>
							{/snippet}
						</WordCloud>
					{:else if hasActiveFilter}
						<p class="text-sm text-muted-foreground">
							No words match this filter for {participantLabel(selectedParticipant)}.
							<button class="text-accent-mint underline" onclick={clearFilters}>Clear filters</button>
						</p>
					{:else}
						<p class="text-sm text-muted-foreground">No words to show for this participant.</p>
					{/if}

					<p class="caption text-xs text-muted-foreground">
						{#if wordMode === 'common'}
							Word size = times spoken; function words and speech fillers are removed before
							counting.
						{:else}
							Word size = how strongly {participantLabel(selectedParticipant)} over-indexes on the
							word versus the other participants — their distinctive voice.
						{/if}
					</p>
				</div>
			</Tabs.Content>

			<!-- Themes tab -->
			<Tabs.Content value="themes" class="flex flex-col gap-4 pt-10">
				{#if radialTree.length}
					<RadialThemeChart
						tree={radialTree}
						unitLabel="segments tagged for {participantLabel(selectedParticipant)}"
						blockLabel="tagged segment"
						onselect={openNodeDrawer}
						selected={selectedRow}
					/>
				{:else}
					<p
						class="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500"
					>
						No themes tagged for {participantLabel(selectedParticipant)} yet. Tag its segments on
						the upload review page first.
					</p>
				{/if}
			</Tabs.Content>
		</Tabs.Root>
		{:else}
			<p
				class="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500"
			>
				No tagged interviews yet.
			</p>
		{/if}
	</div>
</div>

<!-- Participant details drawer -->
<ParticipantDrawer
	bind:open={participantDrawerOpen}
	interviewId={participantDrawerId}
	bind:profiles
/>

<!-- Theme drawer — the selected participant's segments for one theme -->
<RightDrawer bind:open={themeDrawerOpen}>
	<div class="flex h-full flex-col">
		<div class="flex flex-col gap-1 border-b border-muted p-6">
			<span class="figcaption text-accent-mint">
				{drawerKindLabel} · {profileName(profiles[selectedParticipant], participantLabel(selectedParticipant))}
			</span>
			<h2 class="font-heading text-3xl font-light uppercase text-primary">
				{drawerLabel}
			</h2>
			<p class="text-sm text-muted-foreground">
				{drawerFragments.length}
				{drawerNode?.kind === 'keyword' ? 'matched' : 'coded'}
				{drawerFragments.length === 1 ? 'segment' : 'segments'} · Starring segments will highlight
				them as key quotes across the Lab Book.
			</p>
		</div>

		<div class="flex flex-1 flex-col gap-3 overflow-y-auto p-6">
			{#each drawerFragments as f (f.segment_id)}
				<CodedFragmentCard
					fragment={f}
					{profiles}
					starred={starredSegments.has(f.segment_id)}
					togglingStar={togglingSegment === f.segment_id}
					onToggleStar={toggleSegmentStar}
				/>
			{:else}
				<p
					class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500"
				>
					No tagged quotes for this theme.
				</p>
			{/each}
		</div>
	</div>
</RightDrawer>

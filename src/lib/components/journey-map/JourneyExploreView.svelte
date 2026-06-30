<!--
	JourneyExploreView — third surface for a journey-map artifact (?view=explore).

	A quadrant-based map: HOME / DIAGNOSIS / TREATMENT / RESEARCH. Stages sit
	as clickable waypoints inside their assigned zone; a vocabulary of segment
	primitives (Straight / Fork / Roundabout / DeadEnd) renders the persona's
	route between them. Clicking a waypoint opens the stage drawer.

	Persona positions and segments come from explore-layouts.ts. Personas
	without a hand-authored layout get a fallback chain.

	NOTE: drawer renderer + helpers duplicate JourneyMapView's drawer code as
	an interim state. Follow-up commit unifies into a shared JourneyMapDrawer.

	No italics anywhere. No side-bordered rounded rects. Sharp corners.
-->
<script lang="ts">
	import type { Fragment } from '$lib/content/corpora/types';
	import type {
		Observation,
		ExternalObservation,
		DecisionPanelItem,
		StageMap,
		JourneyMapArtifact
	} from './types';
	import type { JourneyMap } from '$lib/content/journeys/types';
	import type { Point, SegmentSpec, MapZone } from './segments/types';
	import {
		EXPLORE_VIEWBOX,
		EXPLORE_ZONES,
		STAGE_ZONE_HEURISTIC,
		resolveExploreLayout
	} from './explore-layouts';
	import StraightSegment from './segments/StraightSegment.svelte';
	import ForkSegment from './segments/ForkSegment.svelte';
	import RoundaboutSegment from './segments/RoundaboutSegment.svelte';
	import DeadEndSegment from './segments/DeadEndSegment.svelte';
	import EmotionDyadChip from '$lib/components/EmotionDyadChip.svelte';
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import TertiaryDrawer from '$lib/components/TertiaryDrawer.svelte';
	import {
		Activity,
		AlertCircle,
		ArrowDown,
		ArrowUp,
		BookOpen,
		Briefcase,
		ClipboardList,
		DollarSign,
		FlaskConical,
		Home,
		Info,
		Minus,
		Pill,
		Search,
		Sparkles,
		Stethoscope,
		Users
	} from '@lucide/svelte';

	type Profile = { first_name?: string; last_initial?: string };

	type Props = {
		artifact: JourneyMapArtifact;
		fragmentsById: Record<string, Fragment>;
		journey: JourneyMap | null;
		profiles: Record<string, Profile>;
		showHeader?: boolean;
		showFooter?: boolean;
	};

	let {
		artifact,
		fragmentsById,
		journey,
		profiles,
		showHeader = true,
		showFooter = true
	}: Props = $props();

	const personaColor = $derived(artifact.meta.persona_color ?? '#446079');
	const indicationLabel = $derived(
		artifact.meta.journey_indication.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
	);

	// ---------------- Layout resolution ----------------

	const visitedStageIds = $derived(artifact.stages.map((s) => s.stage_id));
	const layout = $derived(
		resolveExploreLayout(artifact.meta.persona_id, visitedStageIds, STAGE_ZONE_HEURISTIC)
	);

	const stagesById = $derived.by(() => {
		const m: Record<string, StageMap> = {};
		for (const s of artifact.stages) m[s.stage_id] = s;
		return m;
	});

	const decisionPanelByStageId = $derived.by(() => {
		const m: Record<string, (typeof artifact.decision_panels)[number]> = {};
		for (const p of artifact.decision_panels) m[p.stage_id] = p;
		return m;
	});

	function resolveAnchor(idOrPoint: string | Point): Point | null {
		if (typeof idOrPoint === 'string') {
			const pos = layout.stagePositions[idOrPoint];
			return pos ?? null;
		}
		return idOrPoint;
	}

	// ---------------- Stage archetype → icon ----------------

	const STAGE_ICONS: Record<string, typeof Stethoscope> = {
		// LN
		pre_diagnosis: Home,
		diagnostic_odyssey: FlaskConical,
		induction_treatment: Pill,
		stable_maintenance: Pill,
		flare_or_refractory_cycle: AlertCircle,
		trial_consideration: ClipboardList,
		in_trial_experience: Stethoscope,
		post_trial: Sparkles,

		// GLP-1
		lifestyle_attempts: Activity,
		clinical_conversation: Stethoscope,
		glp1_initiation: Pill,
		active_weight_loss: Activity,
		weight_stabilization: Sparkles,
		discontinuation_consideration: AlertCircle,
		post_discontinuation: Search
		// trial_consideration shared with LN map above (ClipboardList)
	};

	function iconForStage(stage: StageMap): typeof Stethoscope {
		return STAGE_ICONS[stage.stage_id] ?? Activity;
	}

	// ---------------- Drawer state (duplicated from JourneyMapView) ----------------

	type PrimaryDrawerEntry =
		| { kind: 'observation'; obs: Observation; stageLabel: string; stepLabel: string | null }
		| {
				kind: 'external';
				ext: ExternalObservation;
				stageLabel: string;
				stepLabel: string | null;
		  }
		| {
				kind: 'decision_item';
				item: DecisionPanelItem;
				variant: 'driver' | 'barrier' | 'mixed';
				panelLabel: string;
		  }
		| { kind: 'stage'; stage: StageMap };

	let primaryDrawerOpen = $state(false);
	let primaryDrawer = $state<PrimaryDrawerEntry | null>(null);
	let keywordDrawerKw = $state<string | null>(null);

	function openPrimaryDrawer(entry: PrimaryDrawerEntry) {
		primaryDrawer = entry;
		primaryDrawerOpen = true;
	}

	function openKeywordDrawer(keyword: string) {
		keywordDrawerKw = keyword;
	}

	function closeKeywordDrawer() {
		keywordDrawerKw = null;
	}

	$effect(() => {
		if (!primaryDrawerOpen) {
			primaryDrawer = null;
			keywordDrawerKw = null;
		}
	});

	// ---------------- Helpers (duplicated from JourneyMapView) ----------------

	function speakerLabel(f: Fragment): string {
		const id =
			f.source_ref.kind === 'interview'
				? f.source_ref.interview_id
				: ((f.source_ref as { author_handle_hash?: string }).author_handle_hash ?? '?');
		const p = profiles[id] as Profile | undefined;
		if (p?.first_name) {
			return [p.first_name, p.last_initial ? `${p.last_initial}.` : ''].filter(Boolean).join(' ');
		}
		return id;
	}

	type Band = { label: string; dotBg: string; text: string };

	function sentimentBand(avg: number | null): Band {
		if (avg == null) return { label: 'Neutral', dotBg: '#A8A8A0', text: '#6E6E64' };
		if (avg >= 1.5) return { label: 'Very positive', dotBg: '#599077', text: '#3F6B58' };
		if (avg >= 0.5) return { label: 'Positive', dotBg: '#7DBFA7', text: '#3F6B58' };
		if (avg > -0.5) return { label: 'Neutral', dotBg: '#A8A8A0', text: '#6E6E64' };
		if (avg > -1.5) return { label: 'Negative', dotBg: '#CC6324', text: '#8A3F12' };
		return { label: 'Very negative', dotBg: '#8A3F12', text: '#5A2A0E' };
	}

	function polaritySwatch(p: Observation['polarity']): string {
		if (p === 'positive') return '#7DBFA7';
		if (p === 'negative') return '#CC6324';
		return '#6a99c2';
	}

	const ICON_RULES: { match: RegExp; Icon: typeof Stethoscope }[] = [
		{ match: /\b(specialist|doctor|nurse|physician|rheumatolog|nephrolog|PCP|clinic|hospital|admission)\b/i, Icon: Stethoscope },
		{ match: /\b(biopsy|scan|ultrasound|MRI|CT|x-ray|imaging|ANA|lab|panel|test|workup|creatinine|eGFR|proteinuria|albumin)\b/i, Icon: FlaskConical },
		{ match: /\b(drug|medication|Lupkynis|Saphnelo|Gazyva|mycophenolate|prednisone|steroid|rituximab|belimumab|biologic|infusion|chemo|fludarabine|cyclophosphamide)\b/i, Icon: Pill },
		{ match: /\b(fatigue|pain|flare|symptom|exercise|diet|lifestyle|sleep|moon face|weight)\b/i, Icon: Activity },
		{ match: /\b(work|job|career|employment|leave|disability|FMLA)\b/i, Icon: Briefcase },
		{ match: /\b(family|caregiver|parent|child|spouse|sibling|partner|husband|wife|daughter|son|mother|father)\b/i, Icon: Users },
		{ match: /\b(trial|study|enroll|screen|eligib|consent|protocol|CAR-T|registry)\b/i, Icon: ClipboardList },
		{ match: /\b(cost|insurance|afford|expensive|money|copay|coverage|financial|out-of-pocket)\b/i, Icon: DollarSign },
		{ match: /\b(search|google|online|internet|forum|reddit|facebook|community|info|information)\b/i, Icon: Search },
		{ match: /\b(hope|cure|remission|breakthrough|optimism|grateful|excited)\b/i, Icon: Sparkles },
		{ match: /\b(rejection|denied|disqualif|ineligibl|excluded|barrier|risk|fear|worry|anxiety|complication|toxicity)\b/i, Icon: AlertCircle }
	];

	function iconFor(text: string, polarity: Observation['polarity']): typeof Stethoscope {
		for (const rule of ICON_RULES) {
			if (rule.match.test(text)) return rule.Icon;
		}
		if (polarity === 'positive') return ArrowUp;
		if (polarity === 'negative') return ArrowDown;
		return Minus;
	}

	const SUPPLEMENTAL_KEYWORDS = [
		'specialist', 'biopsy', 'infusion', 'flare', 'fatigue', 'exercise',
		'dialysis', 'remission', 'eligibility', 'caregiver', 'prednisone',
		'mycophenolate', 'CAR-T', 'kidney', 'lupus', 'trial', 'consent'
	];

	const keywordList = $derived.by(() => {
		const set = new Set<string>(SUPPLEMENTAL_KEYWORDS.map((k) => k.toLowerCase()));
		if (journey) {
			for (const stage of journey.stages) {
				set.add(stage.label.toLowerCase());
				for (const step of stage.steps) set.add(step.label.toLowerCase());
			}
		}
		return [...set].sort((a, b) => b.length - a.length);
	});

	type KwSegment = { text: string; keyword?: string };

	function segmentWithKeywords(text: string): KwSegment[] {
		if (!text) return [{ text: '' }];
		const escaped = keywordList
			.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
			.join('|');
		if (!escaped) return [{ text }];
		const re = new RegExp(`\\b(${escaped})\\b`, 'gi');
		const out: KwSegment[] = [];
		let lastIdx = 0;
		for (const m of text.matchAll(re)) {
			const idx = m.index ?? 0;
			if (idx > lastIdx) out.push({ text: text.slice(lastIdx, idx) });
			out.push({ text: m[0], keyword: m[0].toLowerCase() });
			lastIdx = idx + m[0].length;
		}
		if (lastIdx < text.length) out.push({ text: text.slice(lastIdx) });
		return out;
	}

	function fragmentsForKeyword(keyword: string): Fragment[] {
		const k = keyword.toLowerCase();
		const out: Fragment[] = [];
		for (const f of Object.values(fragmentsById)) {
			if (typeof f.text === 'string' && f.text.toLowerCase().includes(k)) {
				out.push(f);
				if (out.length >= 25) break;
			}
		}
		return out;
	}

	const decisionVariantLabel = {
		driver: 'Driver',
		barrier: 'Barrier',
		mixed: 'Knowledge gap'
	};

	const decisionVariantColor = {
		driver: '#7DBFA7',
		barrier: '#CC6324',
		mixed: '#6a99c2'
	};

	// ---------------- Map geometry helpers ----------------

	const WAYPOINT_RADIUS = 26;

	// Stages with valid positions and the lookup mapping for zone.
	const renderableStages = $derived.by(() => {
		return artifact.stages.filter((s) => layout.stagePositions[s.stage_id] != null);
	});

	// Aria summary for the SVG.
	const mapAriaLabel = $derived(
		`Journey map for ${artifact.meta.persona_label}: ${renderableStages.length} stages across home, diagnosis, treatment, and research zones.`
	);
</script>

<svelte:head>
	<title>{artifact.meta.persona_label} — journey explore</title>
</svelte:head>

<div class="explore-page">
	{#if showHeader}
		<header class="page-header">
			<div class="header-eyebrow">
				<span
					class="persona-swatch"
					style="background-color: {personaColor}"
					aria-hidden="true"
				></span>
				<span class="eyebrow-text">Journey map · {indicationLabel} · Explore</span>
			</div>
			<h1 class="header-title">{artifact.meta.persona_label}</h1>
			<div class="header-meta">
				<span class="meta-chip">{artifact.meta.corpus_id}</span>
				<span>·</span>
				<span>{artifact.meta.fragment_count_total} fragments</span>
				<span>·</span>
				<span>{renderableStages.length} stages on map</span>
				{#if artifact.decision_panels.length > 0}
					<span>·</span>
					<span>{artifact.decision_panels.length} decision point{artifact.decision_panels.length === 1 ? '' : 's'}</span>
				{/if}
			</div>
		</header>
	{/if}

	<div class="map-wrap">
		<svg
			class="map-svg"
			viewBox="0 0 {EXPLORE_VIEWBOX.width} {EXPLORE_VIEWBOX.height}"
			role="img"
			aria-label={mapAriaLabel}
			preserveAspectRatio="xMidYMid meet"
		>
			<!-- Zone backgrounds -->
			<g class="zone-layer" aria-hidden="true">
				{#each EXPLORE_ZONES as zone (zone.id)}
					<rect
						x={zone.x}
						y={zone.y}
						width={zone.width}
						height={zone.height}
						fill={zone.tint}
					/>
					<text
						x={zone.x + 24}
						y={zone.y + 36}
						class="zone-label"
					>
						{zone.label.toUpperCase()}
					</text>
				{/each}
				<!-- Zone dividers, sharp pencil-rule -->
				<line
					x1={EXPLORE_VIEWBOX.width / 2}
					y1="0"
					x2={EXPLORE_VIEWBOX.width / 2}
					y2={EXPLORE_VIEWBOX.height}
					class="zone-divider"
				/>
				<line
					x1="0"
					y1={EXPLORE_VIEWBOX.height / 2}
					x2={EXPLORE_VIEWBOX.width}
					y2={EXPLORE_VIEWBOX.height / 2}
					class="zone-divider"
				/>
			</g>

			<!-- Segments -->
			<g class="segments-layer" aria-hidden="true">
				{#each layout.segments as seg, i (i)}
					{#if seg.kind === 'straight'}
						{@const from = resolveAnchor(seg.from)}
						{@const to = resolveAnchor(seg.to)}
						{#if from && to}
							<StraightSegment
								{from}
								{to}
								curvature={seg.curvature ?? 0}
								stroke={personaColor}
								status={seg.status}
							/>
						{/if}
					{:else if seg.kind === 'fork'}
						{@const from = resolveAnchor(seg.from)}
						{@const branches = seg.branches
							.map(resolveAnchor)
							.filter((p): p is Point => p !== null)}
						{#if from && branches.length > 0}
							<ForkSegment {from} to={branches} stroke={personaColor} status={seg.status} />
						{/if}
					{:else if seg.kind === 'roundabout'}
						{@const at = resolveAnchor(seg.at)}
						{@const exitTo = seg.exitTo ? resolveAnchor(seg.exitTo) : undefined}
						{#if at}
							<RoundaboutSegment
								{at}
								radius={seg.radius}
								exitTo={exitTo ?? undefined}
								stroke={personaColor}
								status={seg.status}
							/>
						{/if}
					{:else if seg.kind === 'dead_end'}
						{@const from = resolveAnchor(seg.from)}
						{#if from}
							<DeadEndSegment
								{from}
								length={seg.length}
								angle={seg.angle}
								stroke={personaColor}
								status={seg.status}
							/>
						{/if}
					{/if}
				{/each}
			</g>

			<!-- Waypoints (HTML buttons inside foreignObject for real a11y) -->
			<g class="waypoints-layer">
				{#each renderableStages as stage, i (stage.stage_id)}
					{@const pos = layout.stagePositions[stage.stage_id]}
					{@const band = sentimentBand(stage.avg_sentiment)}
					{@const Icon = iconForStage(stage)}
					{@const isDecision = decisionPanelByStageId[stage.stage_id] != null}
					<foreignObject
						x={pos.x - WAYPOINT_RADIUS - 8}
						y={pos.y - WAYPOINT_RADIUS - 8}
						width={(WAYPOINT_RADIUS + 8) * 2}
						height={(WAYPOINT_RADIUS + 8) * 2}
					>
						<button
							type="button"
							class="waypoint"
							class:waypoint-decision={isDecision}
							onclick={() => openPrimaryDrawer({ kind: 'stage', stage })}
							aria-label="Stage {i + 1}: {stage.label}, {band.label}{isDecision ? ', decision point' : ''}"
							style="--accent: {band.dotBg}; --persona: {personaColor}"
						>
							<span class="waypoint-icon" aria-hidden="true">
								<Icon size={20} strokeWidth={1.6} />
							</span>
							<span class="waypoint-num" aria-hidden="true">{i + 1}</span>
							{#if isDecision}
								<span class="waypoint-badge" aria-hidden="true">?</span>
							{/if}
						</button>
					</foreignObject>

					<!-- Stage label below the waypoint, plain SVG text for crisp rendering -->
					<text
						x={pos.x}
						y={pos.y + WAYPOINT_RADIUS + 26}
						class="waypoint-label"
						text-anchor="middle"
						aria-hidden="true"
					>
						{stage.label}
					</text>
				{/each}
			</g>
		</svg>

		<!-- Screen-reader parallel list of waypoints -->
		<ol class="sr-only">
			{#each renderableStages as stage, i (stage.stage_id)}
				<li>
					<button
						type="button"
						onclick={() => openPrimaryDrawer({ kind: 'stage', stage })}
					>
						Stage {i + 1} of {renderableStages.length}: {stage.label}
					</button>
				</li>
			{/each}
		</ol>
	</div>

	{#if showFooter}
		<footer class="page-footer">
			<p>
				Click any waypoint to open stage details. Stages with a "?" badge include a decision-point
				panel — drivers, barriers, and knowledge gaps surface inside the drawer. Linked keywords
				inside drawer text open related fragments. All observations are AI-proposed against the
				patient evidence; review pending.
			</p>
		</footer>
	{/if}
</div>

<!-- ====================== PRIMARY DRAWER ====================== -->

<RightDrawer bind:open={primaryDrawerOpen}>
	<div class="flex h-full flex-col">
		<header class="drawer-header">
			<div class="drawer-header-eyebrow">
				{#if primaryDrawer?.kind === 'observation'}
					{primaryDrawer.stageLabel}{primaryDrawer.stepLabel ? ` · ${primaryDrawer.stepLabel}` : ''}
				{:else if primaryDrawer?.kind === 'external'}
					Research · {primaryDrawer.stageLabel}{primaryDrawer.stepLabel ? ` · ${primaryDrawer.stepLabel}` : ''}
				{:else if primaryDrawer?.kind === 'decision_item'}
					{decisionVariantLabel[primaryDrawer.variant]} · {primaryDrawer.panelLabel}
				{:else if primaryDrawer?.kind === 'stage'}
					Stage details
				{/if}
			</div>
		</header>

		<div class="drawer-body">
			{#if primaryDrawer?.kind === 'observation'}
				{@const obs = primaryDrawer.obs}
				{@const swatch = polaritySwatch(obs.polarity)}
				<div class="drawer-pill-strip" style="--strip: {swatch}">
					<span class="drawer-polarity">{obs.polarity}</span>
					<span class="drawer-confidence">confidence {(obs.confidence * 100).toFixed(0)}%</span>
				</div>
				<h2 class="drawer-title">{obs.title}</h2>
				{#if obs.body}
					<p class="drawer-text">
						{#each segmentWithKeywords(obs.body) as seg, i (i)}
							{#if seg.keyword}
								<button
									type="button"
									class="kw-link"
									onclick={() => openKeywordDrawer(seg.keyword!)}
								>{seg.text}</button>
							{:else}
								{seg.text}
							{/if}
						{/each}
					</p>
				{/if}
				{#if obs.supporting_fragment_ids.length > 0}
					<div class="drawer-quote-block">
						<h3 class="drawer-section-title">Supporting quotes</h3>
						{#each obs.supporting_fragment_ids as fid (fid)}
							{@const f = fragmentsById[fid]}
							{#if f}
								<div class="drawer-quote">
									<div class="drawer-quote-speaker">{speakerLabel(f)}</div>
									<div class="drawer-quote-text">"{f.text}"</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			{:else if primaryDrawer?.kind === 'external'}
				{@const ext = primaryDrawer.ext}
				<div class="drawer-pill-strip" style="--strip: #6469A6">
					<span class="drawer-polarity">external research</span>
					{#if ext.confidence != null}
						<span class="drawer-confidence">confidence {(ext.confidence * 100).toFixed(0)}%</span>
					{/if}
				</div>
				<h2 class="drawer-title">{ext.title}</h2>
				{#if ext.body}
					<p class="drawer-text">
						{#each segmentWithKeywords(ext.body) as seg, i (i)}
							{#if seg.keyword}
								<button
									type="button"
									class="kw-link"
									onclick={() => openKeywordDrawer(seg.keyword!)}
								>{seg.text}</button>
							{:else}
								{seg.text}
							{/if}
						{/each}
					</p>
				{/if}
				{#if ext.citation}
					<div class="drawer-citation">{ext.citation}</div>
				{/if}
			{:else if primaryDrawer?.kind === 'decision_item'}
				{@const item = primaryDrawer.item}
				{@const swatch = decisionVariantColor[primaryDrawer.variant]}
				<div class="drawer-pill-strip" style="--strip: {swatch}">
					<span class="drawer-polarity">{decisionVariantLabel[primaryDrawer.variant]}</span>
					<span class="drawer-confidence">confidence {(item.confidence * 100).toFixed(0)}%</span>
				</div>
				<h2 class="drawer-title">{item.title}</h2>
				{#if item.body}
					<p class="drawer-text">
						{#each segmentWithKeywords(item.body) as seg, i (i)}
							{#if seg.keyword}
								<button
									type="button"
									class="kw-link"
									onclick={() => openKeywordDrawer(seg.keyword!)}
								>{seg.text}</button>
							{:else}
								{seg.text}
							{/if}
						{/each}
					</p>
				{/if}
				{#if item.supporting_fragment_ids.length > 0}
					<div class="drawer-quote-block">
						<h3 class="drawer-section-title">Supporting quotes</h3>
						{#each item.supporting_fragment_ids as fid (fid)}
							{@const f = fragmentsById[fid]}
							{#if f}
								<div class="drawer-quote">
									<div class="drawer-quote-speaker">{speakerLabel(f)}</div>
									<div class="drawer-quote-text">"{f.text}"</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			{:else if primaryDrawer?.kind === 'stage'}
				{@const stage = primaryDrawer.stage}
				{@const band = sentimentBand(stage.avg_sentiment)}
				<div class="drawer-stage-affect">
					<span class="affect-band" style="color: {band.text}">
						<span class="affect-band-dot" style="background-color: {band.dotBg}"></span>
						<span>{band.label}</span>
					</span>
					{#if stage.emotion_label}
						<EmotionDyadChip id={stage.emotion_label} showConstituents />
					{/if}
					<span class="drawer-stage-frag-count">{stage.fragment_count} fragments</span>
				</div>
				<h2 class="drawer-title">{stage.label}</h2>
				{#if stage.stage_summary}
					<p class="drawer-text">
						{#each segmentWithKeywords(stage.stage_summary) as seg, i (i)}
							{#if seg.keyword}
								<button
									type="button"
									class="kw-link"
									onclick={() => openKeywordDrawer(seg.keyword!)}
								>{seg.text}</button>
							{:else}
								{seg.text}
							{/if}
						{/each}
					</p>
				{/if}
				{#if stage.drill_down}
					<div class="drawer-section">
						<h3 class="drawer-section-title">Drill-down</h3>
						<p class="drawer-text">
							{#each segmentWithKeywords(stage.drill_down.text) as seg, i (i)}
								{#if seg.keyword}
									<button
										type="button"
										class="kw-link"
										onclick={() => openKeywordDrawer(seg.keyword!)}
									>{seg.text}</button>
								{:else}
									{seg.text}
								{/if}
							{/each}
						</p>
						{#if stage.drill_down.supporting_fragment_ids.length > 0}
							<div class="drawer-quote-block">
								<h3 class="drawer-section-title">Supporting quotes</h3>
								{#each stage.drill_down.supporting_fragment_ids as fid (fid)}
									{@const f = fragmentsById[fid]}
									{#if f}
										<div class="drawer-quote">
											<div class="drawer-quote-speaker">{speakerLabel(f)}</div>
											<div class="drawer-quote-text">"{f.text}"</div>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Observations from each step, as drawer-internal buttons that switch
				     the drawer entry to the observation kind. -->
				{#if stage.steps.some((s) => s.observations.length + s.external_observations.length > 0)}
					<div class="drawer-section">
						<h3 class="drawer-section-title">Observations</h3>
						{#each stage.steps as step, stepIdx (step.step_id ?? '_general_' + stepIdx)}
							{#if step.observations.length + step.external_observations.length > 0}
								<div class="drawer-step-block">
									{#if step.label}
										<div class="drawer-step-label">{step.label}</div>
									{/if}
									<div class="drawer-pill-list">
										{#each step.observations as obs, obsIdx (obsIdx)}
											{@const PillIcon = iconFor(obs.title + ' ' + obs.body, obs.polarity)}
											<button
												type="button"
												class="drawer-pill"
												data-polarity={obs.polarity}
												onclick={() =>
													openPrimaryDrawer({
														kind: 'observation',
														obs,
														stageLabel: stage.label,
														stepLabel: step.label
													})}
											>
												<span
													class="drawer-pill-swatch"
													style="background-color: {polaritySwatch(obs.polarity)}"
												></span>
												<span class="drawer-pill-icon">
													<PillIcon size={16} strokeWidth={1.6} />
												</span>
												<span class="drawer-pill-title">{obs.title}</span>
											</button>
										{/each}
										{#each step.external_observations as ext, extIdx (extIdx)}
											<button
												type="button"
												class="drawer-pill drawer-pill-research"
												onclick={() =>
													openPrimaryDrawer({
														kind: 'external',
														ext,
														stageLabel: stage.label,
														stepLabel: step.label
													})}
											>
												<span class="drawer-pill-swatch" style="background-color: #6469A6"></span>
												<span class="drawer-pill-icon"><BookOpen size={16} strokeWidth={1.6} /></span>
												<span class="drawer-pill-title">{ext.title}</span>
											</button>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}

				<!-- Decision panel for this stage, if any -->
				{@const panel = decisionPanelByStageId[stage.stage_id]}
				{#if panel}
					<div class="drawer-section">
						<h3 class="drawer-section-title">Decision point</h3>
						{#if panel.drivers.length > 0}
							<div class="drawer-step-block">
								<div class="drawer-step-label">Drivers</div>
								<div class="drawer-pill-list">
									{#each panel.drivers as it, i (i)}
										{@const PillIcon = iconFor(it.title + ' ' + it.body, 'positive')}
										<button
											type="button"
											class="drawer-pill"
											data-polarity="positive"
											onclick={() =>
												openPrimaryDrawer({
													kind: 'decision_item',
													item: it,
													variant: 'driver',
													panelLabel: panel.label
												})}
										>
											<span
												class="drawer-pill-swatch"
												style="background-color: {decisionVariantColor.driver}"
											></span>
											<span class="drawer-pill-icon"><PillIcon size={16} strokeWidth={1.6} /></span>
											<span class="drawer-pill-title">{it.title}</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}
						{#if panel.barriers.length > 0}
							<div class="drawer-step-block">
								<div class="drawer-step-label">Barriers</div>
								<div class="drawer-pill-list">
									{#each panel.barriers as it, i (i)}
										{@const PillIcon = iconFor(it.title + ' ' + it.body, 'negative')}
										<button
											type="button"
											class="drawer-pill"
											data-polarity="negative"
											onclick={() =>
												openPrimaryDrawer({
													kind: 'decision_item',
													item: it,
													variant: 'barrier',
													panelLabel: panel.label
												})}
										>
											<span
												class="drawer-pill-swatch"
												style="background-color: {decisionVariantColor.barrier}"
											></span>
											<span class="drawer-pill-icon"><PillIcon size={16} strokeWidth={1.6} /></span>
											<span class="drawer-pill-title">{it.title}</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}
						{#if panel.mixed.length > 0}
							<div class="drawer-step-block">
								<div class="drawer-step-label">Knowledge gaps</div>
								<div class="drawer-pill-list">
									{#each panel.mixed as it, i (i)}
										{@const PillIcon = iconFor(it.title + ' ' + it.body, 'mixed')}
										<button
											type="button"
											class="drawer-pill"
											data-polarity="mixed"
											onclick={() =>
												openPrimaryDrawer({
													kind: 'decision_item',
													item: it,
													variant: 'mixed',
													panelLabel: panel.label
												})}
										>
											<span
												class="drawer-pill-swatch"
												style="background-color: {decisionVariantColor.mixed}"
											></span>
											<span class="drawer-pill-icon"><PillIcon size={16} strokeWidth={1.6} /></span>
											<span class="drawer-pill-title">{it.title}</span>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</RightDrawer>

<!-- ====================== KEYWORD TERTIARY DRAWER ====================== -->

<TertiaryDrawer
	open={keywordDrawerKw !== null}
	onclose={closeKeywordDrawer}
	ariaLabel="Keyword fragments"
	eyebrow="Keyword"
	title={keywordDrawerKw ?? ''}
>
	{#if keywordDrawerKw}
		{@const related = fragmentsForKeyword(keywordDrawerKw)}
		<div class="drawer-body">
			<p class="drawer-text">
				{related.length} fragment{related.length === 1 ? '' : 's'} in this corpus mention "{keywordDrawerKw}".
			</p>
			{#if related.length > 0}
				<div class="drawer-quote-block">
					{#each related as f (f.id)}
						<div class="drawer-quote">
							<div class="drawer-quote-speaker">{speakerLabel(f)}</div>
							<div class="drawer-quote-text">"{f.text}"</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</TertiaryDrawer>

<style>
	/* Hammer-rule: enforce no italics anywhere in this subtree per hard-rule #1. */
	.explore-page :global(*) {
		font-style: normal;
	}

	.explore-page {
		max-width: 1480px;
		margin: 0 auto;
		padding: 1.5rem 1.75rem 4rem;
		color: var(--ink);
		font-family: var(--font-body);
	}

	.page-header {
		padding-bottom: 1.25rem;
		border-bottom: 1px solid #E7E5E2;
		margin-bottom: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.header-eyebrow {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.persona-swatch {
		width: 12px;
		height: 12px;
		display: inline-block;
	}
	.eyebrow-text {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--grayblue);
	}
	.header-title {
		font-family: var(--font-heading);
		font-weight: 400;
		font-size: 2.5rem;
		line-height: 1.1;
		color: var(--darkgrayblue);
		margin: 0;
	}
	.header-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--grayblue);
	}
	.meta-chip {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		padding: 0.1rem 0.5rem;
		background: #F4F1EA;
		color: var(--darkgrayblue);
	}

	/* ----------- Map ----------- */

	.map-wrap {
		position: relative;
		width: 100%;
		background: #FBF9F4;
		border: 1px solid #E7E5E2;
	}

	.map-svg {
		display: block;
		width: 100%;
		height: auto;
	}

	.zone-label {
		font-family: var(--font-mono);
		font-size: 14px;
		letter-spacing: 0.22em;
		fill: #8C8678;
	}

	.zone-divider {
		stroke: #DDD7C9;
		stroke-width: 1;
		stroke-dasharray: 4 6;
	}

	.waypoint-label {
		font-family: var(--font-body);
		font-size: 15px;
		font-weight: 500;
		fill: var(--darkgrayblue);
	}

	/* Waypoint buttons live inside foreignObject; need explicit box reset to
	   render as plain DOM buttons against the SVG background. */
	.waypoint {
		all: unset;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		margin: 8px;
		background: #FFFFFF;
		border: 2px solid var(--accent, #999);
		border-radius: 50%;
		cursor: pointer;
		position: relative;
		transition: transform 120ms ease, box-shadow 120ms ease;
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04), 0 2px 6px rgba(0, 0, 0, 0.05);
	}

	.waypoint:hover {
		transform: translateY(-1px);
		box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.waypoint:focus-visible {
		outline: 2px solid var(--persona, #446079);
		outline-offset: 3px;
	}

	.waypoint-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--darkgrayblue);
	}

	.waypoint-num {
		position: absolute;
		top: -6px;
		left: -6px;
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 600;
		background: var(--persona, #446079);
		color: #FFFFFF;
		border-radius: 50%;
	}

	.waypoint-badge {
		position: absolute;
		top: -6px;
		right: -6px;
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 700;
		background: #E8B547;
		color: #4A3914;
		border-radius: 50%;
	}

	.waypoint-decision {
		border-color: #E8B547;
	}

	/* Screen-reader-only fallback nav */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	/* ----------- Footer ----------- */

	.page-footer {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid #E7E5E2;
		font-size: 0.8rem;
		color: var(--grayblue);
		max-width: 70ch;
	}
	.page-footer p {
		margin: 0;
	}

	/* ----------- Drawer (matches JourneyMapView's drawer styles) ----------- */

	.drawer-header {
		padding: 1.5rem 1.5rem 0;
	}
	.drawer-header-eyebrow {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--grayblue);
	}
	.drawer-body {
		padding: 1rem 1.5rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow-y: auto;
	}
	.drawer-pill-strip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0.65rem;
		background: color-mix(in srgb, var(--strip) 12%, transparent);
		color: var(--strip);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.drawer-polarity {
		font-weight: 600;
	}
	.drawer-confidence {
		opacity: 0.85;
	}
	.drawer-title {
		font-family: var(--font-heading);
		font-weight: 500;
		font-size: 1.6rem;
		line-height: 1.2;
		color: var(--darkgrayblue);
		margin: 0;
		text-wrap: balance;
	}
	.drawer-text {
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--ink);
		margin: 0;
	}
	.drawer-section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-top: 0.5rem;
	}
	.drawer-section-title {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--grayblue);
		margin: 0;
	}
	.drawer-citation {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--grayblue);
	}
	.drawer-quote-block {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.drawer-quote {
		padding: 0.6rem 0.75rem;
		background: #F4F1EA;
	}
	.drawer-quote-speaker {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--grayblue);
		margin-bottom: 0.25rem;
	}
	.drawer-quote-text {
		font-family: var(--font-body);
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--ink);
	}
	.kw-link {
		all: unset;
		cursor: pointer;
		color: var(--darkgrayblue);
		font-weight: 600;
		border-bottom: 1px dashed var(--grayblue);
	}
	.kw-link:hover {
		background: #F4F1EA;
	}
	.drawer-stage-affect {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
	}
	.affect-band {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.affect-band-dot {
		width: 8px;
		height: 8px;
		display: inline-block;
	}
	.drawer-stage-frag-count {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--grayblue);
	}
	.drawer-step-block {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.drawer-step-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--darkgrayblue);
		font-weight: 600;
	}
	.drawer-pill-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.drawer-pill {
		all: unset;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.55rem 0.65rem;
		background: #FFFFFF;
		border: 1px solid #E7E5E2;
	}
	.drawer-pill:hover {
		background: #FAF8F2;
		border-color: #C9C3B3;
	}
	.drawer-pill:focus-visible {
		outline: 2px solid var(--darkgrayblue);
		outline-offset: 2px;
	}
	.drawer-pill-swatch {
		width: 8px;
		height: 24px;
		flex-shrink: 0;
	}
	.drawer-pill-icon {
		display: flex;
		align-items: center;
		color: var(--darkgrayblue);
	}
	.drawer-pill-title {
		font-size: 0.9rem;
		line-height: 1.35;
		color: var(--ink);
	}
</style>

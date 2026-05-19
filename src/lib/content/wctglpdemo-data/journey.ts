/**
 * journey.ts
 *
 * Builds the trial-experience journey map: three curated phases, each split
 * into steps, each step ranking the themes and keywords that drove sentiment
 * across the segments it covers.
 *
 * NOTE ON FRAMING — the WCT GLP-1 interviews are attitudinal: participants
 * react to a *hypothetical* trial ("would you consider…"), so there is no
 * lived chronology in the data. The three phases below are an editorial
 * recutting of the interview guide into a journey-shaped narrative. Edit
 * `PLAN` to recut it; everything downstream is derived.
 *
 * Like keywords.ts / word-frequency.ts this is the UI-side counterpart to the
 * build scripts — derived at runtime from the pipeline outputs, no new file.
 */
import { annotations, segments, titleCase } from './analysis';
import { keywordTags } from './keywords';

/** Which way a driver pulled participants relative to joining the trial. */
export type Pull = 'toward' | 'away' | 'mixed';
export type DriverKind = 'theme' | 'keyword';

/** A sentiment driver the quiz asks the user to place — a theme or a keyword. */
export type Driver = {
	kind: DriverKind;
	id: string;
	label: string;
	/** Segments in this step that mention the driver. */
	count: number;
	/** Mean sentiment (−2…+2) of those segments. */
	avgSentiment: number;
	/** Quiz answer key, derived from `avgSentiment`. */
	pull: Pull;
};

export type Step = {
	id: string;
	title: string;
	blurb: string;
	/** Codebook theme ids that define the step's segment slice. */
	themeIds: string[];
	/** Distinct segments behind the step. */
	segmentCount: number;
	/** Top themes + top keywords, ranked by mention frequency. */
	drivers: Driver[];
};

export type Phase = {
	id: string;
	title: string;
	blurb: string;
	/** Visual tone key — resolved to classes in the UI. */
	accent: 'emerald' | 'amber' | 'sky';
	steps: Step[];
};

type StepPlan = { id: string; title: string; blurb: string; themes: string[] };
type PhasePlan = Omit<Phase, 'steps'> & { steps: StepPlan[] };

/**
 * The editorial journey cut. Every codebook theme is assigned to exactly one
 * step, so the three phases partition the taxonomy cleanly.
 */
const PLAN: PhasePlan[] = [
	{
		id: 'awareness',
		title: 'Trial Awareness & Education',
		blurb: 'Before anyone applies — what people bring with them, how they first hear about a trial, and what they say they need to understand.',
		accent: 'emerald',
		steps: [
			{
				id: 'starting-point',
				title: 'Where they’re starting from',
				blurb: 'Years of diet attempts, weight regain, and what "maintenance" has meant so far.',
				themes: ['weight_loss_history', 'maintenance_strategy', 'health_transformation']
			},
			{
				id: 'hearing',
				title: 'Hearing about the trial',
				blurb: 'First contact with the idea of a trial — and the instinct to go looking for more.',
				themes: ['trial_awareness', 'information_seeking']
			},
			{
				id: 'getting-up-to-speed',
				title: 'Getting up to speed',
				blurb: 'The education and guidance people say they would need before deciding.',
				themes: ['education_need', 'self_advocacy']
			}
		]
	},
	{
		id: 'decision',
		title: 'Decision to Apply',
		blurb: 'Weighing the offer — motivations, risks, altruism, and the conditions attached to a yes.',
		accent: 'amber',
		steps: [
			{
				id: 'whats-in-it',
				title: 'Weighing what’s in it for them',
				blurb: 'Access to medication, compensation, and the personal cost–benefit math.',
				themes: ['trial_participation_motivation', 'incentives_support', 'access_logic', 'cost_benefit_reasoning']
			},
			{
				id: 'risks',
				title: 'Sizing up the risks',
				blurb: 'Unknown safety, side effects, placebo odds, and the fear of regaining weight.',
				themes: ['risk_calculation', 'side_effect_concern', 'placebo_concern', 'fear_of_weight_regain']
			},
			{
				id: 'for-others',
				title: 'Doing it for others',
				blurb: 'Contributing to research and helping people beyond themselves.',
				themes: ['research_altruism', 'altruistic_reasoning']
			},
			{
				id: 'making-the-call',
				title: 'Making the call',
				blurb: 'The conditions, trade-offs, and "only if" caveats behind a decision.',
				themes: ['conditional_decision', 'convenience_tradeoff']
			}
		]
	},
	{
		id: 'participation',
		title: 'Trial Participation',
		blurb: 'Living the protocol — getting to the site, the procedures, the medication, and staying enrolled.',
		accent: 'sky',
		steps: [
			{
				id: 'getting-there',
				title: 'Getting to the site',
				blurb: 'Travel, time off, and the logistics of every visit.',
				themes: ['travel_burden', 'time_burden', 'visit_logistics']
			},
			{
				id: 'procedures',
				title: 'Tests, scans, and shots',
				blurb: 'Fasting blood draws, glucose monitoring, and the injections themselves.',
				themes: ['monitoring_burden', 'injection_experience']
			},
			{
				id: 'living-with-it',
				title: 'Living with the medication',
				blurb: 'Route, formulation, switching, side benefits, and staying on treatment.',
				themes: [
					'oral_medication_interest',
					'compounded_medication',
					'drug_switching',
					'non_weight_benefits',
					'treatment_continuation',
					'treatment_dependency'
				]
			},
			{
				id: 'friction',
				title: 'Friction and staying the course',
				blurb: 'Cost, access, and the everyday friction of seeing a trial through.',
				themes: ['clinical_trial_friction', 'cost_access', 'insurance_barrier', 'medication_access', 'lifestyle_change']
			}
		]
	}
];

/** Below this |average sentiment| a driver reads as genuinely mixed. */
const PULL_THRESHOLD = 0.15;
/** A driver needs at least this many mentions to enter the quiz. */
const MIN_MENTIONS = 2;
/** Drivers shown per kind, per step. */
const PER_KIND = 3;

function pullOf(avg: number): Pull {
	if (avg >= PULL_THRESHOLD) return 'toward';
	if (avg <= -PULL_THRESHOLD) return 'away';
	return 'mixed';
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const textBySegment = new Map(segments.map((s) => [s.segment_id, s.text]));

function buildStep(plan: StepPlan): Step {
	const themeSet = new Set(plan.themes);
	// Every annotated segment carrying at least one of the step's themes.
	const stepAnns = annotations.filter((a) => a.themes.some((t) => themeSet.has(t)));

	// Theme drivers — one per planned theme, ranked by how many segments use it.
	const themeDrivers: Driver[] = plan.themes
		.map((themeId): Driver => {
			const hits = stepAnns.filter((a) => a.themes.includes(themeId));
			const avg = mean(hits.map((a) => a.sentiment));
			return {
				kind: 'theme',
				id: themeId,
				label: titleCase(themeId),
				count: hits.length,
				avgSentiment: avg,
				pull: pullOf(avg)
			};
		})
		.filter((d) => d.count >= MIN_MENTIONS)
		.sort((a, b) => b.count - a.count)
		.slice(0, PER_KIND);

	// Keyword drivers — lexicon keywords spoken inside the step's segments,
	// each carrying the sentiment of the segments it appeared in.
	const kwSent = new Map<string, { label: string; sentiments: number[] }>();
	for (const a of stepAnns) {
		const text = textBySegment.get(a.segment_id);
		if (!text) continue;
		for (const kw of keywordTags(text).keywords) {
			const entry = kwSent.get(kw.id) ?? { label: kw.label, sentiments: [] };
			entry.sentiments.push(a.sentiment);
			kwSent.set(kw.id, entry);
		}
	}
	const keywordDrivers: Driver[] = [...kwSent.entries()]
		.map(([id, entry]): Driver => {
			const avg = mean(entry.sentiments);
			return {
				kind: 'keyword',
				id,
				label: entry.label,
				count: entry.sentiments.length,
				avgSentiment: avg,
				pull: pullOf(avg)
			};
		})
		.filter((d) => d.count >= MIN_MENTIONS)
		.sort((a, b) => b.count - a.count)
		.slice(0, PER_KIND);

	return {
		id: plan.id,
		title: plan.title,
		blurb: plan.blurb,
		themeIds: plan.themes,
		segmentCount: stepAnns.length,
		drivers: [...themeDrivers, ...keywordDrivers].sort((a, b) => b.count - a.count)
	};
}

export const phases: Phase[] = PLAN.map((p) => ({
	id: p.id,
	title: p.title,
	blurb: p.blurb,
	accent: p.accent,
	steps: p.steps.map(buildStep)
}));

/** Every driver across the whole journey, for the closing results summary. */
export const allDrivers: Driver[] = phases.flatMap((p) => p.steps.flatMap((s) => s.drivers));

export const journeyStats = {
	phases: phases.length,
	steps: phases.reduce((n, p) => n + p.steps.length, 0),
	drivers: allDrivers.length
};

/**
 * Hand-authored explore-view layouts, keyed by persona_id.
 *
 * Each layout places the persona's visited stages onto a 1200x700 viewBox
 * divided into four quadrants (HOME / DIAGNOSIS / TREATMENT / RESEARCH).
 * Stage positions live in viewBox coords; segments connect them using the
 * primitive vocabulary from ./segments/types.
 *
 * Adding a new persona: copy an existing entry, swap stage IDs and positions,
 * adjust segments. Personas without an authored layout get a fallback chain
 * (see resolveExploreLayout below).
 */

import type { ExploreLayout, MapZone, ZoneRect, Point } from './segments/types';

// ---------------- Canvas constants ----------------

export const EXPLORE_VIEWBOX = { width: 1200, height: 700 } as const;

// Four fixed quadrants. Chronology flows clockwise from HOME (top-left)
// through DIAGNOSIS (top-right), TREATMENT (bottom-right), RESEARCH
// (bottom-left).
export const EXPLORE_ZONES: ZoneRect[] = [
	{
		id: 'home',
		label: 'Home',
		x: 0,
		y: 0,
		width: 600,
		height: 350,
		tint: '#F4F1EA'
	},
	{
		id: 'diagnosis',
		label: 'Diagnosis',
		x: 600,
		y: 0,
		width: 600,
		height: 350,
		tint: '#EEEAE0'
	},
	{
		id: 'treatment',
		label: 'Treatment',
		x: 600,
		y: 350,
		width: 600,
		height: 350,
		tint: '#E8E3D5'
	},
	{
		id: 'research',
		label: 'Research',
		x: 0,
		y: 350,
		width: 600,
		height: 350,
		tint: '#E4DECE'
	}
];

// ---------------- Per-persona layouts ----------------

const ln_sle_carT_curious_patients: ExploreLayout = {
	stagePositions: {
		diagnostic_odyssey: { x: 900, y: 180 },
		stable_maintenance: { x: 830, y: 440 },
		flare_or_refractory_cycle: { x: 1030, y: 580 },
		trial_consideration: { x: 500, y: 460 },
		in_trial_experience: { x: 270, y: 540 },
		post_trial: { x: 160, y: 390 }
	},
	stageZones: {
		diagnostic_odyssey: 'diagnosis',
		stable_maintenance: 'treatment',
		flare_or_refractory_cycle: 'treatment',
		trial_consideration: 'research',
		in_trial_experience: 'research',
		post_trial: 'research'
	},
	segments: [
		{ kind: 'straight', from: 'diagnostic_odyssey', to: 'stable_maintenance', curvature: 0.3 },
		{ kind: 'straight', from: 'stable_maintenance', to: 'flare_or_refractory_cycle', curvature: -0.4 },
		{ kind: 'straight', from: 'flare_or_refractory_cycle', to: 'trial_consideration', curvature: 0.25 },
		{
			kind: 'fork',
			from: 'trial_consideration',
			branches: ['in_trial_experience', { x: 460, y: 660 } satisfies Point]
		},
		{ kind: 'straight', from: 'in_trial_experience', to: 'post_trial', curvature: 0.2 }
	]
};

export const EXPLORE_LAYOUTS: Record<string, ExploreLayout> = {
	ln_sle_carT_curious_patients
};

// ---------------- Resolver ----------------

/**
 * Resolve a layout for a persona. If hand-authored, return it. Otherwise
 * synthesize a fallback: stages laid out left-to-right across zones in their
 * canonical order, connected with StraightSegments.
 */
export function resolveExploreLayout(
	personaId: string,
	visitedStageIds: string[],
	stageZoneFallback: Record<string, MapZone>
): ExploreLayout {
	const authored = EXPLORE_LAYOUTS[personaId];
	if (authored) return authored;

	// Fallback: chain stages with even horizontal spacing inside their assigned
	// zone, centered vertically within the zone. Each stage gets a position
	// based on its index within its zone's stages.
	const byZone = new Map<MapZone, string[]>();
	for (const sid of visitedStageIds) {
		const z = stageZoneFallback[sid] ?? 'treatment';
		if (!byZone.has(z)) byZone.set(z, []);
		byZone.get(z)!.push(sid);
	}

	const stagePositions: Record<string, Point> = {};
	for (const zone of EXPLORE_ZONES) {
		const sids = byZone.get(zone.id) ?? [];
		sids.forEach((sid, i) => {
			const cx = zone.x + (zone.width * (i + 1)) / (sids.length + 1);
			const cy = zone.y + zone.height / 2;
			stagePositions[sid] = { x: cx, y: cy };
		});
	}

	const segments: ExploreLayout['segments'] = [];
	for (let i = 0; i < visitedStageIds.length - 1; i++) {
		segments.push({
			kind: 'straight',
			from: visitedStageIds[i],
			to: visitedStageIds[i + 1],
			curvature: 0
		});
	}

	return {
		stagePositions,
		stageZones: stageZoneFallback,
		segments
	};
}

// ---------------- Default zone-by-stage for unauthored fallback ----------------

/**
 * Stage → zone heuristic, used for personas without a hand-authored layout.
 * Indication-specific stage IDs need an entry here to land in a sensible
 * zone. Missing entries fall back to 'treatment'.
 *
 * Authored layouts override this via their own `stageZones` map.
 */
export const STAGE_ZONE_HEURISTIC: Record<string, MapZone> = {
	// LN
	pre_diagnosis: 'home',
	diagnostic_odyssey: 'diagnosis',
	induction_treatment: 'treatment',
	stable_maintenance: 'treatment',
	flare_or_refractory_cycle: 'treatment',
	trial_consideration: 'research',
	in_trial_experience: 'research',
	post_trial: 'research',

	// GLP-1 / obesity
	lifestyle_attempts: 'home',
	clinical_conversation: 'diagnosis',
	glp1_initiation: 'treatment',
	active_weight_loss: 'treatment',
	weight_stabilization: 'treatment',
	discontinuation_consideration: 'treatment',
	post_discontinuation: 'research',
	// trial_consideration is shared with LN above; already mapped to 'research'

	// MS — placeholders; real stage IDs land when the MS artifact ships
	relapse: 'treatment',
	remission: 'treatment'
};

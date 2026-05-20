/**
 * migrate-segment-tags.mjs
 *
 * Re-keys segment_tags.json AND segment_tags.proposed.json into the new
 * codebook 2.0-draft structure (codebook.next.json), using
 * codebook_migration_map.json as the old-id → new-(theme, subtheme) lookup.
 *
 * Writes to segment_tags.next.json and segment_tags.proposed.next.json so the
 * live files stay undisturbed.
 *
 * Programmatic review-row rules (defaults can be overridden per-segment):
 *   - decision_factor themes (risk_calculation, convenience_tradeoff,
 *     cost_benefit_reasoning, conditional_decision) default to
 *     treatment_decision_factors; remap to trial_decision_factors when the
 *     same segment carries ANY old tag whose new_theme is 'clinical_trials'.
 *   - injection_experience + injection_frequency default to
 *     treatment_negative_experiences; remap to treatment_positive_experiences
 *     when annotation.sentiment >= 1.
 *   - telehealth, home_visits, local_site default to trial_barriers; remap
 *     to trial_motivators when annotation.sentiment >= 1.
 *   - compounded_medication defaults to treatment_health_history; remap to
 *     treatment_barriers when the segment co-occurs with any old
 *     affordability-group theme.
 *
 * Run: node scripts/migrate-segment-tags.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MAP_FILE = 'src/lib/content/wctglpdemo-data/codebook_migration_map.json';
const NEXT_CODEBOOK_FILE = 'src/lib/content/wctglpdemo-data/codebook.next.json';

const TAGS_FILE = 'src/lib/content/wctglpdemo-data/segment_tags.json';
const TAGS_OUT = 'src/lib/content/wctglpdemo-data/segment_tags.next.json';

const PROPOSED_FILE = 'src/lib/content/wctglpdemo-data/segment_tags.proposed.json';
const PROPOSED_OUT = 'src/lib/content/wctglpdemo-data/segment_tags.proposed.next.json';

// --- Programmatic review-row rules -----------------------------------------

const DECISION_FACTOR_THEMES = new Set([
	'risk_calculation',
	'convenience_tradeoff',
	'cost_benefit_reasoning',
	'conditional_decision'
]);

const SENTIMENT_FLIPPED_TO_POSITIVE_EXPERIENCES = new Set([
	'injection_experience',
	'injection_frequency'
]);

const SENTIMENT_FLIPPED_TO_TRIAL_MOTIVATORS = new Set([
	'telehealth',
	'home_visits',
	'local_site'
]);

const COMPOUNDED_MEDICATION_BARRIER_TRIGGERS = new Set([
	'cost_access',
	'out_of_pocket_cost',
	'price_trends',
	'insurance_barrier',
	'medication_access'
]);

// --- Helpers ---------------------------------------------------------------

function loadJson(relPath) {
	return JSON.parse(readFileSync(resolve(ROOT, relPath), 'utf8'));
}

function buildLookup(mapDoc) {
	const lookup = new Map();
	for (const row of mapDoc.rows) lookup.set(row.old_id, row);
	return lookup;
}

function buildValidPairs(codebook) {
	const pairs = new Set();
	const themes = new Set();
	for (const t of codebook.themes) {
		themes.add(t.id);
		for (const s of t.subthemes ?? []) pairs.add(`${t.id}::${s.id}`);
	}
	return { pairs, themes };
}

function resolveOldId(oldId, lookup, sentiment, oldIdsOnSegment, newThemesForSegment) {
	const row = lookup.get(oldId);
	if (!row) return { kind: 'unknown' };
	if (row.kind === 'drop') return null;

	let new_theme = row.new_theme;
	let new_subtheme = row.new_subtheme;
	const fired = [];

	if (DECISION_FACTOR_THEMES.has(oldId) && newThemesForSegment.has('clinical_trials')) {
		new_theme = 'clinical_trials';
		new_subtheme = 'trial_decision_factors';
		fired.push('decision_factor_to_trial');
	}
	if (SENTIMENT_FLIPPED_TO_POSITIVE_EXPERIENCES.has(oldId) && sentiment >= 1) {
		new_subtheme = 'treatment_positive_experiences';
		fired.push('injection_positive');
	}
	if (SENTIMENT_FLIPPED_TO_TRIAL_MOTIVATORS.has(oldId) && sentiment >= 1) {
		new_subtheme = 'trial_motivators';
		fired.push('visit_logistics_motivator');
	}
	if (oldId === 'compounded_medication') {
		for (const id of oldIdsOnSegment) {
			if (COMPOUNDED_MEDICATION_BARRIER_TRIGGERS.has(id)) {
				new_subtheme = 'treatment_barriers';
				fired.push('compounded_to_barriers');
				break;
			}
		}
	}
	return { kind: 'mapped', new_theme, new_subtheme, fired };
}

const lookup = buildLookup(loadJson(MAP_FILE));
const nextCodebook = loadJson(NEXT_CODEBOOK_FILE);
const { pairs: validPairs, themes: validThemes } = buildValidPairs(nextCodebook);

const newStats = () => ({
	total: 0,
	with_themes: 0,
	changed: 0,
	old_ids_seen: 0,
	old_ids_dropped: 0,
	rule_fired: {
		decision_factor_to_trial: 0,
		injection_positive: 0,
		visit_logistics_motivator: 0,
		compounded_to_barriers: 0
	},
	unknown_ids: new Set(),
	invalid_new_pairs: new Set()
});

/** Transform one (themes, subthemes, sentiment) triple → new (themes, subthemes). */
function transform(oldThemes, oldSubthemes, sentiment, stats) {
	const oldIds = [...oldThemes, ...oldSubthemes];
	if (oldThemes.length > 0 || oldSubthemes.length > 0) stats.with_themes++;

	const provisionalNewThemes = new Set();
	for (const id of oldIds) {
		const row = lookup.get(id);
		if (!row || row.kind === 'drop') continue;
		if (DECISION_FACTOR_THEMES.has(id)) continue;
		provisionalNewThemes.add(row.new_theme);
	}

	const newThemeSet = new Set();
	const newSubthemeSet = new Set();
	const oldIdsOnSegment = new Set(oldIds);

	for (const id of oldIds) {
		stats.old_ids_seen++;
		const res = resolveOldId(id, lookup, sentiment, oldIdsOnSegment, provisionalNewThemes);
		if (res === null) {
			stats.old_ids_dropped++;
			continue;
		}
		if (res.kind === 'unknown') {
			stats.unknown_ids.add(id);
			continue;
		}
		newThemeSet.add(res.new_theme);
		newSubthemeSet.add(res.new_subtheme);
		for (const r of res.fired) stats.rule_fired[r]++;

		const pair = `${res.new_theme}::${res.new_subtheme}`;
		if (!validPairs.has(pair)) stats.invalid_new_pairs.add(pair);
		if (!validThemes.has(res.new_theme)) stats.invalid_new_pairs.add(`!theme:${res.new_theme}`);
	}

	const newThemes = [...newThemeSet].sort();
	const newSubthemes = [...newSubthemeSet].sort();
	const changed =
		newThemes.length !== oldThemes.length ||
		newSubthemes.length !== oldSubthemes.length ||
		newThemes.some((t, i) => t !== oldThemes[i]) ||
		newSubthemes.some((s, i) => s !== oldSubthemes[i]);
	if (changed) stats.changed++;

	return { newThemes, newSubthemes };
}

function gateValidation(stats, label) {
	if (stats.unknown_ids.size > 0) {
		console.error(`\n[ERROR] ${label}: unknown old ids (no row in migration map):`);
		for (const id of stats.unknown_ids) console.error(`  - ${id}`);
		process.exit(1);
	}
	if (stats.invalid_new_pairs.size > 0) {
		console.error(`\n[ERROR] ${label}: produced (theme, subtheme) pairs not in codebook.next.json:`);
		for (const p of stats.invalid_new_pairs) console.error(`  - ${p}`);
		process.exit(1);
	}
}

function printStats(stats, label) {
	console.log(`\n${label}:`);
	console.log(`  total: ${stats.total} (with themes: ${stats.with_themes})`);
	console.log(`  changed: ${stats.changed}`);
	console.log(`  old ids: ${stats.old_ids_seen} (dropped: ${stats.old_ids_dropped})`);
	console.log(`  rules fired:`);
	for (const [r, n] of Object.entries(stats.rule_fired)) console.log(`    ${r}: ${n}`);
}

// === Pass 1: segment_tags.json (array of annotations) =====================

const tagsDoc = loadJson(TAGS_FILE);
const stats1 = newStats();
const newAnnotations = [];

for (const ann of tagsDoc.annotations ?? []) {
	stats1.total++;
	const oldThemes = Array.isArray(ann.themes) ? ann.themes : [];
	const oldSubthemes = Array.isArray(ann.subthemes) ? ann.subthemes : [];
	const sentiment = ann.sentiment ?? 0;
	const { newThemes, newSubthemes } = transform(oldThemes, oldSubthemes, sentiment, stats1);
	newAnnotations.push({ ...ann, themes: newThemes, subthemes: newSubthemes });
}

gateValidation(stats1, 'segment_tags.json');

const tagsOut = {
	meta: {
		...tagsDoc.meta,
		schema_version: tagsDoc.meta?.schema_version ?? '1.2',
		generated_at: new Date().toISOString(),
		generator: 'scripts/migrate-segment-tags.mjs',
		sources: [TAGS_FILE, NEXT_CODEBOOK_FILE, MAP_FILE],
		codebook_schema_version: nextCodebook.meta?.schema_version ?? '2.0-draft',
		migration_status: 'draft',
		migration_notes: [
			`Re-keyed from codebook.json @ ${tagsDoc.meta?.codebook_schema_version ?? '1.x'} to codebook.next.json @ ${nextCodebook.meta?.schema_version ?? '2.0-draft'}.`,
			`${stats1.changed} of ${stats1.total} annotations changed shape.`,
			`Rules fired: decision_factor_to_trial=${stats1.rule_fired.decision_factor_to_trial}, injection_positive=${stats1.rule_fired.injection_positive}, visit_logistics_motivator=${stats1.rule_fired.visit_logistics_motivator}, compounded_to_barriers=${stats1.rule_fired.compounded_to_barriers}.`
		]
	},
	annotations: newAnnotations
};

writeFileSync(resolve(ROOT, TAGS_OUT), JSON.stringify(tagsOut, null, 2) + '\n', 'utf8');
console.log(`Wrote ${TAGS_OUT}`);
printStats(stats1, 'segment_tags.json');

// === Pass 2: segment_tags.proposed.json (object keyed by segment_id) ======

if (!existsSync(resolve(ROOT, PROPOSED_FILE))) {
	console.log(`\nNo ${PROPOSED_FILE} found — skipping proposed-tags migration.`);
} else {
	const propDoc = loadJson(PROPOSED_FILE);
	const stats2 = newStats();
	const newProposals = {};

	for (const [segmentId, p] of Object.entries(propDoc.proposals ?? {})) {
		stats2.total++;
		const oldThemes = Array.isArray(p.themes) ? p.themes : [];
		const oldSubthemes = Array.isArray(p.subthemes) ? p.subthemes : [];
		const sentiment = p.sentiment ?? 0;
		const { newThemes, newSubthemes } = transform(oldThemes, oldSubthemes, sentiment, stats2);
		newProposals[segmentId] = { ...p, themes: newThemes, subthemes: newSubthemes };
	}

	gateValidation(stats2, 'segment_tags.proposed.json');

	const propOut = {
		meta: {
			...propDoc.meta,
			generated_at: new Date().toISOString(),
			generator: 'scripts/migrate-segment-tags.mjs',
			sources: [PROPOSED_FILE, NEXT_CODEBOOK_FILE, MAP_FILE],
			codebook_schema_version: nextCodebook.meta?.schema_version ?? '2.0-draft',
			migration_status: 'draft',
			migration_notes: [
				`Re-keyed from codebook.json @ ${propDoc.meta?.codebook_schema_version ?? '1.x'} to codebook.next.json @ ${nextCodebook.meta?.schema_version ?? '2.0-draft'}.`,
				`${stats2.changed} of ${stats2.total} proposals changed shape.`
			]
		},
		proposals: newProposals
	};

	writeFileSync(resolve(ROOT, PROPOSED_OUT), JSON.stringify(propOut, null, 2) + '\n', 'utf8');
	console.log(`\nWrote ${PROPOSED_OUT}`);
	printStats(stats2, 'segment_tags.proposed.json');
}

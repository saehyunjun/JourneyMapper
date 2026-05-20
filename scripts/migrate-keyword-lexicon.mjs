/**
 * migrate-keyword-lexicon.mjs
 *
 * Ports the 102 clusters in keyword_lexicon.json @ 2.0 into the flat
 * `clusters[]` shape of keyword_lexicon.next.json @ 3.0-draft, attaching
 * parent_theme + parent_subtheme FKs per a heuristic mapping (category
 * defaults + per-cluster overrides). Variants and ids are preserved verbatim.
 *
 * Writes a fresh keyword_lexicon.next.json, preserving the meta block from
 * the existing draft.
 *
 * Run: node scripts/migrate-keyword-lexicon.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SRC_LEXICON = 'src/lib/content/wctglpdemo-data/keyword_lexicon.json';
const NEXT_LEXICON = 'src/lib/content/wctglpdemo-data/keyword_lexicon.next.json';
const NEXT_CODEBOOK = 'src/lib/content/wctglpdemo-data/codebook.next.json';

// --- Mapping ----------------------------------------------------------------
// Defaults per old category. Most clusters in a category share intent.

const CATEGORY_DEFAULTS = {
	medications: { theme: 'treatment', subtheme: 'treatment_health_history' },
	insurance_finances: { theme: 'treatment', subtheme: 'treatment_barriers' },
	lifestyle: { theme: 'condition_specific', subtheme: 'medical_self_efficacy' },
	concerns_risks: { theme: 'treatment', subtheme: 'treatment_negative_experiences' },
	clinical_trial: { theme: 'clinical_trials', subtheme: 'trial_barriers' },
	health_conditions: { theme: 'condition_specific', subtheme: 'comorbidities' },
	education_support: { theme: 'clinical_trials', subtheme: 'trial_motivators' }
};

// Per-cluster overrides — where the category default doesn't apply.
const OVERRIDES = {
	// insurance_finances → some are trial-specific incentives
	financial_compensation: { theme: 'clinical_trials', subtheme: 'trial_motivators' },
	vouchers: { theme: 'clinical_trials', subtheme: 'trial_motivators' },

	// concerns_risks → split between negative experiences (default), decision factors, and barriers
	shortages: { theme: 'treatment', subtheme: 'treatment_barriers' },
	scary: { theme: 'treatment', subtheme: 'treatment_decision_factors' },
	guinea_pig: { theme: 'treatment', subtheme: 'treatment_decision_factors' },
	weight_regain: { theme: 'treatment', subtheme: 'treatment_decision_factors' },
	safety: { theme: 'treatment', subtheme: 'treatment_knowledge_gaps' },
	needle_phobia: { theme: 'treatment', subtheme: 'treatment_barriers' },
	risk: { theme: 'treatment', subtheme: 'treatment_decision_factors' },
	harm: { theme: 'treatment', subtheme: 'treatment_decision_factors' },
	concern: { theme: 'treatment', subtheme: 'treatment_decision_factors' },
	hunger: { theme: 'treatment', subtheme: 'treatment_positive_experiences' },

	// clinical_trial → not all are barriers; trial-design concepts are knowledge gaps,
	// human supports are motivators
	clinical_trial: { theme: 'clinical_trials', subtheme: 'clinical_trial_knowledge_gaps' },
	placebo: { theme: 'clinical_trials', subtheme: 'clinical_trial_knowledge_gaps' },
	randomized: { theme: 'clinical_trials', subtheme: 'clinical_trial_knowledge_gaps' },
	telehealth: { theme: 'clinical_trials', subtheme: 'trial_motivators' },
	home_visits: { theme: 'clinical_trials', subtheme: 'trial_motivators' },
	nurse: { theme: 'clinical_trials', subtheme: 'trial_motivators' },
	study_doctor: { theme: 'clinical_trials', subtheme: 'trial_motivators' },
	travel_concierge: { theme: 'clinical_trials', subtheme: 'trial_motivators' },
	better: { theme: 'condition_specific', subtheme: 'medical_self_efficacy' },

	// health_conditions → weight outcomes are treatment positives; comorbidities stay; obesity = primary symptom
	weight_loss: { theme: 'treatment', subtheme: 'treatment_positive_experiences' },
	weight_maintenance: { theme: 'treatment', subtheme: 'treatment_positive_experiences' },
	obesity: { theme: 'condition_specific', subtheme: 'symptoms' },
	genetics: { theme: 'condition_specific', subtheme: 'condition_knowledge_gaps' },
	quality_of_life: { theme: 'treatment', subtheme: 'treatment_positive_experiences' },

	// education_support → support → peer groups, otherwise stays as trial-motivator
	support: { theme: 'condition_specific', subtheme: 'advocacy_peer_groups' }
};

// Titlecase a snake_case id for use as a default label.
const titleCase = (id) => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// --- Read inputs ------------------------------------------------------------

const oldLex = JSON.parse(readFileSync(resolve(ROOT, SRC_LEXICON), 'utf8'));
const nextLex = JSON.parse(readFileSync(resolve(ROOT, NEXT_LEXICON), 'utf8'));
const nextCb = JSON.parse(readFileSync(resolve(ROOT, NEXT_CODEBOOK), 'utf8'));

// Build a validator for (theme, subtheme) pairs.
const validPairs = new Set();
const validThemes = new Set();
for (const t of nextCb.themes) {
	validThemes.add(t.id);
	for (const s of t.subthemes ?? []) validPairs.add(`${t.id}::${s.id}`);
}

// --- Map every cluster ------------------------------------------------------

const newClusters = [];
const stats = { mapped_by_override: 0, mapped_by_default: 0, unmapped_categories: new Set() };

for (const cat of oldLex.categories) {
	const def = CATEGORY_DEFAULTS[cat.id];
	if (!def) {
		stats.unmapped_categories.add(cat.id);
		continue;
	}
	for (const kw of cat.keywords) {
		const o = OVERRIDES[kw.id];
		const parent = o ?? def;
		if (o) stats.mapped_by_override++;
		else stats.mapped_by_default++;

		const pair = `${parent.theme}::${parent.subtheme}`;
		if (!validPairs.has(pair)) {
			console.error(`[ERROR] cluster "${kw.id}" → invalid pair (${parent.theme}, ${parent.subtheme})`);
			process.exit(1);
		}

		newClusters.push({
			id: kw.id,
			label: kw.label || titleCase(kw.id),
			description: '',
			parent_theme: parent.theme,
			parent_subtheme: parent.subtheme,
			variants: kw.variants
		});
	}
}

if (stats.unmapped_categories.size > 0) {
	console.error(`[ERROR] unmapped old categories:`, [...stats.unmapped_categories]);
	process.exit(1);
}

// Sort clusters by (parent_theme, parent_subtheme, id) for stable, diff-friendly output.
newClusters.sort((a, b) => {
	if (a.parent_theme !== b.parent_theme) return a.parent_theme.localeCompare(b.parent_theme);
	if (a.parent_subtheme !== b.parent_subtheme)
		return a.parent_subtheme.localeCompare(b.parent_subtheme);
	return a.id.localeCompare(b.id);
});

// --- Write ------------------------------------------------------------------

nextLex.clusters = newClusters;
nextLex.meta.changelog = [
	...(nextLex.meta.changelog ?? []),
	`3.0-draft (porting pass) — ported ${newClusters.length} clusters from keyword_lexicon.json @ 2.0 via scripts/migrate-keyword-lexicon.mjs. Each cluster carries parent_theme + parent_subtheme assigned by category default + per-cluster overrides. Descriptions are empty for now; analyst should backfill as part of Phase 0 review.`
];

writeFileSync(
	resolve(ROOT, NEXT_LEXICON),
	JSON.stringify(nextLex, null, 2) + '\n',
	'utf8'
);

// --- Summary ----------------------------------------------------------------

console.log(`Wrote ${NEXT_LEXICON}`);
console.log(`  clusters ported: ${newClusters.length}`);
console.log(`  by category default: ${stats.mapped_by_default}`);
console.log(`  by per-cluster override: ${stats.mapped_by_override}`);

// Distribution by new subtheme
const bySubtheme = {};
for (const c of newClusters) {
	bySubtheme[c.parent_subtheme] = (bySubtheme[c.parent_subtheme] ?? 0) + 1;
}
console.log(`  by parent_subtheme:`);
for (const [s, n] of Object.entries(bySubtheme).sort((a, b) => b[1] - a[1])) {
	console.log(`    ${s}: ${n}`);
}

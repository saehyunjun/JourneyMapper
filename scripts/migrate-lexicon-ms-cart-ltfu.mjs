/**
 * migrate-lexicon-ms-cart-ltfu.mjs
 *
 * Upgrades keyword_lexicon.json from schema 3.6 → 3.7 by appending three
 * coordinated cluster sets:
 *
 *   1. Multiple Sclerosis (indication: ['multiple_sclerosis']) — full parallel
 *      pass mirroring the LN expansion: DMTs, symptoms, MRI/EDSS labs,
 *      comorbidities, self-management, side effects, barriers, decision factors,
 *      stigma, advocacy, and MS-specific trial endpoints.
 *
 *   2. CAR-T modality (cross-cutting, indications: []) — patient-experience
 *      vocabulary that is identical whether the target is LN, MS, or onc:
 *      apheresis, lymphodepletion, CRS, ICANS, B-cell aplasia, inpatient
 *      monitoring window, caregiver requirement, one-and-done framing,
 *      secondary-malignancy anxiety, specialty-pharmacy navigation.
 *
 *   3. Long-Term Follow-Up (cross-cutting, indications: []) — the retention
 *      design surface for 5–15 year LTFU on cell and gene therapies: visit
 *      burden over time, "feeling done," site-relationship continuity,
 *      decentralized visits, caregiver evolution, insurance/life transitions,
 *      AE-reporting fatigue, post-trial identity, data-return motivators.
 *
 * Prerequisite registry updates done outside this migration (hand-edited):
 *   - registries/therapeutic_areas.json: + neurology
 *   - registries/indications.json:        + multiple_sclerosis
 *   - registries/sponsors.json:           + biogen, novartis, tg_therapeutics,
 *                                          kyverna, cabaletta_bio, cartesian_therapeutics
 *   - registries/mechanisms_of_action.json: + s1p_modulator, alpha_4_integrin,
 *                                            car_t_autologous
 *   - registries/drugs.json:               + ocrelizumab, ofatumumab, ublituximab,
 *                                            natalizumab, fingolimod, kyv_101,
 *                                            caba_201, descartes_08
 *
 * This script asserts those rows exist before touching the lexicon.
 *
 * Idempotent: re-running strips any prior MS / CAR-T modality / LTFU clusters
 *   (matched by id) and re-appends the canonical authored set.
 *
 * Validates the full FK chain (indication, codebook subtheme, drug_id, burden
 * category) and writes nothing on any integrity failure (exit 1).
 *
 * Run: node scripts/migrate-lexicon-ms-cart-ltfu.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const LEXICON = `${DATA_DIR}/keyword_lexicon.json`;
const BACKUP = `${DATA_DIR}/keyword_lexicon.v3.6-backup.json`;
const CODEBOOK = `${DATA_DIR}/codebook.json`;
const REGISTRY_DIR = 'src/lib/content/registries';
const INDICATIONS_FILE = `${REGISTRY_DIR}/indications.json`;
const DRUGS_FILE = `${REGISTRY_DIR}/drugs.json`;
const MOAS_FILE = `${REGISTRY_DIR}/mechanisms_of_action.json`;
const SPONSORS_FILE = `${REGISTRY_DIR}/sponsors.json`;
const TAS_FILE = `${REGISTRY_DIR}/therapeutic_areas.json`;
const BURDENS_FILE = `${REGISTRY_DIR}/burden_categories.json`;

const fail = (msg) => {
	console.error(`[ERROR] ${msg}`);
	process.exit(1);
};

// --- Load + validate registries --------------------------------------------

const indications = JSON.parse(readFileSync(resolve(ROOT, INDICATIONS_FILE), 'utf8'));
const drugs = JSON.parse(readFileSync(resolve(ROOT, DRUGS_FILE), 'utf8'));
const moas = JSON.parse(readFileSync(resolve(ROOT, MOAS_FILE), 'utf8'));
const sponsors = JSON.parse(readFileSync(resolve(ROOT, SPONSORS_FILE), 'utf8'));
const tas = JSON.parse(readFileSync(resolve(ROOT, TAS_FILE), 'utf8'));
const burdens = JSON.parse(readFileSync(resolve(ROOT, BURDENS_FILE), 'utf8'));
const codebook = JSON.parse(readFileSync(resolve(ROOT, CODEBOOK), 'utf8'));

const indicationIds = new Set(indications.items.map((i) => i.id));
const drugIds = new Set(drugs.items.map((d) => d.id));
const moaIds = new Set(moas.items.map((m) => m.id));
const sponsorIds = new Set(sponsors.items.map((s) => s.id));
const taIds = new Set(tas.items.map((a) => a.id));
const burdenIds = new Set(burdens.items.map((b) => b.id));

// Required new rows (set during the hand-edit pass). Fail loudly if any
// upstream registry edit was missed.
const REQUIRED_INDICATIONS = ['multiple_sclerosis'];
const REQUIRED_THERAPEUTIC_AREAS = ['neurology'];
const REQUIRED_SPONSORS = [
	'biogen',
	'novartis',
	'tg_therapeutics',
	'kyverna',
	'cabaletta_bio',
	'cartesian_therapeutics'
];
const REQUIRED_MOAS = ['s1p_modulator', 'alpha_4_integrin', 'car_t_autologous'];
const REQUIRED_DRUGS = [
	'ocrelizumab',
	'ofatumumab',
	'ublituximab',
	'natalizumab',
	'fingolimod',
	'kyv_101',
	'caba_201',
	'descartes_08'
];

for (const id of REQUIRED_INDICATIONS)
	if (!indicationIds.has(id)) fail(`registries/indications.json missing "${id}" — hand-edit first`);
for (const id of REQUIRED_THERAPEUTIC_AREAS)
	if (!taIds.has(id)) fail(`registries/therapeutic_areas.json missing "${id}"`);
for (const id of REQUIRED_SPONSORS)
	if (!sponsorIds.has(id)) fail(`registries/sponsors.json missing "${id}"`);
for (const id of REQUIRED_MOAS)
	if (!moaIds.has(id)) fail(`registries/mechanisms_of_action.json missing "${id}"`);
for (const id of REQUIRED_DRUGS)
	if (!drugIds.has(id)) fail(`registries/drugs.json missing "${id}"`);

// Also re-validate the drug registry's outgoing FKs to catch any mismatch
// introduced by the hand-edit pass.
for (const d of drugs.items) {
	if (d.moa_id !== null && !moaIds.has(d.moa_id))
		fail(`drugs.json: "${d.id}" references unknown moa_id "${d.moa_id}"`);
	if (d.sponsor_id !== null && !sponsorIds.has(d.sponsor_id))
		fail(`drugs.json: "${d.id}" references unknown sponsor_id "${d.sponsor_id}"`);
	for (const id of d.indication_ids ?? [])
		if (!indicationIds.has(id))
			fail(`drugs.json: "${d.id}" references unknown indication "${id}"`);
}

// (theme, subtheme) validator from the live codebook
const validPairs = new Set();
for (const t of codebook.themes) {
	for (const s of t.subthemes ?? []) validPairs.add(`${t.id}::${s.id}`);
}

// --- Cluster authoring ------------------------------------------------------
//
// Convention: ids are snake_case, globally unique across the whole lexicon.
// burden_category_ids stays empty unless the mapping is obvious from the
// cluster's nature (e.g. logistical_caregiver for caregiver-required clusters).
// Variants are SUGGESTION FUEL ONLY (per schema 3.x); brand/generic names that
// live on a drug entity are NOT duplicated in variants[] (schema 3.6).

const MS_CLUSTERS = [
	// --- Medications & delivery (treatment / treatment_health_history) ---
	{
		id: 'ocrelizumab',
		label: 'Ocrelizumab (Ocrevus)',
		description:
			'Anti-CD20 B-cell-depleting antibody approved for relapsing and primary progressive MS; 600 mg IV every 6 months.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_health_history',
		drug_id: 'ocrelizumab',
		variants: ['anti-cd20 mab', 'b-cell depleting', 'every 6 months', 'twice a year infusion']
	},
	{
		id: 'ofatumumab',
		label: 'Ofatumumab (Kesimpta)',
		description:
			'Anti-CD20 antibody for relapsing MS; subcutaneous self-injection monthly. Same class as ocrelizumab but home-administered.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_health_history',
		drug_id: 'ofatumumab',
		variants: ['self-inject', 'self-injection', 'home injection', 'monthly injection', 'pen injector']
	},
	{
		id: 'ublituximab',
		label: 'Ublituximab (Briumvi)',
		description:
			'Glycoengineered anti-CD20 antibody for relapsing MS; ~1-hour infusion every 6 months.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_health_history',
		drug_id: 'ublituximab',
		variants: ['one hour infusion', '1 hour infusion', 'short infusion']
	},
	{
		id: 'natalizumab',
		label: 'Natalizumab (Tysabri)',
		description:
			'Alpha-4 integrin antagonist for relapsing MS; IV every 4 weeks via TOUCH program. High efficacy offset by PML risk in JCV-positive patients.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_health_history',
		drug_id: 'natalizumab',
		variants: ['tysabri infusion', 'touch program', 'monthly infusion', 'every 4 weeks']
	},
	{
		id: 'fingolimod',
		label: 'Fingolimod (Gilenya)',
		description:
			'First oral DMT for relapsing MS; S1P receptor modulator. First-dose cardiac monitoring required.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_health_history',
		drug_id: 'fingolimod',
		variants: ['first dose observation', 'cardiac monitoring', 's1p oral']
	},
	{
		id: 'ms_anti_cd20_class',
		label: 'Anti-CD20 DMTs (class)',
		description:
			'The high-efficacy anti-CD20 class — ocrelizumab, ofatumumab, ublituximab, off-label rituximab — for relapsing and progressive MS.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_health_history',
		variants: [
			'anti-cd20',
			'anti cd20',
			'b cell depleting therapy',
			'b-cell depleting therapy',
			'cd20 depletion'
		]
	},
	{
		id: 'ms_s1p_class',
		label: 'S1P modulators (class)',
		description:
			'Sphingosine-1-phosphate receptor modulators — fingolimod, siponimod, ozanimod, ponesimod. Oral, lymphocyte-sequestering.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_health_history',
		variants: [
			's1p modulator',
			's1p inhibitor',
			'sphingosine',
			'gilenya',
			'mayzent',
			'zeposia',
			'ponvory',
			'siponimod',
			'ozanimod',
			'ponesimod'
		]
	},
	{
		id: 'ms_oral_dmt',
		label: 'Oral DMTs (fumarates / teriflunomide / cladribine)',
		description:
			'The oral disease-modifying therapy options patients name — fumarates (Tecfidera, Vumerity), teriflunomide (Aubagio), cladribine (Mavenclad).',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_health_history',
		variants: [
			'oral dmt',
			'oral medication',
			'tecfidera',
			'dimethyl fumarate',
			'vumerity',
			'diroximel fumarate',
			'aubagio',
			'teriflunomide',
			'mavenclad',
			'cladribine'
		]
	},
	{
		id: 'ms_injectable_dmt',
		label: 'Injectable DMTs (interferons / glatiramer)',
		description:
			'Platform injectable DMTs — interferon-beta products (Avonex, Rebif, Betaseron, Plegridy) and glatiramer acetate (Copaxone).',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_health_history',
		variants: [
			'interferon',
			'interferon beta',
			'beta interferon',
			'avonex',
			'rebif',
			'betaseron',
			'plegridy',
			'extavia',
			'copaxone',
			'glatiramer',
			'glatiramer acetate'
		]
	},
	{
		id: 'ms_dmt_switching',
		label: 'DMT switching / cycling',
		description:
			'The pattern of moving between DMTs over years — switching for breakthrough disease, side effects, or pregnancy planning.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_health_history',
		variants: [
			'switched dmt',
			'switched medications',
			'changed dmt',
			'breakthrough disease',
			'failed therapy',
			'new dmt'
		]
	},

	// --- Symptoms (condition_specific / symptoms) ---
	{
		id: 'multiple_sclerosis_dx',
		label: 'Multiple sclerosis (diagnosis)',
		description:
			'Identification with the diagnosis and its course — relapsing-remitting (RRMS), secondary-progressive (SPMS), primary-progressive (PPMS), clinically isolated syndrome (CIS).',
		parent_theme: 'condition_specific',
		parent_subtheme: 'symptoms',
		variants: [
			'multiple sclerosis',
			'ms',
			'relapsing remitting',
			'relapsing-remitting',
			'rrms',
			'secondary progressive',
			'spms',
			'primary progressive',
			'ppms',
			'clinically isolated syndrome',
			'cis'
		]
	},
	{
		id: 'ms_relapse',
		label: 'MS relapse / attack',
		description:
			'A new neurologic episode lasting >24 hours — the central event in relapsing MS. Patients call them attacks, flares, or exacerbations.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'symptoms',
		variants: [
			'relapse',
			'relapses',
			'attack',
			'attacks',
			'flare',
			'flare up',
			'flare-up',
			'exacerbation',
			'pseudoexacerbation',
			'new episode'
		]
	},
	{
		id: 'ms_fatigue',
		label: 'MS fatigue (lassitude)',
		description:
			'The MS-specific fatigue — distinct from ordinary tiredness; one of the most disabling and under-treated symptoms.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'symptoms',
		variants: [
			'ms fatigue',
			'lassitude',
			'crushing fatigue',
			'wiped out',
			'fatigue wall',
			'exhausted',
			'no energy'
		]
	},
	{
		id: 'ms_walking_difficulty',
		label: 'Walking difficulty / gait',
		description:
			'Loss of ambulation — slowed walking speed, foot drop, falls, eventual use of cane, walker, or wheelchair.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'symptoms',
		variants: [
			'walking',
			'gait',
			'foot drop',
			'falling',
			'falls',
			'unsteady',
			'use a cane',
			'walker',
			'wheelchair',
			'mobility aid',
			'25 foot walk',
			't25fw'
		]
	},
	{
		id: 'ms_spasticity',
		label: 'Spasticity / muscle stiffness',
		description: 'Increased muscle tone, spasms, and stiffness — common in lower limbs.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'symptoms',
		variants: [
			'spasticity',
			'spasms',
			'muscle spasms',
			'leg spasms',
			'stiffness',
			'tight muscles',
			'clonus'
		]
	},
	{
		id: 'ms_numbness_tingling',
		label: 'Numbness / tingling (paresthesia)',
		description:
			'Sensory disturbances — numbness, pins and needles, burning — often the first MS symptom patients notice.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'symptoms',
		variants: [
			'numbness',
			'numb',
			'tingling',
			'pins and needles',
			'paresthesia',
			'paraesthesia',
			'burning sensation',
			'electric shock',
			"lhermitte's"
		]
	},
	{
		id: 'ms_optic_neuritis',
		label: 'Optic neuritis / vision changes',
		description:
			'Inflammation of the optic nerve — blurred or lost vision, pain with eye movement — often a presenting MS symptom.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'symptoms',
		variants: [
			'optic neuritis',
			'blurred vision',
			'lost vision',
			'vision loss',
			'eye pain',
			'color desaturation',
			'double vision',
			'diplopia'
		]
	},
	{
		id: 'ms_cognitive_dysfunction',
		label: 'Cog fog / cognitive dysfunction',
		description:
			'Slowed processing speed, working-memory and attention deficits — common but under-reported in MS.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'symptoms',
		variants: [
			'cog fog',
			'brain fog',
			'cognitive fog',
			'cognitive issues',
			'memory problems',
			'forgetful',
			'slow processing',
			'word finding',
			'sdmt'
		]
	},
	{
		id: 'ms_bladder_bowel',
		label: 'Bladder / bowel dysfunction',
		description:
			'Urinary urgency, frequency, retention, incontinence; constipation. Common, embarrassing, and frequently undisclosed.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'symptoms',
		variants: [
			'bladder',
			'urinary urgency',
			'urinary frequency',
			'urinary retention',
			'incontinence',
			'leakage',
			'self catheterize',
			'self-cath',
			'bowel',
			'constipation'
		]
	},
	{
		id: 'ms_heat_sensitivity',
		label: "Heat sensitivity (Uhthoff's)",
		description:
			"Uhthoff's phenomenon — symptoms worsen with heat (hot shower, exercise, weather). Drives cooling strategies.",
		parent_theme: 'condition_specific',
		parent_subtheme: 'symptoms',
		variants: [
			'heat sensitivity',
			'heat intolerance',
			"uhthoff",
			"uhthoff's",
			'hot shower',
			'hot weather'
		]
	},
	{
		id: 'ms_pain',
		label: 'MS pain (neuropathic, MS hug)',
		description:
			'Neuropathic pain syndromes in MS — trigeminal neuralgia, the "MS hug" (truncal banding), burning extremities.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'symptoms',
		variants: [
			'neuropathic pain',
			'trigeminal neuralgia',
			'ms hug',
			'ms band',
			'banding sensation',
			'nerve pain'
		]
	},
	{
		id: 'ms_progression',
		label: 'Disability progression',
		description:
			'The accumulating disability arc patients fear — independent of relapses in progressive forms; "PIRA" in trials.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'symptoms',
		variants: [
			'progression',
			'getting worse',
			'progressive',
			'pira',
			'disability progression',
			'losing function',
			'losing ability'
		]
	},

	// --- Comorbidities (condition_specific / comorbidities) ---
	{
		id: 'ms_depression_anxiety',
		label: 'Depression / anxiety (MS)',
		description:
			'Mood disorders are common comorbidities in MS — partly disease-driven (cortical involvement, immune signaling), partly reactive.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'comorbidities',
		variants: ['depression', 'anxiety', 'mood disorder', 'antidepressant', 'mental health']
	},
	{
		id: 'ms_pml_history',
		label: 'PML / opportunistic CNS infection',
		description:
			'Progressive multifocal leukoencephalopathy — a rare JC-virus opportunistic infection most associated with natalizumab in JCV-positive patients.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'comorbidities',
		variants: [
			'pml',
			'progressive multifocal leukoencephalopathy',
			'jc virus',
			'jcv',
			'opportunistic infection'
		]
	},

	// --- Labs & disease mechanics (condition_specific / condition_knowledge_gaps) ---
	{
		id: 'ms_mri_lesions',
		label: 'MRI / lesions',
		description:
			'Brain and spinal-cord MRI — T2 lesion burden, gadolinium-enhancing (active) lesions, new vs stable; the standard MS monitoring tool.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'condition_knowledge_gaps',
		variants: [
			'mri',
			'mri scan',
			'lesion',
			'lesions',
			'new lesion',
			't2 lesion',
			'gadolinium',
			'gad enhancing',
			'enhancing lesion',
			'plaque',
			'plaques',
			'demyelination',
			'spinal cord lesion'
		]
	},
	{
		id: 'edss_score',
		label: 'EDSS / disability score',
		description:
			'Expanded Disability Status Scale — the 0–10 walking-distance-anchored disability score used in MS trials and clinic.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'condition_knowledge_gaps',
		variants: ['edss', 'disability score', 'expanded disability status scale']
	},
	{
		id: 'ms_relapse_rate',
		label: 'Annualized relapse rate (ARR)',
		description: 'The standard relapse-frequency metric used in MS trials and patient-facing data.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'condition_knowledge_gaps',
		variants: ['annualized relapse rate', 'arr', 'relapse rate', 'relapse free']
	},
	{
		id: 'jcv_antibody_status',
		label: 'JC virus antibody status',
		description:
			'JCV serostatus — checked before and during natalizumab; positive index raises PML risk and drives DMT decisions.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'condition_knowledge_gaps',
		variants: ['jcv antibody', 'jc virus antibody', 'jcv positive', 'jcv negative', 'stratify test']
	},

	// --- Self-management (condition_specific / medical_self_efficacy) ---
	{
		id: 'ms_pt_ot',
		label: 'Physical / occupational therapy',
		description:
			'PT, OT, and speech therapy — the workhorse non-pharm interventions for MS function and mobility.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'medical_self_efficacy',
		variants: [
			'physical therapy',
			'pt',
			'occupational therapy',
			'ot',
			'speech therapy',
			'rehab',
			'rehabilitation'
		]
	},
	{
		id: 'ms_cooling_strategies',
		label: 'Cooling strategies',
		description:
			'Cooling vests, ice packs, cold drinks, air conditioning — patient workarounds for heat sensitivity.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'medical_self_efficacy',
		variants: ['cooling vest', 'ice pack', 'cold drink', 'air conditioning', 'cooling strategies']
	},
	{
		id: 'ms_symptom_journal',
		label: 'MS symptom / relapse journal',
		description:
			'Logging symptoms, suspected relapses, and treatment response to share with the neurology team.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'medical_self_efficacy',
		variants: [
			'symptom journal',
			'symptom diary',
			'tracking symptoms',
			'relapse log',
			'ms tracker app'
		]
	},

	// --- QoL (treatment / treatment_positive_experiences) ---
	{
		id: 'ms_quality_of_life',
		label: 'Quality of life (MS)',
		description:
			'Felt impact of MS and DMTs on daily life — stamina, function, independence, "stop the progression," "back to myself."',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_positive_experiences',
		variants: [
			'quality of life',
			'back to myself',
			'stop the progression',
			'stop progression',
			'no new lesions',
			'no relapses',
			'feeling normal',
			'back to normal'
		]
	},

	// --- Side effects (treatment / treatment_negative_experiences) ---
	{
		id: 'ms_dmt_side_effects',
		label: 'DMT side effects (injection / flushing / labs)',
		description:
			'Common DMT side effects patients name — injection-site reactions, fumarate flushing, GI upset, lymphopenia, fatigue.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_negative_experiences',
		variants: [
			'injection site reaction',
			'injection site',
			'flushing',
			'flush reaction',
			'lymphopenia',
			'low lymphocytes',
			'flu like symptoms',
			'flu-like'
		]
	},
	{
		id: 'ms_infusion_reactions',
		label: 'Infusion reactions',
		description:
			'Infusion-related reactions to anti-CD20 DMTs — itching, throat tightness, fevers — usually with the first dose.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_negative_experiences',
		variants: ['infusion reaction', 'itchy throat', 'throat tightness', 'chills during infusion']
	},

	// --- Treatment barriers (treatment / treatment_barriers) ---
	{
		id: 'pml_jcv_concerns',
		label: 'PML / JCV risk concerns',
		description:
			'PML risk weighed against natalizumab benefit — JCV positivity, prior immunosuppression, treatment duration.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_barriers',
		variants: ['pml risk', 'jcv risk', 'pml concern', 'risk of pml', "afraid of pml"]
	},
	{
		id: 'ms_refractory',
		label: 'Refractory / failed-everything framing',
		description:
			'The "tried everything" arc — DMT failures stack up, motivating openness to CAR-T or autologous stem-cell transplant.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_barriers',
		variants: [
			'tried everything',
			'failed dmt',
			'failed multiple dmts',
			'refractory ms',
			'out of options',
			'nothing is working'
		]
	},

	// --- Decision factors (treatment / treatment_decision_factors) ---
	{
		id: 'high_efficacy_first',
		label: 'High-efficacy first vs escalation',
		description:
			'The treatment-strategy debate patients hear about — start with high-efficacy DMT vs escalate from platform therapy.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_decision_factors',
		variants: [
			'high efficacy first',
			'high-efficacy first',
			'hit hard early',
			'aggressive treatment',
			'escalation',
			'platform first'
		]
	},
	{
		id: 'dmt_discontinuation_risk',
		label: 'DMT discontinuation risk',
		description:
			'Fear that stopping DMT in older or stable MS will trigger rebound or new disease activity — DISCOMS-type questions.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_decision_factors',
		variants: [
			'stop dmt',
			'stop my dmt',
			'come off dmt',
			'discontinue dmt',
			'rebound',
			'rebound disease'
		]
	},

	// --- Stigma (condition_specific / social_stigma) ---
	{
		id: 'ms_invisible_disability',
		label: 'Invisible disability (MS)',
		description:
			"Symptoms — fatigue, cognitive dysfunction, pain — that aren't visible; the disbelief and judgment that follow.",
		parent_theme: 'condition_specific',
		parent_subtheme: 'social_stigma',
		variants: [
			'invisible disability',
			'invisible illness',
			"you don't look sick",
			"don't look sick",
			'people don’t believe me',
			'no one believes me'
		]
	},

	// --- Advocacy (condition_specific / advocacy_peer_groups) ---
	{
		id: 'ms_society_advocacy',
		label: 'MS Society / advocacy',
		description:
			'National MS Society, MS International Federation, MS Trust, and local chapters — patient education, advocacy, and peer programs.',
		parent_theme: 'condition_specific',
		parent_subtheme: 'advocacy_peer_groups',
		variants: [
			'national ms society',
			'nmss',
			'ms society',
			'ms trust',
			'msaa',
			'walk ms',
			'msif'
		]
	},

	// --- Trial endpoints (clinical_trials / clinical_trial_knowledge_gaps) ---
	{
		id: 'ms_trial_endpoints',
		label: 'MS trial endpoints (EDSS / ARR / MRI)',
		description:
			'The endpoints MS trials use — confirmed disability progression on EDSS, annualized relapse rate, new T2 / gad-enhancing MRI lesions, NEDA.',
		parent_theme: 'clinical_trials',
		parent_subtheme: 'clinical_trial_knowledge_gaps',
		variants: [
			'confirmed disability progression',
			'cdp',
			'neda',
			'no evidence of disease activity',
			'primary endpoint',
			'mri endpoint'
		]
	}
].map((c) => ({ ...c, indications: ['multiple_sclerosis'] }));

const CART_MODALITY_CLUSTERS = [
	{
		id: 'car_t_therapy',
		label: 'CAR T-cell therapy (modality)',
		description:
			'Engineered autologous T-cells targeting a surface antigen (usually CD19 in autoimmune disease). The cross-cutting modality concept that spans LN, MS, myasthenia gravis, and onc indications.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_health_history',
		variants: [
			'car t',
			'car-t',
			'car t cell',
			'car t-cell',
			'cell therapy',
			'cell and gene therapy',
			'engineered t cell',
			'cd19 car t'
		]
	},
	{
		id: 'apheresis',
		label: 'Apheresis / cell collection',
		description:
			'The day patients have their T-cells collected by apheresis — and the manufacturing wait that follows before reinfusion.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_health_history',
		variants: [
			'apheresis',
			'leukapheresis',
			'cell collection',
			'collected my cells',
			'manufacturing wait',
			'waiting for cells'
		]
	},
	{
		id: 'bridging_therapy',
		label: 'Bridging therapy',
		description:
			'Treatment given between apheresis and CAR-T infusion to control disease while cells are being manufactured.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_health_history',
		variants: ['bridging therapy', 'bridge therapy', 'while we wait', 'between collection and infusion']
	},
	{
		id: 'car_t_infusion_day',
		label: 'CAR-T infusion day',
		description: 'The day of CAR-T reinfusion itself and the immediate post-infusion period.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_health_history',
		variants: ['infusion day', 'reinfusion', 'day zero', 'day 0', 'cells back', 'getting my cells back']
	},
	{
		id: 'lymphodepletion',
		label: 'Lymphodepletion conditioning',
		description:
			'Fludarabine + cyclophosphamide (or similar) given before CAR-T reinfusion to make room for the engineered cells; the part patients dread most.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_negative_experiences',
		burden_category_ids: ['physical_side_effects', 'emotional_fear'],
		variants: [
			'lymphodepletion',
			'lympho depletion',
			'conditioning',
			'conditioning chemo',
			'fludarabine',
			'flu cy',
			'flu/cy',
			'before infusion chemo'
		]
	},
	{
		id: 'cytokine_release_syndrome',
		label: 'Cytokine release syndrome (CRS)',
		description:
			'Fevers, hypotension, hypoxia driven by T-cell activation post-CAR-T; managed with tocilizumab and steroids. Generally milder in autoimmune CAR-T than onc.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_negative_experiences',
		burden_category_ids: ['physical_side_effects', 'emotional_fear'],
		variants: [
			'cytokine release syndrome',
			'crs',
			'cytokine storm',
			'tocilizumab',
			'actemra',
			'high fever after infusion'
		]
	},
	{
		id: 'icans_neurotoxicity',
		label: 'ICANS / neurotoxicity',
		description:
			'Immune-effector-cell-associated neurotoxicity syndrome — confusion, aphasia, tremor; the post-CAR-T monitoring window watches for it.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_negative_experiences',
		burden_category_ids: ['physical_side_effects', 'emotional_fear'],
		variants: [
			'icans',
			'neurotoxicity',
			'ice score',
			'confusion after infusion',
			'aphasia',
			'tremor after car t'
		]
	},
	{
		id: 'b_cell_aplasia_infections',
		label: 'B-cell aplasia / infection vigilance',
		description:
			'Sustained B-cell depletion post-CAR-T — low immunoglobulins, infection risk, IVIG replacement, vaccine timing decisions.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_negative_experiences',
		burden_category_ids: ['physical_side_effects', 'emotional_uncertainty'],
		variants: [
			'b cell aplasia',
			'b-cell aplasia',
			'low immunoglobulins',
			'hypogammaglobulinemia',
			'ivig',
			'immunoglobulin replacement',
			'frequent infections',
			'vaccine timing'
		]
	},
	{
		id: 'car_t_inpatient_monitoring',
		label: 'Inpatient monitoring window',
		description:
			'The required inpatient stay after CAR-T infusion (typical CRS/ICANS watch period) — visit burden + caregiver requirement.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_barriers',
		burden_category_ids: ['regimen_appointments', 'logistical_caregiver'],
		variants: [
			'inpatient stay',
			'admitted to hospital',
			'monitoring window',
			'first two weeks',
			'first 30 days',
			'observation period'
		]
	},
	{
		id: 'car_t_caregiver_required',
		label: 'Required caregiver / 24-hour support',
		description:
			'Trial protocols require a dedicated caregiver for weeks post-CAR-T — a major barrier for patients without support at home.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_barriers',
		burden_category_ids: ['logistical_caregiver', 'social_relationships'],
		variants: [
			'required caregiver',
			'need a caregiver',
			'24 hour caregiver',
			'24-hour support',
			'someone with me',
			'cannot drive',
			'no driving for'
		]
	},
	{
		id: 'specialty_pharmacy_navigation',
		label: 'Specialty pharmacy / authorization navigation',
		description:
			'Insurance authorization, specialty pharmacy coordination, and treatment-center referral logistics specific to cell therapy.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_barriers',
		burden_category_ids: ['information_navigation', 'financial_insurance'],
		variants: [
			'specialty pharmacy',
			'prior authorization',
			'treatment center',
			'certified center',
			'referral to specialist',
			'navigator'
		]
	},
	{
		id: 'one_and_done_appeal',
		label: '"One-and-done" framing',
		description:
			'The single-administration mental model patients hold about CAR-T — both the appeal vs chronic DMT and the let-down when LTFU visits continue.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_decision_factors',
		burden_category_ids: ['qol_normalcy'],
		variants: [
			'one and done',
			'one-and-done',
			'one time treatment',
			'single infusion',
			'no more pills',
			'no more injections',
			'drug free'
		]
	},
	{
		id: 'secondary_malignancy_concern',
		label: 'Secondary malignancy / black-box concern',
		description:
			'The FDA boxed warning on CAR-T about secondary T-cell malignancies — a real conversational object in informed-consent and patient decisions.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_decision_factors',
		burden_category_ids: ['emotional_fear', 'emotional_uncertainty'],
		variants: [
			'secondary malignancy',
			'secondary cancer',
			't cell lymphoma',
			'black box warning',
			'boxed warning',
			'cancer risk from car t'
		]
	},
	{
		id: 'car_t_long_term_unknowns',
		label: 'Long-term unknowns (CAR-T)',
		description:
			'Patient awareness that long-term CAR-T effects are still being learned — a knowledge gap that LTFU is designed to close.',
		parent_theme: 'treatment',
		parent_subtheme: 'treatment_knowledge_gaps',
		burden_category_ids: ['emotional_uncertainty'],
		variants: [
			'long term unknowns',
			'long-term unknowns',
			'long term safety',
			'long-term safety',
			"don't know yet",
			'still learning',
			'too new to know'
		]
	}
].map((c) => ({ ...c, indications: [] }));

const LTFU_CLUSTERS = [
	{
		id: 'ltfu_long_horizon',
		label: 'Long follow-up horizon (5–15 years)',
		description:
			'The multi-year follow-up commitment cell- and gene-therapy patients sign up for — FDA expectation of ~15 years for integrating vectors.',
		parent_theme: 'clinical_trials',
		parent_subtheme: 'trial_barriers',
		burden_category_ids: ['regimen_appointments', 'emotional_uncertainty'],
		variants: [
			'long term follow up',
			'long-term follow up',
			'ltfu',
			'15 year follow up',
			'12 year follow up',
			'long term follow-up',
			'years of follow up',
			'years of follow-up'
		]
	},
	{
		id: 'ltfu_visit_burden_over_time',
		label: 'Visit burden over time',
		description:
			'How LTFU visits, blood draws, and questionnaires feel year-after-year — burden that compounds as enthusiasm wanes.',
		parent_theme: 'clinical_trials',
		parent_subtheme: 'trial_barriers',
		burden_category_ids: ['regimen_appointments', 'logistical_travel'],
		variants: [
			'follow up visits',
			'follow-up visits',
			'still going in',
			'too many visits',
			'tired of the visits',
			'driving up there again',
			'another blood draw'
		]
	},
	{
		id: 'ltfu_feeling_done',
		label: '"Feeling done" with the trial',
		description:
			'The retention killer — patients feel cured, want to move on, no longer identify with the disease or the study.',
		parent_theme: 'clinical_trials',
		parent_subtheme: 'trial_barriers',
		burden_category_ids: ['emotional_uncertainty', 'qol_normalcy'],
		variants: [
			'feeling done',
			"i'm done",
			'over it',
			'move on with my life',
			'put it behind me',
			"don't want to think about it",
			'ready to be done'
		]
	},
	{
		id: 'ltfu_caregiver_evolution',
		label: 'Caregiver evolution over years',
		description:
			'How the caregiver role changes over a 5–15 year LTFU — partner changes, kids grow up, parents age out.',
		parent_theme: 'clinical_trials',
		parent_subtheme: 'trial_barriers',
		burden_category_ids: ['logistical_caregiver', 'social_relationships'],
		variants: [
			'caregiver changed',
			'no one to bring me',
			'my husband used to drive',
			'partner changed',
			'kids grew up',
			'parents got older'
		]
	},
	{
		id: 'ltfu_insurance_life_transitions',
		label: 'Insurance / life transitions',
		description:
			'Changes in coverage, employment, geography, or Medicare eligibility over a 12-year window — affect both continued access and follow-up logistics.',
		parent_theme: 'clinical_trials',
		parent_subtheme: 'trial_barriers',
		burden_category_ids: ['financial_insurance'],
		variants: [
			'changed insurance',
			'lost coverage',
			'aged into medicare',
			'aged out',
			'moved away',
			'new job',
			'switched plans',
			'lost employer coverage'
		]
	},
	{
		id: 'ltfu_ae_reporting_fatigue',
		label: 'Adverse-event reporting fatigue',
		description:
			'Patients tire of logging every cold, infection, and symptom over years — leading to under-reporting that erodes safety data completeness.',
		parent_theme: 'clinical_trials',
		parent_subtheme: 'trial_barriers',
		burden_category_ids: ['regimen_monitoring'],
		variants: [
			'reporting every',
			'logging symptoms',
			'every cold',
			'every infection',
			"don't bother reporting",
			'stopped reporting'
		]
	},
	{
		id: 'ltfu_altruism_motivator',
		label: 'Altruism / next-patient motivator',
		description:
			'The "for the next person" motivator that keeps trial participants engaged through long follow-up.',
		parent_theme: 'clinical_trials',
		parent_subtheme: 'trial_motivators',
		variants: [
			'for the next person',
			'help others',
			'help future patients',
			'pay it forward',
			'altruism',
			'give back'
		]
	},
	{
		id: 'ltfu_site_relationship',
		label: 'Site / coordinator relationship',
		description:
			'The relationship with the trial coordinator, study nurse, and PI — a powerful retention driver when continuity is preserved; eroded by staff turnover.',
		parent_theme: 'clinical_trials',
		parent_subtheme: 'trial_motivators',
		burden_category_ids: ['social_relationships'],
		variants: [
			'coordinator',
			'study nurse',
			'study team',
			'trial team',
			'they know me',
			'staff turnover',
			'new coordinator',
			'lost my coordinator'
		]
	},
	{
		id: 'ltfu_remote_decentralized_visits',
		label: 'Remote / decentralized LTFU visits',
		description:
			'Decentralized visits — televisit, home phlebotomy, wearables, e-PROs — what patients will and won’t accept as trade-offs for staying enrolled.',
		parent_theme: 'clinical_trials',
		parent_subtheme: 'trial_motivators',
		burden_category_ids: ['regimen_appointments', 'logistical_travel'],
		variants: [
			'televisit',
			'telehealth visit',
			'home health',
			'home phlebotomy',
			'mobile phlebotomy',
			'home visit',
			'wearable',
			'remote monitoring',
			'epro',
			'e-pro'
		]
	},
	{
		id: 'ltfu_data_return_to_patient',
		label: 'Data return to patient',
		description:
			'Returning lab results, MRI summaries, or study-wide findings to participants — a low-cost retention lever and a payor-friendly engagement signal.',
		parent_theme: 'clinical_trials',
		parent_subtheme: 'trial_motivators',
		variants: [
			'getting my results',
			'sharing results back',
			'data return',
			'study results',
			'newsletter',
			'patient summary'
		]
	},
	{
		id: 'ltfu_data_sharing_preferences',
		label: 'Data-sharing preferences',
		description:
			'How patients want their data used and shared over years of follow-up — registries, payors, secondary research; consent fatigue.',
		parent_theme: 'clinical_trials',
		parent_subtheme: 'trial_decision_factors',
		burden_category_ids: ['information_decision_complexity'],
		variants: [
			'data sharing',
			'share my data',
			'registry',
			'who sees my data',
			'consent again',
			'reconsent'
		]
	},
	{
		id: 'ltfu_post_trial_identity',
		label: 'Post-trial identity',
		description:
			'How patients see themselves years after the interventional phase — "trial pioneer," "survivor," "former patient" — shapes willingness to keep showing up.',
		parent_theme: 'clinical_trials',
		parent_subtheme: 'clinical_trial_interest',
		burden_category_ids: ['emotional_grief', 'qol_normalcy'],
		variants: [
			'trial pioneer',
			'first patients',
			'guinea pig',
			'former patient',
			'survivor',
			'cured',
			'i was one of the first'
		]
	}
].map((c) => ({ ...c, indications: [] }));

// --- Combine, strip prior versions, validate -------------------------------

const NEW_IDS = new Set([
	...MS_CLUSTERS.map((c) => c.id),
	...CART_MODALITY_CLUSTERS.map((c) => c.id),
	...LTFU_CLUSTERS.map((c) => c.id)
]);

const lex = JSON.parse(readFileSync(resolve(ROOT, LEXICON), 'utf8'));
const fromVersion = lex.meta?.schema_version ?? 'unknown';
if (fromVersion !== '3.6' && fromVersion !== '3.7') {
	fail(`expected schema 3.6 or 3.7, found "${fromVersion}". Run prior migrations first.`);
}

const surviving = lex.clusters.filter((c) => !NEW_IDS.has(c.id));
const stripped = lex.clusters.length - surviving.length;

const all = [
	...surviving,
	...MS_CLUSTERS,
	...CART_MODALITY_CLUSTERS,
	...LTFU_CLUSTERS
];

// --- Validate ---------------------------------------------------------------

const seen = new Set();
for (const c of all) {
	if (seen.has(c.id)) fail(`duplicate cluster id "${c.id}"`);
	seen.add(c.id);

	if (!Array.isArray(c.indications))
		fail(`cluster "${c.id}" missing indications[]`);
	for (const id of c.indications)
		if (!indicationIds.has(id))
			fail(`cluster "${c.id}" references unknown indication "${id}"`);

	const pair = `${c.parent_theme}::${c.parent_subtheme}`;
	if (!validPairs.has(pair))
		fail(`cluster "${c.id}" → invalid (theme, subtheme) (${c.parent_theme}, ${c.parent_subtheme})`);

	if (!Array.isArray(c.variants)) fail(`cluster "${c.id}" missing variants[]`);

	if (!Array.isArray(c.burden_category_ids ?? []))
		fail(`cluster "${c.id}" burden_category_ids not an array`);
	for (const id of c.burden_category_ids ?? [])
		if (!burdenIds.has(id))
			fail(`cluster "${c.id}" references unknown burden_category_id "${id}"`);

	if (c.drug_id && !drugIds.has(c.drug_id))
		fail(`cluster "${c.id}" drug_id "${c.drug_id}" missing in drugs.json`);
}

// --- Sort: indication-bucket (cross-cutting first) → theme → subtheme → id --

const indPriority = (c) => {
	if (c.indications.length === 0) return 0;
	const first = c.indications[0];
	return 1 + indications.items.findIndex((i) => i.id === first);
};

all.sort((a, b) => {
	const pa = indPriority(a);
	const pb = indPriority(b);
	if (pa !== pb) return pa - pb;
	if (a.parent_theme !== b.parent_theme) return a.parent_theme.localeCompare(b.parent_theme);
	if (a.parent_subtheme !== b.parent_subtheme)
		return a.parent_subtheme.localeCompare(b.parent_subtheme);
	return a.id.localeCompare(b.id);
});

// Canonical field order per cluster.
const orderedClusters = all.map((c) => {
	const next = {
		id: c.id,
		label: c.label,
		description: c.description ?? '',
		indications: c.indications,
		burden_category_ids: c.burden_category_ids ?? [],
		parent_theme: c.parent_theme,
		parent_subtheme: c.parent_subtheme,
		variants: c.variants
	};
	if (c.drug_id) next.drug_id = c.drug_id;
	return next;
});

// --- Update meta ------------------------------------------------------------

const msCount = MS_CLUSTERS.length;
const cartCount = CART_MODALITY_CLUSTERS.length;
const ltfuCount = LTFU_CLUSTERS.length;

lex.meta.schema_version = '3.7';
lex.meta.supersedes = `keyword_lexicon.json @ ${fromVersion}`;
lex.meta.description =
	'Keyword cluster catalog, schema 3.7. Adds the multiple_sclerosis indication and two cross-cutting cluster groups: CAR-T modality (the patient-experience vocabulary that’s identical across LN, MS, and onc CAR-T) and Long-Term Follow-Up retention/friction (the 5–15 year qualitative surface that drives data completeness on cell- and gene-therapy programs). MS DMTs (anti-CD20, S1P, alpha-4 integrin) and three investigational CAR-T programs (KYV-101, CABA-201, Descartes-08) are wired in via drugs.json + mechanisms_of_action.json. The CONDITION axis (clusters[].indications: string[]) and BURDEN axis (clusters[].burden_category_ids: string[]) continue to resolve against registries/. Variants are SUGGESTION FUEL ONLY — they rank cluster suggestions in the segment tag drawer; they do NOT auto-tag any occurrence. Per-instance tag rows live in keyword_tags.json keyed by (cluster_id, segment_id, char_start, char_end).';

lex.meta.changelog = [
	...(lex.meta.changelog ?? []),
	`3.7 — added multiple_sclerosis indication (${msCount} clusters) + cross-cutting CAR-T modality clusters (${cartCount}) + cross-cutting LTFU retention clusters (${ltfuCount}). Stripped ${stripped} prior cluster(s) matching the new id namespace before re-appending (idempotency). Required registry rows asserted: indications +multiple_sclerosis, therapeutic_areas +neurology, sponsors +biogen/novartis/tg_therapeutics/kyverna/cabaletta_bio/cartesian_therapeutics, moas +s1p_modulator/alpha_4_integrin/car_t_autologous, drugs +ocrelizumab/ofatumumab/ublituximab/natalizumab/fingolimod/kyv_101/caba_201/descartes_08. Backup: ${BACKUP.split('/').pop()}. Migration: scripts/migrate-lexicon-ms-cart-ltfu.mjs.`
];

lex.clusters = orderedClusters;

// --- Write (backup once, then overwrite) ------------------------------------

if (!existsSync(resolve(ROOT, BACKUP))) {
	writeFileSync(resolve(ROOT, BACKUP), readFileSync(resolve(ROOT, LEXICON), 'utf8'), 'utf8');
	console.log(`Wrote backup ${BACKUP}`);
} else {
	console.log(`Backup ${BACKUP} already exists — left untouched.`);
}

writeFileSync(resolve(ROOT, LEXICON), JSON.stringify(lex, null, 2) + '\n', 'utf8');

// --- Summary ----------------------------------------------------------------

const byInd = {};
const bySub = {};
for (const c of orderedClusters) {
	const key = c.indications.length === 0 ? '(cross-cutting)' : c.indications.join('+');
	byInd[key] = (byInd[key] ?? 0) + 1;
	const k = `${key} / ${c.parent_subtheme}`;
	bySub[k] = (bySub[k] ?? 0) + 1;
}
console.log(`Wrote ${LEXICON}`);
console.log(`  schema_version: ${lex.meta.schema_version}`);
console.log(`  total clusters: ${orderedClusters.length}`);
console.log(`  by indication:`);
for (const [k, n] of Object.entries(byInd).sort()) console.log(`    ${k}: ${n}`);
console.log(`  multiple_sclerosis by subtheme:`);
for (const [k, n] of Object.entries(bySub)
	.filter(([k]) => k.startsWith('multiple_sclerosis'))
	.sort())
	console.log(`    ${k.replace('multiple_sclerosis / ', '')}: ${n}`);
console.log(`  cross-cutting (CAR-T modality + LTFU) by subtheme:`);
for (const [k, n] of Object.entries(bySub)
	.filter(([k]) => k.startsWith('(cross-cutting)'))
	.sort())
	console.log(`    ${k.replace('(cross-cutting) / ', '')}: ${n}`);

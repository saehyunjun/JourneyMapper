// ── Duration highlighting ─────────────────────────────────────────────────────

const TIME_PATTERN = new RegExp(
  [
    '\\b(?:',
    '\\d+\\s*(?:years?|months?|weeks?|days?|hours?)|',
    '(?:one|two|three|four|five|six|seven|eight|nine|ten|',
    'eleven|twelve|thirteen|fourteen|fifteen|',
    'twenty|thirty|forty|fifty|sixty|',
    'a\\s+(?:few|couple\\s+of))\\s+(?:years?|months?|weeks?|days?|hours?)|',
    '(?:several|many|a\\s+few)\\s+(?:years?|months?|weeks?|days?)|',
    '(?:\\d+[-–]\\d+)\\s+(?:years?|months?|weeks?|days?)',
    ')',
  ].join(''),
  'gi'
);

export function highlightDurations(text = '') {
  return applyPattern(text, TIME_PATTERN, 'highlight-duration');
}

// ── Symptom & clinical term highlighting ─────────────────────────────────────
//
// Terms derived from journeyPersonas.json across all three indication areas:
// Parkinson's Disease, anti-NMDA receptor encephalitis, Osteogenesis Imperfecta.
//
// Two tiers:
//   highlight-symptom-severe  → acute / crisis-level terms  (red)
//   highlight-symptom         → chronic / ongoing symptoms  (orange)
//
// IMPORTANT: plain strings only — no regex syntax inside term strings.
// Regex metacharacters (?, [], etc.) are escaped automatically by buildTermPattern.

const SEVERE_TERMS = [
  // Acute neurological events
  'tonic-clonic seizure',
  'auditory hallucinations',
  'psychiatric break',
  'loss of consciousness',
  'cognitive absence',
  'cognitive fatigue',
  'memory loss',
  'respiratory compromise',
  'mechanical ventilation',
  'emergency admission',
  'ER visit',
  'ER visits',
  'seizures',
  'seizure',
  'psychosis',
  'psychotic',
  'hallucinations',
  'hallucination',
  'catatonic',
  'catatonia',
  'intubated',
  'intubation',
  'inpatient',
  'ICU',
  // Acute OI
  'fractures',
  'fracture',
  // Severe psychiatric / cognitive
  'paranoia',
  'paranoid',
  // Severe disease markers
  'misdiagnosis',
  'disease progression',
  'emergency',
  'hospitalization',
  'hospitalisation',
  'hospitalized',
  'hospitalised',
  'dropout',
  'relapse',
  'worsening',
];

const SYMPTOM_TERMS = [
  // Multi-word first (longest match priority)
  'tonic-clonic seizure',
  'balance changes',
  'balance issues',
  'balance problems',
  'motor symptoms',
  'motor dysfunction',
  'neurological symptoms',
  'cognitive symptoms',
  'cognitive fatigue',

  'cognitive deficit',
  'cognitive sequelae',
  'cognitive impairment',
  'cognitive overload',
  'cognitive burden',
  'word-retrieval',
  'word retrieval',
  'B-cell depletion',
  'FcRn antagonist',
  "Parkinson's disease",
  'movement disorder',
  'osteogenesis imperfecta',
  'bone fracture',
  'bone density',
  'brittle bone',
  'side effects',
  'side effect',
  'diagnostic odyssey',
  'treatment failure',
  'non-response',
  // Single words
  'tremors',
  'tremor',
  'dyskinesia',
  'rigidity',
  'bradykinesia',
  'fatigue',
  'fatigued',
  'neurological',
  'encephalitis',
  'difficulty',
  'difficulties',
  'autoimmune',
  'antibodies',
  'antibody',
  'immunotherapy',
  'IVIG',
  'corticosteroids',
  'corticosteroid',
  'Rituximab',
  'Cyclophosphamide',
  "Parkinson's",
  'neurodegenerative',
  'neurodegeneration',
  'orthopedic',
  'orthopaedic',
  'hypervigilance',
  'hypervigilant',
  'exhaustion',
  'exhausted',
  'casting',
  'post-op',
  'rehabilitation',
  'symptoms',
  'symptom',
  'flares',
  'flare',
  'regression',
  'pain',
  'anxiety',
  'anxious',
  'depressive',
  'depression',
  'despair',
  'grief',
  'isolated',
  'isolation',
  'misrouted',
  'misrouting',
  'delayed',
  'delay',
  'undiagnosed',
  'drop-off',
  'OI',
  'PD',
  'memory',
  'confusion',
  'challenge',
  'difficult',
  'diffulty',
  'difficulties',
  'struggle',
  'struggles',
  'disorientation',
];




const CARE_TERMS = [
  // Multi-word first (longest match priority)
  'recovery',
  'care',
  'care team',
  'physical therapy',
];

/**
 * Escapes regex metacharacters in a plain string so it can be used
 * safely inside a RegExp constructor.
 * @param {string} s
 * @returns {string}
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a regex from a plain-string term list.
 * Terms are escaped and sorted longest-first so multi-word phrases
 * are matched before their component words.
 * @param {string[]} terms
 * @returns {RegExp}
 */
function buildTermPattern(terms) {
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  return new RegExp(`\\b(${sorted.map(escapeRegex).join('|')})\\b`, 'gi');
}

const SEVERE_PATTERN  = buildTermPattern(SEVERE_TERMS);
const SYMPTOM_PATTERN = buildTermPattern(SYMPTOM_TERMS);
const CARE_PATTERN  = buildTermPattern(CARE_TERMS);

/**
 * Splits an HTML string into alternating [text, tag, text, tag, ...] chunks,
 * applies a replacer only to text nodes, then rejoins.
 * This prevents the replacer from ever seeing or modifying tag attributes.
 *
 * @param {string} html
 * @param {RegExp} pattern
 * @param {string} cssClass
 * @returns {string}
 */
function applyPattern(html, pattern, cssClass) {
  // Reset lastIndex in case pattern is reused
  pattern.lastIndex = 0;

  // Split so that full tags (<...>) are their own array entries
  const chunks = html.split(/(<[^>]*>)/g);

  return chunks.map((chunk) => {
    // Leave tag nodes untouched
    if (chunk.startsWith('<')) return chunk;
    // Apply replacement only to text nodes
    return chunk.replace(pattern, (match) =>
      `<mark class="${cssClass}">${match}</mark>`
    );
  }).join('');
}

/**
 * Wraps acute/severe clinical terms — applied FIRST so the severe pass
 * runs on clean text before the broader symptom pass.
 * @param {string} text
 * @returns {string} HTML string
 */
export function highlightSymptoms(text = '') {
  const afterSevere  = applyPattern(text,         SEVERE_PATTERN,  'highlight-symptom-severe');
  const afterSymptom = applyPattern(afterSevere,   SYMPTOM_PATTERN, 'highlight-symptom');
  const afterCare    = applyPattern(afterSymptom,  CARE_PATTERN,    'highlight-care');
  return afterCare;
}


/**
 * Applies duration highlighting then symptom highlighting.
 * Each pass only touches text nodes, never tag attributes or class names.
 * @param {string} text
 * @returns {string} HTML string
 */
export function highlightAll(text = '') {
  return highlightSymptoms(highlightDurations(text));
}
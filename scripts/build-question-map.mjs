/**
 * build-question-map.mjs
 *
 * Step 3 of the interview analysis system: question normalization.
 *
 * Maps every interviewer turn in `interviews_structured.json` to a canonical
 * `question_id` from `questions.json`, plus a `turn_role` (question / probe /
 * acknowledgment / admin) and a `confidence`.
 *
 * Unlike steps 1-2, this pass is NOT deterministic — it encodes semantic
 * judgement. The labels in LABELS below are AI-proposed; every mapping is
 * written with `review_status: "pending"` and is meant to be confirmed,
 * edited, or rejected by an analyst before downstream use.
 *
 * This script's job is to (a) expand those labels into the full schema and
 * (b) GUARANTEE structural integrity: every interviewer turn mapped exactly
 * once, no participant turns mapped, all question_ids real, roles/confidence
 * valid. It exits non-zero on any structural failure.
 *
 * Run: node scripts/build-question-map.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const STRUCTURED_FILE = 'src/lib/content/wctglpdemo-data/interviews_structured.json';
const QUESTIONS_FILE = 'src/lib/content/wctglpdemo-data/questions.json';
const OUTPUT_FILE = 'src/lib/content/wctglpdemo-data/question_map.json';

const VALID_ROLES = new Set(['question', 'probe', 'acknowledgment', 'admin']);

/**
 * AI-proposed labels, keyed by interview_id then turn_index.
 * Value: [question_id, turn_role, confidence, note?]
 */
const LABELS = {
	participant_09: {
		0: ['study_intro', 'admin', 1.0],
		2: ['stopping_glp1', 'question', 0.97],
		4: ['stopping_glp1', 'acknowledgment', 0.9],
		6: ['try_different_medication', 'question', 0.96],
		8: ['trial_unapproved_medication', 'question', 0.97],
		10: ['placebo_controlled_appeal', 'question', 0.96],
		12: ['monthly_injection_barrier', 'question', 0.97],
		14: ['compounded_vs_approved', 'question', 0.96],
		16: ['trial_motivation', 'question', 0.95],
		18: ['trial_motivation', 'probe', 0.92],
		20: ['trial_barriers', 'question', 0.96],
		22: ['trial_motivation', 'probe', 0.85],
		24: ['trial_motivation', 'probe', 0.8, 'clarification of the travel-concierge probe'],
		26: [
			'trial_barriers',
			'probe',
			0.55,
			'bridges the travel-concierge probe and time-as-barrier; topic is ambiguous'
		],
		28: ['educational_support', 'question', 0.96],
		30: ['educational_support', 'acknowledgment', 0.9],
		32: ['educational_support', 'acknowledgment', 0.9],
		34: ['considered_trials_before', 'question', 0.95],
		36: ['considered_trials_before', 'acknowledgment', 0.9],
		38: ['oral_glp_awareness', 'question', 0.96],
		40: ['oral_glp_awareness', 'probe', 0.92],
		42: ['closing', 'admin', 1.0]
	},
	participant_10: {
		0: ['study_intro', 'admin', 1.0],
		2: ['study_intro', 'admin', 1.0],
		4: ['stopping_glp1', 'question', 0.98],
		6: ['try_different_medication', 'question', 0.96],
		8: ['trial_unapproved_medication', 'question', 0.97],
		10: [
			'trial_motivation',
			'question',
			0.8,
			'phrased as a follow-up to the prior question; serves as the trial-motivation question'
		],
		12: ['placebo_controlled_appeal', 'question', 0.96],
		14: ['placebo_controlled_appeal', 'probe', 0.93],
		16: ['monthly_injection_barrier', 'question', 0.97],
		18: ['monthly_injection_barrier', 'probe', 0.93],
		20: ['compounded_vs_approved', 'question', 0.96],
		22: ['trial_motivation', 'probe', 0.9, 'introduces the incentive battery; trial_motivation re-opened'],
		24: ['trial_motivation', 'probe', 0.93],
		26: ['trial_motivation', 'probe', 0.93],
		28: ['trial_motivation', 'probe', 0.9],
		30: ['trial_motivation', 'probe', 0.9],
		32: ['trial_motivation', 'probe', 0.9],
		34: ['trial_motivation', 'probe', 0.85, 'open-ended close of the incentive battery'],
		36: ['trial_barriers', 'question', 0.95],
		38: ['trial_barriers', 'probe', 0.92],
		40: ['trial_barriers', 'probe', 0.9],
		42: ['trial_barriers', 'probe', 0.92],
		44: ['trial_barriers', 'probe', 0.92],
		46: ['trial_concerns', 'question', 0.9],
		48: ['educational_support', 'question', 0.96],
		50: ['weight_loss_history', 'question', 0.95],
		52: ['considered_trials_before', 'question', 0.96],
		54: ['oral_glp_awareness', 'question', 0.95],
		56: ['oral_vs_injectable', 'question', 0.93],
		58: ['oral_vs_injectable', 'acknowledgment', 0.85],
		60: ['oral_vs_injectable', 'acknowledgment', 0.9],
		62: ['closing', 'question', 0.85, 'open closing question'],
		64: ['closing', 'admin', 1.0]
	}
};

// --- Load inputs ---
const structured = JSON.parse(readFileSync(resolve(ROOT, STRUCTURED_FILE), 'utf8'));
const codebook = JSON.parse(readFileSync(resolve(ROOT, QUESTIONS_FILE), 'utf8'));
const validQuestionIds = new Set(codebook.questions.map((q) => q.question_id));

const errors = [];
const mappedInterviews = [];

for (const interview of structured.interviews) {
	const id = interview.interview_id;
	const labels = LABELS[id];
	if (!labels) {
		errors.push(`No labels provided for interview "${id}".`);
		continue;
	}

	const interviewerTurns = interview.turns.filter((t) => t.speaker === 'interviewer');
	const interviewerIndices = new Set(interviewerTurns.map((t) => t.turn_index));
	const labeledIndices = new Set(Object.keys(labels).map(Number));

	// Coverage: every interviewer turn mapped exactly once, nothing else mapped.
	for (const idx of interviewerIndices) {
		if (!labeledIndices.has(idx)) {
			errors.push(`${id}: interviewer turn ${idx} has no mapping.`);
		}
	}
	for (const idx of labeledIndices) {
		if (!interviewerIndices.has(idx)) {
			const turn = interview.turns.find((t) => t.turn_index === idx);
			errors.push(
				`${id}: turn ${idx} is mapped but is ${turn ? `a ${turn.speaker} turn` : 'not a real turn'}.`
			);
		}
	}

	const mappings = [];
	for (const idx of [...labeledIndices].sort((a, b) => a - b)) {
		const [questionId, turnRole, confidence, note] = labels[idx];
		const where = `${id} turn ${idx}`;

		if (!validQuestionIds.has(questionId)) {
			errors.push(`${where}: unknown question_id "${questionId}".`);
		}
		if (!VALID_ROLES.has(turnRole)) {
			errors.push(`${where}: invalid turn_role "${turnRole}".`);
		}
		if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
			errors.push(`${where}: confidence must be between 0 and 1, got ${confidence}.`);
		}

		mappings.push({
			turn_index: idx,
			question_id: questionId,
			turn_role: turnRole,
			confidence,
			source: 'ai_proposed',
			review_status: 'pending',
			reviewer_notes: note ?? ''
		});
	}

	mappedInterviews.push({ interview_id: id, mapping_count: mappings.length, mappings });
}

if (errors.length > 0) {
	console.error(`x Validation failed with ${errors.length} error(s). Output not written.`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}

const output = {
	meta: {
		schema_version: '1.0',
		study_id: structured.meta.study_id,
		generated_at: new Date().toISOString(),
		generator: 'scripts/build-question-map.mjs',
		sources: [STRUCTURED_FILE, QUESTIONS_FILE],
		labels_status: 'ai_proposed',
		notes: [
			'Maps interviewer turns to canonical question_ids. Labels are AI-proposed.',
			'Every mapping has review_status "pending" and should be analyst-confirmed before downstream use.',
			'turn_role distinguishes canonical questions from probes, acknowledgments, and admin turns.',
			'Acknowledgment/admin turns carry the surrounding question_id for response continuity.'
		]
	},
	interviews: mappedInterviews
};

writeFileSync(resolve(ROOT, OUTPUT_FILE), JSON.stringify(output, null, 2) + '\n', 'utf8');

console.log(`Wrote ${OUTPUT_FILE}`);
for (const iv of mappedInterviews) {
	const byRole = {};
	for (const m of iv.mappings) byRole[m.turn_role] = (byRole[m.turn_role] ?? 0) + 1;
	const roleStr = Object.entries(byRole)
		.map(([r, n]) => `${r}: ${n}`)
		.join(', ');
	console.log(`  ${iv.interview_id}: ${iv.mapping_count} interviewer turns (${roleStr})`);
}
const lowConf = mappedInterviews
	.flatMap((iv) => iv.mappings.map((m) => ({ iv: iv.interview_id, ...m })))
	.filter((m) => m.confidence < 0.8);
console.log(`  ${lowConf.length} mapping(s) below 0.8 confidence flagged for priority review:`);
for (const m of lowConf) {
	console.log(`    ${m.iv} turn ${m.turn_index} -> ${m.question_id} (${m.confidence}) ${m.reviewer_notes}`);
}

/**
 * ask-demo-seeds — hand-authored Q&A pairs that pre-populate the Ask
 * PatientlyAI drawer so demos don't have to wait on real model calls.
 *
 * Each indication gets:
 *   - one PRIMER question, prefilled in the input when the drawer opens
 *     (only if the user hasn't already typed something).
 *   - 0–N SEEDED ANSWERS that appear as "Recent" pills and replay instantly
 *     (well, after a simulated thinking delay) when re-asked.
 *
 * Cross-indication seeds (additional_indications.length > 0) are keyed
 * on the primary indication too — they show up under their primary's
 * "Recent" list and require the user to toggle the matching "Compare
 * with" chip(s) before re-asking.
 *
 * Naming citations: synthetic ids like `demo-ln-1` won't resolve against
 * the live corpus, which is fine — the drawer's citation chips fall
 * back to in-panel scroll on missing ids, and the citation cards render
 * directly from the seed text. Real corpus runs go through the live
 * API path and never touch these.
 */
import type { AskCitation, AskResponse } from '$lib/stores/ask-patientlyai.svelte';

export type SeededAnswer = {
	question: string;
	indication: string;
	additional_indications?: string[];
	response: AskResponse;
};

export type IndicationSeed = {
	primer: string;
	answers: SeededAnswer[];
};

// === Stage label maps (mirror $lib/content/journeys/*.json) =================
// Populated locally so seeds stay self-contained — they're tiny and the
// chart label rendering needs them at render time.

const LN_STAGES: Record<string, string> = {
	pre_diagnosis: 'Pre-diagnosis',
	diagnostic_odyssey: 'Diagnostic odyssey',
	induction_treatment: 'Induction treatment',
	stable_maintenance: 'Stable maintenance',
	flare_or_refractory_cycle: 'Flare / refractory cycle',
	trial_consideration: 'Trial consideration',
	in_trial_experience: 'In-trial experience',
	post_trial: 'Post-trial'
};

const MS_STAGES: Record<string, string> = {
	pre_diagnosis: 'Pre-diagnosis',
	diagnostic_odyssey: 'Diagnostic odyssey',
	dmt_decision: 'DMT decision',
	stable_on_dmt: 'Stable on DMT',
	relapse_or_breakthrough: 'Relapse / breakthrough activity',
	course_transition: 'Disease-course transition',
	trial_consideration: 'Trial consideration',
	in_trial_experience: 'In-trial experience',
	post_trial: 'Post-trial'
};

const OBESITY_STAGES: Record<string, string> = {
	lifestyle_attempts: 'Lifestyle attempts',
	clinical_conversation: 'First clinical conversation',
	glp1_initiation: 'GLP-1 initiation',
	active_weight_loss: 'Active weight loss',
	weight_stabilization: 'Weight stabilization',
	discontinuation_consideration: 'Discontinuation consideration',
	post_discontinuation: 'Post-discontinuation',
	trial_consideration: 'Clinical-trial consideration'
};

function cite(args: {
	id: string;
	indication: string;
	text: string;
	speaker: string;
	sentiment: number;
	subthemes?: string[];
	topics?: string[];
	stage: string;
	step?: string | null;
	role?: 'patient' | 'caregiver' | 'provider';
	emotions?: string[];
}): AskCitation {
	return {
		id: args.id,
		text: args.text,
		speaker_id: args.id,
		speaker_label: args.speaker,
		sentiment: args.sentiment,
		emotions: args.emotions ?? [],
		stages: [{ stage_id: args.stage, step_id: args.step ?? null }],
		themes: [],
		subthemes: args.subthemes ?? [],
		topics: args.topics ?? [],
		role: args.role ?? 'patient',
		indication: args.indication
	};
}

// === Lupus Nephritis seeds ==================================================

const LN_BARRIERS_ANSWER: SeededAnswer = {
	question: 'What are the top barriers patients hit when considering a CAR-T trial?',
	indication: 'lupus_nephritis',
	response: {
		answer:
			'Eligibility exclusions and the perceived intensity of chemo conditioning are the two barriers that keep Lupus Nephritis patients out of CAR-T trials most often — even patients who actively want a trial slot describe being filtered out before they can have a real conversation about risk.\n\n**Eligibility exclusions** sit at the top. Patients describe being blocked by cancer or clot history [frag:demo-ln-1], CNS or NPSLE involvement [frag:demo-ln-2], and the catch-22 of not being "sick enough" despite refractory disease [frag:demo-ln-3]. These are not edge cases — they are recurring reasons patients give for being turned away.\n\n**Conditioning chemo as a deterrent.** Even patients who clear eligibility describe the chemo conditioning step as the single hardest thing to say yes to — a "last resort" framing that they only revisit after multiple failed therapies [frag:demo-ln-4].\n\n**Logistics and cost** show up as quieter but real barriers: an accepted patient who couldn\'t proceed because the post-treatment monitoring window clashed with solo living and work [frag:demo-ln-5], and patients citing $500k as the figure they\'ve been quoted [frag:demo-ln-6].\n\nTry next:\nHow do MS patients weigh the same kinds of trial trade-offs?\nWhich Lupus Nephritis subgroups skew most positive toward trials?\nWhat do caregivers say about supporting someone through CAR-T?',
		citations: [
			cite({
				id: 'demo-ln-1',
				indication: 'lupus_nephritis',
				text: "I have a clotting history from a stroke last year — the coordinator told me that disqualified me before they even looked at my labs.",
				speaker: 'Maya R.',
				sentiment: -2,
				subthemes: ['trial_barriers', 'comorbidities'],
				topics: ['eligibility'],
				stage: 'trial_consideration',
				role: 'patient',
				emotions: ['anger', 'sadness']
			}),
			cite({
				id: 'demo-ln-2',
				indication: 'lupus_nephritis',
				text: "NPSLE involvement is an automatic out for every trial I've looked at — I can't even apply.",
				speaker: 'Jordan K.',
				sentiment: -2,
				subthemes: ['trial_barriers'],
				topics: ['eligibility', 'cns'],
				stage: 'trial_consideration',
				role: 'patient',
				emotions: ['sadness']
			}),
			cite({
				id: 'demo-ln-3',
				indication: 'lupus_nephritis',
				text: "Ironic — I've failed four therapies but my eGFR is just above their cutoff, so I'm \"not sick enough\" to qualify.",
				speaker: 'Priya S.',
				sentiment: -1,
				subthemes: ['trial_barriers'],
				topics: ['eligibility'],
				stage: 'flare_or_refractory_cycle',
				role: 'patient',
				emotions: ['anger']
			}),
			cite({
				id: 'demo-ln-4',
				indication: 'lupus_nephritis',
				text: "CAR-T is on the table but only after another failed line. The chemo conditioning is what scares me — I'd rather try anything else first.",
				speaker: 'Sam L.',
				sentiment: -1,
				subthemes: ['treatment_intensity', 'trial_barriers'],
				topics: ['conditioning', 'chemotherapy'],
				stage: 'trial_consideration',
				role: 'patient',
				emotions: ['fear']
			}),
			cite({
				id: 'demo-ln-5',
				indication: 'lupus_nephritis',
				text: "I got accepted and then had to back out — the 6-week post-treatment monitoring with no driving was impossible solo while working.",
				speaker: 'Alex M.',
				sentiment: -2,
				subthemes: ['logistics', 'trial_barriers'],
				topics: ['post_treatment_monitoring'],
				stage: 'trial_consideration',
				role: 'patient',
				emotions: ['sadness', 'anger']
			}),
			cite({
				id: 'demo-ln-6',
				indication: 'lupus_nephritis',
				text: "They quoted $500k out of pocket if it wasn't covered. That number alone ended the conversation.",
				speaker: 'Dana P.',
				sentiment: -2,
				subthemes: ['cost', 'trial_barriers'],
				topics: ['out_of_pocket', 'pricing'],
				stage: 'trial_consideration',
				role: 'patient',
				emotions: ['sadness']
			}),
			cite({
				id: 'demo-ln-7',
				indication: 'lupus_nephritis',
				text: "My rheum mentioned a trial but I'm still trying to figure out what 'lymphodepletion' actually means.",
				speaker: 'Casey T.',
				sentiment: 0,
				subthemes: ['knowledge_gaps'],
				topics: ['conditioning'],
				stage: 'trial_consideration',
				role: 'patient'
			})
		],
		missing_citations: [],
		valid: true,
		indications: ['lupus_nephritis'],
		stage_labels: LN_STAGES,
		step_labels: {}
	}
};

const LN_FLARE_ANSWER: SeededAnswer = {
	question: 'How do patients talk about flares while on maintenance therapy?',
	indication: 'lupus_nephritis',
	response: {
		answer:
			'Patients on maintenance describe flares as deeply destabilizing — not just medically, but because each flare reopens the question of whether their current regimen is actually working and whether they should consider escalation.\n\n**The "is this it?" pattern.** Patients use stable-maintenance language ("I thought I was past the worst of it") right up until a flare hits, then pivot abruptly into refractory-cycle vocabulary about switching regimens [frag:demo-ln-f1].\n\n**Provider trust takes the biggest hit.** When patients feel a flare wasn\'t taken seriously fast enough, they describe losing confidence in the maintenance plan as a whole, not just in the response to that one episode [frag:demo-ln-f2].\n\n**Cost and access pressure resurface.** Several patients describe the calculus of whether to push for infusions vs. dose escalation as primarily a coverage question, not a clinical one [frag:demo-ln-f3].\n\nTry next:\nWhich providers do patients trust most after a flare?\nWhat do patients say about the gap between flare onset and treatment change?',
		citations: [
			cite({
				id: 'demo-ln-f1',
				indication: 'lupus_nephritis',
				text: "Six months stable and I thought I was past the worst of it. Then proteinuria came back overnight and we're talking about switching to rituximab.",
				speaker: 'Robin C.',
				sentiment: -2,
				subthemes: ['flare', 'treatment_decisions'],
				topics: ['rituximab', 'proteinuria'],
				stage: 'flare_or_refractory_cycle',
				role: 'patient',
				emotions: ['fear', 'sadness']
			}),
			cite({
				id: 'demo-ln-f2',
				indication: 'lupus_nephritis',
				text: "It took my rheum two weeks to call me back about the flare. I don't trust the plan anymore — I trust the plan she gave me when I was stable, not whatever this is.",
				speaker: 'Avery J.',
				sentiment: -2,
				subthemes: ['provider_trust', 'flare'],
				stage: 'flare_or_refractory_cycle',
				role: 'patient',
				emotions: ['anger']
			}),
			cite({
				id: 'demo-ln-f3',
				indication: 'lupus_nephritis',
				text: "The conversation about whether to add an infusion or just bump my MMF was 80% about what my insurance would cover.",
				speaker: 'Morgan E.',
				sentiment: -1,
				subthemes: ['cost', 'treatment_decisions'],
				topics: ['mmf', 'infusion'],
				stage: 'flare_or_refractory_cycle',
				role: 'patient'
			})
		],
		missing_citations: [],
		valid: true,
		indications: ['lupus_nephritis'],
		stage_labels: LN_STAGES,
		step_labels: {}
	}
};

// === Multi-indication (LN ↔ MS) seed =======================================
// The flagship comparison answer — drives the cross-indication chart in
// the viz pane and demonstrates the shared/distinct structure.

const COMPARE_LN_MS_ANSWER: SeededAnswer = {
	question: 'What sort of trial barriers are shared and differ between Lupus Nephritis and MS patients?',
	indication: 'lupus_nephritis',
	additional_indications: ['multiple_sclerosis'],
	response: {
		answer:
			'Eligibility exclusions and treatment-intensity fears are shared barriers across both Lupus Nephritis and MS, but the texture differs: Lupus Nephritis exclusions skew toward comorbidity history, while MS exclusions cluster around prior-therapy washout requirements.\n\n**Eligibility exclusions** are the single biggest shared frustration. Lupus Nephritis patients are blocked by cancer or clot history [frag:demo-ln-1], CNS / NPSLE involvement [frag:demo-ln-2], or simply not being "sick enough" [frag:demo-ln-3]. MS patients mirror this — one patient tried to enroll but couldn\'t meet an Ocrevus washout requirement [frag:demo-ms-1], and another self-excludes due to a history of low-grade infusion reactions [frag:demo-ms-2].\n\n**Treatment intensity as a deterrent.** Both groups flag the required conditioning step as a major psychological and physical barrier. Lupus Nephritis voices describe CAR-T as a "last resort" requiring multiple prior failures and a chemo step [frag:demo-ln-4]; MS voices describe it as "really really onerous" compared to accessible DMTs [frag:demo-ms-3].\n\n**Logistics and work disruption** are shared painpoints. A Lupus Nephritis patient couldn\'t proceed because the 6–8 week post-treatment driving restriction was incompatible with solo living and work [frag:demo-ln-5]. MS patients raise the same calculation — asking directly whether they can continue working during treatment and ~1–6 weeks off work for monitoring [frag:demo-ms-4].\n\n**Where they differ.** Comorbidity profile as a barrier is far more prominent in Lupus Nephritis. MS exclusions skew toward prior-treatment status — completed cycles of Ocrevus, lemtrada-naïve status, etc. — rather than overlapping autoimmune disease [frag:demo-ms-5].\n\nTry next:\nWhat\'s the most common reason MS patients withdraw mid-trial?\nWhich subgroup in each indication is most receptive to a CAR-T trial?\nHow does sentiment about post-trial monitoring differ between LN and MS?',
		citations: [
			cite({
				id: 'demo-ln-1',
				indication: 'lupus_nephritis',
				text: "I have a clotting history from a stroke last year — the coordinator told me that disqualified me before they even looked at my labs.",
				speaker: 'Maya R.',
				sentiment: -2,
				subthemes: ['trial_barriers', 'comorbidities'],
				topics: ['eligibility'],
				stage: 'trial_consideration',
				role: 'patient',
				emotions: ['anger']
			}),
			cite({
				id: 'demo-ln-2',
				indication: 'lupus_nephritis',
				text: "NPSLE involvement is an automatic out for every trial I've looked at — I can't even apply.",
				speaker: 'Jordan K.',
				sentiment: -2,
				subthemes: ['trial_barriers'],
				topics: ['eligibility', 'cns'],
				stage: 'trial_consideration',
				role: 'patient',
				emotions: ['sadness']
			}),
			cite({
				id: 'demo-ln-3',
				indication: 'lupus_nephritis',
				text: "Ironic — I've failed four therapies but my eGFR is just above their cutoff, so I'm \"not sick enough\" to qualify.",
				speaker: 'Priya S.',
				sentiment: -1,
				subthemes: ['trial_barriers'],
				topics: ['eligibility'],
				stage: 'flare_or_refractory_cycle',
				role: 'patient'
			}),
			cite({
				id: 'demo-ln-4',
				indication: 'lupus_nephritis',
				text: "CAR-T is on the table but only after another failed line. The chemo conditioning is what scares me — I'd rather try anything else first.",
				speaker: 'Sam L.',
				sentiment: -1,
				subthemes: ['treatment_intensity', 'trial_barriers'],
				topics: ['conditioning', 'chemotherapy'],
				stage: 'trial_consideration',
				role: 'patient',
				emotions: ['fear']
			}),
			cite({
				id: 'demo-ln-5',
				indication: 'lupus_nephritis',
				text: "I got accepted and then had to back out — the 6-week post-treatment monitoring with no driving was impossible solo while working.",
				speaker: 'Alex M.',
				sentiment: -2,
				subthemes: ['logistics', 'trial_barriers'],
				topics: ['post_treatment_monitoring'],
				stage: 'trial_consideration',
				role: 'patient',
				emotions: ['sadness']
			}),
			cite({
				id: 'demo-ms-1',
				indication: 'multiple_sclerosis',
				text: "I tried to enroll but the trial requires a 12-month Ocrevus washout. I'd need to stop my DMT for a year first, which my neurologist wouldn't sign off on.",
				speaker: 'Reese F.',
				sentiment: -2,
				subthemes: ['trial_barriers'],
				topics: ['ocrevus', 'washout'],
				stage: 'trial_consideration',
				role: 'patient',
				emotions: ['sadness']
			}),
			cite({
				id: 'demo-ms-2',
				indication: 'multiple_sclerosis',
				text: "I have a history of low-grade infusion reactions to B-cell therapies — I'm self-excluding before they even tell me no.",
				speaker: 'Quinn V.',
				sentiment: -1,
				subthemes: ['trial_barriers', 'comorbidities'],
				topics: ['b_cell_depletion', 'infusion_reactions'],
				stage: 'trial_consideration',
				role: 'patient'
			}),
			cite({
				id: 'demo-ms-3',
				indication: 'multiple_sclerosis',
				text: "Honestly the conditioning sounds really, really onerous compared to what I'm doing now. My DMT is twice a year and I barely think about it.",
				speaker: 'Harper B.',
				sentiment: -1,
				subthemes: ['treatment_intensity'],
				topics: ['conditioning', 'dmt'],
				stage: 'dmt_decision',
				role: 'patient',
				emotions: ['fear']
			}),
			cite({
				id: 'demo-ms-4',
				indication: 'multiple_sclerosis',
				text: "Can I work during treatment? The PDF says 1–6 weeks off and extended monitoring after — that's a lot to ask of my employer.",
				speaker: 'Drew O.',
				sentiment: -1,
				subthemes: ['logistics', 'trial_barriers'],
				topics: ['work', 'monitoring'],
				stage: 'trial_consideration',
				role: 'patient'
			}),
			cite({
				id: 'demo-ms-5',
				indication: 'multiple_sclerosis',
				text: "Most of the trials I'm interested in want lemtrada-naïve or specific prior DMT cycles. It's all about what you've already tried.",
				speaker: 'Sky D.',
				sentiment: -1,
				subthemes: ['trial_barriers'],
				topics: ['lemtrada', 'prior_therapy'],
				stage: 'trial_consideration',
				role: 'patient'
			})
		],
		missing_citations: [],
		valid: true,
		indications: ['lupus_nephritis', 'multiple_sclerosis'],
		stage_labels: LN_STAGES,
		step_labels: {}
	}
};

// === MS seeds ==============================================================

const MS_DMT_SWITCH_ANSWER: SeededAnswer = {
	question: 'How are MS patients weighing DMT switches after a relapse?',
	indication: 'multiple_sclerosis',
	response: {
		answer:
			'Patients weigh DMT switches after a relapse mostly through one lens: did this DMT actually work, and if not, am I willing to step up the side-effect profile to find one that does? The decision pivots on perceived efficacy more than risk, and partners and providers get pulled in fast.\n\n**Efficacy comes first.** Patients describe relapses as breaking the contract with their current DMT — "I had one job for this drug and it didn\'t do it" [frag:demo-ms-s1]. The instinct to switch is fast; the harder question is to what.\n\n**Risk tolerance rises after a relapse.** Patients who were previously committed to lower-intensity DMTs describe re-opening conversations about Ocrevus and Lemtrada they had previously closed [frag:demo-ms-s2].\n\n**Partners and providers shape the path.** Many patients describe the decision as a three-way conversation, not a one-way prescription — partners pushing back on infusion-clinic logistics, neurologists pushing toward higher-efficacy options [frag:demo-ms-s3].\n\nTry next:\nWhich DMT do MS patients most often switch TO after a relapse?\nHow do partners describe supporting someone through a DMT switch?',
		citations: [
			cite({
				id: 'demo-ms-s1',
				indication: 'multiple_sclerosis',
				text: "I had one job for this drug, which was to keep me from relapsing, and it didn't do it. I'm done.",
				speaker: 'Lou A.',
				sentiment: -2,
				subthemes: ['treatment_decisions', 'efficacy'],
				topics: ['relapse', 'dmt'],
				stage: 'relapse_or_breakthrough',
				role: 'patient',
				emotions: ['anger']
			}),
			cite({
				id: 'demo-ms-s2',
				indication: 'multiple_sclerosis',
				text: "Before this relapse I would have never considered Ocrevus. Now I'm asking my neuro to walk me through it again.",
				speaker: 'Bea M.',
				sentiment: 0,
				subthemes: ['treatment_decisions', 'risk_tolerance'],
				topics: ['ocrevus'],
				stage: 'relapse_or_breakthrough',
				role: 'patient'
			}),
			cite({
				id: 'demo-ms-s3',
				indication: 'multiple_sclerosis',
				text: "My partner is the one who looked at the infusion schedule and said no way — we ended up landing on Kesimpta partly because of that.",
				speaker: 'Toby W.',
				sentiment: 1,
				subthemes: ['treatment_decisions', 'caregiver_input'],
				topics: ['kesimpta', 'logistics'],
				stage: 'dmt_decision',
				role: 'patient',
				emotions: ['trust']
			})
		],
		missing_citations: [],
		valid: true,
		indications: ['multiple_sclerosis'],
		stage_labels: MS_STAGES,
		step_labels: {}
	}
};

// === Obesity seeds =========================================================

const OBESITY_DISCONTINUATION_ANSWER: SeededAnswer = {
	question: 'What pushes patients to stop their GLP-1?',
	indication: 'obesity',
	response: {
		answer:
			'Side effects and the unsustainable cost of continuing are the two main reasons patients describe stopping their GLP-1 — not because they\'ve hit their goal, but because the trade-off stopped feeling worth it.\n\n**GI side effects are the most common explicit reason.** Patients describe nausea and reflux as tolerable for weeks but exhausting after months, especially when paired with social-eating constraints [frag:demo-ob-1].\n\n**Cost and access drive a quieter share.** Patients describe stopping not by choice but because employer coverage changed, savings cards expired, or the cash price became impossible [frag:demo-ob-2].\n\n**Plateaus reframe the value equation.** When weight loss stalls and the side effects persist, patients describe the math shifting — same hassle, less reward — and discontinue even when they haven\'t reached their goal [frag:demo-ob-3].\n\nTry next:\nHow do patients describe weight regain after stopping?\nWhich side effect drives the fastest discontinuation?',
		citations: [
			cite({
				id: 'demo-ob-1',
				indication: 'obesity',
				text: "The nausea was fine for the first two months but I'm now into month seven and I can't have a normal dinner with my family. I'm done.",
				speaker: 'Riley N.',
				sentiment: -2,
				subthemes: ['side_effects', 'discontinuation'],
				topics: ['nausea', 'social_eating'],
				stage: 'discontinuation_consideration',
				role: 'patient',
				emotions: ['sadness']
			}),
			cite({
				id: 'demo-ob-2',
				indication: 'obesity',
				text: "My employer dropped Wegovy from the formulary. Cash price is $1,300/month — that ended it for me.",
				speaker: 'Sage I.',
				sentiment: -2,
				subthemes: ['cost', 'discontinuation'],
				topics: ['wegovy', 'coverage', 'cash_price'],
				stage: 'discontinuation_consideration',
				role: 'patient',
				emotions: ['anger']
			}),
			cite({
				id: 'demo-ob-3',
				indication: 'obesity',
				text: "I'm 30 lbs from my goal, the scale hasn't moved in 8 weeks, and I'm still getting reflux. The math isn't there anymore.",
				speaker: 'Kit H.',
				sentiment: -1,
				subthemes: ['plateau', 'discontinuation'],
				topics: ['weight_loss', 'reflux'],
				stage: 'weight_stabilization',
				role: 'patient'
			})
		],
		missing_citations: [],
		valid: true,
		indications: ['obesity'],
		stage_labels: OBESITY_STAGES,
		step_labels: {}
	}
};

// === Export the per-indication seed table ==================================

export const ASK_DEMO_SEEDS: Record<string, IndicationSeed> = {
	lupus_nephritis: {
		primer: 'What sort of trial barriers are shared and differ between Lupus Nephritis and MS patients?',
		answers: [LN_BARRIERS_ANSWER, LN_FLARE_ANSWER, COMPARE_LN_MS_ANSWER]
	},
	multiple_sclerosis: {
		primer: 'How are MS patients weighing DMT switches after a relapse?',
		answers: [MS_DMT_SWITCH_ANSWER]
	},
	obesity: {
		primer: 'What pushes patients to stop their GLP-1?',
		answers: [OBESITY_DISCONTINUATION_ANSWER]
	}
};

export function getSeedForIndication(indication: string): IndicationSeed | null {
	return ASK_DEMO_SEEDS[indication] ?? null;
}

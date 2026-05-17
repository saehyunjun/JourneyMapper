/**
 * build-segment-tags.mjs
 *
 * Step 5 of the interview analysis system: segment tagging.
 *
 * Annotates each segment in `segments.json` with theme, subtheme, emotion,
 * sentiment, and semantic tags from `codebook.json`.
 *
 * Like question normalization, this pass is NOT deterministic — it encodes
 * semantic judgement. The TAGS table below is AI-proposed; every annotation is
 * written with `review_status: "pending"` and a `confidence`, to be confirmed,
 * edited, or rejected by an analyst before downstream use.
 *
 * Scope: TAGGED_INTERVIEWS controls coverage. v1 tags participant_09 only;
 * participant_10 is reported as pending so its segments are not silently
 * treated as having no tags.
 *
 * The script's job is integrity: every segment of a tagged interview annotated
 * exactly once, all tag ids real, every subtheme's parent theme also applied,
 * sentiment and confidence in range. It exits non-zero on any failure.
 *
 * Run: node scripts/build-segment-tags.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const SEGMENTS_FILE = 'src/lib/content/wctglpdemo-data/segments.json';
const CODEBOOK_FILE = 'src/lib/content/wctglpdemo-data/codebook.json';
const OUTPUT_FILE = 'src/lib/content/wctglpdemo-data/segment_tags.json';

const TAGGED_INTERVIEWS = ['participant_09', 'participant_10'];

/**
 * AI-proposed annotations, keyed by segment_id.
 * Value: [themes[], subthemes[], emotions[], sentiment, semantic_tags[], confidence, note?]
 * Each subtheme's parent theme must appear in themes[].
 */
const TAGS = {
	// --- study_intro ---
	participant_09_t01_s00: [[], [], [], 0, [], 0.85],
	participant_09_t01_s01: [[], [], [], 0, [], 0.8, 'admin response, no analytic content'],

	// --- stopping_glp1 ---
	participant_09_t03_s00: [['treatment_continuation'], [], ['confidence'], 2, ['treatment_dependency', 'self_advocacy'], 0.9],
	participant_09_t03_s01: [['weight_loss_history', 'treatment_continuation'], ['lifelong_struggle'], ['relief'], 2, ['health_transformation'], 0.85],
	participant_09_t03_s02: [['cost_access', 'medication_access'], ['out_of_pocket_cost'], ['anxiety'], -2, ['access_logic', 'cost_benefit_reasoning'], 0.9],
	participant_09_t03_s03: [['insurance_barrier'], [], ['frustration'], -2, ['access_logic'], 0.88],
	participant_09_t03_s04: [['insurance_barrier'], [], ['frustration'], -2, ['access_logic'], 0.85],
	participant_09_t03_s05: [['cost_access'], ['out_of_pocket_cost'], [], -2, ['cost_benefit_reasoning'], 0.9],
	participant_09_t03_s06: [['cost_access'], ['out_of_pocket_cost'], ['frustration'], -2, ['cost_benefit_reasoning'], 0.85],
	participant_09_t03_s07: [['cost_access'], [], [], -1, ['conditional_decision'], 0.8],
	participant_09_t03_s08: [['side_effect_concern'], ['serious_complication'], [], -1, ['risk_calculation', 'conditional_decision'], 0.85],
	participant_09_t03_s09: [['non_weight_benefits', 'treatment_continuation'], [], ['relief'], 2, ['health_transformation'], 0.85],
	participant_09_t03_s10: [['non_weight_benefits'], [], ['relief'], 2, ['health_transformation'], 0.9],
	participant_09_t03_s11: [['non_weight_benefits'], ['cardiometabolic'], [], 2, ['health_transformation'], 0.9],
	participant_09_t03_s12: [['non_weight_benefits'], ['cardiometabolic'], ['relief'], 2, ['health_transformation'], 0.9],
	participant_09_t03_s13: [['non_weight_benefits'], ['digestive'], ['relief', 'enthusiasm'], 2, ['health_transformation'], 0.88],
	participant_09_t03_s14: [['side_effect_concern'], ['serious_complication'], [], -1, ['risk_calculation', 'conditional_decision'], 0.85],
	participant_09_t05_s00: [[], [], [], 0, [], 0.5, 'very short — affirmation'],

	// --- try_different_medication ---
	participant_09_t07_s00: [['drug_switching'], [], [], 1, [], 0.8],
	participant_09_t07_s01: [['drug_switching'], [], ['uncertainty'], 0, ['conditional_decision'], 0.55, 'very short'],
	participant_09_t07_s02: [['insurance_barrier'], [], [], 0, [], 0.5, 'context-dependent fragment'],
	participant_09_t07_s03: [['insurance_barrier', 'drug_switching'], [], [], 0, ['access_logic', 'conditional_decision'], 0.85],
	participant_09_t07_s04: [['oral_medication_interest', 'trial_awareness'], [], ['curiosity'], 1, ['maintenance_strategy'], 0.8],
	participant_09_t07_s05: [['insurance_barrier'], [], ['uncertainty'], -1, ['access_logic', 'maintenance_strategy'], 0.8],
	participant_09_t07_s06: [['drug_switching'], [], ['confidence'], 1, [], 0.75],

	// --- trial_unapproved_medication ---
	participant_09_t09_s00: [['trial_participation_motivation', 'trial_awareness'], [], [], 1, [], 0.78],

	// --- placebo_controlled_appeal ---
	participant_09_t11_s00: [['placebo_concern'], [], [], 1, [], 0.5, 'very short'],
	participant_09_t11_s01: [['placebo_concern'], [], [], 1, ['risk_calculation'], 0.8],

	// --- monthly_injection_barrier ---
	participant_09_t13_s00: [['injection_experience'], ['injection_frequency'], [], 1, ['convenience_tradeoff'], 0.85],
	participant_09_t13_s01: [['injection_experience'], ['injection_aversion'], [], -1, [], 0.85],
	participant_09_t13_s02: [['injection_experience', 'treatment_continuation'], ['injection_aversion'], [], 0, ['cost_benefit_reasoning', 'treatment_dependency'], 0.8, 'mixed: dislike vs. efficacy'],

	// --- compounded_vs_approved ---
	participant_09_t15_s00: [['compounded_medication'], [], [], 0, [], 0.85],
	participant_09_t15_s01: [['compounded_medication'], [], [], 1, [], 0.8],

	// --- trial_motivation ---
	participant_09_t17_s00: [['trial_participation_motivation', 'medication_access'], ['access_motivation'], [], 1, ['access_logic'], 0.88],
	participant_09_t17_s01: [['medication_access'], [], ['frustration'], -1, ['access_logic'], 0.82],
	participant_09_t17_s02: [['research_altruism'], [], [], 1, ['altruistic_reasoning'], 0.85],
	participant_09_t17_s03: [['research_altruism'], [], [], 1, ['altruistic_reasoning', 'risk_calculation'], 0.8],
	participant_09_t17_s04: [['research_altruism'], [], ['confidence'], 1, [], 0.7, 'establishes academic perspective'],
	participant_09_t17_s05: [['research_altruism'], [], [], 1, ['altruistic_reasoning'], 0.78],
	participant_09_t19_s00: [[], [], [], 0, [], 0.5, 'very short'],
	participant_09_t19_s01: [['incentives_support'], ['vouchers', 'meal_support'], [], 0, ['conditional_decision', 'access_logic'], 0.8],
	participant_09_t19_s02: [[], [], [], 0, [], 0.5, 'very short'],

	// --- trial_barriers ---
	participant_09_t21_s00: [['travel_burden'], [], [], 0, [], 0.6, 'context-dependent fragment'],
	participant_09_t21_s01: [['travel_burden'], ['distance_to_site'], [], -1, ['clinical_trial_friction'], 0.85],
	participant_09_t21_s02: [['travel_burden', 'visit_logistics'], ['distance_to_site', 'visit_frequency'], [], -1, ['clinical_trial_friction'], 0.85],
	participant_09_t21_s03: [['travel_burden'], [], [], -1, ['clinical_trial_friction'], 0.7],
	participant_09_t21_s04: [['visit_logistics'], ['telehealth'], ['hope'], 1, ['convenience_tradeoff'], 0.85],
	participant_09_t21_s05: [['travel_burden'], ['distance_to_site'], [], -1, ['clinical_trial_friction'], 0.8],

	// --- trial_motivation (travel concierge) ---
	participant_09_t23_s00: [[], [], [], 0, [], 0.55, 'clarifying question back to interviewer'],
	participant_09_t25_s00: [['incentives_support'], ['travel_concierge'], [], 0, [], 0.6],
	participant_09_t25_s01: [['time_burden'], [], [], -1, ['clinical_trial_friction'], 0.8],
	participant_09_t25_s02: [['time_burden', 'travel_burden'], ['distance_to_site'], [], -1, ['clinical_trial_friction'], 0.82],
	participant_09_t25_s03: [['visit_logistics', 'trial_participation_motivation'], ['local_site', 'convenience_motivation'], [], 1, ['convenience_tradeoff'], 0.75],
	participant_09_t25_s04: [['visit_logistics', 'trial_participation_motivation'], ['local_site', 'convenience_motivation'], [], 1, ['convenience_tradeoff'], 0.8],

	// --- trial_barriers (time) ---
	participant_09_t27_s00: [['time_burden'], [], [], -1, ['clinical_trial_friction'], 0.82],

	// --- educational_support ---
	participant_09_t29_s00: [[], [], [], 0, [], 0.5, 'very short'],
	participant_09_t29_s01: [['education_need'], [], ['enthusiasm'], 1, [], 0.55, 'very short — affirmation'],
	participant_09_t29_s02: [['medication_access', 'visit_logistics'], ['telehealth'], [], 0, [], 0.65, 'context fragment'],
	participant_09_t29_s03: [['education_need', 'compounded_medication'], ['medication_education'], [], -1, [], 0.78],
	participant_09_t29_s04: [['education_need'], ['medication_education'], [], -1, [], 0.78],
	participant_09_t29_s05: [['education_need'], ['learning_formats'], [], 1, ['information_seeking'], 0.8],
	participant_09_t29_s06: [['education_need'], ['learning_formats'], ['determination'], 1, ['information_seeking', 'self_advocacy'], 0.82],
	participant_09_t29_s07: [['education_need'], [], ['enthusiasm'], 2, [], 0.78],
	participant_09_t29_s08: [['education_need'], [], ['enthusiasm'], 2, [], 0.7],
	participant_09_t29_s09: [['education_need'], ['learning_formats'], [], 1, ['information_seeking'], 0.78],
	participant_09_t29_s10: [['education_need'], ['medication_education'], [], 1, [], 0.7],
	participant_09_t31_s00: [['education_need', 'incentives_support', 'cost_access'], ['learning_formats'], [], 1, [], 0.78],
	participant_09_t31_s01: [['incentives_support', 'cost_access'], ['out_of_pocket_cost'], [], 1, [], 0.78],
	participant_09_t33_s00: [['education_need'], ['nutrition_education'], [], 1, ['lifestyle_change'], 0.8],
	participant_09_t33_s01: [['education_need'], ['nutrition_education'], [], 1, ['lifestyle_change'], 0.78],

	// --- considered_trials_before ---
	participant_09_t35_s00: [['trial_awareness'], [], [], 1, ['information_seeking'], 0.8],
	participant_09_t35_s01: [[], [], [], 0, [], 0.5, 'very short'],
	participant_09_t35_s02: [['trial_awareness'], [], [], 1, ['information_seeking'], 0.8],
	participant_09_t35_s03: [['trial_awareness', 'travel_burden'], ['distance_to_site'], [], -1, ['clinical_trial_friction'], 0.8],
	participant_09_t37_s00: [['time_burden', 'visit_logistics'], ['visit_frequency'], [], -1, ['conditional_decision'], 0.78],
	participant_09_t37_s01: [['time_burden'], [], ['frustration'], -1, ['clinical_trial_friction'], 0.82],
	participant_09_t37_s02: [['time_burden', 'visit_logistics'], [], [], -1, ['clinical_trial_friction'], 0.8],
	participant_09_t37_s03: [['time_burden'], [], [], -1, ['clinical_trial_friction'], 0.82],

	// --- oral_glp_awareness ---
	participant_09_t39_s00: [['oral_medication_interest', 'trial_awareness'], [], ['uncertainty'], 0, ['information_seeking'], 0.78],
	participant_09_t39_s01: [['oral_medication_interest', 'trial_awareness'], [], [], 0, [], 0.72],
	participant_09_t39_s02: [['oral_medication_interest'], [], [], 0, ['maintenance_strategy'], 0.72],
	participant_09_t39_s03: [['trial_awareness'], [], ['uncertainty'], 0, [], 0.65],
	participant_09_t39_s04: [['trial_awareness', 'oral_medication_interest'], [], ['uncertainty'], 0, ['information_seeking'], 0.78],
	participant_09_t41_s00: [['oral_medication_interest', 'weight_loss_history'], ['lifelong_struggle'], ['hope'], 1, ['maintenance_strategy'], 0.8],
	participant_09_t41_s01: [['oral_medication_interest', 'injection_experience'], ['injection_aversion'], [], 1, ['convenience_tradeoff'], 0.85],
	participant_09_t41_s02: [[], [], [], 0, [], 0.5, 'very short'],

	// --- closing ---
	participant_09_t43_s00: [[], [], [], 0, [], 0.6, 'closing remark, no analytic content'],

	// ============================ participant_10 ============================
	// --- study_intro ---
	participant_10_t01_s00: [[], [], [], 0, [], 0.5, 'very short'],
	participant_10_t03_s00: [[], [], [], 0, [], 0.5, 'very short'],

	// --- stopping_glp1 ---
	participant_10_t05_s00: [[], [], [], 0, [], 0.55, 'context fragment'],
	participant_10_t05_s01: [[], [], [], 0, [], 0.5, 'very short'],
	participant_10_t05_s02: [['side_effect_concern', 'drug_switching'], ['serious_complication'], [], -1, ['conditional_decision'], 0.8],
	participant_10_t05_s03: [['treatment_continuation'], [], [], 1, [], 0.7],
	participant_10_t05_s04: [['treatment_continuation', 'weight_loss_history'], ['lifelong_struggle'], ['determination'], 2, ['treatment_dependency'], 0.85],
	participant_10_t05_s05: [['medication_access', 'treatment_continuation'], [], ['determination'], 0, ['treatment_dependency', 'access_logic'], 0.85, 'shortage concern alongside firm commitment'],

	// --- try_different_medication ---
	participant_10_t07_s00: [['drug_switching'], [], [], 1, [], 0.75],
	participant_10_t07_s01: [['drug_switching', 'trial_awareness'], [], [], 0, ['information_seeking'], 0.8],
	participant_10_t07_s02: [['trial_awareness'], [], [], 0, [], 0.7],
	participant_10_t07_s03: [['drug_switching'], [], ['confidence'], 1, [], 0.8],
	participant_10_t07_s04: [['drug_switching'], [], [], 1, [], 0.65],
	participant_10_t07_s05: [['drug_switching'], ['stall_management'], [], 1, [], 0.85],
	participant_10_t07_s06: [['drug_switching'], [], ['confidence'], 1, [], 0.7],

	// --- trial_unapproved_medication ---
	participant_10_t09_s00: [['trial_participation_motivation'], [], [], 1, [], 0.65],

	// --- trial_motivation ---
	participant_10_t11_s00: [['trial_participation_motivation'], [], [], 1, ['conditional_decision'], 0.8],
	participant_10_t11_s01: [['drug_switching', 'compounded_medication'], ['stall_management'], ['relief'], 1, [], 0.82],
	participant_10_t11_s02: [['trial_participation_motivation'], [], [], 1, ['conditional_decision'], 0.72],
	participant_10_t11_s03: [['trial_participation_motivation'], [], ['confidence'], 1, [], 0.7],

	// --- placebo_controlled_appeal ---
	participant_10_t13_s00: [['placebo_concern'], [], ['enthusiasm'], 1, [], 0.55, 'very short — affirmation'],
	participant_10_t13_s01: [['placebo_concern'], [], [], 1, [], 0.78],
	participant_10_t15_s00: [['placebo_concern', 'research_altruism'], [], [], 1, ['altruistic_reasoning'], 0.75],
	participant_10_t15_s01: [['placebo_concern'], [], ['uncertainty'], 0, ['risk_calculation'], 0.8],
	participant_10_t15_s02: [['placebo_concern', 'research_altruism'], [], [], 1, ['altruistic_reasoning'], 0.85],

	// --- monthly_injection_barrier ---
	participant_10_t17_s00: [['injection_experience'], ['injection_frequency'], [], 1, ['convenience_tradeoff'], 0.85],
	participant_10_t19_s00: [['injection_experience'], ['dosing_durability'], ['uncertainty'], 0, [], 0.82],
	participant_10_t19_s01: [['injection_experience'], ['dosing_durability'], ['curiosity', 'uncertainty'], 0, [], 0.8],
	participant_10_t19_s02: [['injection_experience'], ['dosing_durability'], ['hope'], 1, [], 0.75],

	// --- compounded_vs_approved ---
	participant_10_t21_s00: [['compounded_medication'], [], ['uncertainty'], 0, ['conditional_decision'], 0.5, 'very short'],
	participant_10_t21_s01: [['compounded_medication', 'cost_access'], ['price_trends'], [], 0, [], 0.82],
	participant_10_t21_s02: [['compounded_medication', 'cost_access'], ['price_trends'], [], 0, [], 0.75],
	participant_10_t21_s03: [['compounded_medication', 'cost_access'], [], [], 0, ['conditional_decision', 'cost_benefit_reasoning'], 0.78],
	participant_10_t21_s04: [['compounded_medication', 'cost_access'], ['out_of_pocket_cost'], [], 1, ['cost_benefit_reasoning'], 0.8],
	participant_10_t21_s05: [['compounded_medication'], [], [], 0, [], 0.55, 'context detail — works at a telehealth company'],
	participant_10_t21_s06: [['drug_switching', 'compounded_medication'], ['stall_management'], [], 0, ['conditional_decision'], 0.78],

	// --- trial_motivation (incentive battery) ---
	participant_10_t23_s00: [['incentives_support'], ['vouchers'], [], 1, [], 0.7],
	participant_10_t23_s01: [['incentives_support'], ['vouchers'], [], 1, [], 0.65],
	participant_10_t25_s00: [['incentives_support'], ['financial_compensation'], ['enthusiasm'], 2, [], 0.88],
	participant_10_t27_s00: [['incentives_support'], ['travel_concierge'], [], 1, [], 0.5, 'very short — affirmation re travel concierge'],
	participant_10_t27_s01: [['incentives_support'], ['travel_concierge'], ['enthusiasm'], 1, [], 0.5, 'very short — affirmation re travel concierge'],
	participant_10_t29_s00: [['incentives_support'], ['meal_support'], ['enthusiasm'], 1, [], 0.5, 'very short — affirmation re meal-voucher support'],
	participant_10_t31_s00: [['visit_logistics'], ['home_visits'], ['enthusiasm'], 2, ['convenience_tradeoff'], 0.85],
	participant_10_t31_s01: [['visit_logistics'], ['home_visits'], ['enthusiasm'], 2, [], 0.6, 'short affirmation'],
	participant_10_t33_s00: [['incentives_support'], ['device_provision'], [], 1, [], 0.8],
	participant_10_t33_s01: [[], [], [], 1, ['lifestyle_change'], 0.65, 'general fitness commentary'],
	participant_10_t33_s02: [['weight_loss_history'], ['exercise_history'], [], 1, ['lifestyle_change'], 0.7],
	participant_10_t33_s03: [['weight_loss_history'], ['exercise_history'], [], 1, ['lifestyle_change'], 0.7],
	participant_10_t33_s04: [['incentives_support'], ['device_provision'], [], 1, [], 0.68],
	participant_10_t35_s00: [['education_need'], ['self_tracking'], [], 1, [], 0.8],
	participant_10_t35_s01: [['education_need'], ['self_tracking'], [], 1, [], 0.68],
	participant_10_t35_s02: [['education_need'], ['self_tracking'], [], 1, [], 0.7],
	participant_10_t35_s03: [['education_need'], ['self_tracking'], [], 1, ['lifestyle_change'], 0.78],
	participant_10_t35_s04: [[], [], [], 0, ['lifestyle_change'], 0.7, 'frames medication as a tool, not a cure'],
	participant_10_t35_s05: [[], [], [], 1, ['lifestyle_change', 'maintenance_strategy'], 0.75],

	// --- trial_barriers ---
	participant_10_t37_s00: [['monitoring_burden'], ['fasting_blood'], [], 1, [], 0.7],
	participant_10_t37_s01: [['monitoring_burden'], ['fasting_blood'], [], 1, [], 0.7],
	participant_10_t39_s00: [['monitoring_burden'], ['glucose_monitoring'], [], 0, [], 0.65],
	participant_10_t41_s00: [['monitoring_burden'], ['glucose_monitoring'], [], 1, [], 0.8],
	participant_10_t41_s01: [['monitoring_burden'], ['glucose_monitoring'], [], 0, [], 0.65],
	participant_10_t41_s02: [['monitoring_burden'], ['glucose_monitoring'], [], 1, [], 0.62, 'short affirmation'],
	participant_10_t43_s00: [['travel_burden', 'visit_logistics'], ['transportation_access'], [], 1, ['convenience_tradeoff', 'conditional_decision'], 0.8],
	participant_10_t43_s01: [['travel_burden'], ['distance_to_site'], [], 0, ['conditional_decision'], 0.78],
	participant_10_t43_s02: [['travel_burden'], ['distance_to_site'], [], 0, [], 0.65],
	participant_10_t43_s03: [['travel_burden'], ['distance_to_site'], [], 0, [], 0.78],
	participant_10_t43_s04: [['travel_burden', 'visit_logistics'], ['visit_frequency'], [], -1, [], 0.78],
	participant_10_t45_s00: [['travel_burden'], ['distance_to_site'], [], 0, [], 0.7],
	participant_10_t45_s01: [['travel_burden', 'visit_logistics'], ['visit_frequency'], [], 0, ['convenience_tradeoff'], 0.78],
	participant_10_t45_s02: [['travel_burden'], ['distance_to_site'], [], 0, [], 0.68],
	participant_10_t45_s03: [['travel_burden'], ['distance_to_site'], [], 0, [], 0.62, 'context detail'],

	// --- trial_concerns ---
	participant_10_t47_s00: [['side_effect_concern'], ['unknown_safety'], ['uncertainty'], -1, ['risk_calculation'], 0.82],
	participant_10_t47_s01: [['side_effect_concern'], ['unknown_safety'], [], 0, ['risk_calculation', 'information_seeking'], 0.8],
	participant_10_t47_s02: [['side_effect_concern'], ['gastric_effects'], [], 0, [], 0.82],
	participant_10_t47_s03: [['side_effect_concern'], ['unknown_safety'], [], -1, ['risk_calculation'], 0.78],
	participant_10_t47_s04: [['side_effect_concern'], [], [], -1, [], 0.65],

	// --- educational_support ---
	participant_10_t49_s00: [['education_need'], ['learning_formats'], [], 0, [], 0.82],
	participant_10_t49_s01: [['education_need'], ['learning_formats', 'nutrition_education'], ['enthusiasm'], 1, [], 0.8],
	participant_10_t49_s02: [['education_need'], ['nutrition_education'], [], -1, [], 0.72],
	participant_10_t49_s03: [['education_need'], ['nutrition_education'], [], 1, [], 0.72],

	// --- weight_loss_history ---
	participant_10_t51_s00: [['weight_loss_history'], [], [], 0, [], 0.7],
	participant_10_t51_s01: [['weight_loss_history'], ['lifelong_struggle'], [], -1, [], 0.85],
	participant_10_t51_s02: [['weight_loss_history'], ['prior_diets'], [], 0, [], 0.85],
	participant_10_t51_s03: [['weight_loss_history'], ['prior_diets'], [], 0, [], 0.7],
	participant_10_t51_s04: [['weight_loss_history'], ['prior_weight_loss_medication'], ['frustration'], -1, [], 0.85],
	participant_10_t51_s05: [['weight_loss_history'], ['prior_diets'], [], 0, [], 0.85],
	participant_10_t51_s06: [['weight_loss_history'], ['prior_diets'], [], 0, [], 0.85],
	participant_10_t51_s07: [['weight_loss_history'], [], [], 0, [], 0.55, 'short summary fragment'],
	participant_10_t51_s08: [['weight_loss_history'], ['exercise_history'], [], -1, [], 0.8],
	participant_10_t51_s09: [['weight_loss_history'], ['weight_loss_surgery'], ['hope'], 1, [], 0.8],
	participant_10_t51_s10: [['weight_loss_history'], ['lifelong_struggle'], ['frustration'], -1, [], 0.72],

	// --- considered_trials_before ---
	participant_10_t53_s00: [['trial_awareness'], [], [], 1, [], 0.5, 'very short'],
	participant_10_t53_s01: [['trial_awareness'], [], [], 0, [], 0.78],
	participant_10_t53_s02: [['trial_participation_motivation', 'research_altruism'], [], ['hope', 'enthusiasm'], 2, ['altruistic_reasoning'], 0.82],

	// --- oral_glp_awareness ---
	participant_10_t55_s00: [['oral_medication_interest', 'trial_awareness'], [], ['skepticism'], -1, [], 0.8],
	participant_10_t55_s01: [['oral_medication_interest'], [], ['hope'], 1, [], 0.6, "ambiguous phrasing (likely 'if I could get it as strong')"],
	participant_10_t55_s02: [['oral_medication_interest'], [], ['skepticism'], -1, [], 0.78],
	participant_10_t55_s03: [['oral_medication_interest'], [], ['skepticism'], -1, [], 0.8],
	participant_10_t55_s04: [['oral_medication_interest'], [], [], 1, [], 0.7],
	participant_10_t55_s05: [[], [], [], 0, [], 0.5, 'very short — filler'],
	participant_10_t55_s06: [['oral_medication_interest'], [], ['skepticism'], -1, [], 0.72],

	// --- oral_vs_injectable ---
	participant_10_t57_s00: [['injection_experience'], [], [], 0, [], 0.5, 'very short — chooses injection over pill'],
	participant_10_t59_s00: [[], [], [], 0, [], 0.5, 'very short'],
	participant_10_t59_s01: [['injection_experience'], [], [], 1, ['convenience_tradeoff'], 0.72],
	participant_10_t59_s02: [['injection_experience', 'non_weight_benefits'], ['food_noise'], ['enthusiasm'], 2, [], 0.82],
	participant_10_t59_s03: [[], [], [], 0, [], 0.5, 'very short'],
	participant_10_t61_s00: [[], [], [], 0, [], 0.5, 'very short'],

	// --- closing ---
	participant_10_t63_s00: [[], [], [], 0, [], 0.55, 'closing — nothing to add'],
	participant_10_t63_s01: [[], [], [], 1, [], 0.6, 'closing remark'],
	participant_10_t63_s02: [['research_altruism'], [], ['gratitude', 'enthusiasm'], 2, ['altruistic_reasoning'], 0.78],
	participant_10_t63_s03: [['research_altruism'], [], ['enthusiasm'], 2, ['altruistic_reasoning'], 0.82]
};

// --- Load inputs ---
const segmentsData = JSON.parse(readFileSync(resolve(ROOT, SEGMENTS_FILE), 'utf8'));
const codebook = JSON.parse(readFileSync(resolve(ROOT, CODEBOOK_FILE), 'utf8'));

const validThemes = new Set(codebook.theme_tags.map((t) => t.id));
const validEmotions = new Set(codebook.emotion_tags.map((t) => t.id));
const validSemantic = new Set(codebook.semantic_tags.map((t) => t.id));
// subtheme id -> parent theme id
const subthemeParent = new Map();
for (const theme of codebook.theme_tags) {
	for (const sub of theme.subthemes ?? []) subthemeParent.set(sub.id, theme.id);
}

const segmentsById = new Map(segmentsData.segments.map((s) => [s.segment_id, s]));
const errors = [];
const annotations = [];

for (const interviewId of TAGGED_INTERVIEWS) {
	const segIds = new Set(
		segmentsData.segments.filter((s) => s.interview_id === interviewId).map((s) => s.segment_id)
	);
	for (const id of segIds) {
		if (!(id in TAGS)) errors.push(`${interviewId}: segment ${id} has no annotation.`);
	}
}
for (const id of Object.keys(TAGS)) {
	if (!segmentsById.has(id)) errors.push(`Annotation for unknown segment_id "${id}".`);
}

for (const [segmentId, value] of Object.entries(TAGS)) {
	const seg = segmentsById.get(segmentId);
	if (!seg) continue; // already reported above
	const [themes, subthemes, emotions, sentiment, semanticTags, confidence, note] = value;

	for (const t of themes) if (!validThemes.has(t)) errors.push(`${segmentId}: unknown theme "${t}".`);
	for (const e of emotions) if (!validEmotions.has(e)) errors.push(`${segmentId}: unknown emotion "${e}".`);
	for (const s of semanticTags) if (!validSemantic.has(s)) errors.push(`${segmentId}: unknown semantic tag "${s}".`);
	for (const st of subthemes) {
		const parent = subthemeParent.get(st);
		if (!parent) {
			errors.push(`${segmentId}: unknown subtheme "${st}".`);
		} else if (!themes.includes(parent)) {
			errors.push(`${segmentId}: subtheme "${st}" requires parent theme "${parent}" to also be applied.`);
		}
	}
	if (!Number.isInteger(sentiment) || sentiment < -2 || sentiment > 2) {
		errors.push(`${segmentId}: sentiment must be an integer in [-2, 2], got ${sentiment}.`);
	}
	if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
		errors.push(`${segmentId}: confidence must be between 0 and 1, got ${confidence}.`);
	}

	annotations.push({
		segment_id: segmentId,
		interview_id: seg.interview_id,
		question_id: seg.question_id,
		themes,
		subthemes,
		emotions,
		sentiment,
		semantic_tags: semanticTags,
		confidence,
		source: 'ai_proposed',
		review_status: 'pending',
		reviewer_notes: note ?? ''
	});
}

if (errors.length > 0) {
	console.error(`x Validation failed with ${errors.length} error(s). Output not written.`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}

annotations.sort((a, b) => a.segment_id.localeCompare(b.segment_id));

const taggedSet = new Set(TAGGED_INTERVIEWS);
const pendingInterviews = [...new Set(segmentsData.segments.map((s) => s.interview_id))].filter(
	(id) => !taggedSet.has(id)
);

const output = {
	meta: {
		schema_version: '1.2',
		study_id: segmentsData.meta.study_id,
		generated_at: new Date().toISOString(),
		generator: 'scripts/build-segment-tags.mjs',
		sources: [SEGMENTS_FILE, CODEBOOK_FILE],
		codebook_schema_version: codebook.meta.schema_version,
		labels_status: 'ai_proposed',
		tagged_interviews: TAGGED_INTERVIEWS,
		pending_interviews: pendingInterviews,
		notes: [
			'Theme/subtheme/emotion/sentiment/semantic tags are AI-proposed; every annotation is review_status "pending".',
			'Tags draw exclusively from codebook.json; the script rejects any tag not in the codebook.',
			'A subtheme is only valid when its parent theme is also applied to the segment.',
			'Annotations are keyed by segment_id and join back to segments.json (which carries char offsets).',
			'pending_interviews lists interviews not yet tagged, so their segments are not mistaken for untagged-by-analysis.'
		]
	},
	annotations
};

writeFileSync(resolve(ROOT, OUTPUT_FILE), JSON.stringify(output, null, 2) + '\n', 'utf8');

console.log(`Wrote ${OUTPUT_FILE} (${annotations.length} annotations)`);
console.log(`  tagged: ${TAGGED_INTERVIEWS.join(', ')}`);
console.log(`  pending: ${pendingInterviews.join(', ') || '(none)'}`);

const themeFreq = {};
const subFreq = {};
for (const a of annotations) {
	for (const t of a.themes) themeFreq[t] = (themeFreq[t] ?? 0) + 1;
	for (const s of a.subthemes) subFreq[s] = (subFreq[s] ?? 0) + 1;
}
const topThemes = Object.entries(themeFreq).sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log(`  top themes: ${topThemes.map(([t, n]) => `${t}(${n})`).join(', ')}`);
const subCount = Object.values(subFreq).reduce((n, v) => n + v, 0);
console.log(`  ${subCount} subtheme tags across ${Object.keys(subFreq).length} distinct subthemes`);

const lowConf = annotations.filter((a) => a.confidence < 0.7);
console.log(`  ${lowConf.length} annotation(s) below 0.7 confidence flagged for priority review`);

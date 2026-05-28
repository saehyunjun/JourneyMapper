/**
 * personas/evaluate.ts
 *
 * Persona-as-query evaluator. Pure functions over Fragment + Persona;
 * shared between server load + client filtering. No I/O.
 *
 * Annotation-level predicates take an optional `annotations` map keyed by
 * fragment_id. When the map is omitted, annotation clauses no-op (treated
 * as if the persona didn't specify them) — useful in contexts where
 * annotations aren't loaded.
 */

import type { Fragment, SpeakerAttr } from '../corpora/types';
import type { AnnotationMatcher, AttrMatcher, Persona } from './types';

// Shape of one annotation entry, narrowed to the fields the evaluator reads.
// Kept local so this module doesn't depend on the route-specific types.
type FragmentAnnotationShape = {
	stages?: {
		values?: Array<{ stage_id: string; step_id: string | null; confidence: number }>;
	};
	segment_tags?: {
		themes?: string[];
		subthemes?: string[];
		emotions?: string[];
		sentiment_score?: number | null;
	};
};

export type AnnotationsMap = Record<string, FragmentAnnotationShape>;

type AttrCheckResult = 'match' | 'no_match' | 'unknown';

function checkAttr(
	attr: SpeakerAttr<unknown> | undefined,
	matcher: AttrMatcher
): AttrCheckResult {
	if (!attr) return 'unknown';

	const allowInferred = matcher.allow_inferred ?? true;
	if (attr.evidence === 'unknown') return 'unknown';
	if (attr.evidence === 'inferred' && !allowInferred) return 'no_match';
	if (attr.value === null) return 'unknown';

	return (matcher.in as unknown[]).includes(attr.value) ? 'match' : 'no_match';
}

function checkAnnotation(
	ann: FragmentAnnotationShape | undefined,
	matcher: AnnotationMatcher
): boolean {
	// Without an annotation entry, annotation clauses can't be satisfied.
	if (!ann) return false;

	if (matcher.has_stage) {
		const stages = ann.stages?.values ?? [];
		if (!stages.some((s) => matcher.has_stage!.includes(s.stage_id))) return false;
	}

	if (matcher.has_step) {
		const stages = ann.stages?.values ?? [];
		if (!stages.some((s) => s.step_id !== null && matcher.has_step!.includes(s.step_id)))
			return false;
	}

	if (matcher.sentiment) {
		const s = ann.segment_tags?.sentiment_score;
		if (typeof s !== 'number') return false;
		if (matcher.sentiment.min !== undefined && s < matcher.sentiment.min) return false;
		if (matcher.sentiment.max !== undefined && s > matcher.sentiment.max) return false;
	}

	if (matcher.has_emotion) {
		const emo = ann.segment_tags?.emotions ?? [];
		if (!emo.some((e) => matcher.has_emotion!.includes(e))) return false;
	}

	if (matcher.has_theme) {
		const th = ann.segment_tags?.themes ?? [];
		if (!th.some((t) => matcher.has_theme!.includes(t))) return false;
	}

	if (matcher.has_subtheme) {
		const sub = ann.segment_tags?.subthemes ?? [];
		if (!sub.some((s) => matcher.has_subtheme!.includes(s))) return false;
	}

	return true;
}

export function fragmentMatchesPersona(
	fragment: Fragment,
	persona: Persona,
	annotations?: AnnotationsMap
): boolean {
	const f = persona.filter;

	if (f.content_source && !f.content_source.includes(fragment.content_source)) {
		return false;
	}

	if (f.indications && !fragment.indications.some((ind) => f.indications!.includes(ind))) {
		return false;
	}

	if (f.speaker_attrs) {
		for (const [attrName, matcher] of Object.entries(f.speaker_attrs)) {
			const attr = (fragment.speaker_attrs as Record<string, SpeakerAttr<unknown>>)[attrName];
			const result = checkAttr(attr, matcher);
			if (result === 'no_match') return false;
			if (result === 'unknown' && !(matcher.allow_unknown ?? false)) return false;
		}
	}

	// Annotation predicates no-op when annotations weren't loaded.
	if (f.annotations && annotations) {
		const ann = annotations[fragment.id];
		if (!checkAnnotation(ann, f.annotations)) return false;
	}

	return true;
}

export function filterFragments(
	fragments: Fragment[],
	persona: Persona,
	annotations?: AnnotationsMap
): Fragment[] {
	return fragments.filter((f) => fragmentMatchesPersona(f, persona, annotations));
}

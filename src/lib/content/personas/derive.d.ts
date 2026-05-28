/**
 * Type surface for derive.mjs (pure JS). Mirrors the helpers that derive.mjs
 * exports so TS callers don't need `@ts-expect-error` or `as never` casts.
 * Keep in sync when you add/remove an export in derive.mjs.
 */

import type { Fragment, FragmentAnnotation } from '../corpora/types';
import type { Persona, PersonaFilter } from './types';

export type AuthorFeatures = {
	role: string | null;
	role_stated_count: number;
	themes: Record<string, number>;
	subthemes: Record<string, number>;
	stages: Record<string, number>;
	steps: Record<string, number>;
	emotions: Record<string, number>;
	sentiment_mean: number | null;
	sentiment_var: number | null;
};

export type AuthorProfile = {
	author_handle_hash: string;
	fragment_ids: string[];
	fragment_count: number;
	features: AuthorFeatures;
};

export type Vocab = {
	themes: string[];
	subthemes: string[];
	stages: string[];
	steps: string[];
};

export type AnnotationsMap = Record<string, FragmentAnnotation>;

export function buildAuthorProfile(
	authorHash: string,
	authorFragments: Fragment[],
	annotations: AnnotationsMap,
	opts?: { roleThreshold?: number }
): AuthorProfile;

export function vocabFrom(profiles: AuthorProfile[]): Vocab;

export const DEFAULT_DIM_WEIGHTS: {
	themes: number;
	subthemes: number;
	stages: number;
	steps: number;
};

export function vectorize(
	profile: AuthorProfile,
	vocab: Vocab,
	weights?: typeof DEFAULT_DIM_WEIGHTS
): number[];

export function cosineDistance(a: number[], b: number[]): number;

export function topShares(
	profiles: AuthorProfile[],
	key: keyof Pick<AuthorFeatures, 'themes' | 'subthemes' | 'stages' | 'steps' | 'emotions'>,
	threshold: number
): Array<{ id: string; share: number }>;

export function topSharesAll(
	profiles: AuthorProfile[],
	key: keyof Pick<AuthorFeatures, 'themes' | 'subthemes' | 'stages' | 'steps' | 'emotions'>,
	limit?: number
): Array<{ id: string; share: number }>;

export function deriveFilter(
	profiles: AuthorProfile[],
	opts: {
		fragmentsById: Map<string, Fragment>;
		indications: string[];
		shareThreshold?: number;
		roleThreshold?: number;
	}
): PersonaFilter;

export function matchesFilter(
	fragment: Fragment,
	filter: PersonaFilter,
	annotations: AnnotationsMap
): boolean;

export function jaccard(a: string[], b: string[]): number;

export function overlapsExisting(
	filter: PersonaFilter,
	existingPersonas: Persona[]
): Array<{ persona_id: string; jaccard: number }>;

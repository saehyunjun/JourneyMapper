/**
 * POST /api/personas/derive
 *
 * Manual-merge endpoint. Takes a corpus id + list of author handles the
 * analyst picked, runs the shared deriver, and returns the persona shape +
 * match preview + summary stats. Mirrors scripts/derive-persona-from-authors.mjs.
 *
 * Body:
 *   {
 *     corpus_id: string,
 *     authors: string[],                // author_handle_hash values
 *     share_threshold?: number,          // default 0.4
 *     role_threshold?: number            // default 0.6
 *   }
 *
 * Response: DeriveResponse (below).
 */
import { json, error } from '@sveltejs/kit';
import { loadCorpusBundle } from '$lib/server/corpus-store';
import { listPersonas } from '$lib/server/personas';
import {
	buildAuthorProfile,
	deriveFilter,
	topSharesAll,
	matchesFilter,
	overlapsExisting
} from '$lib/content/personas/derive.mjs';
import type { Fragment } from '$lib/content/corpora/types';
import type { Persona, PersonaFilter } from '$lib/content/personas/types';
import type { RequestHandler } from './$types';

export type DeriveResponse = {
	persona: Omit<Persona, 'id' | 'label' | 'description' | 'color'> & {
		id: string;
		label: string;
		description: string;
	};
	preview: {
		seed_authors: number;
		seed_fragments: number;
		filter_matches_fragments: number;
		filter_matches_authors: number;
		seed_fragments_kept: number;
		non_seed_fragments_swept_in: number;
		non_seed_authors_swept_in: number;
	};
	profile_summary: {
		top_themes: Array<{ id: string; share: number }>;
		top_subthemes: Array<{ id: string; share: number }>;
		top_stages: Array<{ id: string; share: number }>;
		top_steps: Array<{ id: string; share: number }>;
		top_emotions: Array<{ id: string; share: number }>;
	};
	overlaps_existing: Array<{ persona_id: string; jaccard: number }>;
};

export const POST: RequestHandler = async ({ request }) => {
	let body: {
		corpus_id?: string;
		authors?: string[];
		share_threshold?: number;
		role_threshold?: number;
	};
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Body must be JSON.');
	}

	const corpusId = body.corpus_id?.trim();
	const authors = Array.isArray(body.authors) ? body.authors.filter((a) => typeof a === 'string') : [];
	if (!corpusId) throw error(400, 'corpus_id is required.');
	if (authors.length === 0) throw error(400, 'authors must be a non-empty array.');

	const shareThreshold = body.share_threshold ?? 0.4;
	const roleThreshold = body.role_threshold ?? 0.6;

	const corpus = await loadCorpusBundle(corpusId);
	if (!corpus) throw error(404, `Corpus not found: ${corpusId}`);

	const fragmentsByAuthor = new Map<string, Fragment[]>();
	for (const f of corpus.fragments) {
		const h = (f.source_ref as { author_handle_hash?: string }).author_handle_hash;
		if (!h) continue;
		if (!fragmentsByAuthor.has(h)) fragmentsByAuthor.set(h, []);
		fragmentsByAuthor.get(h)!.push(f);
	}

	const missing = authors.filter((a) => !fragmentsByAuthor.has(a));
	if (missing.length > 0) {
		throw error(404, `Author(s) not found in corpus: ${missing.join(', ')}`);
	}

	const fragmentsById = new Map(corpus.fragments.map((f) => [f.id, f]));
	const profiles = authors.map((a) =>
		buildAuthorProfile(a, fragmentsByAuthor.get(a)!, corpus.annotations, { roleThreshold })
	);

	const filter: PersonaFilter = deriveFilter(profiles, {
		fragmentsById,
		indications: corpus.manifest.indications,
		shareThreshold,
		roleThreshold
	});

	// Match preview against the full corpus.
	const seedFragmentIds = new Set(profiles.flatMap((p) => p.fragment_ids));
	const matchedFragments = corpus.fragments.filter((f) =>
		matchesFilter(f, filter, corpus.annotations)
	);
	const matchedAuthors = new Set<string>();
	for (const f of matchedFragments) {
		const h = (f.source_ref as { author_handle_hash?: string }).author_handle_hash;
		if (h) matchedAuthors.add(h);
	}

	const personasInIndication: Persona[] = listPersonas().filter((p) =>
		p.applicable_indications.some((i) => corpus.manifest.indications.includes(i))
	);

	const response: DeriveResponse = {
		persona: {
			id: '',
			label: '',
			description: '',
			applicable_indications: corpus.manifest.indications,
			filter,
			weighting: { type: 'uniform' }
		},
		preview: {
			seed_authors: authors.length,
			seed_fragments: seedFragmentIds.size,
			filter_matches_fragments: matchedFragments.length,
			filter_matches_authors: matchedAuthors.size,
			seed_fragments_kept: matchedFragments.filter((f) => seedFragmentIds.has(f.id)).length,
			non_seed_fragments_swept_in: matchedFragments.filter((f) => !seedFragmentIds.has(f.id)).length,
			non_seed_authors_swept_in: [...matchedAuthors].filter((a) => !authors.includes(a)).length
		},
		profile_summary: {
			top_themes: topSharesAll(profiles, 'themes'),
			top_subthemes: topSharesAll(profiles, 'subthemes'),
			top_stages: topSharesAll(profiles, 'stages'),
			top_steps: topSharesAll(profiles, 'steps'),
			top_emotions: topSharesAll(profiles, 'emotions')
		},
		overlaps_existing: overlapsExisting(filter, personasInIndication)
	};

	return json(response);
};

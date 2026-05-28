/**
 * server/corpora.ts
 *
 * Server-only loader that discovers all corpora under
 * src/lib/content/corpora/ and returns a uniform map of their fragments,
 * annotations (if any), and per-indication journey taxonomies.
 *
 * Each corpus exposes:
 *   - manifest (id, label, indications, partitions)
 *   - fragments per content_source
 *   - annotations per content_source (joined by fragment_id; may be empty)
 *
 * The journey taxonomies and participant profiles are per-indication / per-
 * corpus and loaded separately because not every corpus has them yet (the LN
 * Reddit corpus has no participant_profiles, no stage annotations yet).
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Fragment } from '$lib/content/corpora/types';
import type { JourneyMap } from '$lib/content/journeys/types';
import type { IndicationId } from '$lib/content/registries/types';

const CORPORA_DIR = resolve(process.cwd(), 'src/lib/content/corpora');
const JOURNEYS_DIR = resolve(process.cwd(), 'src/lib/content/journeys');

export type StageTag = { stage_id: string; step_id: string | null; confidence: number };

export type FragmentAnnotation = {
	stages?: {
		values: StageTag[];
		overall_confidence: number;
		note: string;
		source: string;
		review_status: string;
	};
	segment_tags?: {
		themes: string[];
		subthemes: string[];
		emotions: string[];
		topics: string[];
		sentiment_score: number | null;
		confidence: number | null;
		note: string;
		source: string;
		review_status: string;
	};
};

export type CorpusPartitionMeta = {
	content_source: string;
	fragment_count: number;
	ingester_version: string;
	last_ingested_at: string;
};

export type CorpusManifest = {
	id: string;
	label: string;
	indications: IndicationId[];
	created_at: string;
	updated_at: string;
	partitions: CorpusPartitionMeta[];
};

export type CorpusBundle = {
	manifest: CorpusManifest;
	fragments: Fragment[];
	annotations: Record<string, FragmentAnnotation>;
};

/** Discovers every directory under corpora/ that has a manifest.json + at
 *  least one fragments partition. Loads all fragments across content_sources
 *  into a single flat array per corpus. */
export function listCorpora(): CorpusBundle[] {
	if (!existsSync(CORPORA_DIR)) return [];
	const bundles: CorpusBundle[] = [];
	for (const name of readdirSync(CORPORA_DIR)) {
		const dir = resolve(CORPORA_DIR, name);
		if (!statSync(dir).isDirectory()) continue;
		const manifestPath = resolve(dir, 'manifest.json');
		if (!existsSync(manifestPath)) continue;

		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CorpusManifest;

		const fragments: Fragment[] = [];
		const fragmentsDir = resolve(dir, 'fragments');
		if (existsSync(fragmentsDir)) {
			for (const f of readdirSync(fragmentsDir)) {
				if (!f.endsWith('.json')) continue;
				const doc = JSON.parse(readFileSync(resolve(fragmentsDir, f), 'utf8')) as {
					fragments?: Fragment[];
				};
				if (Array.isArray(doc.fragments)) fragments.push(...doc.fragments);
			}
		}

		const annotations: Record<string, FragmentAnnotation> = {};
		const annotationsDir = resolve(dir, 'annotations');
		if (existsSync(annotationsDir)) {
			for (const f of readdirSync(annotationsDir)) {
				if (!f.endsWith('.json')) continue;
				const doc = JSON.parse(readFileSync(resolve(annotationsDir, f), 'utf8')) as {
					annotations?: Record<string, FragmentAnnotation>;
				};
				if (doc.annotations) Object.assign(annotations, doc.annotations);
			}
		}

		bundles.push({ manifest, fragments, annotations });
	}
	bundles.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
	return bundles;
}

/** Returns a map keyed by indication id of every journey taxonomy on disk.
 *  Filename convention: <indication>.json. */
export function listJourneys(): Record<string, JourneyMap> {
	if (!existsSync(JOURNEYS_DIR)) return {};
	const out: Record<string, JourneyMap> = {};
	for (const f of readdirSync(JOURNEYS_DIR)) {
		if (!f.endsWith('.json')) continue;
		const doc = JSON.parse(readFileSync(resolve(JOURNEYS_DIR, f), 'utf8')) as JourneyMap;
		if (doc?.meta?.indication) out[doc.meta.indication] = doc;
	}
	return out;
}

/** Best-effort participant profile loader, scoped per corpus. Today only the
 *  WCT GLP-1 corpus has profiles (they were authored alongside the interview
 *  pipeline). Returns an empty map when none are present — the UI handles the
 *  absence gracefully. */
export function loadProfilesForCorpus(corpusId: string): Record<string, unknown> {
	// Hardcoded for now; will be a per-corpus convention once additional
	// corpora author profile sidecars.
	if (corpusId === 'wct_glp1_2025q4') {
		const p = resolve(process.cwd(), 'src/lib/content/wctglpdemo-data/participant_profiles.json');
		if (existsSync(p)) {
			const doc = JSON.parse(readFileSync(p, 'utf8')) as {
				profiles?: Record<string, unknown>;
			};
			return doc.profiles ?? {};
		}
	}
	return {};
}

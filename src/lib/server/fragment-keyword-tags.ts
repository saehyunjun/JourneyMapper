/**
 * Fragment keyword tags — per-instance cluster assignments for forum
 * fragments, the corpus-side analog of segment keyword tags.
 *
 * One row per (cluster, fragment, char span). The same surface form can resolve
 * to different clusters in different fragments — context determines the
 * cluster, not the string. Validation:
 *   - cluster must exist in the active LexiconSlice (provided by caller — keeps
 *     this module unaware of the indication-routing logic)
 *   - fragment must exist in the corpus
 *   - char span must sit inside fragment.text and match its substring verbatim
 *
 * Storage: per-corpus partitioned, mirroring annotations layout:
 *   corpora/<corpus_id>/keyword_tags/<content_source>.json
 *
 * Dev-only writes — the deployed function FS is read-only.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { CorpusId, Fragment, FragmentId } from '$lib/content/corpora/types';

const CORPORA_DIR = 'src/lib/content/corpora';

export type FragmentKeywordTag = {
	keyword_id: string;
	corpus_id: CorpusId;
	fragment_id: FragmentId;
	content_source: string;
	char_start: number;
	char_end: number;
	surface: string;
	source: 'human' | 'ai_proposed';
	review_status: 'confirmed' | 'pending';
	created_at: string;
	reviewer_notes?: string;
};

export type FragmentKeywordTagsFile = {
	meta: {
		schema_version: string;
		corpus_id: CorpusId;
		content_source: string;
		updated_at: string;
	};
	tags: FragmentKeywordTag[];
};

function partitionPath(corpusId: CorpusId, contentSource: string): string {
	return resolve(CORPORA_DIR, corpusId, 'keyword_tags', `${contentSource}.json`);
}

function emptyFile(corpusId: CorpusId, contentSource: string): FragmentKeywordTagsFile {
	return {
		meta: {
			schema_version: '1.0',
			corpus_id: corpusId,
			content_source: contentSource,
			updated_at: new Date().toISOString()
		},
		tags: []
	};
}

function readFile(corpusId: CorpusId, contentSource: string): FragmentKeywordTagsFile {
	const path = partitionPath(corpusId, contentSource);
	if (!existsSync(path)) return emptyFile(corpusId, contentSource);
	try {
		const data = JSON.parse(readFileSync(path, 'utf8')) as FragmentKeywordTagsFile;
		// Tolerate older snapshots missing fields.
		if (!Array.isArray(data.tags)) data.tags = [];
		return data;
	} catch {
		return emptyFile(corpusId, contentSource);
	}
}

function writeFile(file: FragmentKeywordTagsFile): void {
	const path = partitionPath(file.meta.corpus_id, file.meta.content_source);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(file, null, 2) + '\n', 'utf8');
}

/** All tags for one fragment, in (char_start, keyword_id) order. */
export function readFragmentKeywordTags(
	corpusId: CorpusId,
	contentSource: string,
	fragmentId: FragmentId
): FragmentKeywordTag[] {
	const file = readFile(corpusId, contentSource);
	return file.tags
		.filter((t) => t.fragment_id === fragmentId)
		.sort(
			(a, b) =>
				a.char_start - b.char_start || a.keyword_id.localeCompare(b.keyword_id)
		);
}

export type AddTagInput = {
	corpusId: CorpusId;
	fragment: Fragment;
	keywordId: string;
	charStart: number;
	charEnd: number;
	expectedSurface?: string;
	reviewerNotes?: string;
	clusterIds: Set<string>;
};

export type AddTagResult =
	| { ok: true; tags: FragmentKeywordTag[]; surface: string }
	| { ok: false; error: string };

export function addFragmentKeywordTag(input: AddTagInput): AddTagResult {
	const { corpusId, fragment, keywordId, charStart, charEnd, expectedSurface } = input;

	if (!input.clusterIds.has(keywordId)) {
		return { ok: false, error: `Unknown cluster "${keywordId}".` };
	}
	if (!Number.isInteger(charStart) || !Number.isInteger(charEnd) || charEnd <= charStart) {
		return { ok: false, error: 'Invalid char span.' };
	}
	if (charStart < 0 || charEnd > fragment.text.length) {
		return { ok: false, error: 'Char span outside fragment text.' };
	}
	const surface = fragment.text.slice(charStart, charEnd);
	if (expectedSurface !== undefined && expectedSurface !== surface) {
		return {
			ok: false,
			error: `Stale offsets — expected "${expectedSurface}" but text says "${surface}".`
		};
	}

	const file = readFile(corpusId, fragment.content_source);
	// Dedup: collapse a tag for the same (cluster, fragment, span) — a no-op
	// rather than an error so the UI's optimistic state can stay simple.
	const dupIdx = file.tags.findIndex(
		(t) =>
			t.keyword_id === keywordId &&
			t.fragment_id === fragment.id &&
			t.char_start === charStart &&
			t.char_end === charEnd
	);
	const row: FragmentKeywordTag = {
		keyword_id: keywordId,
		corpus_id: corpusId,
		fragment_id: fragment.id,
		content_source: fragment.content_source,
		char_start: charStart,
		char_end: charEnd,
		surface,
		source: 'human',
		review_status: 'confirmed',
		created_at: new Date().toISOString(),
		reviewer_notes: input.reviewerNotes || undefined
	};
	if (dupIdx >= 0) {
		file.tags[dupIdx] = { ...file.tags[dupIdx], ...row };
	} else {
		file.tags.push(row);
	}
	file.meta.updated_at = new Date().toISOString();
	writeFile(file);
	return { ok: true, tags: readFragmentKeywordTags(corpusId, fragment.content_source, fragment.id), surface };
}

export type RemoveTagInput = {
	corpusId: CorpusId;
	contentSource: string;
	fragmentId: FragmentId;
	keywordId: string;
	charStart: number;
	charEnd: number;
};

export function removeFragmentKeywordTag(input: RemoveTagInput): {
	ok: true;
	tags: FragmentKeywordTag[];
} {
	const file = readFile(input.corpusId, input.contentSource);
	file.tags = file.tags.filter(
		(t) =>
			!(
				t.keyword_id === input.keywordId &&
				t.fragment_id === input.fragmentId &&
				t.char_start === input.charStart &&
				t.char_end === input.charEnd
			)
	);
	file.meta.updated_at = new Date().toISOString();
	writeFile(file);
	return {
		ok: true,
		tags: readFragmentKeywordTags(input.corpusId, input.contentSource, input.fragmentId)
	};
}

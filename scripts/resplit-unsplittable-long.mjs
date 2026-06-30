/**
 * resplit-unsplittable-long.mjs
 *
 * One-off touch-up that re-splits fragments currently flagged
 * `flags: ["unsplittable_long"]` in a corpus's fragments JSON files, using the
 * shared splitSentences with allowLowercaseStart:true. Rows that NOW produce
 * >= min_sentences sentences are replaced in-place by _sNN children
 * (mirroring scripts/import-forum-as-fragments.mjs); rows still under the
 * threshold are left alone (genuinely unsplittable).
 *
 * Why this exists: an earlier inline-upload path emitted long lowercase posts
 * as unsplit + flagged. Re-running import-forum-as-fragments.mjs cannot fix
 * them without also deleting any UI-uploaded content not present in
 * source/comments.json. This script is the safe in-place alternative.
 *
 * Does NOT touch annotations; stale parent-id annotations will be pruned by
 * the next proposer run, per the import-forum-as-fragments contract.
 *
 * Run:
 *   node scripts/resplit-unsplittable-long.mjs <corpus_id>           # dry-run
 *   node scripts/resplit-unsplittable-long.mjs <corpus_id> --apply   # write
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitSentences } from './lib/sentence-split.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const args = process.argv.slice(2);
const corpusId = args.find((a) => !a.startsWith('--'));
const apply = args.includes('--apply');
if (!corpusId) {
	console.error('x Usage: node scripts/resplit-unsplittable-long.mjs <corpus_id> [--apply]');
	process.exit(1);
}

const CONFIG_PATH = `src/lib/content/corpora/${corpusId}/ingest.config.json`;
const config = JSON.parse(readFileSync(resolve(ROOT, CONFIG_PATH), 'utf8'));
const SPLIT_CONFIG = {
	enabled: true,
	min_chars: 400,
	min_sentences: 4,
	applies_to: ['social_post', 'social_comment'],
	...(config.split_long_fragments ?? {})
};

const pad2 = (n) => String(n).padStart(2, '0');

function readJson(rel) {
	return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));
}
function writeJson(rel, data) {
	writeFileSync(resolve(ROOT, rel), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const summary = {};
const manifestRel = `src/lib/content/corpora/${corpusId}/manifest.json`;
const manifest = readJson(manifestRel);

for (const cs of SPLIT_CONFIG.applies_to) {
	const rel = `src/lib/content/corpora/${corpusId}/fragments/${cs}.json`;
	let doc;
	try {
		doc = readJson(rel);
	} catch {
		continue; // file may not exist for this corpus
	}
	const rows = doc.fragments;
	const next = [];
	const stats = { parents_resplit: 0, children_added: 0, still_flagged: 0, parents_seen: 0 };

	for (const r of rows) {
		const isFlagged = (r.flags || []).includes('unsplittable_long');
		if (!isFlagged) {
			next.push(r);
			continue;
		}
		stats.parents_seen += 1;

		const sentences = splitSentences(r.text, { allowLowercaseStart: true });
		if (sentences.length < SPLIT_CONFIG.min_sentences) {
			next.push(r); // still genuinely unsplittable; leave alone
			stats.still_flagged += 1;
			continue;
		}

		// Round-trip guard before mutating.
		let roundTripOk = true;
		for (const part of sentences) {
			if (r.text.slice(part.start, part.end) !== part.text) {
				roundTripOk = false;
				break;
			}
		}
		if (!roundTripOk) {
			console.error(`! round-trip failed for ${r.id}; leaving as-is`);
			next.push(r);
			continue;
		}

		// Replace parent with sentence-level children.
		const { flags: _ignored, text: _text, source_ref: parentSourceRef, id: parentId, ...inherited } = r;
		for (let s = 0; s < sentences.length; s += 1) {
			const part = sentences[s];
			next.push({
				id: `${parentId}_s${pad2(s)}`,
				...inherited,
				source_ref: { ...parentSourceRef, char_start: part.start, char_end: part.end },
				text: part.text
			});
			stats.children_added += 1;
		}
		stats.parents_resplit += 1;
	}

	summary[cs] = stats;

	if (apply) {
		doc.fragments = next;
		doc.meta = doc.meta ?? {};
		doc.meta.updated_at = new Date().toISOString();
		writeJson(rel, doc);
		const part = manifest.partitions.find((p) => p.content_source === cs);
		if (part) {
			part.fragment_count = next.length;
			part.last_ingested_at = doc.meta.updated_at;
		}
	}
}

if (apply) {
	manifest.updated_at = new Date().toISOString();
	writeJson(manifestRel, manifest);
}

console.log(apply ? '=== applied ===' : '=== DRY RUN (no writes; pass --apply to write) ===');
for (const [cs, s] of Object.entries(summary)) {
	console.log(
		`  ${cs}: ${s.parents_seen} flagged rows; ${s.parents_resplit} re-split into ${s.children_added} children; ${s.still_flagged} still unsplittable`
	);
}

/**
 * normalize-fragment-text.mjs
 *
 * One-off cleanup over existing fragment-corpus partitions. Re-applies the
 * same `normalizeText()` pass that import-forum-as-fragments.mjs runs at
 * ingest time, so corpora ingested before the normalization step landed get
 * the same clean output (HTML entities decoded, zero-widths stripped,
 * \uXXXX escapes resolved, run-of-newlines collapsed).
 *
 * Fragment ids are stable across this rewrite because annotations don't key
 * on byte offsets in the corpus model. Annotation files are untouched.
 *
 * Usage:
 *   node scripts/normalize-fragment-text.mjs <corpus_id>             # all partitions
 *   node scripts/normalize-fragment-text.mjs <corpus_id> social_post # one partition
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeText } from './lib/normalize-text.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CORPORA_DIR = resolve(ROOT, 'src/lib/content/corpora');

const args = process.argv.slice(2);
const corpusId = args[0];
const partitionFilter = args[1];

if (!corpusId) {
	console.error('x Usage: node scripts/normalize-fragment-text.mjs <corpus_id> [partition]');
	process.exit(1);
}

const fragmentsDir = resolve(CORPORA_DIR, corpusId, 'fragments');
if (!existsSync(fragmentsDir)) {
	console.error(`x No fragments dir at ${fragmentsDir}`);
	process.exit(1);
}

let totalRewrites = 0;
let totalUnchanged = 0;

const files = readdirSync(fragmentsDir).filter((f) => f.endsWith('.json'));
for (const file of files) {
	const partition = basename(file, '.json');
	if (partitionFilter && partition !== partitionFilter) continue;

	const path = join(fragmentsDir, file);
	const data = JSON.parse(readFileSync(path, 'utf8'));
	let changed = 0;
	for (const f of data.fragments ?? []) {
		const before = f.text ?? '';
		const after = normalizeText(String(before));
		if (after !== before) {
			f.text = after;
			changed += 1;
		}
	}

	if (changed > 0) {
		writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
		console.log(`  ${file}: ${changed} fragment(s) rewritten.`);
		totalRewrites += changed;
	} else {
		console.log(`  ${file}: already clean.`);
	}
	totalUnchanged += (data.fragments?.length ?? 0) - changed;
}

console.log(`\nDone. ${totalRewrites} fragment(s) updated; ${totalUnchanged} already clean.`);

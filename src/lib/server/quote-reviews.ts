/**
 * Analyst review decisions on AI-proposed pull quotes.
 *
 * Backed by wctglpdemo-data/quote_reviews.json. The quote bank itself
 * (quote_bank.json) is a generated artifact — build-quote-bank.mjs rewrites it
 * on every run and bakes every quote as review_status "pending". So an
 * analyst's approve/reject decision is stored here instead, keyed by quote_id,
 * where it survives a quote-bank rebuild. A quote with no entry here is
 * "pending".
 *
 * Note: this writes into the source tree, so it is a dev/demo-time operation —
 * see the matching note in highlights.ts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REVIEWS_PATH = 'src/lib/content/wctglpdemo-data/quote_reviews.json';

/** A stored decision. "pending" is never stored — it is the absence of an entry. */
export type QuoteReviewDecision = 'approved' | 'rejected';
export type QuoteReviewStatus = QuoteReviewDecision | 'pending';

type ReviewsFile = {
	meta: { schema_version: string; study_id: string; description: string; updated_at: string };
	reviews: Record<string, { status: QuoteReviewDecision; updated_at: string }>;
};

/** quote_id -> decision, for the quotes an analyst has acted on. */
export type QuoteReviewState = Record<string, QuoteReviewDecision>;

function read(): ReviewsFile {
	return JSON.parse(readFileSync(resolve(REVIEWS_PATH), 'utf8'));
}

function project(file: ReviewsFile): QuoteReviewState {
	return Object.fromEntries(Object.entries(file.reviews).map(([id, r]) => [id, r.status]));
}

/** Current review decisions — safe to call from a page `load`. */
export function readQuoteReviews(): QuoteReviewState {
	return project(read());
}

/**
 * Apply a batch of analyst decisions in a single write; returns the updated
 * state. Each entry maps a quote_id to its new status — "pending" clears the
 * decision, "approved"/"rejected" set it.
 */
export function applyQuoteReviews(
	updates: Record<string, QuoteReviewStatus>
): QuoteReviewState {
	const file = read();
	const now = new Date().toISOString();
	for (const [id, status] of Object.entries(updates)) {
		if (status === 'pending') delete file.reviews[id];
		else file.reviews[id] = { status, updated_at: now };
	}
	// Keep the map key-sorted so file diffs stay readable.
	file.reviews = Object.fromEntries(
		Object.entries(file.reviews).sort(([a], [b]) => a.localeCompare(b))
	);
	file.meta.updated_at = now;
	writeFileSync(resolve(REVIEWS_PATH), JSON.stringify(file, null, 2) + '\n', 'utf8');
	return project(file);
}

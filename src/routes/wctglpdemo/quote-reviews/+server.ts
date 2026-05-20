/**
 * Endpoint for analyst review decisions on pull quotes.
 *
 * The analysis page stages approve/reject edits locally, then POSTs the whole
 * diff here as { updates: { quoteId: status } } on Save and gets back the full
 * updated review state. Kept as a plain endpoint, like /highlights — a save
 * never touches the page's `form` prop.
 */
import { json, error } from '@sveltejs/kit';
import { applyQuoteReviews, type QuoteReviewStatus } from '$lib/server/quote-reviews';
import type { RequestHandler } from './$types';

const STATUSES: QuoteReviewStatus[] = ['pending', 'approved', 'rejected'];

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const updates = body?.updates;

	if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
		error(400, 'Expected a JSON body { updates: { [quoteId]: "pending" | "approved" | "rejected" } }.');
	}

	const clean: Record<string, QuoteReviewStatus> = {};
	for (const [rawId, status] of Object.entries(updates)) {
		const id = rawId.trim();
		if (!id || !STATUSES.includes(status as QuoteReviewStatus)) {
			error(400, `Invalid review update for "${rawId}".`);
		}
		clean[id] = status as QuoteReviewStatus;
	}

	if (Object.keys(clean).length === 0) {
		error(400, 'No review updates provided.');
	}

	return json({ reviews: await applyQuoteReviews(clean) });
};

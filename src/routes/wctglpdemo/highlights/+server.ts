/**
 * Toggle endpoint for analyst-starred highlights.
 *
 * Shared by the review (upload) and analysis pages: each star button POSTs
 * { kind, id } here and gets back the full updated highlight state. Kept as a
 * plain endpoint rather than a form action so a toggle never touches either
 * page's `form` prop.
 */
import { json, error } from '@sveltejs/kit';
import { toggleHighlight, type HighlightKind } from '$lib/server/highlights';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const kind = body?.kind as HighlightKind | undefined;
	const id = typeof body?.id === 'string' ? body.id.trim() : '';

	if ((kind !== 'segment' && kind !== 'quote') || !id) {
		error(400, 'Expected a JSON body { kind: "segment" | "quote", id: string }.');
	}

	return json(toggleHighlight(kind, id));
};

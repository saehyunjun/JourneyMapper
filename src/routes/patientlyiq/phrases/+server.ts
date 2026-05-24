/**
 * Key-phrase lexicon editing — POST endpoint.
 *
 * The segment tag drawer's right-click menu posts a highlighted snippet here
 * to file it under a canonical key phrase. One `action` per request:
 *   add_phrase_variant — add the snippet as a variant of an existing phrase
 *   create_key_phrase  — make a new key phrase, seeded with the snippet
 *
 * Each variant carries the segment_id and interview_id it came from so the
 * canonical phrase can back-link to the participant utterances. Responds with
 * the refreshed key-phrase list so the drawer can keep its menus in sync.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addPhraseVariant, createKeyPhrase, type PhraseState } from '$lib/server/phrases';

export const POST: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
	}

	const action = typeof body.action === 'string' ? body.action : '';
	const text = typeof body.text === 'string' ? body.text : '';
	const str = (v: unknown) => (typeof v === 'string' ? v : '');
	const trimmed = text.replace(/\s+/g, ' ').trim();
	const segmentId = str(body.segment_id);
	const interviewId = str(body.interview_id);

	try {
		let state: PhraseState;
		let message: string;
		switch (action) {
			case 'add_phrase_variant':
				state = await addPhraseVariant(str(body.key_phrase_id), text, segmentId, interviewId);
				message = `Added “${trimmed}” as a key-phrase variant.`;
				break;
			case 'create_key_phrase':
				state = await createKeyPhrase(text, segmentId, interviewId, str(body.label) || undefined);
				message = `Created a new key phrase from “${trimmed}”.`;
				break;
			default:
				return json({ ok: false, error: `Unknown action "${action}".` }, { status: 400 });
		}
		return json({ ok: true, message, key_phrases: state.key_phrases });
	} catch (e) {
		return json(
			{ ok: false, error: e instanceof Error ? e.message : 'Could not update the list.' },
			{ status: 400 }
		);
	}
};

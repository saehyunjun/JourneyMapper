/**
 * Keyword lexicon & theme term editing — POST endpoint.
 *
 * The segment tag drawer's right-click menu posts a highlighted phrase here to
 * file it into a keyword or theme. One `action` per request:
 *   add_keyword_variant — add the phrase as a variant of an existing keyword
 *   create_keyword      — make a new keyword in a category from the phrase
 *   add_theme_term      — add the phrase to an existing theme's term list
 *   create_theme        — make a new theme seeded with the phrase
 *
 * Responds with the refreshed keyword categories and theme list so the drawer
 * can keep its menus in sync within the session.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	addKeywordVariant,
	createKeyword,
	addThemeTerm,
	createTheme,
	type LexiconState
} from '$lib/server/lexicon';

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

	try {
		let state: LexiconState;
		let message: string;
		switch (action) {
			case 'add_keyword_variant':
				state = await addKeywordVariant(str(body.keyword_id), text);
				message = `Added “${trimmed}” as a keyword variant.`;
				break;
			case 'create_keyword':
				state = await createKeyword(str(body.category_id), text);
				message = `Created a new keyword from “${trimmed}”.`;
				break;
			case 'add_theme_term':
				state = await addThemeTerm(str(body.theme_id), text);
				message = `Added “${trimmed}” to a theme.`;
				break;
			case 'create_theme':
				state = await createTheme(text);
				message = `Created a new theme from “${trimmed}”.`;
				break;
			default:
				return json({ ok: false, error: `Unknown action "${action}".` }, { status: 400 });
		}
		return json({ ok: true, message, categories: state.categories, themes: state.themes });
	} catch (e) {
		return json(
			{ ok: false, error: e instanceof Error ? e.message : 'Could not update the list.' },
			{ status: 400 }
		);
	}
};

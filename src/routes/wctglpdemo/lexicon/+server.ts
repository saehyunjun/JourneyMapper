/**
 * Keyword cluster lexicon — POST endpoint.
 *
 * Backs the segment tag drawer's "Tag as keyword…" flow.
 *   add_keyword_variant — add the phrase as a variant of an existing cluster
 *   create_cluster      — create a new cluster under (parent_theme,
 *                         parent_subtheme), seeded with the phrase
 *
 * Returns the refreshed clusters + themes so the drawer can keep its menus in
 * sync, plus `created_id` on create_cluster so the caller can immediately tag
 * the highlighted span to it.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	addKeywordVariant,
	createCluster,
	moveKeywordVariant,
	removeKeywordVariant,
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
		switch (action) {
			case 'add_keyword_variant': {
				const state: LexiconState = await addKeywordVariant(str(body.keyword_id), text);
				return json({
					ok: true,
					message: `Added “${trimmed}” as a cluster variant.`,
					clusters: state.clusters,
					themes: state.themes
				});
			}
			case 'remove_keyword_variant': {
				const state: LexiconState = await removeKeywordVariant(str(body.keyword_id), text);
				const cluster = state.clusters.find((c) => c.id === str(body.keyword_id));
				return json({
					ok: true,
					message: `Unlinked “${trimmed}” from “${cluster?.label ?? str(body.keyword_id)}”.`,
					clusters: state.clusters,
					themes: state.themes
				});
			}
			case 'move_keyword_variant': {
				const state: LexiconState = await moveKeywordVariant(
					str(body.from_keyword_id),
					str(body.to_keyword_id),
					text
				);
				const target = state.clusters.find((c) => c.id === str(body.to_keyword_id));
				return json({
					ok: true,
					message: `Moved “${trimmed}” to “${target?.label ?? str(body.to_keyword_id)}”.`,
					clusters: state.clusters,
					themes: state.themes
				});
			}
			case 'create_cluster': {
				const result = await createCluster(
					str(body.parent_theme),
					str(body.parent_subtheme),
					text,
					str(body.label),
					str(body.description)
				);
				const created = result.clusters.find((c) => c.id === result.createdId);
				return json({
					ok: true,
					message: `Linked “${trimmed}” to “${created?.label ?? result.createdId}”.`,
					clusters: result.clusters,
					themes: result.themes,
					created_id: result.createdId
				});
			}
			default:
				return json({ ok: false, error: `Unknown action "${action}".` }, { status: 400 });
		}
	} catch (e) {
		return json(
			{ ok: false, error: e instanceof Error ? e.message : 'Could not update the lexicon.' },
			{ status: 400 }
		);
	}
};

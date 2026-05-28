/**
 * Personas page — resolve which gallery is active and which entry is selected.
 *
 *  ?view=saved | suggestions    (default: suggestions if any exist, else saved)
 *  ?persona=<id>                (id from the active gallery)
 */
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url, data }) => {
	const requestedView = url.searchParams.get('view');
	const initialView: 'suggestions' | 'saved' =
		requestedView === 'saved'
			? 'saved'
			: requestedView === 'suggestions'
				? 'suggestions'
				: data.suggestions.length > 0
					? 'suggestions'
					: 'saved';

	const active = initialView === 'saved' ? data.saved : data.suggestions;
	const requestedId = url.searchParams.get('persona') ?? url.searchParams.get('suggestion');
	const ids = new Set(active.map((p) => p.id));
	const initialPersonaId =
		requestedId && ids.has(requestedId) ? requestedId : (active[0]?.id ?? null);

	return { ...data, initialView, initialPersonaId };
};

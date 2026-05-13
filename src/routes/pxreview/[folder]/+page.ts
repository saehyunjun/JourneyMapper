import { error } from '@sveltejs/kit';
import { findSection } from '$lib/content';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const section = findSection(params.folder);
	if (!section) error(404, `No section "${params.folder}"`);
	return {
		folder: params.folder,
		sectionTitle: section.title
	};
};

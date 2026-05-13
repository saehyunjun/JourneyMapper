import { error } from '@sveltejs/kit';
import { findEntry, getSectionTitle } from '$lib/content';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const entry = findEntry(params.folder, params.slug);
	if (!entry) error(404, `No content at ${params.folder}/${params.slug}`);
	return {
		folder: params.folder,
		slug: params.slug,
		title: entry.title,
		sectionTitle: getSectionTitle(params.folder)
	};
};

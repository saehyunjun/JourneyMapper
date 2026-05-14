import { error } from '@sveltejs/kit';
import { findEntry, getSectionTitle } from '$lib/content';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const entry = findEntry(params.folder, params.subfolder, params.slug);
	if (!entry) error(404, `No content at ${params.folder}/${params.subfolder}/${params.slug}`);
	return {
		folder: params.folder,
		subfolder: params.subfolder,
		slug: params.slug,
		title: entry.title,
		sectionTitle: getSectionTitle(params.folder)
	};
};

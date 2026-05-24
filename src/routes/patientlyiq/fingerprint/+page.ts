/**
 * Fingerprint page — resolve which interview to show first.
 *
 * `?interview=<id>` (e.g. the link from the upload page's post-tag modal) wins;
 * otherwise the most recent themed interview is shown.
 */
import type { PageLoad } from './$types';
import { themedParticipantIds } from '$lib/content/wctglpdemo-data/analysis';

export const load: PageLoad = ({ url, data }) => {
	const requested = url.searchParams.get('interview');
	const interview =
		requested && themedParticipantIds.includes(requested)
			? requested
			: (themedParticipantIds[themedParticipantIds.length - 1] ?? null);
	// Merge in the server load's output (starred quotes + participant profiles).
	return { ...data, interview };
};

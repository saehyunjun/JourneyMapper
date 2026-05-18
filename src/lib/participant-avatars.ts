/**
 * Participant avatar images.
 *
 * The pngs in wctglpdemo-data/avatars are named "Participant NN.png"; this
 * maps them to interview ids ("participant_06") and resolves each to a served
 * URL via Vite. Import `participantAvatarUrl` wherever a participant avatar is
 * shown.
 */
const modules = import.meta.glob('./content/wctglpdemo-data/avatars/*.png', {
	eager: true,
	query: '?url',
	import: 'default'
}) as Record<string, string>;

const byInterviewId = new Map<string, string>();
for (const [path, url] of Object.entries(modules)) {
	const match = path.match(/Participant\s+(\d+)\.png$/i);
	if (match) byInterviewId.set(`participant_${match[1]}`, url);
}

/** Served URL of an interview's avatar image, or undefined if there is none. */
export function participantAvatarUrl(interviewId: string): string | undefined {
	return byInterviewId.get(interviewId);
}

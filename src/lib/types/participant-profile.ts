/**
 * participant-profile.ts
 *
 * Shared (client + server) types for analyst-maintained participant details:
 * name, demographics, an individual/composite flag, and an uploaded avatar.
 * Persisted via $lib/server/participant-profiles; edited in ParticipantDrawer.
 */

export type Gender = 'male' | 'female' | 'non-binary' | 'transgender';
export type ParticipantType = 'individual' | 'composite';

export type ParticipantProfile = {
	interview_id: string;
	first_name: string;
	/** Single-letter surname initial, e.g. "D". */
	last_initial: string;
	gender: Gender | '';
	country: string;
	age_range: string;
	participant_type: ParticipantType;
	/** Served URL of an uploaded avatar override, or null to fall back to the bundled image. */
	avatar_url: string | null;
};

export const GENDERS: Gender[] = ['male', 'female', 'non-binary', 'transgender'];

export const AGE_RANGES = [
	'18-25',
	'26-30',
	'31-35',
	'36-40',
	'41-45',
	'46-50',
	'51-55',
	'56-60',
	'61-65',
	'66+'
] as const;

/** A blank profile for an interview that has no saved details yet. */
export function emptyProfile(interviewId: string): ParticipantProfile {
	return {
		interview_id: interviewId,
		first_name: '',
		last_initial: '',
		gender: '',
		country: '',
		age_range: '',
		participant_type: 'individual',
		avatar_url: null
	};
}

/**
 * Display label for a participant — "Jane D." once a name is filled in, falling
 * back to the supplied interview label (e.g. "Participant 09") otherwise.
 */
export function profileName(profile: ParticipantProfile | undefined, fallback: string): string {
	const first = profile?.first_name?.trim() ?? '';
	const last = profile?.last_initial?.trim() ?? '';
	if (!first) return fallback;
	return last ? `${first} ${last.toUpperCase()}.` : first;
}

/** Join phrases into prose: "A", "A and B", "A, B, and C". */
function proseList(items: string[]): string {
	if (items.length <= 1) return items[0] ?? '';
	if (items.length === 2) return `${items[0]} and ${items[1]}`;
	return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/**
 * A generated two-sentence bio for the fingerprint page. The first sentence
 * places the participant (age, country, individual/composite); the second
 * names the themes their tagged segments returned to most. `themeLabels`
 * should be human-readable and ordered most-raised first.
 */
export function participantBio(
	profile: ParticipantProfile | undefined,
	fallback: string,
	themeLabels: string[],
	segmentCount: number
): string {
	const name = profileName(profile, fallback);
	const age = profile?.age_range?.trim() ?? '';
	const country = profile?.country?.trim() ?? '';
	const composite = profile?.participant_type === 'composite';

	// Sentence 1 — who they are.
	const noun = composite ? 'composite persona' : 'patient';
	const ageClause = age ? `${age.replace(/-/g, '–')}-year-old ` : '';
	let identity = `${name} is a ${ageClause}${noun}`;
	if (country) identity += ` from ${country}`;
	if (composite) identity += ', blended from several interviews';
	identity += '.';

	// Sentence 2 — what their interview returned to.
	const themes = themeLabels.slice(0, 3);
	const concern = themes.length
		? `Across ${segmentCount} tagged ${segmentCount === 1 ? 'segment' : 'segments'}, ` +
			`${composite ? 'this persona' : 'they'} returned most often to ${proseList(themes)}.`
		: 'No interview themes have been tagged for this participant yet.';

	return `${identity} ${concern}`;
}

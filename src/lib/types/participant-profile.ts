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

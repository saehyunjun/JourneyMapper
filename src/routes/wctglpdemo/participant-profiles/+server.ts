/**
 * Save endpoint for participant profile details.
 *
 * The participant drawer POSTs { interviewId, profile } here when the analyst
 * saves a participant's details; it gets back the persisted profile. Avatar
 * uploads go to the sibling /participant-avatar endpoint (multipart).
 */
import { json, error } from '@sveltejs/kit';
import { saveProfile } from '$lib/server/participant-profiles';
import {
	AGE_RANGES,
	GENDERS,
	type Gender,
	type ParticipantProfile,
	type ParticipantType
} from '$lib/types/participant-profile';
import type { RequestHandler } from './$types';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const interviewId = str(body?.interviewId);
	const profile = body?.profile;

	if (!interviewId || !profile || typeof profile !== 'object') {
		error(400, 'Expected a JSON body { interviewId: string, profile: {…} }.');
	}

	const gender = str(profile.gender);
	if (gender && !GENDERS.includes(gender as Gender)) {
		error(400, `Unknown gender "${gender}".`);
	}

	const ageRange = str(profile.age_range);
	if (ageRange && !AGE_RANGES.includes(ageRange as (typeof AGE_RANGES)[number])) {
		error(400, `Unknown age range "${ageRange}".`);
	}

	const participantType = str(profile.participant_type) || 'individual';
	if (participantType !== 'individual' && participantType !== 'composite') {
		error(400, `participant_type must be "individual" or "composite".`);
	}

	const patch: Partial<Omit<ParticipantProfile, 'interview_id'>> = {
		first_name: str(profile.first_name),
		last_initial: str(profile.last_initial).slice(0, 1),
		gender: gender as Gender | '',
		country: str(profile.country),
		age_range: ageRange,
		participant_type: participantType as ParticipantType
	};

	return json({ profile: await saveProfile(interviewId, patch) });
};

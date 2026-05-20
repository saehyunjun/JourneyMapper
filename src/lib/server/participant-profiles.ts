/**
 * Participant profiles — shared read/write helpers.
 *
 * Backed by wctglpdemo-data/participant_profiles.json (dev) or the KV store
 * (prod). Analyst-maintained details (name, demographics, individual/composite
 * flag, uploaded avatar) for each interviewee. Until first save, every
 * participant reads as a blank profile, with gender seeded from the structured
 * interview metadata where it is known.
 */
import interviewsRaw from '$lib/content/wctglpdemo-data/interviews_structured.json';
import bundledProfiles from '$lib/content/wctglpdemo-data/participant_profiles.json';
import {
	emptyProfile,
	type Gender,
	type ParticipantProfile
} from '$lib/types/participant-profile';
import { loadDoc, saveDoc } from './kv-store';

const PROFILES_PATH = 'src/lib/content/wctglpdemo-data/participant_profiles.json';
const KV_KEY = 'wctglpdemo:participant_profiles';

type StoredProfile = Omit<ParticipantProfile, 'interview_id'>;

type ProfilesFile = {
	meta: { schema_version: string; study_id: string; description: string; updated_at: string };
	profiles: Record<string, StoredProfile>;
};

const interviews = (
	interviewsRaw as {
		interviews: {
			interview_id: string;
			participant_metadata?: { gender?: string | null };
		}[];
	}
).interviews;

/** Every interview id known to the structured dataset. */
export const knownInterviewIds: string[] = interviews.map((iv) => iv.interview_id).sort();

// Gender from the structured pipeline metadata, used to seed a fresh profile.
const seededGender = new Map<string, Gender>();
for (const iv of interviews) {
	const g = iv.participant_metadata?.gender;
	if (g === 'male' || g === 'female') seededGender.set(iv.interview_id, g);
}

const read = () =>
	loadDoc<ProfilesFile>(KV_KEY, PROFILES_PATH, bundledProfiles as ProfilesFile);

/** Build a full, defaulted profile for one interview from its stored fields. */
function hydrate(interviewId: string, stored: StoredProfile | undefined): ParticipantProfile {
	const base = emptyProfile(interviewId);
	if (seededGender.has(interviewId)) base.gender = seededGender.get(interviewId)!;
	return { ...base, ...stored, interview_id: interviewId };
}

/** Profiles for every known interview, defaulted and seeded — safe to call from a page `load`. */
export async function readProfiles(): Promise<Record<string, ParticipantProfile>> {
	const file = await read();
	const out: Record<string, ParticipantProfile> = {};
	for (const id of knownInterviewIds) out[id] = hydrate(id, file.profiles[id]);
	// Include any stored profile whose interview is not in the structured set.
	for (const id of Object.keys(file.profiles)) {
		if (!out[id]) out[id] = hydrate(id, file.profiles[id]);
	}
	return out;
}

/** One participant's profile, defaulted/seeded. */
export async function readProfile(interviewId: string): Promise<ParticipantProfile> {
	const file = await read();
	return hydrate(interviewId, file.profiles[interviewId]);
}

/** Merge a partial update into one profile and persist; returns the saved profile. */
export async function saveProfile(
	interviewId: string,
	patch: Partial<Omit<ParticipantProfile, 'interview_id'>>
): Promise<ParticipantProfile> {
	const file = await read();
	const current = hydrate(interviewId, file.profiles[interviewId]);
	const next: ParticipantProfile = { ...current, ...patch, interview_id: interviewId };
	const { interview_id, ...stored } = next;
	void interview_id;
	file.profiles[interviewId] = stored;
	file.meta.updated_at = new Date().toISOString();
	await saveDoc(KV_KEY, PROFILES_PATH, file);
	return next;
}

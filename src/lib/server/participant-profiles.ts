/**
 * Participant profiles — shared read/write helpers.
 *
 * Backed by wctglpdemo-data/participant_profiles.json (dev) or the KV store
 * (prod). Analyst-maintained details (name, demographics, individual/composite
 * flag, uploaded avatar) for each interviewee. Until first save, every
 * participant reads as a blank profile, with gender seeded from the structured
 * interview metadata where it is known.
 */
import {
	emptyProfile,
	type Gender,
	type ParticipantProfile
} from '$lib/types/participant-profile';
import { loadDoc, saveDoc, lazySeed } from './kv-store';

const PROFILES_PATH = 'src/lib/content/wctglpdemo-data/participant_profiles.json';
const KV_KEY = 'wctglpdemo:participant_profiles';

type StoredProfile = Omit<ParticipantProfile, 'interview_id'>;

type ProfilesFile = {
	meta: { schema_version: string; study_id: string; description: string; updated_at: string };
	profiles: Record<string, StoredProfile>;
};

type InterviewMeta = {
	interview_id: string;
	participant_metadata?: { gender?: string | null };
};

// interviews_structured.json is 164 KB. Loaded lazily on first profile read
// (instead of at module init) so importing this module doesn't drag it into
// every chunk that just needs the readProfile* helpers.
const loadInterviewIndex = lazySeed(async () => {
	const m = await import('$lib/content/wctglpdemo-data/interviews_structured.json');
	const interviews = (m.default as { interviews: InterviewMeta[] }).interviews;
	const ids = interviews.map((iv) => iv.interview_id).sort();
	const genderById = new Map<string, Gender>();
	for (const iv of interviews) {
		const g = iv.participant_metadata?.gender;
		if (g === 'male' || g === 'female') genderById.set(iv.interview_id, g);
	}
	return { ids, genderById };
});

const seedProfiles = lazySeed(() =>
	import('$lib/content/wctglpdemo-data/participant_profiles.json').then(
		(m) => m.default as ProfilesFile
	)
);

const read = () => loadDoc<ProfilesFile>(KV_KEY, PROFILES_PATH, seedProfiles);

/** Every interview id known to the structured dataset. Lazy; resolves once
 *  and caches. */
export async function getKnownInterviewIds(): Promise<string[]> {
	return (await loadInterviewIndex()).ids;
}

/** Build a full, defaulted profile for one interview from its stored fields. */
function hydrate(
	interviewId: string,
	stored: StoredProfile | undefined,
	genderById: Map<string, Gender>
): ParticipantProfile {
	const base = emptyProfile(interviewId);
	if (genderById.has(interviewId)) base.gender = genderById.get(interviewId)!;
	return { ...base, ...stored, interview_id: interviewId };
}

/** Profiles for every known interview, defaulted and seeded — safe to call from a page `load`. */
export async function readProfiles(): Promise<Record<string, ParticipantProfile>> {
	const [file, { ids, genderById }] = await Promise.all([read(), loadInterviewIndex()]);
	const out: Record<string, ParticipantProfile> = {};
	for (const id of ids) out[id] = hydrate(id, file.profiles[id], genderById);
	// Include any stored profile whose interview is not in the structured set.
	for (const id of Object.keys(file.profiles)) {
		if (!out[id]) out[id] = hydrate(id, file.profiles[id], genderById);
	}
	return out;
}

/** One participant's profile, defaulted/seeded. */
export async function readProfile(interviewId: string): Promise<ParticipantProfile> {
	const [file, { genderById }] = await Promise.all([read(), loadInterviewIndex()]);
	return hydrate(interviewId, file.profiles[interviewId], genderById);
}

/** Merge a partial update into one profile and persist; returns the saved profile. */
export async function saveProfile(
	interviewId: string,
	patch: Partial<Omit<ParticipantProfile, 'interview_id'>>
): Promise<ParticipantProfile> {
	const [file, { genderById }] = await Promise.all([read(), loadInterviewIndex()]);
	const current = hydrate(interviewId, file.profiles[interviewId], genderById);
	const next: ParticipantProfile = { ...current, ...patch, interview_id: interviewId };
	const { interview_id, ...stored } = next;
	void interview_id;
	file.profiles[interviewId] = stored;
	file.meta.updated_at = new Date().toISOString();
	await saveDoc(KV_KEY, PROFILES_PATH, file);
	return next;
}

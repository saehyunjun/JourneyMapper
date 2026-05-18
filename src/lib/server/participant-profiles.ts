/**
 * Participant profiles — shared read/write helpers.
 *
 * Backed by wctglpdemo-data/participant_profiles.json: analyst-maintained
 * details (name, demographics, individual/composite flag, uploaded avatar) for
 * each interviewee. The file is created lazily on first save; until then every
 * participant reads as a blank profile, with gender seeded from the structured
 * interview metadata where it is known.
 *
 * Note: this writes into the source tree, so it is a dev/demo-time operation —
 * see the matching note in $lib/server/highlights.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import interviewsRaw from '$lib/content/wctglpdemo-data/interviews_structured.json';
import {
	emptyProfile,
	type Gender,
	type ParticipantProfile
} from '$lib/types/participant-profile';

const PROFILES_PATH = 'src/lib/content/wctglpdemo-data/participant_profiles.json';

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

function emptyFile(): ProfilesFile {
	return {
		meta: {
			schema_version: '1.0',
			study_id: 'wct_glp1',
			description:
				'Analyst-maintained participant profiles. Keyed by interview_id; references avatars under static/content-assets/avatars.',
			updated_at: new Date().toISOString()
		},
		profiles: {}
	};
}

function read(): ProfilesFile {
	const path = resolve(PROFILES_PATH);
	if (!existsSync(path)) return emptyFile();
	try {
		return JSON.parse(readFileSync(path, 'utf8')) as ProfilesFile;
	} catch {
		return emptyFile();
	}
}

/** Build a full, defaulted profile for one interview from its stored fields. */
function hydrate(interviewId: string, stored: StoredProfile | undefined): ParticipantProfile {
	const base = emptyProfile(interviewId);
	if (seededGender.has(interviewId)) base.gender = seededGender.get(interviewId)!;
	return { ...base, ...stored, interview_id: interviewId };
}

/** Profiles for every known interview, defaulted and seeded — safe to call from a page `load`. */
export function readProfiles(): Record<string, ParticipantProfile> {
	const file = read();
	const out: Record<string, ParticipantProfile> = {};
	for (const id of knownInterviewIds) out[id] = hydrate(id, file.profiles[id]);
	// Include any stored profile whose interview is not in the structured set.
	for (const id of Object.keys(file.profiles)) {
		if (!out[id]) out[id] = hydrate(id, file.profiles[id]);
	}
	return out;
}

/** One participant's profile, defaulted/seeded. */
export function readProfile(interviewId: string): ParticipantProfile {
	return hydrate(interviewId, read().profiles[interviewId]);
}

/** Merge a partial update into one profile and persist; returns the saved profile. */
export function saveProfile(
	interviewId: string,
	patch: Partial<Omit<ParticipantProfile, 'interview_id'>>
): ParticipantProfile {
	const file = read();
	const current = hydrate(interviewId, file.profiles[interviewId]);
	const next: ParticipantProfile = { ...current, ...patch, interview_id: interviewId };
	const { interview_id, ...stored } = next;
	void interview_id;
	file.profiles[interviewId] = stored;
	file.meta.updated_at = new Date().toISOString();
	writeFileSync(resolve(PROFILES_PATH), JSON.stringify(file, null, 2) + '\n', 'utf8');
	return next;
}

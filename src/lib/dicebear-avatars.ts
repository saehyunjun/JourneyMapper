const DICEBEAR_PROXY_BASE = '/api/avatars/dicebear';

const MONO_BACKGROUNDS = ['f8fafc', 'f1f5f9', 'e7e5e4', 'e5e7eb', 'd6d3d1'];
const MONO_SKIN = ['f1eeeb', 'e5dfd9', 'd6cdc5', 'c8beb6'];
const MONO_HAIR = ['1f2937', '334155', '44403c', '57534e'];
const MONO_SHIRTS = ['475569', '64748b', '78716c', '71717a'];
const MONO_ACCENTS = ['94a3b8', 'a8a29e', 'cbd5e1', 'd6d3d1'];

function isGeneratedDicebearAvatarUrl(url: string | null | undefined): boolean {
	return Boolean(
		url?.startsWith(`${DICEBEAR_PROXY_BASE}/`) || url?.startsWith('https://api.dicebear.com/')
	);
}

function dicebearUrl(style: 'micah' | 'glass', seed: string, options: Record<string, string> = {}) {
	const params = new URLSearchParams({
		seed,
		radius: '50',
		size: '128',
		...options
	});
	return `${DICEBEAR_PROXY_BASE}/${style}?${params.toString().replaceAll('%2C', ',')}`;
}

export function personaNarrativeAvatarUrl(persona: {
	id: string;
	label?: string;
	color?: string | null;
}) {
	return dicebearUrl('micah', `persona:${persona.id}:${persona.label ?? ''}`, {
		backgroundColor: MONO_BACKGROUNDS.join(','),
		baseColor: MONO_SKIN.join(','),
		hairColor: MONO_HAIR.join(','),
		facialHairColor: MONO_HAIR.join(','),
		earringsColor: MONO_ACCENTS.join(','),
		glassesColor: MONO_HAIR.join(','),
		shirtColor: MONO_SHIRTS.join(',')
	});
}

export function corpusParticipantAvatarUrl(corpusId: string, authorHandle: string) {
	return participantNarrativeAvatarUrl({
		kind: 'corpus_author',
		corpusId,
		authorHandle
	});
}

/** Shared persona-style avatar generator for participants — interview
 *  participants and corpus authors all route through this so every narrative
 *  view shows the same Micah-figure + gradient treatment that personas use.
 *  The seed encodes the participant's identity so the avatar stays stable
 *  across renders without per-participant artwork.  */
export function participantNarrativeAvatarUrl(
	target:
		| { kind: 'interview'; interviewId: string }
		| { kind: 'corpus_author'; corpusId: string; authorHandle: string }
): string {
	const seed =
		target.kind === 'interview'
			? `participant:${target.interviewId}`
			: `corpus:${target.corpusId}:author:${target.authorHandle}`;
	return dicebearUrl('micah', seed, {
		backgroundColor: MONO_BACKGROUNDS.join(','),
		backgroundType: 'gradientLinear',
		backgroundRotation: '0,360',
		baseColor: MONO_SKIN.join(','),
		hairColor: MONO_HAIR.join(','),
		facialHairColor: MONO_HAIR.join(','),
		earringsColor: MONO_ACCENTS.join(','),
		glassesColor: MONO_HAIR.join(','),
		shirtColor: MONO_SHIRTS.join(',')
	});
}

/** Fragment-aware shortcut so views that walk a mixed fragment list don't have
 *  to discriminate the SourceRef union themselves. Returns null when the
 *  fragment doesn't have a participant concept (e.g. search_query rows). */
export function fragmentParticipantAvatarUrl(f: {
	corpus_id: string;
	source_ref: { kind: string; interview_id?: string; author_handle_hash?: string; media_id?: string };
}): string | null {
	const ref = f.source_ref;
	if (ref.kind === 'interview' && ref.interview_id) {
		return participantNarrativeAvatarUrl({ kind: 'interview', interviewId: ref.interview_id });
	}
	if (ref.author_handle_hash) {
		return participantNarrativeAvatarUrl({
			kind: 'corpus_author',
			corpusId: f.corpus_id,
			authorHandle: ref.author_handle_hash
		});
	}
	if ((ref.kind === 'youtube_transcript' || ref.kind === 'podcast_transcript') && ref.media_id) {
		// Per-episode avatar — segments share the same media_id so the speaker
		// view groups under one figure even though no individual speaker is named.
		return participantNarrativeAvatarUrl({
			kind: 'corpus_author',
			corpusId: f.corpus_id,
			authorHandle: ref.media_id
		});
	}
	return null;
}

export function generatedPersonaAvatarUrl(persona: {
	id: string;
	label?: string;
	color?: string | null;
	avatar_url?: string | null;
}) {
	return persona.avatar_url && !isGeneratedDicebearAvatarUrl(persona.avatar_url)
		? persona.avatar_url
		: personaNarrativeAvatarUrl(persona);
}

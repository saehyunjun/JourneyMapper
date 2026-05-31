/**
 * Journey-Map landing redirect.
 *
 * The real journey-map view lives at /journey-map/[corpus_id]/[persona_id],
 * which can't be linked from the sidebar without params. This loader picks a
 * sensible default — first artifact for the active indication, else first
 * artifact anywhere — and redirects so the sidebar link "Journey Map"
 * always lands on something useful instead of a 404.
 *
 * If no artifacts exist at all (fresh repo), it 404s with a hint to run the
 * journey-map synthesis script.
 */
import { redirect, error } from '@sveltejs/kit';
import { listCorpusIds, listCorpusArtifacts, loadCorpusManifest } from '$lib/server/corpus-store';
import type { PageServerLoad } from './$types';

const ARTIFACT_RE = /^journey-map-(.+)$/;

type Hit = { corpus_id: string; persona_id: string; indications: string[] };

async function scanArtifacts(): Promise<Hit[]> {
	const ids = await listCorpusIds();
	const out: Hit[] = [];
	for (const id of ids) {
		const manifest = await loadCorpusManifest(id);
		if (!manifest) continue;
		const names = await listCorpusArtifacts(id);
		for (const name of names) {
			const m = name.match(ARTIFACT_RE);
			if (!m) continue;
			out.push({
				corpus_id: id,
				persona_id: m[1],
				indications: manifest.indications as string[]
			});
		}
	}
	return out;
}

export const load: PageServerLoad = async ({ parent, url }) => {
	const { slice } = (await parent()) as { slice?: { active_indication?: string } };
	const activeIndication = slice?.active_indication ?? null;

	const hits = await scanArtifacts();
	if (hits.length === 0) {
		throw error(
			404,
			'No journey-map artifacts found. Generate one with scripts/synthesize-journey-map.mjs <corpus_id> <persona_id>.'
		);
	}

	const preferred = activeIndication
		? hits.find((h) => h.indications.includes(activeIndication))
		: null;
	const pick = preferred ?? hits[0];

	const target = `/patientlyiq/journey-map/${pick.corpus_id}/${pick.persona_id}${url.search}`;
	throw redirect(307, target);
};

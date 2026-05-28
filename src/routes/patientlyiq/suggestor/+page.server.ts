/**
 * REPL surface for the Phase A2 content suggestor (mapping.ts). Ships the
 * id+label option lists for indications, journey stages, burden categories,
 * and codebook subthemes; the client wires them into multi-select chips and
 * calls `rankStrategies` reactively on every change.
 *
 * Burdens and subthemes are grouped (by parent_id and theme respectively) so
 * the UI can render them as clusters instead of a single flat list — keeps
 * the chip wall scannable.
 */

import indicationsJson from '$lib/content/registries/indications.json';
import burdensJson from '$lib/content/registries/burden_categories.json';
import codebookJson from '$lib/content/wctglpdemo-data/codebook.json';
import lupusJourney from '$lib/content/journeys/lupus_nephritis.json';
import type {
	BurdenCategoryId,
	IndicationId,
	LnJourneyStageId
} from '$lib/content/registries/types';

type RegistryFile<T> = { items: T[] };

type IndicationItem = { id: IndicationId; label: string };
type BurdenItem = {
	id: BurdenCategoryId;
	label: string;
	parent_id: BurdenCategoryId | null;
};
type StageItem = { id: LnJourneyStageId; label: string; order: number };
type SubthemeGroup = {
	theme_id: string;
	theme_label: string;
	subthemes: { id: string; label: string }[];
};

export const prerender = false;

export function load() {
	const indications: IndicationItem[] = (indicationsJson as RegistryFile<IndicationItem>).items.map(
		(i) => ({ id: i.id, label: i.label })
	);

	const allBurdens = (burdensJson as RegistryFile<BurdenItem>).items;
	const topLevelBurdens = allBurdens
		.filter((b) => b.parent_id === null)
		.map((parent) => ({
			id: parent.id,
			label: parent.label,
			children: allBurdens
				.filter((b) => b.parent_id === parent.id)
				.map((c) => ({ id: c.id, label: c.label }))
		}));

	const stages: StageItem[] = (
		lupusJourney as { stages: { id: LnJourneyStageId; label: string; order: number }[] }
	).stages.map((s) => ({ id: s.id, label: s.label, order: s.order }));

	const subthemeGroups: SubthemeGroup[] = (
		codebookJson as {
			themes: { id: string; label: string; subthemes: { id: string; label: string }[] }[];
		}
	).themes.map((t) => ({
		theme_id: t.id,
		theme_label: t.label,
		subthemes: t.subthemes.map((s) => ({ id: s.id, label: s.label }))
	}));

	return {
		indications,
		stages,
		burdenGroups: topLevelBurdens,
		subthemeGroups
	};
}

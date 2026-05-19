/**
 * group-drawer store — drives the secondary keyword/theme stats drawer.
 *
 * Clicking a highlighted keyword or theme in any quote (see KeywordText.svelte)
 * calls `groupDrawer.open()`; GroupStatsDrawer.svelte, mounted once in the
 * wctglpdemo layout, renders whatever is current. Global so any page can open
 * it without per-page wiring.
 */
import type { GroupKind } from '$lib/content/wctglpdemo-data/lexicon-stats';

export type GroupSelection = { kind: GroupKind; id: string };

let current = $state<GroupSelection | null>(null);

export const groupDrawer = {
	/** The keyword/theme currently shown, or null when the drawer is closed. */
	get current(): GroupSelection | null {
		return current;
	},
	open(kind: GroupKind, id: string): void {
		current = { kind, id };
	},
	close(): void {
		current = null;
	}
};

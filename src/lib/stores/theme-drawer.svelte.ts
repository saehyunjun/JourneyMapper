/**
 * theme-drawer store — drives the ThemeStatsDrawer (Phase 5 of the codebook
 * migration). Parallel to entity-drawer (which drives EntityDetailDrawer)
 * and group-drawer (legacy keyword/theme stats).
 *
 * Opens with an exact theme_id (`hrqol.bodily_pain`) or a wildcard query
 * (`*.financial`). The drawer reads stats via getThemeStats() in
 * server/theme-tags.ts and renders the per-axis rollup + evidence.
 */

export type ThemeSelection = { query: string };

let current = $state<ThemeSelection | null>(null);

export const themeDrawer = {
	get current(): ThemeSelection | null {
		return current;
	},
	open(query: string): void {
		current = { query };
	},
	close(): void {
		current = null;
	}
};

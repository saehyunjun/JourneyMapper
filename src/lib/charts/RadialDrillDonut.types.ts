/**
 * Shared types for RadialDrillDonut.
 *
 * Lives in a .ts file (not the .svelte itself) so any module — including
 * server endpoints, data-shape helpers, and other charts — can import the
 * hierarchy node type without pulling in Svelte runtime.
 */

export type DrillNode = {
	id: string;
	label: string;
	value: number;
	/** Optional fill color. Falls back to a slate gray in the chart. */
	color?: string;
	/** Second-level slices shown in the inner ring when this parent is focused. */
	children?: DrillNode[];
};

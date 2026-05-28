/**
 * Datum types for RadialImpactFlow.svelte.
 *
 * Hoisted into a `.ts` file because TypeScript can't follow `import type`
 * across `.svelte` extensions from another `.ts` module. The component
 * re-exports these from its `<script module>` block for callers that
 * already import from the chart file.
 */

export type RadialFlowSubtheme = {
	id: string;
	label: string;
	total: number;
	veryNegative?: number;
	negative: number;
	neutral: number;
	positive: number;
	veryPositive?: number;
	description?: string;
};

export type RadialFlowTheme = RadialFlowSubtheme & {
	subthemes: RadialFlowSubtheme[];
	color?: string;
};

export type RadialFlowSelection = {
	kind: 'theme' | 'subtheme';
	theme: RadialFlowTheme;
	subtheme?: RadialFlowSubtheme;
};

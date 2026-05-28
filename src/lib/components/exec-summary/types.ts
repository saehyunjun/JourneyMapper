/**
 * Shared types for the Executive Summary dashboard.
 *
 * `Selection` is what the feed and detail pane communicate over — kept in a
 * separate file because Svelte component <script> bodies can't be imported
 * from another module.
 */

export type Selection =
	| { kind: 'overview' }
	| { kind: 'finding'; id: string }
	| { kind: 'theme'; id: string }
	| { kind: 'quote'; id: string };

export type ThemeRow = {
	id: string;
	label: string;
	blocks: { sentiment: number }[];
};

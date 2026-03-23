import { writable } from 'svelte/store';

// Index of the currently hovered step column (-1 = none)
export const hoveredIndex = writable(-1);

// Index of the currently selected/clicked step column (-1 = none).
// Mirrors zoomedIndex so existing components that read selectedIndex still work.
export const selectedIndex = writable(-1);

// Index of the step currently "zoomed into" (first click). -1 = none.
// A second click on the same zoomed step triggers the drawer to open.
export const zoomedIndex = writable(-1);

// Index of the step whose inflection sub-card is currently hovered (-1 = none).
// Used by JourneyTooltip and FlowStepCard to show inflection context.
export const hoveredInflectionIndex = writable(-1);

// Index of the step whose inflection fork was clicked (-1 = none).
// Set alongside selectedInflectionPath when a fork path card is clicked.
export const selectedInflectionIndex = writable(-1);

// Which fork path was clicked: 'positive' | 'negative' | null
// null when no inflection is selected.
export const selectedInflectionPath = writable(/** @type {'positive'|'negative'|null} */ (null));
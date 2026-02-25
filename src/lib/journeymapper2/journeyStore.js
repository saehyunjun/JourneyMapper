import { writable } from 'svelte/store';

// Index of the currently hovered step column (-1 = none)
export const hoveredIndex = writable(-1);

// Index of the currently selected/clicked step column (-1 = none).
// Mirrors zoomedIndex so existing components that read selectedIndex still work.
export const selectedIndex = writable(-1);

// Index of the step currently "zoomed into" (first click). -1 = none.
// A second click on the same zoomed step triggers the drawer to open.
export const zoomedIndex = writable(-1);
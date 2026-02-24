import { writable } from 'svelte/store';

// Index of the currently hovered step column (-1 = none)
export const hoveredIndex = writable(-1);

// Index of the currently selected/clicked step column (-1 = none)
export const selectedIndex = writable(-1);
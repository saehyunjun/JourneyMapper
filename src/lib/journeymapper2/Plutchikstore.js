import { writable } from 'svelte/store';

/**
 * hoveredEmotions: a Set<string> of emotion ids currently highlighted.
 * - Empty Set  → nothing hovered
 * - 1 item     → single petal hover (wheel)
 * - 2 items    → dyad row hover (combinations list)
 */
export const hoveredEmotions = writable(new Set());

/** Helper: set one emotion (petal hover) */
export function hoverOne(id) {
  hoveredEmotions.set(new Set([id]));
}

/** Helper: set a dyad pair (row hover) */
export function hoverPair(id1, id2) {
  hoveredEmotions.set(new Set([id1, id2]));
}

/** Helper: clear */
export function hoverClear() {
  hoveredEmotions.set(new Set());
}
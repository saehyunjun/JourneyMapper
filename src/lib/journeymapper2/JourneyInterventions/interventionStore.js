// interventionStore.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared store keyed by step_id, tracking which intervention items have been
// dropped on each step's InterventionDropZone. Components subscribe via
// `$stepInterventions` and write via the helper functions below.
// ─────────────────────────────────────────────────────────────────────────────

import { writable } from 'svelte/store';

/**
 * @typedef {Object} InterventionItem
 * @property {string} id        Globally unique id (palette items get rewritten on drop)
 * @property {string} label     Human-readable label
 * @property {string} category  Sponsor initiative category key
 */

/** @type {import('svelte/store').Writable<Map<string, InterventionItem[]>>} */
export const stepInterventions = writable(new Map());

/**
 * Replace the entire intervention list for a given step.
 * Called by InterventionDropZone after every drop / reorder.
 */
export function setStepInterventions(stepId, items) {
  stepInterventions.update((m) => {
    const next = new Map(m);
    next.set(stepId, items);
    return next;
  });
}

/**
 * Remove a single intervention from a step (used by the chip's × button).
 */
export function removeIntervention(stepId, itemId) {
  stepInterventions.update((m) => {
    const current = m.get(stepId) ?? [];
    const next = new Map(m);
    next.set(
      stepId,
      current.filter((it) => it.id !== itemId)
    );
    return next;
  });
}

/**
 * Clear every intervention assigned to a step.
 */
export function clearStepInterventions(stepId) {
  stepInterventions.update((m) => {
    const next = new Map(m);
    next.delete(stepId);
    return next;
  });
}
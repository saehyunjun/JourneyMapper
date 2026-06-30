/**
 * protocol-schedule view-model types. Phase A only — no friction yet.
 */

import type { Procedure, Timepoint, Cell } from '$lib/content/protocols/types';

export type CellSelection = {
	procedure: Procedure;
	timepoint: Timepoint;
	cell: Cell | null;
	phase_label: string;
};

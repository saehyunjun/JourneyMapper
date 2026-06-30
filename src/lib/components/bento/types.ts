/**
 * Bento system — shared types.
 *
 * The bento language is built on two axes:
 *
 *   1. `BentoSize`   — the ordinal density scale every bento child component
 *                       respects. A component declares what to show at each
 *                       step (xs/sm: figure only; md: + caption; lg: + chart;
 *                       xl: + narrative). Not pixels — every consumer reads
 *                       the same scale.
 *
 *   2. `CellSpan`    — how many grid columns/rows a cell occupies on the
 *                       12x12 board. Independent of the size axis: a cell may
 *                       span (col: 6, row: 4) but render at `size: 'md'`.
 *                       Expansion changes BOTH (cell goes to (12, 8), size
 *                       jumps to 'xl').
 *
 * Each component documents its own variant table — what changes between
 * sizes. The point of the ordinal scale is that page authors don't need to
 * pass per-component config; they pick a size and the component handles the
 * density step.
 */

export type BentoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type CellSpan = {
	col: number;
	row?: number;
};

/** Context shape the BentoBoard provides to each BentoCell. */
export type BentoContext = {
	expandedId: () => string | null;
	expand: (id: string) => void;
	collapse: () => void;
	/** When a cell expands, the board declares what size all cells should
	 *  render at: the expanded cell gets `expandedSize`, every other cell
	 *  gets `dimmedSize`. Components react via their size prop. */
	expandedSize: BentoSize;
	dimmedSize: BentoSize;
	/** When true, the board is in archive/static mode — click-to-expand is
	 *  disabled and the cell hit target is not interactive. The expansion
	 *  code stays in place so it can be turned back on with a single prop. */
	staticBoard: boolean;
};

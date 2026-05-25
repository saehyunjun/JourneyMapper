/**
 * Reactive viewport breakpoint + responsive size resolver for story viz.
 *
 * Story viz components (MetricRing, BubbleConstellation, WaffleStat, DotGrid,
 * CorpusGrid) take numeric `size` / `cellSize` props. To make them grow on
 * md / lg / xl viewports without each component growing its own
 * responsive logic, slides call `vizSize({ base, md, lg, xl, '2xl' })` to
 * resolve a single number that tracks the viewport.
 *
 * The viewport listener installs once per session (idempotent). On the
 * server the width falls back to the `lg` breakpoint so SSR output reflects
 * a desktop default and the client hydration only adjusts if narrower.
 */
const BREAKPOINT_PX = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	'2xl': 1536
} as const;

export type Breakpoint = 'base' | keyof typeof BREAKPOINT_PX;

const SSR_DEFAULT_WIDTH = 1280;

let width = $state(typeof window !== 'undefined' ? window.innerWidth : SSR_DEFAULT_WIDTH);
let installed = false;

function install() {
	if (installed || typeof window === 'undefined') return;
	installed = true;
	// `width` was already initialized to window.innerWidth at module load —
	// don't reassign here, since install() runs inside derived expressions
	// (via vizSize) and Svelte 5 forbids state mutation inside $derived.
	window.addEventListener('resize', () => (width = window.innerWidth), { passive: true });
}

export function viewportWidth(): number {
	install();
	return width;
}

export function viewportBreakpoint(): Breakpoint {
	const w = viewportWidth();
	if (w >= BREAKPOINT_PX['2xl']) return '2xl';
	if (w >= BREAKPOINT_PX.xl) return 'xl';
	if (w >= BREAKPOINT_PX.lg) return 'lg';
	if (w >= BREAKPOINT_PX.md) return 'md';
	if (w >= BREAKPOINT_PX.sm) return 'sm';
	return 'base';
}

const BP_ORDER: Breakpoint[] = ['2xl', 'xl', 'lg', 'md', 'sm', 'base'];

/**
 * Resolve a partial per-breakpoint size map to a single number, picking the
 * largest defined breakpoint that the current viewport satisfies.
 *
 *   vizSize({ base: 280, md: 360, lg: 460 })
 *
 * At lg+ → 460, at md → 360, below → 280. Missing levels fall through to
 * the next defined level below.
 */
export function vizSize(scale: Partial<Record<Breakpoint, number>>): number {
	const current = viewportBreakpoint();
	const startIdx = BP_ORDER.indexOf(current);
	for (let i = startIdx; i < BP_ORDER.length; i++) {
		const v = scale[BP_ORDER[i]];
		if (v !== undefined) return v;
	}
	return scale.base ?? 0;
}

/*
	Shared motion utilities for data visualizations.

	Three motion modes drive every animated chart:

	  - 'none'      → no transitions; final state is rendered immediately.
	  - 'dashboard' → restrained intro that settles quickly; appropriate for
	                  dense analysis dashboards where motion shouldn't compete
	                  with the data.
	  - 'story'     → deliberate, replayable choreography for exports and
	                  presentation. Slower, more staggered, and visually richer.

	The presets and helpers below are pure: they describe timing, not state. A
	chart component should read them in $derived blocks and feed the numbers
	into rAF tweens, CSS variables, or SvelteTransition configs. Keeping this
	file framework-agnostic makes it easy to reuse the same numbers between an
	SVG arc sweep, a bar grow, and a label fade.
*/

import { cubicInOut, cubicOut } from 'svelte/easing';

export type VizMotionMode = 'none' | 'dashboard' | 'story';

export type VizEase = (t: number) => number;

export type VizMotionPreset = {
	mode: VizMotionMode;
	/** Total intro duration in ms. 0 for 'none'. */
	duration: number;
	/** Gap between staggered children in ms. */
	stagger: number;
	/** ms to hold before the first mark animates. */
	leadIn: number;
	/** Easing applied to mark intros. */
	ease: VizEase;
	/** Label/annotation fade duration in ms. */
	labelDuration: number;
	/** Delay applied to labels after the last mark settles, in ms. */
	labelDelay: number;
};

/*
	Tuning notes:
	- Dashboard durations stay under ~600ms so the chart is interactive almost
	  immediately. Stagger is small (35ms) — perceptible motion without
	  drawing attention.
	- Story durations sit around 1s with a ~140ms stagger so a five-band ring
	  has a clean negative→positive sweep that reads in ~1.6s. Numbers were
	  picked so a recorded GIF stays under ~2s end-to-end including labels.
*/
const PRESETS: Record<VizMotionMode, VizMotionPreset> = {
	none: {
		mode: 'none',
		duration: 0,
		stagger: 0,
		leadIn: 0,
		ease: (t) => t,
		labelDuration: 0,
		labelDelay: 0
	},
	dashboard: {
		mode: 'dashboard',
		duration: 600,
		stagger: 35,
		leadIn: 40,
		ease: cubicOut,
		labelDuration: 220,
		labelDelay: 120
	},
	story: {
		mode: 'story',
		duration: 1100,
		stagger: 140,
		leadIn: 120,
		ease: cubicInOut,
		labelDuration: 360,
		labelDelay: 240
	}
};

export function getVizMotionPreset(mode: VizMotionMode = 'dashboard'): VizMotionPreset {
	return PRESETS[mode] ?? PRESETS.dashboard;
}

/**
 * Deterministic per-index delay (ms). Pass `enabled = false` to flatten it to 0
 * — handy when a viz wants stagger configurable as a prop.
 */
export function getStaggerDelay(index: number, mode: VizMotionMode, enabled = true): number {
	if (!enabled || mode === 'none') return 0;
	const p = getVizMotionPreset(mode);
	return p.leadIn + Math.max(0, index) * p.stagger;
}

export type ArcTweenConfig = {
	duration: number;
	delay: number;
	ease: VizEase;
};

export function getArcTweenConfig(mode: VizMotionMode, index = 0): ArcTweenConfig {
	const p = getVizMotionPreset(mode);
	return {
		duration: p.duration,
		delay: getStaggerDelay(index, mode),
		ease: p.ease
	};
}

export type BarTweenConfig = ArcTweenConfig;

export function getBarTweenConfig(mode: VizMotionMode, index = 0): BarTweenConfig {
	return getArcTweenConfig(mode, index);
}

export type LabelRevealConfig = {
	duration: number;
	delay: number;
	ease: VizEase;
};

/**
 * Label reveal config. `afterIndex` is the number of marks that animated
 * before the label so labels appear once the related marks have settled.
 */
export function getLabelRevealConfig(mode: VizMotionMode, afterIndex = 0): LabelRevealConfig {
	const p = getVizMotionPreset(mode);
	if (mode === 'none') return { duration: 0, delay: 0, ease: p.ease };
	const lastMarkEnd = p.leadIn + Math.max(0, afterIndex) * p.stagger + p.duration;
	return {
		duration: p.labelDuration,
		delay: lastMarkEnd + p.labelDelay,
		ease: cubicOut
	};
}

/**
 * Total time until the choreography for `markCount` marks settles, including
 * the trailing label reveal. Useful for `onintrocomplete` fallbacks and for
 * deciding how long a GIF/MP4 recorder should keep capturing.
 */
export function getIntroTotalDuration(mode: VizMotionMode, markCount: number): number {
	if (mode === 'none' || markCount <= 0) return 0;
	const p = getVizMotionPreset(mode);
	const last = p.leadIn + Math.max(0, markCount - 1) * p.stagger + p.duration;
	return last + p.labelDelay + p.labelDuration;
}

/**
 * Sentiment-aware sort order for story-mode reveal. Returns the index a mark
 * with `sentiment` should occupy in the reveal sequence — negative reveals
 * first, then neutral, then positive. Items with the same sentiment fall back
 * to their original index so the result is stable across renders.
 */
export function sentimentRevealIndex(sentiment: number, originalIndex: number): number {
	const bucket = sentiment < 0 ? 0 : sentiment === 0 ? 1 : 2;
	return bucket * 1000 + originalIndex;
}

/**
 * Read `prefers-reduced-motion: reduce` from the platform. Safe to call in SSR
 * (returns false). Components should combine this with an explicit
 * `reducedMotion` prop so designers can force-test either branch.
 */
export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Resolve an effective motion mode: 'none' if the user has asked for reduced
 * motion or the caller passed `reducedMotion=true`, otherwise the requested
 * mode. Centralized so every viz behaves identically.
 */
export function resolveMotionMode(
	requested: VizMotionMode = 'dashboard',
	reducedMotion?: boolean
): VizMotionMode {
	if (reducedMotion) return 'none';
	if (reducedMotion === false) return requested;
	return prefersReducedMotion() ? 'none' : requested;
}

/*
	countUp — a Svelte action that animates a node's textContent from 0 to a
	target value. Used in story mode so a centred total reads like it's being
	tallied rather than appearing at full value.

	The action is deterministic: same inputs produce the same per-frame output.
	`replayKey` is a number the caller bumps to force a restart — the action
	tears down the running rAF and starts fresh from 0. Reduced motion snaps
	to the final value.

	`format` lets the caller pick integer / decimal / unit formatting; it
	receives the eased intermediate value, so callers can render
	`Math.round(v)` for integer counts and trust the final frame is exact.
*/
export type CountUpOptions = {
	value: number;
	mode?: VizMotionMode;
	/** Override the preset duration (ms). */
	duration?: number;
	/** Ms to hold before counting starts (defaults to the preset leadIn). */
	delay?: number;
	/** Bump to replay. */
	replayKey?: number;
	/** Bypass the running animation and render the value immediately. */
	reducedMotion?: boolean;
	format?: (v: number) => string;
};

const defaultFormat = (v: number) => String(Math.round(v));

export function countUp(node: HTMLElement | SVGElement, opts: CountUpOptions) {
	let raf = 0;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let current: CountUpOptions = opts;

	const cancel = () => {
		if (raf) cancelAnimationFrame(raf);
		if (timer) clearTimeout(timer);
		raf = 0;
		timer = null;
	};

	const run = (o: CountUpOptions) => {
		cancel();
		const fmt = o.format ?? defaultFormat;
		const target = Number.isFinite(o.value) ? o.value : 0;
		const mode = resolveMotionMode(o.mode ?? 'dashboard', o.reducedMotion);
		const preset = getVizMotionPreset(mode);
		const duration = Math.max(0, o.duration ?? preset.duration);
		const delay = Math.max(0, o.delay ?? preset.leadIn);

		if (mode === 'none' || duration === 0) {
			node.textContent = fmt(target);
			return;
		}

		node.textContent = fmt(0);

		const start = () => {
			const t0 = performance.now();
			const tick = (now: number) => {
				const t = Math.min(1, (now - t0) / duration);
				const eased = preset.ease(t);
				node.textContent = fmt(target * eased);
				if (t < 1) raf = requestAnimationFrame(tick);
			};
			raf = requestAnimationFrame(tick);
		};

		if (delay > 0) {
			timer = setTimeout(start, delay);
		} else {
			start();
		}
	};

	run(current);

	return {
		update(next: CountUpOptions) {
			const replayed = next.replayKey !== current.replayKey;
			const valueChanged = next.value !== current.value;
			const modeChanged = next.mode !== current.mode;
			current = next;
			if (replayed || valueChanged || modeChanged) run(next);
		},
		destroy() {
			cancel();
		}
	};
}

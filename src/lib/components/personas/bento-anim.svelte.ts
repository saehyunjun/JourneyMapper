/**
 * Shared animation primitives for the persona-page bento grid.
 *
 * Two helpers, both rune-based so they compose cleanly with $derived inside
 * component scripts:
 *
 *  - createCountUp(getTarget, getTrigger) — returns a reactive `value` getter
 *    that tweens up to the latest target whenever the trigger changes (mount,
 *    hover-replay, participant switch). Pure rAF + easeOutCubic, no deps.
 *
 *  - createReplayKeys() — small bag for "bump this id's replay counter on
 *    hover" so charts that already accept a `replayKey` re-run their intros
 *    when the user mouses over the tile. Avoids threading state through every
 *    BentoCard's snippet signature.
 */
import { untrack } from 'svelte';

function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3);
}

export type CountUpOptions = {
	duration?: number;
	leadIn?: number;
	/** Truthy = run; falsy = jump straight to the target (no animation). */
	animate?: () => boolean;
};

/**
 * Tween a number up to a moving target. Re-fires whenever `getTrigger()`
 * changes — pass `replayKey`, `mounted`, or a composite token there. Returns
 * the live value as a getter so callers can read it in `$derived` chains.
 */
export function createCountUp(
	getTarget: () => number,
	getTrigger: () => unknown,
	opts: CountUpOptions = {}
): { readonly value: number } {
	const duration = opts.duration ?? 1000;
	const leadIn = opts.leadIn ?? 60;
	let value = $state(0);
	let raf = 0;

	$effect(() => {
		// Subscribe to both target and trigger.
		const target = getTarget();
		getTrigger();
		const enabled = opts.animate ? opts.animate() : true;

		if (raf) cancelAnimationFrame(raf);
		if (!enabled) {
			value = target;
			return;
		}
		const from = untrack(() => value);
		const start = performance.now() + leadIn;
		function tick(now: number) {
			const t = Math.max(0, Math.min(1, (now - start) / duration));
			value = Math.round(from + (target - from) * easeOutCubic(t));
			if (t < 1) raf = requestAnimationFrame(tick);
		}
		raf = requestAnimationFrame(tick);
		return () => {
			if (raf) cancelAnimationFrame(raf);
		};
	});

	return {
		get value() {
			return value;
		}
	};
}

/**
 * Per-id replay bag. Call `bump(id)` to re-trigger animated charts inside the
 * given cell; read `keys[id]` (defaults to 0) and pass to charts that accept
 * `replayKey`.
 */
export function createReplayKeys() {
	const keys = $state<Record<string, number>>({});
	return {
		get keys() {
			return keys;
		},
		bump(id: string) {
			keys[id] = (keys[id] ?? 0) + 1;
		}
	};
}

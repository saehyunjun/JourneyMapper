<!--
	CompactThemeBars — the mockup's "Health systems & general overview" row idiom,
	adapted to interview subthemes.

	Each row is one subtheme: a coloured circular icon (parent theme's palette
	colour + theme glyph), the subtheme label, a horizontal bar whose length is
	proportional to that subtheme's tagged-segment count for the current
	participant, and the raw count as a "X.X of N" readout that echoes the
	mockup's score format.

	Read-only — the parent BentoCard owns the click-to-expand behaviour, so
	individual rows don't need their own click handlers. The expanded view
	switches to RadialThemeChart for drill-down.
-->
<script lang="ts">
	import { Pill, FlaskConical, Activity, Tag as TagIcon } from '@lucide/svelte';
	import { themePalette } from '$lib/content/wctglpdemo-data/topicTree';

	type Row = {
		id: string;
		label: string;
		themeId: string;
		count: number;
	};

	let {
		rows,
		max,
		outOf = 10,
		replayKey = 0
	}: {
		rows: Row[];
		/** Highest count among rows; bar lengths normalise against this. */
		max: number;
		/** Denominator shown in the "X of Y" readout. Defaults to 10 (mockup-style). */
		outOf?: number;
		/**
		 * Bump to re-run the bar-grow intro. Pairs with the bento tile's hover-
		 * replay so the bars sweep in again when the user mouses over the tile.
		 */
		replayKey?: number;
	} = $props();

	// One glyph per top-level theme — keeps subthemes visually grouped by parent.
	const THEME_ICON: Record<string, typeof Pill> = {
		treatment: Pill,
		clinical_trials: FlaskConical,
		condition_specific: Activity
	};

	function iconFor(themeId: string) {
		return THEME_ICON[themeId] ?? TagIcon;
	}

	function tint(themeId: string, alpha: number) {
		const hex = themePalette[themeId] ?? '#94a3b8';
		// hex → rgba()
		const h = hex.replace('#', '');
		const r = parseInt(h.slice(0, 2), 16);
		const g = parseInt(h.slice(2, 4), 16);
		const b = parseInt(h.slice(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	// Format the row's count as a 1-decimal "score" if the source counts are
	// small, integer otherwise — keeps the readout legible whatever the corpus.
	function formatScore(n: number, denom: number) {
		if (n <= denom) return n.toFixed(1);
		return String(n);
	}
</script>

<!-- Wrapping #key re-mounts the list whenever the parent bumps replayKey,
     which retriggers the bar-grow CSS animation from 0. -->
{#key replayKey}
	<ul class="flex flex-col gap-3">
		{#each rows as r, i (r.id)}
			{@const Icon = iconFor(r.themeId)}
			{@const color = themePalette[r.themeId] ?? '#94a3b8'}
			{@const width = max > 0 ? Math.max(8, Math.round((r.count / max) * 100)) : 0}
			<li class="flex items-center gap-3" style="--row-index: {i};">
				<span
					class="flex size-9 shrink-0 items-center justify-center rounded-full ctb-icon"
					style:background-color={tint(r.themeId, 0.18)}
				>
					<Icon class="size-4" style="color: {color};" />
				</span>
				<div class="flex min-w-0 flex-1 flex-col gap-1">
					<span class="truncate text-sm font-medium text-foreground" title={r.label}>
						{r.label}
					</span>
					<div class="h-1.5 w-full overflow-hidden rounded-full bg-(--ink)/8">
						<span
							class="ctb-bar block h-full rounded-full"
							style="--bar-target: {width}%; background-color: {color};"
						></span>
					</div>
				</div>
				<span class="ml-2 shrink-0 text-right">
					<span class="font-heading text-base font-semibold text-foreground tabular-nums">
						{formatScore(r.count, outOf)}
					</span>
					<span class="ml-0.5 text-xs text-muted-foreground">of {outOf}</span>
				</span>
			</li>
		{/each}
	</ul>
{/key}

<style>
	.ctb-bar {
		width: 0%;
		animation: ctb-bar-grow 720ms cubic-bezier(0.2, 0.9, 0.25, 1) forwards;
		animation-delay: calc(var(--row-index, 0) * 90ms + 80ms);
	}
	@keyframes ctb-bar-grow {
		from { width: 0%; }
		to { width: var(--bar-target, 0%); }
	}
	.ctb-icon {
		opacity: 0;
		transform: scale(0.6);
		animation: ctb-icon-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
		animation-delay: calc(var(--row-index, 0) * 90ms);
	}
	@keyframes ctb-icon-pop {
		to { opacity: 1; transform: scale(1); }
	}
	@media (prefers-reduced-motion: reduce) {
		.ctb-bar { animation: none; width: var(--bar-target, 0%); }
		.ctb-icon { animation: none; opacity: 1; transform: scale(1); }
	}
</style>

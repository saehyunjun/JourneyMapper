<script lang="ts" module>
	export type RadialFlowSubtheme = {
		id: string;
		label: string;
		total: number;
		veryNegative?: number;
		negative: number;
		neutral: number;
		positive: number;
		veryPositive?: number;
		description?: string;
	};

	export type RadialFlowTheme = RadialFlowSubtheme & {
		subthemes: RadialFlowSubtheme[];
		color?: string;
	};

	export type RadialFlowSelection = {
		kind: 'theme' | 'subtheme';
		theme: RadialFlowTheme;
		subtheme?: RadialFlowSubtheme;
	};
</script>

<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import { resolveMotionMode, getVizMotionPreset, type VizMotionMode } from '$lib/motion/viz';

	let {
		themes = [],
		title,
		subtitle,
		centerLabel,
		centerValue,
		maxDotsPerCluster = 60,
		selectedId = null,
		motionMode = 'dashboard',
		replayKey = 0,
		onselect
	}: {
		themes: RadialFlowTheme[];
		title?: string;
		subtitle?: string;
		centerLabel?: string;
		centerValue?: string | number;
		maxDotsPerCluster?: number;
		selectedId?: string | null;
		motionMode?: VizMotionMode;
		replayKey?: number;
		onselect?: (sel: RadialFlowSelection) => void;
	} = $props();

	// ── layout constants ──────────────────────────────────────────────────────
	const W = 960;
	const H = 760;
	const CX = W / 2;
	const CY = H / 2;
	const R_HUB = 58;
	const R_THEME = 150;
	const R_SUB = 280;
	const R_LABEL = 352;
	const DOT_R = 3;

	// ── sentiment palette ─────────────────────────────────────────────────────
	const C_VERY_NEG = '#e11d48';
	const C_NEG = '#fb7185';
	const C_NEU = '#cbd5e1';
	const C_POS = '#34d399';
	const C_VERY_POS = '#059669';

	// ── theme palette ─────────────────────────────────────────────────────────
	const THEME_PALETTE = ['#6366f1', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#f97316'];

	const effectiveMode = $derived(resolveMotionMode(motionMode));

	// ── geometry helpers ──────────────────────────────────────────────────────
	function pt(angle: number, r: number) {
		return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
	}

	function bowToHub(
		a: { x: number; y: number },
		b: { x: number; y: number },
		bend = 0.35
	): string {
		const mx = (a.x + b.x) / 2;
		const my = (a.y + b.y) / 2;
		const cx = mx + (CX - mx) * bend;
		const cy = my + (CY - my) * bend;
		return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
	}

	function phyllotaxis(n: number, scale = 5.5): { x: number; y: number }[] {
		const golden = Math.PI * (3 - Math.sqrt(5));
		const out: { x: number; y: number }[] = [];
		for (let i = 0; i < n; i++) {
			const r = scale * Math.sqrt(i + 0.5);
			const a = i * golden;
			out.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
		}
		return out;
	}

	function dotColorsFor(s: RadialFlowSubtheme, n: number): string[] {
		if (n === 0 || s.total === 0) return [];
		const buckets: [number, string][] = [
			[s.veryNegative ?? 0, C_VERY_NEG],
			[s.negative, C_NEG],
			[s.neutral, C_NEU],
			[s.positive, C_POS],
			[s.veryPositive ?? 0, C_VERY_POS]
		];
		const colors: string[] = [];
		let assigned = 0;
		buckets.forEach(([v, c], i) => {
			const target =
				i === buckets.length - 1
					? Math.max(0, n - assigned)
					: Math.round((v / s.total) * n);
			for (let k = 0; k < target; k++) colors.push(c);
			assigned += target;
		});
		return colors.slice(0, n);
	}

	function truncate(s: string, n = 24): string {
		return s.length > n ? s.slice(0, n - 1) + '…' : s;
	}

	function pct(n: number, total: number): string {
		return total === 0 ? '0%' : Math.round((n / total) * 100) + '%';
	}

	// ── derived layout ────────────────────────────────────────────────────────
	type ThemeNode = RadialFlowTheme & {
		color: string;
		angle: number;
		wedgeStart: number;
		wedgeEnd: number;
		anchor: { x: number; y: number };
		hubEdge: { x: number; y: number };
	};

	type SubNode = RadialFlowSubtheme & {
		themeId: string;
		themeColor: string;
		angle: number;
		anchor: { x: number; y: number };
		dots: { x: number; y: number; color: string }[];
	};

	const themesLaid = $derived.by((): ThemeNode[] => {
		const n = themes.length;
		if (n === 0) return [];
		const gap = Math.PI * 2 * 0.04;
		const wedge = (Math.PI * 2 - gap * n) / n;
		return themes.map((t, i) => {
			const wedgeStart = -Math.PI / 2 + i * (wedge + gap) + gap / 2;
			const wedgeEnd = wedgeStart + wedge;
			const angle = (wedgeStart + wedgeEnd) / 2;
			const color = t.color ?? THEME_PALETTE[i % THEME_PALETTE.length];
			return {
				...t,
				color,
				angle,
				wedgeStart,
				wedgeEnd,
				anchor: pt(angle, R_THEME),
				hubEdge: pt(angle, R_HUB)
			};
		});
	});

	const allSubs = $derived(themesLaid.flatMap((t) => t.subthemes));
	const maxSubTotal = $derived(Math.max(1, ...allSubs.map((s) => s.total)));
	const dotsPerUnit = $derived(Math.max(1, Math.ceil(maxSubTotal / maxDotsPerCluster)));

	const subsLaid = $derived.by((): SubNode[] => {
		const out: SubNode[] = [];
		for (const t of themesLaid) {
			const m = t.subthemes.length;
			if (m === 0) continue;
			// inset endpoints slightly so subthemes don't touch wedge boundaries
			const inset = Math.min(0.15, 0.5 / m);
			for (let i = 0; i < m; i++) {
				const tFrac = m === 1 ? 0.5 : inset + (i / (m - 1)) * (1 - 2 * inset);
				const angle = t.wedgeStart + tFrac * (t.wedgeEnd - t.wedgeStart);
				const anchor = pt(angle, R_SUB);
				const sub = t.subthemes[i];
				const dotCount = Math.min(
					Math.max(sub.total > 0 ? 1 : 0, Math.round(sub.total / dotsPerUnit)),
					maxDotsPerCluster
				);
				const positions = phyllotaxis(dotCount);
				const colors = dotColorsFor(sub, dotCount);
				const dots = positions.map((p, k) => ({
					x: anchor.x + p.x,
					y: anchor.y + p.y,
					color: colors[k] ?? C_NEU
				}));
				out.push({
					...sub,
					themeId: t.id,
					themeColor: t.color,
					angle,
					anchor,
					dots
				});
			}
		}
		return out;
	});

	// ── motion: themes reveal first, then subthemes ───────────────────────────
	let introProgress = $state(0);

	const totalNodes = $derived(themesLaid.length + subsLaid.length);

	const nodeTs = $derived.by(() => {
		const ts: number[] = [];
		const n = totalNodes;
		if (effectiveMode === 'none') {
			for (let i = 0; i < n; i++) ts.push(1);
			return ts;
		}
		const preset = getVizMotionPreset(effectiveMode);
		for (let i = 0; i < n; i++) {
			const start = preset.leadIn + i * preset.stagger;
			const end = start + preset.duration;
			if (introProgress <= start) ts.push(0);
			else if (introProgress >= end) ts.push(1);
			else ts.push(preset.ease((introProgress - start) / preset.duration));
		}
		return ts;
	});

	const labelOpacity = $derived.by(() => {
		if (effectiveMode === 'none') return 1;
		const preset = getVizMotionPreset(effectiveMode);
		const last = preset.leadIn + Math.max(0, totalNodes - 1) * preset.stagger + preset.duration;
		const start = last + preset.labelDelay;
		const end = start + preset.labelDuration;
		if (introProgress < start) return 0;
		if (introProgress >= end) return 1;
		return cubicOut((introProgress - start) / preset.labelDuration);
	});

	$effect(() => {
		void replayKey;
		const mode = effectiveMode;
		const n = untrack(() => totalNodes);
		if (mode === 'none') {
			introProgress = 1e9;
			return;
		}
		introProgress = 0;
		const preset = getVizMotionPreset(mode);
		const totalMs =
			preset.leadIn +
			Math.max(0, n - 1) * preset.stagger +
			preset.duration +
			preset.labelDelay +
			preset.labelDuration +
			80;

		let t0 = 0;
		let rafId = 0;
		const tick = (now: number) => {
			if (t0 === 0) t0 = now;
			const elapsed = now - t0;
			introProgress = elapsed;
			if (elapsed < totalMs) rafId = requestAnimationFrame(tick);
		};
		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	});

	// ── interaction ───────────────────────────────────────────────────────────
	let hoveredId = $state<string | null>(null);
	let tooltipPos = $state<{ x: number; y: number } | null>(null);
	let activeId = $state<string | null>(null);

	$effect(() => {
		activeId = selectedId;
	});

	const hoveredSub = $derived(subsLaid.find((s) => s.id === hoveredId) ?? null);
	const hoveredTheme = $derived(themesLaid.find((t) => t.id === hoveredId) ?? null);

	function isDim(id: string): boolean {
		const target = hoveredId ?? activeId;
		if (!target) return false;
		if (id === target) return false;
		const sub = subsLaid.find((s) => s.id === target);
		if (sub) {
			if (id === sub.themeId) return false;
			return true;
		}
		const theme = themesLaid.find((t) => t.id === target);
		if (theme) {
			if (subsLaid.some((s) => s.id === id && s.themeId === theme.id)) return false;
			return true;
		}
		return true;
	}

	function selectTheme(t: ThemeNode) {
		activeId = t.id;
		onselect?.({ kind: 'theme', theme: t });
	}

	function selectSub(s: SubNode) {
		const theme = themesLaid.find((t) => t.id === s.themeId);
		if (!theme) return;
		activeId = s.id;
		onselect?.({ kind: 'subtheme', theme, subtheme: s });
	}
</script>

<div class="rif-root">
	{#if title}
		<p class="rif-title">{title}</p>
		{#if subtitle}<p class="rif-subtitle">{subtitle}</p>{/if}
	{/if}

	<div class="rif-scroll-wrap">
		<svg
			class="rif-svg"
			viewBox="0 0 {W} {H}"
			aria-label={title ?? 'Radial impact flow chart'}
			role="img"
		>
			<!-- Hub → theme connectors -->
			<g aria-hidden="true">
				{#each themesLaid as theme, i}
					{@const t = nodeTs[i] ?? 0}
					{@const dim = isDim(theme.id)}
					<path
						d={bowToHub(theme.hubEdge, theme.anchor, 0.2)}
						class="rif-hub-link"
						stroke={theme.color}
						opacity={t * (dim ? 0.15 : 0.55)}
						stroke-width={dim ? 1 : 2}
					/>
				{/each}
			</g>

			<!-- Theme → subtheme connectors -->
			<g aria-hidden="true">
				{#each subsLaid as sub, i}
					{@const t = nodeTs[themesLaid.length + i] ?? 0}
					{@const theme = themesLaid.find((th) => th.id === sub.themeId)}
					{#if theme && t > 0}
						{@const dim = isDim(sub.id)}
						<path
							d={bowToHub(theme.anchor, sub.anchor, 0.35)}
							class="rif-sub-link"
							stroke={theme.color}
							opacity={t * (dim ? 0.1 : 0.35)}
							stroke-width={dim ? 0.75 : 1.25}
						/>
					{/if}
				{/each}
			</g>

			<!-- Dot clusters -->
			<g>
				{#each subsLaid as sub, i}
					{@const t = nodeTs[themesLaid.length + i] ?? 0}
					{@const dim = isDim(sub.id)}
					{#if t > 0.1}
						<g
							class="rif-cluster"
							role="button"
							tabindex={0}
							aria-label="{sub.label}: {sub.total} tagged segments"
							aria-pressed={activeId === sub.id}
							onmouseenter={(e) => {
								hoveredId = sub.id;
								tooltipPos = { x: e.clientX, y: e.clientY };
							}}
							onmouseleave={() => {
								hoveredId = null;
								tooltipPos = null;
							}}
							onmousemove={(e) => {
								tooltipPos = { x: e.clientX, y: e.clientY };
							}}
							onclick={() => selectSub(sub)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									selectSub(sub);
								}
							}}
							opacity={Math.min(1, (t - 0.1) / 0.5) * (dim ? 0.35 : 1)}
						>
							<!-- transparent hit-circle so the whole cluster is interactive -->
							<circle
								cx={sub.anchor.x}
								cy={sub.anchor.y}
								r="50"
								fill="transparent"
							/>
							{#each sub.dots as d}
								<circle
									cx={d.x}
									cy={d.y}
									r={DOT_R}
									fill={d.color}
									class="rif-dot"
									class:rif-dot--active={hoveredId === sub.id || activeId === sub.id}
								/>
							{/each}
						</g>
					{/if}
				{/each}
			</g>

			<!-- Theme nodes -->
			<g>
				{#each themesLaid as theme, i}
					{@const t = nodeTs[i] ?? 0}
					{@const dim = isDim(theme.id)}
					{@const active = hoveredId === theme.id || activeId === theme.id}
					<g
						class="rif-theme"
						role="button"
						tabindex={0}
						aria-label="{theme.label}: {theme.total} tagged segments"
						aria-pressed={activeId === theme.id}
						onmouseenter={(e) => {
							hoveredId = theme.id;
							tooltipPos = { x: e.clientX, y: e.clientY };
						}}
						onmouseleave={() => {
							hoveredId = null;
							tooltipPos = null;
						}}
						onmousemove={(e) => {
							tooltipPos = { x: e.clientX, y: e.clientY };
						}}
						onclick={() => selectTheme(theme)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								selectTheme(theme);
							}
						}}
						opacity={t * (dim ? 0.4 : 1)}
					>
						<circle
							cx={theme.anchor.x}
							cy={theme.anchor.y}
							r={active ? 22 : 18}
							fill={theme.color}
							class="rif-theme-node"
						/>
						<text
							x={theme.anchor.x}
							y={theme.anchor.y + 4}
							text-anchor="middle"
							class="rif-theme-count"
						>{theme.total}</text>
					</g>
				{/each}
			</g>

			<!-- Subtheme labels -->
			<g aria-hidden="true" style:opacity={labelOpacity}>
				{#each subsLaid as sub, i}
					{@const t = nodeTs[themesLaid.length + i] ?? 0}
					{#if t > 0.6}
						{@const labelPos = pt(sub.angle, R_LABEL)}
						{@const deg = (sub.angle * 180) / Math.PI}
						{@const isLeft = Math.cos(sub.angle) < -0.05}
						{@const active = hoveredId === sub.id || activeId === sub.id}
						{@const dim = isDim(sub.id)}
						<text
							x={labelPos.x}
							y={labelPos.y}
							text-anchor={isLeft ? 'end' : 'start'}
							dominant-baseline="middle"
							class="rif-sub-label"
							class:rif-sub-label--active={active}
							style:fill={sub.themeColor}
							opacity={dim ? 0.3 : 1}
						>{truncate(sub.label)}</text>
					{/if}
				{/each}
			</g>

			<!-- Theme labels (outer, near theme node) -->
			<g aria-hidden="true" style:opacity={labelOpacity}>
				{#each themesLaid as theme, i}
					{@const t = nodeTs[i] ?? 0}
					{@const dim = isDim(theme.id)}
					{@const labelOffset = pt(theme.angle, R_THEME - 32)}
					<text
						x={labelOffset.x}
						y={labelOffset.y}
						text-anchor="middle"
						dominant-baseline="middle"
						class="rif-theme-label"
						style:fill={theme.color}
						opacity={t * (dim ? 0.4 : 1)}
					>{theme.label}</text>
				{/each}
			</g>

			<!-- Hub -->
			<g aria-hidden="true">
				<circle cx={CX} cy={CY} r={R_HUB} class="rif-hub" />
				{#if centerValue != null}
					<text x={CX} y={CY - 4} text-anchor="middle" class="rif-hub-value">{centerValue}</text>
				{/if}
				{#if centerLabel}
					<text x={CX} y={CY + 16} text-anchor="middle" class="rif-hub-label">{centerLabel}</text>
				{/if}
			</g>
		</svg>
	</div>

	<!-- Legend -->
	<div class="rif-legend" aria-label="Sentiment colour legend">
		<span class="rif-legend-item"
			><span class="rif-swatch" style:background={C_VERY_NEG}></span>Very Negative</span
		>
		<span class="rif-legend-item"
			><span class="rif-swatch" style:background={C_NEG}></span>Negative</span
		>
		<span class="rif-legend-item"
			><span class="rif-swatch" style:background={C_NEU}></span>Neutral</span
		>
		<span class="rif-legend-item"
			><span class="rif-swatch" style:background={C_POS}></span>Positive</span
		>
		<span class="rif-legend-item"
			><span class="rif-swatch" style:background={C_VERY_POS}></span>Very Positive</span
		>
		<span class="rif-legend-item">1 dot ≈ {dotsPerUnit} {dotsPerUnit === 1 ? 'segment' : 'segments'}</span>
	</div>

	{#if hoveredSub && tooltipPos}
		<div
			class="rif-tooltip"
			role="tooltip"
			style:left="{tooltipPos.x + 14}px"
			style:top="{tooltipPos.y - 12}px"
		>
			<p class="rif-tt-label">{hoveredSub.label}</p>
			<p class="rif-tt-total">{hoveredSub.total} tagged segments</p>
			<div class="rif-tt-rows">
				{#if (hoveredSub.veryNegative ?? 0) > 0}
					<span class="rif-tt-very-neg"
						>{hoveredSub.veryNegative} very negative ({pct(
							hoveredSub.veryNegative ?? 0,
							hoveredSub.total
						)})</span
					>
				{/if}
				<span class="rif-tt-neg"
					>{hoveredSub.negative} negative ({pct(hoveredSub.negative, hoveredSub.total)})</span
				>
				<span class="rif-tt-neu"
					>{hoveredSub.neutral} neutral ({pct(hoveredSub.neutral, hoveredSub.total)})</span
				>
				<span class="rif-tt-pos"
					>{hoveredSub.positive} positive ({pct(hoveredSub.positive, hoveredSub.total)})</span
				>
				{#if (hoveredSub.veryPositive ?? 0) > 0}
					<span class="rif-tt-very-pos"
						>{hoveredSub.veryPositive} very positive ({pct(
							hoveredSub.veryPositive ?? 0,
							hoveredSub.total
						)})</span
					>
				{/if}
			</div>
			{#if hoveredSub.description}
				<p class="rif-tt-desc">{hoveredSub.description}</p>
			{/if}
		</div>
	{:else if hoveredTheme && tooltipPos}
		<div
			class="rif-tooltip"
			role="tooltip"
			style:left="{tooltipPos.x + 14}px"
			style:top="{tooltipPos.y - 12}px"
		>
			<p class="rif-tt-label" style:color={hoveredTheme.color}>{hoveredTheme.label}</p>
			<p class="rif-tt-total">
				{hoveredTheme.total} segments · {hoveredTheme.subthemes.length} subthemes
			</p>
			{#if hoveredTheme.description}
				<p class="rif-tt-desc">{hoveredTheme.description}</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.rif-root {
		position: relative;
		width: 100%;
		font-family: var(--font-body, 'IBM Plex Sans', sans-serif);
	}

	.rif-title {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 1rem;
		font-weight: 600;
		color: var(--ink, #312f28);
		margin: 0 0 0.2rem;
	}

	.rif-subtitle {
		font-size: 0.8125rem;
		color: var(--gray, #707070);
		margin: 0 0 0.75rem;
	}

	.rif-scroll-wrap {
		width: 100%;
		overflow-x: auto;
	}

	.rif-svg {
		width: 100%;
		min-width: 520px;
		display: block;
	}

	.rif-hub-link,
	.rif-sub-link {
		fill: none;
		transition: opacity 0.15s, stroke-width 0.15s;
	}

	.rif-cluster,
	.rif-theme {
		cursor: pointer;
		outline: none;
	}

	.rif-dot {
		transition: r 0.12s;
	}

	.rif-dot--active {
		r: 4;
	}

	.rif-theme-node {
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.18));
		transition: r 0.15s;
	}

	.rif-theme-count {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 11px;
		font-weight: 600;
		fill: #fff;
		pointer-events: none;
	}

	.rif-theme-label {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		pointer-events: none;
	}

	.rif-sub-label {
		font-size: 10px;
		font-weight: 500;
		opacity: 0.85;
		transition: opacity 0.12s, font-weight 0.12s;
	}

	.rif-sub-label--active {
		opacity: 1;
		font-weight: 700;
	}

	.rif-hub {
		fill: var(--card, #fff);
		stroke: var(--panel-dark, #d9dacf);
		stroke-width: 1;
	}

	.rif-hub-value {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 18px;
		font-weight: 600;
		fill: var(--ink, #312f28);
	}

	.rif-hub-label {
		font-size: 10px;
		fill: var(--gray, #707070);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.rif-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem 1.5rem;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0 0;
	}

	.rif-legend-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.75rem;
		color: var(--gray, #707070);
	}

	.rif-swatch {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.rif-tooltip {
		position: fixed;
		z-index: 200;
		background: var(--card, #fff);
		border: 1px solid var(--panel-dark, #e7e5e2);
		border-radius: 6px;
		padding: 0.625rem 0.75rem;
		box-shadow: 0 2px 14px rgba(0, 0, 0, 0.08);
		pointer-events: none;
		min-width: 175px;
		max-width: 235px;
	}

	.rif-tt-label {
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--ink, #312f28);
		margin: 0 0 0.25rem;
	}

	.rif-tt-total {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--ink, #312f28);
		margin: 0 0 0.4rem;
	}

	.rif-tt-rows {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.rif-tt-very-neg { font-size: 0.6875rem; color: #e11d48; }
	.rif-tt-neg     { font-size: 0.6875rem; color: #fb7185; }
	.rif-tt-neu     { font-size: 0.6875rem; color: var(--gray, #707070); }
	.rif-tt-pos     { font-size: 0.6875rem; color: #34d399; }
	.rif-tt-very-pos{ font-size: 0.6875rem; color: #059669; }

	.rif-tt-desc {
		font-size: 0.6875rem;
		color: var(--gray, #707070);
		margin: 0.4rem 0 0;
		line-height: 1.45;
	}

	@media (prefers-reduced-motion: reduce) {
		.rif-dot,
		.rif-hub-link,
		.rif-sub-link,
		.rif-theme-node,
		.rif-sub-label {
			transition: none;
		}
	}
</style>

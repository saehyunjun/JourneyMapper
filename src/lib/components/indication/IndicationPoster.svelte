<!--
	IndicationPoster — generative abstract SVG inspired by Clever Franke's
	"Into The Great Wide Open" poster generator. Maps indication-page corpus
	telemetry (total quotes, sentiment split, theme-size range, neutral share,
	per-interview sentiment) onto a fixed shape vocabulary: circle, rotated
	rectangle, triangle, ellipse, dot markers, background splines.

	Pure SVG output — no title, no caption, no interactivity. Same inputs +
	same seed always produce the same composition.
-->
<script lang="ts">
	import { fade } from 'svelte/transition';

	type InterviewAnchor = {
		id: string;
		/** Quote text shown in the hover card. Omit to disable the card for this dot. */
		quote?: string;
		/** -2..+2 sentiment for the sentiment dot in the card header. */
		sentiment?: number;
		/** Display-friendly theme label or two for the card. */
		themes?: string[];
		/** Display name of the participant, defaults to the id. */
		participant?: string;
	};

	type Props = {
		totalQuotes: number;
		posPct: number;
		negPct: number;
		neutralPct: number;
		themeSizes: number[];
		interviewAnchors: InterviewAnchor[];
		sentimentTimeline: number[];
		seed?: number;
		width?: number;
		height?: number;
		variant?: 'default' | 'warm' | 'cool';
		/** Stagger each shape's draw-in instead of rendering at full opacity. */
		animate?: boolean;
		/** Wall-clock budget the animation spreads across, in ms. */
		animateDuration?: number;
		/** Drop the outer paper frame — useful when used as a slide background. */
		showFrame?: boolean;
		/**
		 * 'meet' (default) letterboxes the poster inside its container so the
		 * full composition stays visible — right for a card. 'slice' fills the
		 * container and crops — right for a full-bleed slide background.
		 */
		fit?: 'meet' | 'slice';
		/**
		 * Allow dot hover + quote card. Off by default so background usage
		 * (e.g. the opening story slide) doesn't intercept scroll/click events
		 * meant for the slide itself.
		 */
		interactive?: boolean;
	};

	let {
		totalQuotes,
		posPct,
		negPct,
		neutralPct,
		themeSizes,
		interviewAnchors,
		sentimentTimeline,
		seed = 1,
		width = 800,
		height = 1040,
		variant = 'default',
		animate = false,
		animateDuration = 2200,
		showFrame = true,
		fit = 'meet',
		interactive = false
	}: Props = $props();

	function mulberry32(a: number) {
		return function () {
			a |= 0;
			a = (a + 0x6d2b79f5) | 0;
			let t = a;
			t = Math.imul(t ^ (t >>> 15), t | 1);
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	function hashId(s: string): number {
		let h = 2166136261 >>> 0;
		for (let i = 0; i < s.length; i++) {
			h ^= s.charCodeAt(i);
			h = Math.imul(h, 16777619);
		}
		return h >>> 0;
	}

	const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

	const FRAME = 48;
	const innerW = $derived(width - FRAME * 2);
	const innerH = $derived(height - FRAME * 2);

	const bgFill = $derived(
		variant === 'warm'
			? 'var(--lightorange)'
			: variant === 'cool'
				? 'var(--lightteal)'
				: 'var(--paper)'
	);

	// Hard caps keep the composition readable regardless of container size or
	// input magnitude — at large viewports (slide background, 1920×1080) the
	// shapes were swallowing the frame. Sqrt scaling makes the difference
	// between 50 quotes and 500 visible without the 500-case dominating.
	const MAX_CIRCLE_R = 220;
	const MAX_RECT_W = 520;
	const MAX_TRIANGLE_LEG = 240;
	const MAX_ELLIPSE_R = 130;

	// Circle — total quotes -> radius (sqrt-scaled, hard-capped)
	const circle = $derived.by(() => {
		const rng = mulberry32(seed * 13 + 7);
		const r = clamp(
			60,
			30 + Math.sqrt(Math.max(0, totalQuotes)) * 9,
			Math.min(MAX_CIRCLE_R, Math.min(innerW, innerH) * 0.32)
		);
		const cx = FRAME + innerW * lerp(0.42, 0.62, rng());
		const cy = FRAME + innerH * lerp(0.22, 0.38, rng());
		return { cx, cy, r };
	});

	// Rectangle — sentiment lean: angle = (posPct - negPct), length = total coded
	const rectangle = $derived.by(() => {
		const rng = mulberry32(seed * 31 + 11);
		const totalCoded = posPct + negPct + neutralPct || 1;
		const rectW = clamp(
			160,
			100 + Math.sqrt(Math.max(0, totalQuotes)) * 18,
			Math.min(MAX_RECT_W, innerW * 0.7)
		);
		const rectH = 52 + (totalCoded > 90 ? 10 : 0);
		const angleDeg = clamp(-25, (posPct - negPct) * 0.6, 25);
		const cx = FRAME + innerW * lerp(0.42, 0.58, rng());
		const cy = FRAME + innerH * lerp(0.5, 0.6, rng());
		return { cx, cy, w: rectW, h: rectH, angle: angleDeg };
	});

	// Triangle — theme-size range: legs scaled to min/max
	const triangle = $derived.by(() => {
		const rng = mulberry32(seed * 53 + 17);
		const minSize = themeSizes.length ? Math.min(...themeSizes) : 4;
		const maxSize = themeSizes.length ? Math.max(...themeSizes) : 20;
		const small = clamp(50, minSize * 5, 130);
		const large = clamp(120, maxSize * 5.5, MAX_TRIANGLE_LEG);
		const ax = FRAME + innerW * lerp(0.1, 0.22, rng());
		const ay = FRAME + innerH * lerp(0.78, 0.86, rng());
		const angle = lerp(-40, -10, rng()) * (Math.PI / 180);
		const bx = ax + Math.cos(angle) * large;
		const by = ay + Math.sin(angle) * large;
		const cx = ax + Math.cos(angle + Math.PI / 2.6) * small;
		const cy = ay + Math.sin(angle + Math.PI / 2.6) * small;
		return { points: `${ax},${ay} ${bx},${by} ${cx},${cy}` };
	});

	// Ellipse — neutral share -> width × height
	const ellipse = $derived.by(() => {
		const rng = mulberry32(seed * 71 + 23);
		const base = clamp(55, neutralPct * 4, MAX_ELLIPSE_R);
		const cx = FRAME + innerW * lerp(0.6, 0.78, rng());
		const cy = FRAME + innerH * lerp(0.78, 0.88, rng());
		return { cx, cy, rx: base, ry: base * lerp(0.55, 0.75, rng()) };
	});

	// Dot markers — one per interview anchor, positioned by hash of id
	const dots = $derived.by(() =>
		interviewAnchors.slice(0, 6).map((a) => {
			const h = hashId(a.id + ':' + seed);
			const rng = mulberry32(h);
			const x = FRAME + 16 + rng() * (innerW - 32);
			const y = FRAME + 16 + rng() * (innerH - 32);
			return { x, y, id: a.id };
		})
	);

	// Background splines — sentiment timeline drives amplitude per control point
	const splines = $derived.by(() => {
		if (!sentimentTimeline.length) return [] as string[];
		const samples = 8;
		const step = innerW / (samples - 1);
		const buildPath = (offsetY: number, ampScale: number, phase: number) => {
			const vals = Array.from({ length: samples }, (_, i) => {
				const idx = Math.floor((i / (samples - 1)) * (sentimentTimeline.length - 1));
				return sentimentTimeline[idx] ?? 0;
			});
			let d = '';
			for (let i = 0; i < samples; i++) {
				const x = FRAME + i * step;
				const amp = vals[i] * 80 * ampScale;
				const y = FRAME + offsetY + Math.sin(i * 0.9 + phase) * 12 + amp;
				if (i === 0) d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
				else {
					const px = FRAME + (i - 1) * step;
					const cx1 = px + step * 0.4;
					const cx2 = x - step * 0.4;
					d += ` C ${cx1.toFixed(1)} ${y.toFixed(1)}, ${cx2.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
				}
			}
			return d;
		};
		return [buildPath(innerH * 0.32, 1, 0), buildPath(innerH * 0.62, 0.7, 1.7)];
	});

	// Per-element draw-in schedule. Seeded so the stagger is deterministic
	// but unique per indication. Splines draw first (behind), then the four
	// big shapes in randomized order, then the interview dots.
	type Timing = { delay: number; duration: number };
	const timings = $derived.by(() => {
		const rng = mulberry32(seed * 101 + 41);
		const budget = Math.max(400, animateDuration);
		// Splines wash in across the first half. Shapes overlap one another
		// across a long window so each takes its time bleeding into view.
		// Dots arrive last as a soft trickle.
		const splineWindow = budget * 0.55;
		const shapeWindow = budget * 0.85;
		const dotWindow = budget * 0.3;
		const shapeOrder = ['circle', 'rectangle', 'triangle', 'ellipse'].sort(
			() => rng() - 0.5
		);
		const shapeStart = splineWindow * 0.2;
		const stride = (shapeWindow * 0.5) / 4;
		const shapeDelays: Record<string, Timing> = {};
		shapeOrder.forEach((name, i) => {
			shapeDelays[name] = {
				delay: shapeStart + stride * i + rng() * stride * 0.5,
				duration: 2400 + rng() * 1400
			};
		});
		return {
			splines: splines.map(() => ({
				delay: rng() * splineWindow * 0.35,
				duration: 2800 + rng() * 1400
			})),
			circle: shapeDelays.circle,
			rectangle: shapeDelays.rectangle,
			triangle: shapeDelays.triangle,
			ellipse: shapeDelays.ellipse,
			dots: dots.map(() => ({
				delay: shapeStart + shapeWindow * 0.6 + rng() * dotWindow,
				duration: 900 + rng() * 700
			}))
		};
	});

	// Approx path length for each spline — used to drive the stroke-dasharray
	// draw-in. A rough estimate (width * 1.4) is good enough; the dasharray
	// just needs to be longer than the actual path so the offset hides it.
	const splineLen = $derived(width * 1.6);

	// --- Hover quote card ----------------------------------------------------
	// Same interaction model as ThemeConstellation: track which dot is hovered,
	// fade in an HTML card positioned beside it, clamp to the container bounds.

	const SENTIMENT_FILL: Record<number, string> = {
		[-2]: '#9b1c1c',
		[-1]: '#f87171',
		0: '#cbd5e1',
		1: '#34d399',
		2: '#059669'
	};
	const SENTIMENT_LABEL: Record<number, string> = {
		[-2]: 'Strongly negative',
		[-1]: 'Negative',
		0: 'Neutral / mixed',
		1: 'Positive',
		2: 'Strongly positive'
	};
	const clampSent = (v: number | undefined) =>
		v === undefined ? 0 : Math.max(-2, Math.min(2, Math.round(v)));

	const CARD_W = 320;
	const CARD_GAP = 14;
	const CARD_M = 12;

	let wrapW = $state(0);
	let wrapH = $state(0);
	let hoveredId = $state<string | null>(null);

	const anchorById = $derived(new Map(interviewAnchors.map((a) => [a.id, a])));

	function onDotEnter(id: string) {
		if (!interactive) return;
		const a = anchorById.get(id);
		if (a?.quote) hoveredId = id;
	}
	function onDotLeave(id: string) {
		if (!interactive) return;
		if (hoveredId === id) hoveredId = null;
	}

	// Convert a dot's SVG-space (x, y) into a card position in container pixels.
	// Respects the active preserveAspectRatio so it works in both 'meet' (the
	// dashboard card) and 'slice' (the full-bleed slide background) modes.
	function dotScreenPos(dotX: number, dotY: number) {
		const cw = wrapW || 1;
		const ch = wrapH || 1;
		const sx = cw / width;
		const sy = ch / height;
		const scale = fit === 'slice' ? Math.max(sx, sy) : Math.min(sx, sy);
		const renderedW = width * scale;
		const renderedH = height * scale;
		const offsetX = (cw - renderedW) / 2;
		const offsetY = (ch - renderedH) / 2;
		return { x: offsetX + dotX * scale, y: offsetY + dotY * scale };
	}

	const card = $derived.by(() => {
		if (!hoveredId) return null;
		const dot = dots.find((d) => d.id === hoveredId);
		const a = anchorById.get(hoveredId);
		if (!dot || !a?.quote) return null;
		const { x: px, y: py } = dotScreenPos(dot.x, dot.y);
		const cw = wrapW || 1;
		const ch = wrapH || 1;
		const toRight = cw - px > CARD_W + CARD_GAP + CARD_M;
		const rawLeft = toRight ? px + CARD_GAP : px - CARD_GAP - CARD_W;
		const left = Math.min(Math.max(rawLeft, CARD_M), Math.max(CARD_M, cw - CARD_W - CARD_M));
		const estH = 180;
		const top = Math.min(
			Math.max(py - estH * 0.4, CARD_M),
			Math.max(CARD_M, ch - estH - CARD_M)
		);
		const s = clampSent(a.sentiment);
		const text = a.quote.length > 220 ? a.quote.slice(0, 219).trimEnd() + '…' : a.quote;
		return {
			id: a.id,
			text,
			sentiment: s,
			sentimentColor: SENTIMENT_FILL[s],
			sentimentLabel: SENTIMENT_LABEL[s],
			themes: (a.themes ?? []).slice(0, 3),
			participant: a.participant ?? a.id,
			left,
			top
		};
	});
</script>

<div
	bind:clientWidth={wrapW}
	bind:clientHeight={wrapH}
	class="poster-wrap"
	class:poster-wrap--cover={fit === 'slice'}
	class:poster-wrap--inert={!interactive}
	role="presentation"
>
<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 {width} {height}"
	preserveAspectRatio={fit === 'slice' ? 'xMidYMid slice' : 'xMidYMid meet'}
	role="img"
	aria-label="Indication corpus visual"
	class:animate
	style={fit === 'slice'
		? 'width: 100%; height: 100%; display: block;'
		: 'width: 100%; height: auto; display: block;'}
>
	<defs>
		<!-- Hand-drawn wobble — each shape borrows a slightly different seed
		     so they don't all wobble identically. Higher scale = rougher edge. -->
		<filter id="rough-{seed}-a" x="-5%" y="-5%" width="110%" height="110%">
			<feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed={seed % 100} />
			<feDisplacementMap in="SourceGraphic" scale="7" />
		</filter>
		<filter id="rough-{seed}-b" x="-5%" y="-5%" width="110%" height="110%">
			<feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed={(seed + 13) % 100} />
			<feDisplacementMap in="SourceGraphic" scale="5" />
		</filter>
		<filter id="rough-{seed}-c" x="-5%" y="-5%" width="110%" height="110%">
			<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed={(seed + 27) % 100} />
			<feDisplacementMap in="SourceGraphic" scale="6" />
		</filter>
		<filter id="rough-{seed}-line" x="-5%" y="-5%" width="110%" height="110%">
			<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed={(seed + 41) % 100} />
			<feDisplacementMap in="SourceGraphic" scale="3" />
		</filter>
	</defs>

	{#if showFrame}
		<rect x="0" y="0" width={width} height={height} fill="var(--panel-mid)" />
		<rect
			x={FRAME / 2}
			y={FRAME / 2}
			width={width - FRAME}
			height={height - FRAME}
			fill={bgFill}
		/>
	{:else}
		<rect x="0" y="0" width={width} height={height} fill={bgFill} />
	{/if}

	<!-- Background splines (drawn behind shapes) -->
	{#each splines as d, i (i)}
		<path
			{d}
			fill="none"
			stroke="var(--ink)"
			stroke-width="0.9"
			opacity="0.22"
			stroke-linecap="round"
			filter="url(#rough-{seed}-line)"
			class="poster-spline"
			stroke-dasharray={animate ? splineLen : undefined}
			stroke-dashoffset={animate ? splineLen : 0}
			style="--delay: {timings.splines[i]?.delay ?? 0}ms; --dur: {timings.splines[i]
				?.duration ?? 800}ms;"
		/>
	{/each}

	<!-- Large circle: total tagged quotes -->
	<circle
		cx={circle.cx}
		cy={circle.cy}
		r={circle.r}
		fill="var(--teal)"
		filter="url(#rough-{seed}-a)"
		class="poster-shape"
		style="--delay: {timings.circle.delay}ms; --dur: {timings.circle.duration}ms;"
	/>

	<!-- Rotated rectangle: sentiment lean -->
	<g
		class="poster-shape"
		transform="translate({rectangle.cx} {rectangle.cy}) rotate({rectangle.angle})"
		style="--delay: {timings.rectangle.delay}ms; --dur: {timings.rectangle.duration}ms;"
	>
		<rect
			x={-rectangle.w / 2}
			y={-rectangle.h / 2}
			width={rectangle.w}
			height={rectangle.h}
			fill="var(--purple)"
			filter="url(#rough-{seed}-b)"
		/>
	</g>

	<!-- Triangle: theme-size range -->
	<polygon
		points={triangle.points}
		fill="var(--brightorange)"
		filter="url(#rough-{seed}-c)"
		class="poster-shape"
		style="--delay: {timings.triangle.delay}ms; --dur: {timings.triangle.duration}ms;"
	/>

	<!-- Ellipse: neutral share -->
	<ellipse
		cx={ellipse.cx}
		cy={ellipse.cy}
		rx={ellipse.rx}
		ry={ellipse.ry}
		fill="var(--lightorange)"
		filter="url(#rough-{seed}-a)"
		class="poster-shape"
		style="--delay: {timings.ellipse.delay}ms; --dur: {timings.ellipse.duration}ms;"
	/>

	<!-- Interview anchor dots + labels -->
	{#each dots as dot, i (dot.id)}
		<g
			class="poster-dot"
			class:has-quote={anchorById.get(dot.id)?.quote}
			class:hovered={hoveredId === dot.id}
			style="--delay: {timings.dots[i]?.delay ?? 0}ms; --dur: {timings.dots[i]
				?.duration ?? 300}ms;"
			onpointerenter={() => onDotEnter(dot.id)}
			onpointerleave={() => onDotLeave(dot.id)}
			role="presentation"
		>
			<!-- Larger transparent hit target so the 3px dot is comfortably hoverable. -->
			<circle cx={dot.x} cy={dot.y} r="14" fill="transparent" class="dot-hit" />
			<circle
				cx={dot.x}
				cy={dot.y}
				r={hoveredId === dot.id ? 5 : 3}
				fill="var(--ink)"
				class="dot-mark"
			/>
			<text
				x={dot.x + 7}
				y={dot.y + 3}
				font-family="var(--font-mono), 'IBM Plex Mono', monospace"
				font-size="8"
				fill="var(--ink)">{dot.id}</text
			>
		</g>
	{/each}
</svg>

{#if card}
	{#key card.id}
		<div
			class="poster-card"
			style="left: {card.left}px; top: {card.top}px; width: {CARD_W}px;"
			in:fade={{ duration: 280 }}
			out:fade={{ duration: 160 }}
			role="presentation"
		>
			<div class="poster-card-head">
				<span class="poster-card-id">{card.participant}</span>
				<span class="poster-card-sentiment">
					<span class="sentiment-dot" style="background: {card.sentimentColor};"></span>
					{card.sentimentLabel}
				</span>
			</div>
			<p class="poster-card-text">"{card.text}"</p>
			{#if card.themes.length}
				<div class="poster-card-themes">
					{#each card.themes as t (t)}
						<span class="poster-card-theme">{t}</span>
					{/each}
				</div>
			{/if}
		</div>
	{/key}
{/if}
</div>

<style>
	.poster-wrap {
		position: relative;
		width: 100%;
		display: block;
	}
	/* Cover mode fills its parent (slide background). Card mode lets the
	   SVG's natural aspect ratio drive the height. */
	.poster-wrap--cover {
		height: 100%;
	}
	/* When not interactive (e.g. as a slide background) the whole subtree is
	   transparent to pointer events so it never blocks the host's clicks,
	   scrolls, or keyboard nav. */
	.poster-wrap--inert,
	.poster-wrap--inert :global(*) {
		pointer-events: none;
	}

	/* Dot interaction: hit target absorbs the hover; the visible mark grows
	   slightly when the row is hovered. Same interaction model as
	   ThemeConstellation but adapted for SVG-native nodes. */
	.poster-dot.has-quote {
		cursor: pointer;
	}
	.poster-dot .dot-mark {
		transition: r 200ms cubic-bezier(0.4, 0, 0.2, 1);
	}
	.poster-dot.hovered .dot-mark {
		filter: drop-shadow(0 0 4px var(--ink));
	}

	.poster-card {
		position: absolute;
		z-index: 20;
		pointer-events: none;
		padding: 14px 16px;
		border-radius: 12px;
		background: rgba(244, 244, 255, 0.94);
		border: 1px solid rgba(49, 47, 40, 0.18);
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.14);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		color: var(--ink);
		font-family: var(--font-body);
	}
	.poster-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 8px;
	}
	.poster-card-id {
		font-family: var(--font-mono), 'IBM Plex Mono', monospace;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--grayblue);
	}
	.poster-card-sentiment {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-mono), 'IBM Plex Mono', monospace;
		font-size: 10px;
		color: var(--gray);
	}
	.sentiment-dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		display: inline-block;
	}
	.poster-card-text {
		font-family: var(--font-heading-serif), 'Spectral', serif;
		font-size: 15px;
		line-height: 1.4;
		font-weight: 300;
		color: var(--ink);
		margin: 0 0 10px 0;
	}
	.poster-card-themes {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.poster-card-theme {
		font-family: var(--font-mono), 'IBM Plex Mono', monospace;
		font-size: 10px;
		padding: 2px 8px;
		border-radius: 999px;
		background: rgba(49, 47, 40, 0.06);
		color: var(--grayblue);
	}

	/* All animated elements fade — no scale, no translation, no fly. Long
	   eased durations make the shapes seem to bleed in like ink on paper. */
	svg.animate .poster-shape,
	svg.animate .poster-dot {
		opacity: 0;
		animation: poster-fade var(--dur, 2400ms) cubic-bezier(0.4, 0, 0.2, 1)
			var(--delay, 0ms) forwards;
	}
	svg.animate .poster-spline {
		animation: poster-draw var(--dur, 2800ms) cubic-bezier(0.4, 0, 0.2, 1)
			var(--delay, 0ms) forwards;
	}
	@keyframes poster-fade {
		from { opacity: 0; }
		to   { opacity: 1; }
	}
	@keyframes poster-draw {
		to { stroke-dashoffset: 0; }
	}
	@media (prefers-reduced-motion: reduce) {
		svg.animate .poster-shape,
		svg.animate .poster-dot,
		svg.animate .poster-spline {
			animation: none;
			opacity: 1;
			stroke-dashoffset: 0 !important;
		}
	}
</style>

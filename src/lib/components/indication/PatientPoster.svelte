<!--
	PatientPoster — single-patient cousin of IndicationPoster. Same generative
	shape vocabulary (circle, rotated rectangle, triangle, ellipse, dot markers,
	background splines), same hand-drawn wobble filter, same fade-only entrance —
	but every dimension reads from one patient's tagged-segment rollup instead
	of the indication-wide totals.

	Adds two patient-specific elements:
	  - an outer halo arc whose stroke length encodes net sentiment (signed)
	  - an optional circular avatar inset in the corner when avatarUrl is set

	Pure SVG output wrapped in a div for the hover quote card. Same seed +
	same inputs always produce the same composition, so each patient gets a
	stable visual signature.
-->
<script lang="ts">
	import { fade } from 'svelte/transition';

	type PullQuote = {
		id: string;
		text: string;
		sentiment?: number;
		themes?: string[];
	};

	type Props = {
		interviewId?: string;
		segmentCount: number;
		posPct: number;
		negPct: number;
		neutralPct: number;
		/** Their segment count divided by the corpus median. 1 = average speaker. */
		segmentsVsMedian: number;
		topThemeSize: number;
		distinctThemes: number;
		distinctEmotions: number;
		/** -1..+1 — drives the outer halo arc length and color. */
		netSentiment: number;
		pullQuotes: PullQuote[];
		sentimentTimeline: number[];
		ageBand?: 'younger' | 'middle' | 'older';
		participantType?: 'individual' | 'composite';
		avatarUrl?: string | null;
		seed?: number;
		width?: number;
		height?: number;
		variant?: 'default' | 'warm' | 'cool';
		animate?: boolean;
		animateDuration?: number;
		showFrame?: boolean;
		fit?: 'meet' | 'slice';
		interactive?: boolean;
	};

	let {
		interviewId,
		segmentCount,
		posPct,
		negPct,
		neutralPct,
		segmentsVsMedian,
		topThemeSize,
		distinctThemes,
		distinctEmotions,
		netSentiment,
		pullQuotes,
		sentimentTimeline,
		ageBand,
		participantType = 'individual',
		avatarUrl = null,
		seed,
		width = 720,
		height = 940,
		variant,
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

	const resolvedSeed = $derived(
		seed ?? (interviewId ? hashId(interviewId) : 1)
	);

	// Variant is two-axis: ageBand picks the palette tilt, the explicit
	// `variant` prop overrides it when set. Composite participants get the
	// whole palette desaturated via a CSS mix layer.
	const resolvedVariant = $derived<'default' | 'warm' | 'cool'>(
		variant ??
			(ageBand === 'younger' ? 'warm' : ageBand === 'older' ? 'cool' : 'default')
	);

	const FRAME = 36;
	const innerW = $derived(width - FRAME * 2);
	const innerH = $derived(height - FRAME * 2);

	const bgFill = $derived(
		resolvedVariant === 'warm'
			? 'var(--lightorange)'
			: resolvedVariant === 'cool'
				? 'var(--lightteal)'
				: 'var(--paper)'
	);

	// Hard caps keep the composition readable at any container size — matches
	// IndicationPoster after the sprawl fix. Patient totals are an order of
	// magnitude smaller than corpus totals, so the linear factors are tuned
	// up to compensate while the caps stay near the same absolute pixel
	// values.
	const MAX_CIRCLE_R = 180;
	const MAX_RECT_W = 380;
	const MAX_TRIANGLE_LEG = 200;
	const MAX_ELLIPSE_R = 110;

	const circle = $derived.by(() => {
		const rng = mulberry32(resolvedSeed * 13 + 7);
		const r = clamp(
			55,
			28 + Math.sqrt(Math.max(0, segmentCount)) * 14,
			Math.min(MAX_CIRCLE_R, Math.min(innerW, innerH) * 0.34)
		);
		const cx = FRAME + innerW * lerp(0.4, 0.62, rng());
		const cy = FRAME + innerH * lerp(0.22, 0.38, rng());
		return { cx, cy, r };
	});

	const rectangle = $derived.by(() => {
		const rng = mulberry32(resolvedSeed * 31 + 11);
		// segmentsVsMedian sits around 1.0 for an average speaker; cap the
		// ratio so a very chatty patient doesn't blow past the bound.
		const ratio = clamp(0.4, segmentsVsMedian, 2.5);
		const rectW = clamp(
			140,
			innerW * 0.4 * ratio,
			Math.min(MAX_RECT_W, innerW * 0.7)
		);
		const rectH = 46;
		const angleDeg = clamp(-25, (posPct - negPct) * 0.6, 25);
		const cx = FRAME + innerW * lerp(0.42, 0.58, rng());
		const cy = FRAME + innerH * lerp(0.5, 0.6, rng());
		return { cx, cy, w: rectW, h: rectH, angle: angleDeg };
	});

	const triangle = $derived.by(() => {
		const rng = mulberry32(resolvedSeed * 53 + 17);
		const small = clamp(50, distinctThemes * 14, 120);
		const large = clamp(110, topThemeSize * 10 + 60, MAX_TRIANGLE_LEG);
		const ax = FRAME + innerW * lerp(0.1, 0.22, rng());
		const ay = FRAME + innerH * lerp(0.78, 0.86, rng());
		const angle = lerp(-40, -10, rng()) * (Math.PI / 180);
		const bx = ax + Math.cos(angle) * large;
		const by = ay + Math.sin(angle) * large;
		const cx = ax + Math.cos(angle + Math.PI / 2.6) * small;
		const cy = ay + Math.sin(angle + Math.PI / 2.6) * small;
		return { points: `${ax},${ay} ${bx},${by} ${cx},${cy}` };
	});

	const ellipse = $derived.by(() => {
		const rng = mulberry32(resolvedSeed * 71 + 23);
		const base = clamp(45, distinctEmotions * 12, MAX_ELLIPSE_R);
		const cx = FRAME + innerW * lerp(0.6, 0.78, rng());
		const cy = FRAME + innerH * lerp(0.78, 0.88, rng());
		return { cx, cy, rx: base, ry: base * lerp(0.55, 0.78, rng()) };
	});

	// Halo arc — outer concentric ring whose stroke length encodes signed
	// net sentiment. Positive sentiment uses the green palette, negative the
	// orange one. Drawn behind the circle.
	const halo = $derived.by(() => {
		const haloRadius = circle.r + 26;
		const ns = clamp(-1, netSentiment, 1);
		const circumference = 2 * Math.PI * haloRadius;
		const arcLen = Math.abs(ns) * circumference;
		return {
			cx: circle.cx,
			cy: circle.cy,
			r: haloRadius,
			circumference,
			arcLen,
			color: ns >= 0 ? 'var(--green)' : 'var(--orange)'
		};
	});

	// Pull quote dot markers — one per quote, hashed onto the inner area.
	const dots = $derived.by(() =>
		pullQuotes.slice(0, 8).map((q) => {
			const h = hashId(q.id + ':' + resolvedSeed);
			const rng = mulberry32(h);
			const x = FRAME + 14 + rng() * (innerW - 28);
			const y = FRAME + 14 + rng() * (innerH - 28);
			return { x, y, id: q.id, quote: q };
		})
	);

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
				const amp = vals[i] * 60 * ampScale;
				const y = FRAME + offsetY + Math.sin(i * 0.9 + phase) * 10 + amp;
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
		return [buildPath(innerH * 0.34, 1, 0), buildPath(innerH * 0.64, 0.7, 1.7)];
	});

	// Avatar inset — fixed-size circular vignette anchored to a corner picked
	// from the seed. Only rendered when avatarUrl is present.
	const avatar = $derived.by(() => {
		if (!avatarUrl) return null;
		const rng = mulberry32(resolvedSeed * 97 + 31);
		const r = 32;
		const margin = FRAME + 14;
		const onRight = rng() > 0.5;
		const onTop = rng() > 0.5;
		const cx = onRight ? width - margin - r : margin + r;
		const cy = onTop ? margin + r : height - margin - r;
		return { cx, cy, r };
	});

	// Per-element draw-in schedule — same orchestration as IndicationPoster.
	type Timing = { delay: number; duration: number };
	const timings = $derived.by(() => {
		const rng = mulberry32(resolvedSeed * 101 + 41);
		const budget = Math.max(400, animateDuration);
		const splineWindow = budget * 0.55;
		const shapeWindow = budget * 0.85;
		const dotWindow = budget * 0.3;
		const shapeOrder = ['halo', 'circle', 'rectangle', 'triangle', 'ellipse'].sort(
			() => rng() - 0.5
		);
		const shapeStart = splineWindow * 0.2;
		const stride = (shapeWindow * 0.5) / 5;
		const shapeDelays: Record<string, Timing> = {};
		shapeOrder.forEach((name, i) => {
			shapeDelays[name] = {
				delay: shapeStart + stride * i + rng() * stride * 0.5,
				duration: 1800 + rng() * 1100
			};
		});
		return {
			splines: splines.map(() => ({
				delay: rng() * splineWindow * 0.35,
				duration: 2200 + rng() * 1200
			})),
			halo: shapeDelays.halo,
			circle: shapeDelays.circle,
			rectangle: shapeDelays.rectangle,
			triangle: shapeDelays.triangle,
			ellipse: shapeDelays.ellipse,
			dots: dots.map(() => ({
				delay: shapeStart + shapeWindow * 0.6 + rng() * dotWindow,
				duration: 700 + rng() * 500
			}))
		};
	});

	const splineLen = $derived(width * 1.6);
	const isComposite = $derived(participantType === 'composite');

	// --- Hover quote card ----------------------------------------------------

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

	const CARD_W = 300;
	const CARD_GAP = 14;
	const CARD_M = 12;

	let wrapW = $state(0);
	let wrapH = $state(0);
	let hoveredId = $state<string | null>(null);

	function onDotEnter(id: string) {
		if (!interactive) return;
		hoveredId = id;
	}
	function onDotLeave(id: string) {
		if (!interactive) return;
		if (hoveredId === id) hoveredId = null;
	}

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
		if (!dot?.quote?.text) return null;
		const { x: px, y: py } = dotScreenPos(dot.x, dot.y);
		const cw = wrapW || 1;
		const ch = wrapH || 1;
		const toRight = cw - px > CARD_W + CARD_GAP + CARD_M;
		const rawLeft = toRight ? px + CARD_GAP : px - CARD_GAP - CARD_W;
		const left = Math.min(Math.max(rawLeft, CARD_M), Math.max(CARD_M, cw - CARD_W - CARD_M));
		const estH = 170;
		const top = Math.min(
			Math.max(py - estH * 0.4, CARD_M),
			Math.max(CARD_M, ch - estH - CARD_M)
		);
		const s = clampSent(dot.quote.sentiment);
		const text =
			dot.quote.text.length > 200
				? dot.quote.text.slice(0, 199).trimEnd() + '…'
				: dot.quote.text;
		return {
			id: dot.id,
			text,
			sentiment: s,
			sentimentColor: SENTIMENT_FILL[s],
			sentimentLabel: SENTIMENT_LABEL[s],
			themes: (dot.quote.themes ?? []).slice(0, 3),
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
	class:poster-wrap--composite={isComposite}
	role="presentation"
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 {width} {height}"
		preserveAspectRatio={fit === 'slice' ? 'xMidYMid slice' : 'xMidYMid meet'}
		role="img"
		aria-label={interviewId ? `${interviewId} profile visual` : 'Patient profile visual'}
		class:animate
		style={fit === 'slice'
			? 'width: 100%; height: 100%; display: block;'
			: 'width: 100%; height: auto; display: block;'}
	>
		<defs>
			<filter id="ppr-{resolvedSeed}-a" x="-5%" y="-5%" width="110%" height="110%">
				<feTurbulence
					type="fractalNoise"
					baseFrequency="0.02"
					numOctaves="2"
					seed={resolvedSeed % 100}
				/>
				<feDisplacementMap in="SourceGraphic" scale="6" />
			</filter>
			<filter id="ppr-{resolvedSeed}-b" x="-5%" y="-5%" width="110%" height="110%">
				<feTurbulence
					type="fractalNoise"
					baseFrequency="0.024"
					numOctaves="2"
					seed={(resolvedSeed + 13) % 100}
				/>
				<feDisplacementMap in="SourceGraphic" scale="4" />
			</filter>
			<filter id="ppr-{resolvedSeed}-c" x="-5%" y="-5%" width="110%" height="110%">
				<feTurbulence
					type="fractalNoise"
					baseFrequency="0.032"
					numOctaves="2"
					seed={(resolvedSeed + 27) % 100}
				/>
				<feDisplacementMap in="SourceGraphic" scale="5" />
			</filter>
			<filter id="ppr-{resolvedSeed}-line" x="-5%" y="-5%" width="110%" height="110%">
				<feTurbulence
					type="fractalNoise"
					baseFrequency="0.04"
					numOctaves="2"
					seed={(resolvedSeed + 41) % 100}
				/>
				<feDisplacementMap in="SourceGraphic" scale="2.5" />
			</filter>
			{#if avatar}
				<clipPath id="ppr-{resolvedSeed}-avatar">
					<circle cx={avatar.cx} cy={avatar.cy} r={avatar.r} />
				</clipPath>
			{/if}
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

		{#each splines as d, i (i)}
			<path
				{d}
				fill="none"
				stroke="var(--ink)"
				stroke-width="0.9"
				opacity="0.2"
				stroke-linecap="round"
				filter="url(#ppr-{resolvedSeed}-line)"
				class="poster-spline"
				stroke-dasharray={animate ? splineLen : undefined}
				stroke-dashoffset={animate ? splineLen : 0}
				style="--delay: {timings.splines[i]?.delay ?? 0}ms; --dur: {timings.splines[i]
					?.duration ?? 800}ms;"
			/>
		{/each}

		<!-- Halo arc (behind the circle): signed net sentiment -->
		<g
			class="poster-shape"
			transform="rotate(-90 {halo.cx} {halo.cy})"
			style="--delay: {timings.halo.delay}ms; --dur: {timings.halo.duration}ms;"
		>
			<circle
				cx={halo.cx}
				cy={halo.cy}
				r={halo.r}
				fill="none"
				stroke={halo.color}
				stroke-width="3"
				stroke-linecap="round"
				stroke-dasharray="{halo.arcLen} {halo.circumference - halo.arcLen}"
				opacity="0.78"
			/>
		</g>

		<circle
			cx={circle.cx}
			cy={circle.cy}
			r={circle.r}
			fill="var(--teal)"
			filter="url(#ppr-{resolvedSeed}-a)"
			class="poster-shape"
			style="--delay: {timings.circle.delay}ms; --dur: {timings.circle.duration}ms;"
		/>

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
				filter="url(#ppr-{resolvedSeed}-b)"
			/>
		</g>

		<polygon
			points={triangle.points}
			fill="var(--brightorange)"
			filter="url(#ppr-{resolvedSeed}-c)"
			class="poster-shape"
			style="--delay: {timings.triangle.delay}ms; --dur: {timings.triangle.duration}ms;"
		/>

		<ellipse
			cx={ellipse.cx}
			cy={ellipse.cy}
			rx={ellipse.rx}
			ry={ellipse.ry}
			fill="var(--lightorange)"
			filter="url(#ppr-{resolvedSeed}-a)"
			class="poster-shape"
			style="--delay: {timings.ellipse.delay}ms; --dur: {timings.ellipse.duration}ms;"
		/>

		{#if avatar}
			<g class="poster-avatar">
				<circle
					cx={avatar.cx}
					cy={avatar.cy}
					r={avatar.r + 3}
					fill="var(--paper)"
					stroke="var(--panel-mid)"
					stroke-width="1"
				/>
				<image
					href={avatarUrl}
					x={avatar.cx - avatar.r}
					y={avatar.cy - avatar.r}
					width={avatar.r * 2}
					height={avatar.r * 2}
					clip-path="url(#ppr-{resolvedSeed}-avatar)"
					preserveAspectRatio="xMidYMid slice"
				/>
			</g>
		{/if}

		{#each dots as dot, i (dot.id)}
			<g
				class="poster-dot"
				class:has-quote={dot.quote?.text}
				class:hovered={hoveredId === dot.id}
				style="--delay: {timings.dots[i]?.delay ?? 0}ms; --dur: {timings.dots[i]
					?.duration ?? 300}ms;"
				onpointerenter={() => onDotEnter(dot.id)}
				onpointerleave={() => onDotLeave(dot.id)}
				role="presentation"
			>
				<circle cx={dot.x} cy={dot.y} r="14" fill="transparent" class="dot-hit" />
				<circle
					cx={dot.x}
					cy={dot.y}
					r={hoveredId === dot.id ? 5 : 3}
					fill="var(--ink)"
					class="dot-mark"
				/>
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
					<span class="poster-card-id">Pull quote</span>
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
	.poster-wrap--cover {
		height: 100%;
	}
	.poster-wrap--inert,
	.poster-wrap--inert :global(*) {
		pointer-events: none;
	}
	/* Composites read as constructed: the whole subtree dims toward the
	   panel-mid neutral so the colors feel sketchy rather than authoritative. */
	.poster-wrap--composite svg :global(circle),
	.poster-wrap--composite svg :global(rect),
	.poster-wrap--composite svg :global(polygon),
	.poster-wrap--composite svg :global(ellipse) {
		filter: saturate(0.65);
	}

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
		padding: 12px 14px;
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
		font-size: 14px;
		line-height: 1.4;
		font-weight: 300;
		color: var(--ink);
		margin: 0 0 8px 0;
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

	svg.animate .poster-shape,
	svg.animate .poster-dot,
	svg.animate .poster-avatar {
		opacity: 0;
		animation: poster-fade var(--dur, 2000ms) cubic-bezier(0.4, 0, 0.2, 1)
			var(--delay, 0ms) forwards;
	}
	svg.animate .poster-spline {
		animation: poster-draw var(--dur, 2400ms) cubic-bezier(0.4, 0, 0.2, 1)
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
		svg.animate .poster-spline,
		svg.animate .poster-avatar {
			animation: none;
			opacity: 1;
			stroke-dashoffset: 0 !important;
		}
	}
</style>

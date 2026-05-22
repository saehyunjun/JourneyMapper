<!--
	ThemeConstellation — an ambient, booth-friendly attractor loop.

	Every tagged segment is a circle, coloured by sentiment.

	Two modes:
	  - Auto   — cycles through the interview guide on its own; for each
	             question its segments drift out of a loose cloud and gather
	             into the themes they were coded to, then re-gather into the
	             keywords they used. Meanwhile the key quotes spoken under that
	             question are spotlit one at a time, each lifting a quote card
	             into the far top corner.
	  - Manual — click through questions, toggle theme/keyword grouping, and
	             hover a circle to read the line behind it.

	Built on a d3-force simulation drawn to a canvas so ~600 circles animate
	smoothly on an iPad.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { forceSimulation, forceX, forceY, forceCollide, type Simulation } from 'd3-force';
	import {
		annotations,
		segments,
		quotes,
		themedQuestionIds,
		questionLabel,
		titleCase,
		keywordBySegment
	} from '$lib/content/wctglpdemo-data/analysis';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';

	let {
		/** Fill the parent edge-to-edge (no aspect box, border, legend or caption). */
		fullBleed = false,
		/** Fired when a circle is clicked — passes the segment's first coded theme. */
		onThemeSelect
	}: { fullBleed?: boolean; onThemeSelect?: (themeId: string) => void } = $props();

	const TAU = Math.PI * 2;

	// -2..2 diverging sentiment scale — matches RadialThemeChart / SortableBarChart.
	const SENTIMENT_COLORS: Record<number, string> = {
		[-2]: '#e11d48',
		[-1]: '#fb7185',
		0: '#94a3b8',
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
	const SENTIMENT_ORDER = [-2, -1, 0, 1, 2];
	const clampS = (s: number) => Math.max(-2, Math.min(2, Math.round(s)));

	type Group = { key: string; label: string };

	type Node = {
		index?: number;
		x: number;
		y: number;
		vx: number;
		vy: number;
		sentiment: number;
		questionId: string;
		segmentId: string;
		interviewId: string;
		/** First coded theme — the theme cluster this circle gathers into. */
		theme: string | null;
		/** Every theme this segment was coded to — drives the highlight connectors. */
		themes: string[];
		/** Strongest matched lexicon keyword — the keyword cluster it gathers into. */
		keyword: { id: string; label: string; surface: string } | null;
		r: number;
		/** Per-phase force target + strength. */
		tx: number;
		ty: number;
		ts: number;
		/** Smoothed 0..1 — drives colour/opacity so circles fade in and out. */
		active: number;
		activeTarget: number;
		/** Smoothed 0..1 highlight — drives the spotlight halo + focus ring. */
		glow: number;
	};

	type Cluster = {
		/** Group id — a theme id or a keyword id, depending on the stage. */
		key: string;
		/** Display label. */
		label: string;
		count: number;
		cx: number;
		cy: number;
		labelX: number;
		labelY: number;
	};

	// --- tuning -------------------------------------------------------------
	const SCATTER_MS = 1700; // loose-drift beat before each sort
	const HOLD_MS = 6300; // how long a sorted question is held
	const SPOT_MS = 5200; // how long each key quote is spotlit (auto mode)
	const ALPHA_FLOOR = 0.18; // simulation never fully cools — keeps drift alive
	const ACTIVE_PULL = 0.16; // force toward a theme cluster
	const DRIFT_PULL = 0.006; // force toward the loose cloud
	const JITTER = 0.55; // brownian nudge on drifting circles
	const PAD_X = 30;
	const PAD_TOP = 56; // headroom for the quote card
	const PAD_BOTTOM = 156; // headroom for the question + progress overlay
	const CARD_W = 340;
	const CARD_M = 18; // card inset from the canvas edge
	const CARD_GAP = 26; // gap between the highlighted circle and its card
	// ------------------------------------------------------------------------

	// segment joins for the quote card: verbatim text + interviewee.
	const segById = new Map(segments.map((s) => [s.segment_id, s]));
	// segment_id -> the quote-bank quote it belongs to (its curated "key quote").
	const quoteBySegmentId = new Map<string, (typeof quotes)[number]>();
	for (const q of quotes) for (const sid of q.segment_ids) quoteBySegmentId.set(sid, q);

	// One circle per tagged segment.
	const nodes: Node[] = annotations.map((a) => ({
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
		sentiment: a.sentiment,
		questionId: a.question_id,
		segmentId: a.segment_id,
		interviewId: a.interview_id,
		theme: a.themes[0] ?? null,
		themes: a.themes,
		keyword: keywordBySegment.get(a.segment_id) ?? null,
		r: 4,
		tx: 0,
		ty: 0,
		ts: DRIFT_PULL,
		active: 0,
		activeTarget: 0,
		glow: 0
	}));

	// How a node maps to a cluster in each stage. Theme ids are title-cased for
	// display; keywords already carry a human label from the lexicon.
	const themeGroup = (n: Node): Group | null =>
		n.theme ? { key: n.theme, label: titleCase(n.theme) } : null;
	const keywordGroup = (n: Node): Group | null =>
		n.keyword ? { key: n.keyword.id, label: n.keyword.label } : null;

	const total = themedQuestionIds.length;

	let wrap = $state<HTMLDivElement>();
	let canvas = $state<HTMLCanvasElement>();
	let W = $state(960);
	let H = $state(600);

	let mode = $state<'auto' | 'manual'>('auto');
	let phase = $state(0);
	let stage = $state<'theme' | 'keyword'>('theme');
	let clusters = $state<Cluster[]>([]);
	let spotNode = $state<Node | null>(null); // auto-mode spotlight
	let hovered = $state<Node | null>(null); // manual-mode hover/tap
	let focusX = $state(0); // live x of the focused node, for card placement
	let focusY = $state(0); // live y of the focused node, for card placement
	const currentQid = $derived(themedQuestionIds[phase] ?? themedQuestionIds[0]);
	// The node driving the highlight + card: the spotlight in auto, hover in manual.
	const focusNode = $derived(mode === 'auto' ? spotNode : hovered);

	let ctx: CanvasRenderingContext2D | null = null;
	let R = 4;
	let sim: Simulation<Node, undefined>;
	let timer: ReturnType<typeof setTimeout>;
	let spotTimer: ReturnType<typeof setInterval> | null = null;
	let spotList: Node[] = [];
	let spotIdx = 0;
	let focusAmt = 0; // smoothed 0..1 — recedes the rest of the cloud while highlighting

	function sizeCanvas() {
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		ctx = canvas.getContext('2d');
		ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
		R = Math.max(3, Math.min(6, W / 210));
		for (const n of nodes) n.r = R;
	}

	/** Send a node toward a random point in the loose background cloud. */
	function scatterTarget(n: Node) {
		n.tx = W / 2 + (Math.random() - 0.5) * W * 0.72;
		n.ty =
			(PAD_TOP + H - PAD_BOTTOM) / 2 +
			(Math.random() - 0.5) * (H - PAD_TOP - PAD_BOTTOM) * 0.88;
		n.ts = DRIFT_PULL;
	}

	/**
	 * Grid of cluster centres for the segments under one question, grouped by
	 * `groupOf` — themes in the theme stage, keywords in the keyword stage.
	 */
	function computeLayout(qid: string, groupOf: (n: Node) => Group | null): Cluster[] {
		const counts = new Map<string, { label: string; count: number }>();
		for (const node of nodes) {
			if (node.questionId !== qid) continue;
			const g = groupOf(node);
			if (!g) continue;
			const e = counts.get(g.key);
			if (e) e.count++;
			else counts.set(g.key, { label: g.label, count: 1 });
		}
		const groups = [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
		const n = groups.length;
		if (n === 0) return [];
		const cols = Math.max(1, Math.round(Math.sqrt(((n * W) / Math.max(H, 1)) * 0.82)));
		const cellW = (W - 2 * PAD_X) / cols;
		const cellH = (H - PAD_TOP - PAD_BOTTOM) / Math.ceil(n / cols);
		return groups.map(([key, { label, count }], i) => {
			const x0 = PAD_X + (i % cols) * cellW;
			const y0 = PAD_TOP + Math.floor(i / cols) * cellH;
			return {
				key,
				label,
				count,
				cx: x0 + cellW / 2,
				cy: y0 + cellH * 0.6,
				labelX: x0 + cellW / 2,
				labelY: y0 + cellH * 0.12
			};
		});
	}

	// d3-force caches each force's targets/strengths at initialize time, so the
	// x/y/collide forces are rebuilt whenever node targets or radii change.
	function setForces() {
		sim
			.force(
				'x',
				forceX<Node>()
					.x((d) => d.tx)
					.strength((d) => d.ts)
			)
			.force(
				'y',
				forceY<Node>()
					.y((d) => d.ty)
					.strength((d) => d.ts)
			)
			.force(
				'collide',
				forceCollide<Node>()
					.radius((d) => d.r + 0.8)
					.strength(0.72)
					.iterations(1)
			);
	}

	/** Loose-drift beat: every circle releases back into the cloud. */
	function enterScatter() {
		stage = 'theme';
		clusters = [];
		for (const n of nodes) {
			n.activeTarget = 0;
			scatterTarget(n);
		}
		setForces();
		sim.alpha(0.55);
		if (mode === 'auto') timer = setTimeout(() => enterSort('theme'), SCATTER_MS);
	}

	/**
	 * Sort beat: this question's circles gather into clusters. The theme stage
	 * runs first; the keyword stage then re-gathers the same circles without a
	 * scatter, so the theme clusters visibly morph into keyword clusters. In
	 * auto mode it schedules the next beat; in manual mode it just settles.
	 */
	function enterSort(which: 'theme' | 'keyword') {
		stage = which;
		const groupOf = which === 'theme' ? themeGroup : keywordGroup;
		const cl = computeLayout(currentQid, groupOf);
		clusters = cl;
		const byKey = new Map(cl.map((c) => [c.key, c]));
		for (const n of nodes) {
			const g = n.questionId === currentQid ? groupOf(n) : null;
			const c = g ? byKey.get(g.key) : undefined;
			if (c) {
				n.tx = c.cx + (Math.random() - 0.5) * 10;
				n.ty = c.cy + (Math.random() - 0.5) * 10;
				n.ts = ACTIVE_PULL;
				n.activeTarget = 1;
			} else {
				n.activeTarget = 0;
				scatterTarget(n);
			}
		}
		setForces();
		sim.alpha(0.72);
		if (mode !== 'auto') return;
		if (which === 'theme') {
			timer = setTimeout(() => enterSort('keyword'), HOLD_MS);
		} else {
			timer = setTimeout(() => {
				phase = (phase + 1) % total;
				enterScatter();
			}, HOLD_MS);
		}
	}

	// --- auto-mode spotlight -------------------------------------------------

	/** The current question's key quotes — segments that are part of a pull quote. */
	function buildSpotList() {
		spotList = nodes.filter(
			(n) => n.questionId === currentQid && quoteBySegmentId.has(n.segmentId)
		);
		spotIdx = 0;
		spotNode = spotList[0] ?? null;
	}

	function advanceSpot() {
		if (!spotList.length) {
			spotNode = null;
			return;
		}
		spotIdx = (spotIdx + 1) % spotList.length;
		spotNode = spotList[spotIdx];
	}

	function startSpotlight() {
		if (spotTimer) clearInterval(spotTimer);
		buildSpotList();
		spotTimer = setInterval(advanceSpot, SPOT_MS);
	}

	// --- manual controls -----------------------------------------------------

	function setMode(m: 'auto' | 'manual') {
		if (m === mode) return;
		mode = m;
		clearTimeout(timer);
		if (spotTimer) ((clearInterval(spotTimer), (spotTimer = null)));
		hovered = null;
		if (m === 'auto') {
			enterScatter();
			startSpotlight();
		} else {
			spotNode = null;
			enterSort(stage); // settle the current question, no further beats
		}
	}

	/** Manual mode: jump to a question and re-sort it at the current stage. */
	function gotoQuestion(i: number) {
		phase = ((i % total) + total) % total;
		enterSort(stage);
	}

	function sizedHit(n: Node) {
		return Math.max(n.r + 9, 12);
	}

	/** Manual mode: find the circle nearest a pointer position — any circle. */
	function hitTest(px: number, py: number): Node | null {
		let best: Node | null = null;
		let bestD = Infinity;
		for (const n of nodes) {
			const d = Math.hypot(n.x - px, n.y - py);
			if (d < sizedHit(n) && d < bestD) ((bestD = d), (best = n));
		}
		return best;
	}

	/** Centres of the theme/keyword clusters the focused circle belongs to. */
	function focusClusterTargets(n: Node): { x: number; y: number }[] {
		if (!clusters.length) return [];
		const byKey = new Map(clusters.map((c) => [c.key, c]));
		const keys = stage === 'theme' ? n.themes : n.keyword ? [n.keyword.id] : [];
		const out: { x: number; y: number }[] = [];
		for (const k of keys) {
			const c = byKey.get(k);
			if (c) out.push({ x: c.cx, y: c.cy });
		}
		return out;
	}

	function onPointer(e: PointerEvent) {
		if (mode !== 'manual' || !wrap) return;
		const rect = wrap.getBoundingClientRect();
		hovered = hitTest(e.clientX - rect.left, e.clientY - rect.top);
	}

	/** Click a circle to open the theme drawer for its first coded theme. */
	function onClick(e: MouseEvent) {
		if (!onThemeSelect || !wrap) return;
		const rect = wrap.getBoundingClientRect();
		const hit = hitTest(e.clientX - rect.left, e.clientY - rect.top);
		if (hit?.theme) onThemeSelect(hit.theme);
	}

	function tick() {
		for (const n of nodes) {
			// brownian drift keeps the background cloud alive
			if (n.activeTarget === 0) {
				n.vx += (Math.random() - 0.5) * JITTER;
				n.vy += (Math.random() - 0.5) * JITTER;
			}
			// soft-bounce circles back onto the canvas
			if (n.x < R) ((n.x = R), (n.vx = Math.abs(n.vx) * 0.5));
			else if (n.x > W - R) ((n.x = W - R), (n.vx = -Math.abs(n.vx) * 0.5));
			if (n.y < R) ((n.y = R), (n.vy = Math.abs(n.vy) * 0.5));
			else if (n.y > H - R) ((n.y = H - R), (n.vy = -Math.abs(n.vy) * 0.5));
		}
		// pin alpha above its floor so the simulation never stops ticking
		if (sim.alpha() < ALPHA_FLOOR) sim.alpha(ALPHA_FLOOR);
		draw();
	}

	function draw() {
		if (!ctx) return;
		const focus = focusNode;
		if (focus) ((focusX = focus.x), (focusY = focus.y));
		focusAmt += ((focus ? 1 : 0) - focusAmt) * 0.08;
		ctx.clearRect(0, 0, W, H);

		// highlight connectors — the focused circle tethered to the theme/keyword
		// clusters it belongs to, echoing the keyword-orbit constellation.
		if (focus && focus.questionId === currentQid) {
			ctx.lineWidth = 1.2;
			ctx.strokeStyle = 'rgba(251,191,36,0.55)';
			for (const t of focusClusterTargets(focus)) {
				ctx.globalAlpha = 0.5 * focus.glow;
				ctx.beginPath();
				ctx.moveTo(focus.x, focus.y);
				ctx.lineTo(t.x, t.y);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
		}

		for (const n of nodes) {
			n.active += (n.activeTarget - n.active) * 0.06;
			n.glow += ((n === focus ? 1 : 0) - n.glow) * 0.09;
			const col = SENTIMENT_COLORS[n.sentiment] ?? '#94a3b8';
			const a = n.active;
			const g = n.glow;
			// the rest of the cloud recedes while a circle is highlighted
			const dimK = 1 - 0.42 * focusAmt * (1 - g);

			// soft sentiment halo for clustered circles
			if (a > 0.04) {
				ctx.globalAlpha = 0.13 * a * dimK;
				ctx.beginPath();
				ctx.arc(n.x, n.y, n.r * 3, 0, TAU);
				ctx.fillStyle = col;
				ctx.fill();
			}

			// gold gradient halo behind the highlighted circle
			if (g > 0.04) {
				const rh = n.r * 4.6 + 12;
				const halo = ctx.createRadialGradient(n.x, n.y, n.r * 1.1, n.x, n.y, rh);
				halo.addColorStop(0, 'rgba(253,230,138,0)');
				halo.addColorStop(0.5, 'rgba(251,191,36,0.55)');
				halo.addColorStop(0.8, 'rgba(245,158,11,0.4)');
				halo.addColorStop(1, 'rgba(245,158,11,0)');
				ctx.globalAlpha = g;
				ctx.fillStyle = halo;
				ctx.beginPath();
				ctx.arc(n.x, n.y, rh, 0, TAU);
				ctx.fill();
			}

			// core — the focused circle stays bright even if its cluster faded
			ctx.globalAlpha = Math.max((0.15 + 0.78 * a) * dimK, 0.95 * g);
			ctx.beginPath();
			ctx.arc(n.x, n.y, n.r * (1 + 0.5 * g), 0, TAU);
			ctx.fillStyle = col;
			ctx.fill();

			// gold gradient ring around the highlighted circle
			if (g > 0.04) {
				const rr = n.r * 2.5 + 5;
				const ring = ctx.createLinearGradient(n.x - rr, n.y - rr, n.x + rr, n.y + rr);
				ring.addColorStop(0, '#fde68a');
				ring.addColorStop(0.5, '#f59e0b');
				ring.addColorStop(1, '#fcd34d');
				ctx.globalAlpha = 0.95 * g;
				ctx.lineWidth = 2;
				ctx.strokeStyle = ring;
				ctx.beginPath();
				ctx.arc(n.x, n.y, rr, 0, TAU);
				ctx.stroke();
			}
		}
		ctx.globalAlpha = 1;
	}

	onMount(() => {
		if (wrap) {
			W = wrap.clientWidth || W;
			H = wrap.clientHeight || H;
		}
		sizeCanvas();
		for (const n of nodes) {
			n.x = Math.random() * W;
			n.y = Math.random() * H;
		}
		sim = forceSimulation<Node>(nodes).velocityDecay(0.62).alphaDecay(0.0228);
		setForces();
		sim.on('tick', tick);
		enterScatter();
		startSpotlight();
		return () => {
			clearTimeout(timer);
			if (spotTimer) clearInterval(spotTimer);
			sim.stop();
		};
	});

	// Auto mode: rebuild the spotlight list whenever the question advances.
	$effect(() => {
		const q = currentQid;
		void q;
		untrack(() => {
			if (mode === 'auto' && sim) buildSpotList();
		});
	});

	// Re-fit the canvas + cluster targets on resize without disturbing the cycle.
	$effect(() => {
		const w = W;
		const h = H;
		untrack(() => {
			if (!canvas || !sim || !w || !h) return;
			sizeCanvas();
			if (clusters.length) {
				const groupOf = stage === 'theme' ? themeGroup : keywordGroup;
				const cl = computeLayout(currentQid, groupOf);
				clusters = cl;
				const byKey = new Map(cl.map((c) => [c.key, c]));
				for (const n of nodes) {
					const g = n.questionId === currentQid ? groupOf(n) : null;
					const c = g ? byKey.get(g.key) : undefined;
					if (c) ((n.tx = c.cx), (n.ty = c.cy));
					else scatterTarget(n);
				}
			} else {
				for (const n of nodes) scatterTarget(n);
			}
			setForces();
		});
	});

	// --- quote card ----------------------------------------------------------

	/** Split a quote so the spoken keyword can be emphasised. */
	function parts(text: string, surface: string): { s: string; hit: boolean }[] {
		if (!surface) return [{ s: text, hit: false }];
		const re = new RegExp(`(${surface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
		return text
			.split(re)
			.filter(Boolean)
			.map((s) => ({ s, hit: s.toLowerCase() === surface.toLowerCase() }));
	}

	// The card describing the focused circle — sits just beside it, on whichever
	// side has room, and is clamped to stay on-canvas.
	const card = $derived.by(() => {
		const n = focusNode;
		if (!n) return null;
		const seg = segById.get(n.segmentId);
		const q = quoteBySegmentId.get(n.segmentId);
		const raw = (q?.text ?? seg?.text ?? '').trim();
		if (!raw) return null;
		const themeIds = q?.themes?.length ? q.themes : n.theme ? [n.theme] : [];
		const estH = 248; // rough card height, for vertical clamping
		const toRight = W - focusX > CARD_W + CARD_GAP + CARD_M;
		const rawLeft = toRight ? focusX + CARD_GAP : focusX - CARD_GAP - CARD_W;
		const left = Math.min(Math.max(rawLeft, CARD_M), Math.max(CARD_M, W - CARD_W - CARD_M));
		// Clamp the card clear of the bottom overlay band (question + progress
		// row) so it never crowds the bottom edge of the screen.
		const top = Math.min(
			Math.max(focusY - estH * 0.42, CARD_M),
			Math.max(CARD_M, H - estH - PAD_BOTTOM)
		);
		return {
			label: n.keyword?.label ?? (n.theme ? titleCase(n.theme) : 'Tagged segment'),
			text: raw.length > 240 ? raw.slice(0, 239).trimEnd() + '…' : raw,
			surface: n.keyword?.surface ?? '',
			sentiment: q?.sentiment ?? n.sentiment,
			interviewId: n.interviewId,
			participant: titleCase(n.interviewId),
			isKeyQuote: !!q,
			themes: themeIds.map(titleCase),
			left,
			top
		};
	});
</script>

<div class={fullBleed ? 'flex min-h-0 w-full flex-1 flex-col' : 'flex flex-col gap-3'}>
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div
		bind:this={wrap}
		bind:clientWidth={W}
		bind:clientHeight={H}
		class="relative w-full overflow-hidden bg-[#0c1320] {fullBleed
			? 'min-h-0 flex-1'
			: 'aspect-16/10 min-h-[460px] rounded-xl border border-(--ink)/15'}"
		class:cursor-crosshair={mode === 'manual'}
		class:cursor-pointer={onThemeSelect && mode === 'auto'}
		onpointermove={onPointer}
		onpointerdown={onPointer}
		onpointerleave={() => (hovered = null)}
		onclick={onClick}
	>
		<canvas bind:this={canvas} class="absolute inset-0 h-full w-full"></canvas>

		<!-- cluster labels -->
		{#each clusters as c (c.key + phase + stage)}
			<div
				class="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-center"
				style="left: {c.labelX}px; top: {c.labelY}px;"
				transition:fade={{ duration: 380 }}
			>
				<span class="font-mono text-[11px] font-medium uppercase tracking-wide text-white/85">
					{c.label}
				</span>
				<span class="ml-1 font-mono text-[11px] text-white/45">{c.count}</span>
			</div>
		{/each}

		<!-- question + manual nav -->
		<div class="absolute bottom-12 left-0 flex max-w-2xl flex-col gap-1.5 p-6">
			<div class="flex items-center gap-2">
				{#if mode === 'manual'}
					<button
						class="pointer-events-auto flex size-6 items-center justify-center rounded-full border border-white/25 text-sm text-white/75 transition-colors hover:bg-white/10"
						aria-label="Previous question"
						onclick={() => gotoQuestion(phase - 1)}>‹</button
					>
				{/if}
				<span class="font-mono text-xs uppercase tracking-wider text-white/55">
					Question {phase + 1} / {total}
				</span>
				{#if mode === 'manual'}
					<button
						class="pointer-events-auto flex size-6 items-center justify-center rounded-full border border-white/25 text-sm text-white/75 transition-colors hover:bg-white/10"
						aria-label="Next question"
						onclick={() => gotoQuestion(phase + 1)}>›</button
					>
				{/if}
			</div>
			{#key currentQid}
				<h3
					in:fade={{ duration: 500 }}
					class="font-heading text-2xl font-light leading-tight text-white md:text-3xl"
				>
					{questionLabel(currentQid)}
				</h3>
			{/key}
			{#if mode === 'manual'}
				<div
					class="pointer-events-auto mt-0.5 flex gap-1 self-start rounded-lg border border-white/15 p-1"
				>
					{#each ['theme', 'keyword'] as const as s (s)}
						<button
							class="rounded-md px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wide transition-colors
								{stage === s ? 'bg-white/90 text-slate-900' : 'text-white/55 hover:bg-white/10'}"
							onclick={() => enterSort(s)}>{s}</button
						>
					{/each}
				</div>
			{:else if clusters.length}
				{#key stage}
					<span
						in:fade={{ duration: 300 }}
						class="font-mono text-xs uppercase tracking-wider text-accent-mint"
					>
						Grouped by {stage}
					</span>
				{/key}
			{/if}
		</div>

		<!-- mode toggle -->
		<div class="absolute bottom-12 right-0 flex flex-col items-end gap-3 p-6">
			<div class="pointer-events-auto flex gap-1 rounded-lg border border-white/15 p-1">
				{#each ['auto', 'manual'] as const as m (m)}
					<button
						class="rounded-md px-3 py-1 font-mono text-xs uppercase tracking-wide transition-colors
							{mode === m ? 'bg-white/90 text-slate-900' : 'text-white/60 hover:bg-white/10'}"
						onclick={() => setMode(m)}>{m}</button
					>
				{/each}
			</div>
		</div>

		<!-- cycle progress — clickable in manual mode -->
		<div class="absolute bottom-0 left-0 flex w-full items-center gap-1 p-6">
			{#each themedQuestionIds as q, i (q)}
				<button
					class="flex-1 py-2 {mode === 'manual'
						? 'pointer-events-auto cursor-pointer'
						: 'pointer-events-none'}"
					disabled={mode !== 'manual'}
					aria-label="Question {i + 1}"
					onclick={() => gotoQuestion(i)}
				>
					<span
						class="block h-1 rounded-full transition-colors duration-300"
						style="background: {i === phase
							? 'rgba(255,255,255,0.85)'
							: 'rgba(255,255,255,0.16)'}"
					></span>
				</button>
			{/each}
		</div>

		<!-- quote card — beside the focused circle -->
		{#if card}
			{#key card.text}
				<div
					class="pointer-events-none absolute z-20 rounded-xl border border-white/25 bg-white/80 p-5 shadow-2xl backdrop-blur-md"
					style="left: {card.left}px; top: {card.top}px; width: {CARD_W}px;"
					in:fade={{ duration: 400 }}
				>
					<div class="flex items-center justify-between gap-3">
						<span class="font-mono text-xs font-medium uppercase tracking-wide text-slate-600">
							{card.label}
						</span>
						<span class="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
							<span
								class="size-2.5 rounded-full"
								style:background-color={SENTIMENT_COLORS[clampS(card.sentiment)]}
							></span>
							{SENTIMENT_LABEL[clampS(card.sentiment)]}
						</span>
					</div>
					<p class="mt-3 font-heading text-lg font-light leading-snug text-slate-800">
						{#each parts(card.text, card.surface) as p, i (i)}{#if p.hit}<span
									class="font-medium text-slate-950">{p.s}</span
								>{:else}{p.s}{/if}{/each}
					</p>
					{#if card.themes.length}
						<div class="mt-3 flex flex-wrap gap-1.5">
							{#each card.themes.slice(0, 6) as t (t)}
								<span
									class="rounded-full bg-slate-900/8 px-2 py-0.5 font-mono text-[10px] text-slate-600"
								>
									{t}
								</span>
							{/each}
						</div>
					{/if}
					<div class="mt-3 flex items-center gap-2 border-t border-slate-900/10 pt-3">
						<ParticipantAvatar interviewId={card.interviewId} size="sm" />
						<span class="font-mono text-xs text-slate-500">{card.participant}</span>
						{#if card.isKeyQuote}
							<span class="ml-auto font-mono text-[10px] uppercase tracking-wide text-emerald-600">
								Key quote
							</span>
						{/if}
					</div>
				</div>
			{/key}
		{/if}

		<!-- full-bleed booth: sentiment legend overlaid in the corner -->
		{#if fullBleed}
			<div class="pointer-events-none absolute right-0 top-0 m-6 flex flex-col items-end gap-1.5">
				<span class="font-mono text-[11px] uppercase tracking-wide text-white/55">
					{nodes.length} segments · {total} questions
				</span>
				<div class="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
					{#each SENTIMENT_ORDER as s (s)}
						<span class="flex items-center gap-1.5 font-mono text-[11px] text-white/75">
							<span class="size-2.5 rounded-full" style:background-color={SENTIMENT_COLORS[s]}
							></span>
							{SENTIMENT_LABEL[s]}
						</span>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	{#if !fullBleed}
		<!-- sentiment legend -->
		<div class="flex flex-wrap items-center gap-x-4 gap-y-1">
			<p class="caption text-muted-foreground">
				{nodes.length} tagged segments · {total} questions
			</p>
			{#each SENTIMENT_ORDER as s (s)}
				<span class="flex items-center gap-1.5 font-mono text-xs text-foreground">
					<span class="size-3 rounded-full" style:background-color={SENTIMENT_COLORS[s]}></span>
					{SENTIMENT_LABEL[s]}
				</span>
			{/each}
		</div>

		<p class="caption text-xs text-muted-foreground">
			Each circle is one tagged segment, coloured by sentiment. In <strong>auto</strong> mode the view
			cycles through the interview guide — segments gather into their coded themes, then re-gather into
			the keywords participants used, while the key quotes spoken under each question are spotlit one
			at a time. Switch to <strong>manual</strong> to click through questions, toggle theme/keyword grouping,
			and hover any circle to read the line behind it.
		</p>
	{/if}
</div>

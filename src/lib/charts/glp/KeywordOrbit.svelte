<!--
	KeywordOrbit — an ambient, full-bleed, booth-friendly view.

	Coded themes sit as small hubs in a loose central ring; the words
	participants used orbit the theme they co-occur with most, each tethered to
	its hub by a faint spoke so the grouping reads at a glance. The keyword→theme
	link is derived, not re-tagged: each keyword match in keyword_usage.json
	carries a segment_id, and that segment's annotation carries the themes. Every
	node is coloured by sentiment.

	Two modes:
	  - Auto    — cycles through the interview guide on its own; for each
	              question, keywords spoken under it brighten and one at a time
	              is spotlit, lifted clear with a quote card in the far corner.
	  - Manual  — click through questions, hover (or tap) a keyword to highlight
	              it and read the line where it was spoken.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import {
		annotations,
		segments,
		themedQuestionIds,
		questionLabel,
		titleCase
	} from '$lib/content/wctglpdemo-data/analysis';
	import { keywordTags } from '$lib/content/wctglpdemo-data/keywords';
	import keywordUsageRaw from '$lib/content/wctglpdemo-data/keyword_usage.json';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import {
		PLUTCHIK_DYADS,
		EMOTION_COLOR_MAP,
		EMOTION_LEVELS_MAP
	} from '$lib/content/emotions/plutchik';

	let {
		/** Fired when a theme hub (or a keyword orbiting one) is clicked. */
		onThemeSelect
	}: { onThemeSelect?: (themeId: string) => void } = $props();

	const TAU = Math.PI * 2;
	const GOLDEN = Math.PI * (3 - Math.sqrt(5));

	// -2..2 diverging sentiment scale — matches the segment constellation.
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
	const sentColor = (s: number) => SENTIMENT_COLORS[clampS(s)];

	// Plutchik emotions — a dyad carries its two primary colours; each intensity
	// level (e.g. "serenity") maps back to its primary (e.g. "joy").
	type Dyad = { c1: string; c2: string };
	const DYAD = new Map<string, Dyad>();
	for (const group of Object.values(PLUTCHIK_DYADS) as { label: string; color_1: string; color_2: string }[][])
		for (const d of group) DYAD.set(d.label, { c1: d.color_1, c2: d.color_2 });
	const PRIMARY_OF = new Map<string, string>();
	for (const [primary, levels] of Object.entries(EMOTION_LEVELS_MAP as Record<string, string[]>))
		for (const lv of levels) PRIMARY_OF.set(lv, primary);
	const emotionColorMap = EMOTION_COLOR_MAP as Record<string, string>;

	/** Display style for one tagged emotion — a dyad gets a two-colour gradient. */
	function emotionStyle(id: string): { label: string; css: string } {
		const d = DYAD.get(id);
		if (d) return { label: titleCase(id), css: `linear-gradient(135deg, ${d.c1}, ${d.c2})` };
		const p = PRIMARY_OF.get(id);
		return { label: titleCase(id), css: p ? emotionColorMap[p] : '#94a3b8' };
	}

	// --- tuning -------------------------------------------------------------
	const HUB_COUNT = 9; // themes shown as central hubs
	const SPOT_MS = 9000; // how long each keyword is spotlit (auto mode)
	const KEYWORDS_PER_Q = 4; // keywords spotlit before the question advances
	const GLOW_LERP = 0.022; // how slowly highlights ease in / out
	const HUB_RING = 0.3; // hub ring radius as a fraction of min(W,H)
	const ORBIT_CAP = 0.12; // max keyword-cloud radius as a fraction of min(W,H)
	const LIFT = 0.13; // how far a spotlit keyword lifts clear, fraction of min(W,H)
	const CARD_W = 360;
	const CARD_M = 24; // card inset from the corner
	// ------------------------------------------------------------------------

	type Match = { segment_id: string; question_id: string; text: string };
	type Keyword = { id: string; label: string; matches?: Match[]; count?: number };
	const keywordUsage = keywordUsageRaw as { categories: { keywords: Keyword[] }[] };

	// segment joins for the keyword→theme link, sentiment colour, and quotes.
	const segThemes = new Map(annotations.map((a) => [a.segment_id, a.themes]));
	const segSentiment = new Map(annotations.map((a) => [a.segment_id, a.sentiment]));
	const segEmotions = new Map(annotations.map((a) => [a.segment_id, a.emotions]));
	const segById = new Map(segments.map((s) => [s.segment_id, s]));

	type Quote = {
		text: string;
		surface: string;
		interviewId: string;
		participant: string;
		sentiment: number;
		emotions: string[];
		tags: { id: string; label: string }[];
	};
	type Hub = {
		id: string;
		label: string;
		sentiment: number;
		deg: number;
		angle: number; // position on the hub ring
		rJit: number;
		spin: number; // angular speed of its keyword cloud
		orbitR: number;
		x: number;
		y: number;
		r: number;
		glow: number;
	};
	type Sat = {
		id: string;
		label: string;
		sentiment: number;
		hub: Hub;
		relatedHubs: Hub[]; // every hub theme this keyword co-occurs with
		qids: Set<string>;
		mentions: number;
		quote: Quote | null;
		/** Two-colour blend when the representative quote carries a dyad emotion. */
		dyad: Dyad | null;
		k: number; // index within its hub
		angle: number; // live orbit angle
		spin: number;
		radiusFrac: number;
		frozen: boolean;
		x: number;
		y: number;
		r: number;
		glow: number;
	};

	/**
	 * Pick one verbatim line where a keyword was spoken — moderate length reads
	 * best, and a line whose sentiment matches the keyword's own is preferred so
	 * the card's sentiment chip agrees with how the node is coloured.
	 */
	function pickQuote(matches: Match[], preferSentiment: number): Quote | null {
		let bestSeg: (typeof segments)[number] | null = null;
		let bestSurface = '';
		let bestScore = -Infinity;
		for (const m of matches) {
			const seg = segById.get(m.segment_id);
			if (!seg) continue;
			const len = seg.text.length;
			let score = -Math.abs(len - 150) - (len < 45 ? 1000 : 0);
			if (segSentiment.get(seg.segment_id) === preferSentiment) score += 600;
			if (score > bestScore) {
				bestScore = score;
				bestSeg = seg;
				bestSurface = m.text;
			}
		}
		if (!bestSeg) return null;
		return {
			text: bestSeg.text,
			surface: bestSurface,
			interviewId: bestSeg.interview_id,
			participant: titleCase(bestSeg.interview_id),
			sentiment: segSentiment.get(bestSeg.segment_id) ?? 0,
			emotions: segEmotions.get(bestSeg.segment_id) ?? [],
			tags: keywordTags(bestSeg.text).keywords.map((k) => ({ id: k.id, label: k.label }))
		};
	}

	// --- derive the graph (runs once) ---------------------------------------
	type Cand = {
		id: string;
		label: string;
		mentions: number;
		weights: Map<string, number>;
		sentiments: number[];
		qids: Set<string>;
		matches: Match[];
	};
	const candidates: Cand[] = [];
	for (const cat of keywordUsage.categories) {
		for (const kw of cat.keywords) {
			const weights = new Map<string, number>();
			const sentiments: number[] = [];
			const qids = new Set<string>();
			for (const m of kw.matches ?? []) {
				if (m.question_id) qids.add(m.question_id);
				const themes = segThemes.get(m.segment_id);
				if (!themes) continue;
				for (const t of themes) weights.set(t, (weights.get(t) ?? 0) + 1);
				const s = segSentiment.get(m.segment_id);
				if (s !== undefined) sentiments.push(s);
			}
			if (weights.size)
				candidates.push({
					id: kw.id,
					label: kw.label,
					mentions: kw.count ?? 0,
					weights,
					sentiments,
					qids,
					matches: kw.matches ?? []
				});
		}
	}

	const argmax = (w: Map<string, number>) => [...w.entries()].sort((a, b) => b[1] - a[1])[0][0];
	const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

	// Hubs = the themes the most keywords point to as their first choice.
	const firstChoice = new Map<string, number>();
	for (const c of candidates) {
		const t = argmax(c.weights);
		firstChoice.set(t, (firstChoice.get(t) ?? 0) + 1);
	}
	const hubThemes = [...firstChoice.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, HUB_COUNT)
		.map(([t]) => t);
	const hubSet = new Set(hubThemes);

	const hubs: Hub[] = hubThemes.map((t, i) => ({
		id: t,
		label: titleCase(t),
		sentiment: mean(annotations.filter((a) => a.themes.includes(t)).map((a) => a.sentiment)),
		deg: 0,
		angle: (i / HUB_COUNT) * TAU - Math.PI / 2,
		rJit: 0.82 + (i % 3) * 0.12,
		spin: (0.04 + (i % 3) * 0.014) * (i % 2 ? 1 : -1),
		orbitR: 0,
		x: 0,
		y: 0,
		r: 6,
		glow: 0
	}));
	const hubById = new Map(hubs.map((h) => [h.id, h]));

	const sats: Sat[] = [];
	for (const c of candidates) {
		let best: string | null = null;
		let bestW = -1;
		for (const [t, w] of c.weights) if (hubSet.has(t) && w > bestW) ((bestW = w), (best = t));
		if (!best) continue;
		const hub = hubById.get(best)!;
		// the keyword's representative sentiment — the colour the node carries
		const kwSentiment = c.sentiments.length ? clampS(mean(c.sentiments)) : 0;
		const quote = pickQuote(c.matches, kwSentiment);
		// the representative quote's first dyad emotion drives the glow gradient
		const dyadId = quote?.emotions.find((e) => DYAD.has(e));
		sats.push({
			id: c.id,
			label: c.label,
			sentiment: kwSentiment,
			hub,
			relatedHubs: [...c.weights.keys()].filter((t) => hubSet.has(t)).map((t) => hubById.get(t)!),
			qids: c.qids,
			mentions: c.mentions,
			quote,
			dyad: dyadId ? DYAD.get(dyadId)! : null,
			k: hub.deg,
			angle: 0,
			spin: 0,
			radiusFrac: 0,
			frozen: false,
			x: 0,
			y: 0,
			r: 4,
			glow: 0
		});
		hub.deg++;
	}
	for (const s of sats) {
		s.angle = s.k * GOLDEN;
		s.spin = s.hub.spin * (0.85 + Math.random() * 0.3);
		s.radiusFrac = Math.sqrt((s.k + 0.6) / s.hub.deg);
	}

	// Questions that actually have keywords, in interview-guide order.
	const qList = themedQuestionIds.filter((q) => sats.some((s) => s.qids.has(q)));
	// ------------------------------------------------------------------------

	let wrap = $state<HTMLDivElement>();
	let canvas = $state<HTMLCanvasElement>();
	let W = $state(1200);
	let H = $state(760);
	let mode = $state<'auto' | 'manual'>('auto');
	let qPtr = $state(0); // index into qList
	let spot = $state(0); // absolute index into sats — auto-mode spotlight
	let hovered = $state<Sat | null>(null); // manual-mode hover/tap
	let focusXY = $state({ x: 0, y: 0 });

	const activeQid = $derived(qList[qPtr] ?? qList[0]);
	// The node driving the highlight + card: the spotlight in auto, the hover in manual.
	const focusSat = $derived(mode === 'auto' ? sats[spot] : hovered);

	let ctx: CanvasRenderingContext2D | null = null;
	let scale = 1;
	let raf = 0;
	let last = 0;
	let t = 0;
	let seeded = false;
	let spotPtr = 0;
	let spotList: number[] = [];
	let timer: ReturnType<typeof setInterval> | null = null;

	/** Keywords of the current question, by mentions — the ones to spotlight. */
	function buildSpotList() {
		const q = qList[qPtr];
		spotList = sats
			.map((s, i) => ({ s, i }))
			.filter(({ s }) => s.qids.has(q) && s.quote)
			.sort((a, b) => b.s.mentions - a.s.mentions)
			.slice(0, KEYWORDS_PER_Q)
			.map(({ i }) => i);
		if (!spotList.length) spotList = [spot];
	}

	function advance() {
		spotPtr += 1;
		if (spotPtr >= spotList.length) {
			qPtr = (qPtr + 1) % qList.length;
			buildSpotList();
			spotPtr = 0;
		}
		spot = spotList[spotPtr];
	}

	function startAuto() {
		if (timer) clearInterval(timer);
		buildSpotList();
		spotPtr = 0;
		spot = spotList[0];
		timer = setInterval(advance, SPOT_MS);
	}

	function setMode(m: 'auto' | 'manual') {
		mode = m;
		if (m === 'auto') startAuto();
		else {
			if (timer) clearInterval(timer);
			timer = null;
			hovered = null;
		}
	}

	function setQuestion(i: number) {
		qPtr = ((i % qList.length) + qList.length) % qList.length;
	}

	function sizeCanvas() {
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		ctx = canvas.getContext('2d');
		ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
		const m = Math.min(W, H);
		scale = Math.max(0.75, Math.min(2, m / 780));
		for (const h of hubs) {
			h.r = (3 + Math.sqrt(h.deg) * 0.85) * scale;
			h.orbitR = Math.min((22 + Math.sqrt(h.deg) * 8) * scale, m * ORBIT_CAP);
		}
		for (const s of sats) s.r = (2.4 + Math.sqrt(s.mentions) * 0.5) * scale;
	}

	/** Find the keyword node nearest a pointer position, if within reach. */
	function hitTest(px: number, py: number): Sat | null {
		let best: Sat | null = null;
		let bestD = Infinity;
		for (const s of sats) {
			const d = Math.hypot(s.x - px, s.y - py);
			const reach = Math.max(s.r + 14 * scale, 16);
			if (d < reach && d < bestD) ((bestD = d), (best = s));
		}
		return best;
	}

	function onPointer(e: PointerEvent) {
		if (mode !== 'manual' || !wrap) return;
		const rect = wrap.getBoundingClientRect();
		hovered = hitTest(e.clientX - rect.left, e.clientY - rect.top);
	}

	/** Find the theme hub nearest a pointer position, if within reach. */
	function hitTestHub(px: number, py: number): Hub | null {
		let best: Hub | null = null;
		let bestD = Infinity;
		for (const h of hubs) {
			const d = Math.hypot(h.x - px, h.y - py);
			const reach = Math.max(h.r * 2.6 + 12 * scale, 24);
			if (d < reach && d < bestD) ((bestD = d), (best = h));
		}
		return best;
	}

	/** Click a hub — or a keyword — to open the theme drawer for that theme. */
	function onClick(e: MouseEvent) {
		if (!onThemeSelect || !wrap) return;
		const rect = wrap.getBoundingClientRect();
		const px = e.clientX - rect.left;
		const py = e.clientY - rect.top;
		const hub = hitTestHub(px, py);
		if (hub) {
			onThemeSelect(hub.id);
			return;
		}
		const sat = hitTest(px, py);
		if (sat) onThemeSelect(sat.hub.id);
	}

	function frame(now: number) {
		raf = requestAnimationFrame(frame);
		const dt = Math.min(0.05, (now - last) / 1000 || 0);
		last = now;
		t += dt;

		const cx = W / 2;
		const cy = H / 2;
		const ringR = Math.min(W, H) * HUB_RING;
		const lift = Math.min(W, H) * LIFT;
		const margin = 110;
		const focus = focusSat;

		for (let i = 0; i < hubs.length; i++) {
			const h = hubs[i];
			const rr = ringR * h.rJit + Math.sin(t * 0.18 + i) * Math.min(W, H) * 0.012;
			h.x = cx + Math.cos(h.angle) * rr;
			h.y = cy + Math.sin(h.angle) * rr;
		}
		for (const s of sats) {
			s.frozen = s === focus; // the focused keyword holds still
			if (!s.frozen) s.angle += dt * s.spin;
			const ring = s.hub.r + 9 * scale;
			const radius = ring + s.hub.orbitR * s.radiusFrac + Math.sin(t * 0.5 + s.k) * 2.4 * scale;
			const ox = s.hub.x + Math.cos(s.angle) * radius;
			const oy = s.hub.y + Math.sin(s.angle) * radius;
			let tx = ox;
			let ty = oy;
			// the auto-mode spotlight lifts radially clear of its cluster
			if (mode === 'auto' && s === focus) {
				const dx = ox - cx;
				const dy = oy - cy;
				const d = Math.hypot(dx, dy) || 1;
				tx = Math.max(margin, Math.min(W - margin, ox + (dx / d) * lift));
				ty = Math.max(margin, Math.min(H - margin, oy + (dy / d) * lift));
			}
			const ease = seeded ? (s === focus && mode === 'auto' ? 0.05 : 0.16) : 1;
			s.x += (tx - s.x) * ease;
			s.y += (ty - s.y) * ease;
		}
		seeded = true;

		if (focus) focusXY = { x: focus.x, y: focus.y };

		// highlight targets — slow-eased per node
		const q = activeQid;
		const relatedHubs = new Set(focus?.relatedHubs ?? []);
		const activeHubs = new Set<Hub>();
		for (const s of sats) {
			const inQ = s.qids.has(q);
			const target = s === focus ? 1 : inQ ? 0.45 : 0;
			s.glow += (target - s.glow) * GLOW_LERP;
			if (inQ) activeHubs.add(s.hub);
		}
		for (const h of hubs) {
			const target = relatedHubs.has(h) ? 1 : activeHubs.has(h) ? 0.5 : 0.16;
			h.glow += (target - h.glow) * GLOW_LERP;
		}
		draw();
	}

	function draw() {
		if (!ctx) return;
		const focus = focusSat;
		ctx.clearRect(0, 0, W, H);

		// faint always-on spokes — every keyword tethered to its hub
		ctx.lineWidth = 0.7 * scale;
		for (const s of sats) {
			ctx.globalAlpha = 0.045 + 0.22 * s.glow;
			ctx.strokeStyle = sentColor(s.sentiment);
			ctx.beginPath();
			ctx.moveTo(s.hub.x, s.hub.y);
			ctx.lineTo(s.x, s.y);
			ctx.stroke();
		}

		// connectors — the focused keyword to every theme it touches
		if (focus) {
			ctx.lineWidth = 1.25 * scale;
			ctx.strokeStyle = sentColor(focus.sentiment);
			for (const h of focus.relatedHubs) {
				ctx.globalAlpha = 0.36 * focus.glow;
				ctx.beginPath();
				ctx.moveTo(focus.x, focus.y);
				ctx.lineTo(h.x, h.y);
				ctx.stroke();
			}
		}

		// keyword satellites — core coloured by sentiment, glow by emotion: a
		// dyad-tagged node glows with a gradient of the dyad's two primaries
		for (const s of sats) {
			const col = sentColor(s.sentiment);
			if (s.glow > 0.04) {
				const rr = s.r * (3 + 3 * s.glow);
				if (s.dyad) {
					const g = ctx.createLinearGradient(s.x - rr, s.y - rr, s.x + rr, s.y + rr);
					g.addColorStop(0, s.dyad.c1);
					g.addColorStop(1, s.dyad.c2);
					ctx.fillStyle = g;
				} else {
					ctx.fillStyle = col;
				}
				ctx.globalAlpha = 0.24 * s.glow;
				ctx.beginPath();
				ctx.arc(s.x, s.y, rr, 0, TAU);
				ctx.fill();
			}
			ctx.globalAlpha = 0.26 + 0.66 * s.glow;
			ctx.fillStyle = col;
			ctx.beginPath();
			ctx.arc(s.x, s.y, s.r * (1 + 0.35 * s.glow), 0, TAU);
			ctx.fill();
		}

		// hubs — small, soft halo + core, coloured by the theme's mean sentiment
		for (const h of hubs) {
			const col = sentColor(h.sentiment);
			ctx.globalAlpha = 0.1 + 0.16 * h.glow;
			ctx.fillStyle = col;
			ctx.beginPath();
			ctx.arc(h.x, h.y, h.r * (2.4 + h.glow), 0, TAU);
			ctx.fill();
			ctx.globalAlpha = 0.5 + 0.45 * h.glow;
			ctx.beginPath();
			ctx.arc(h.x, h.y, h.r, 0, TAU);
			ctx.fill();
		}

		// focused keyword label
		ctx.globalAlpha = 1;
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		if (focus && focus.glow > 0.5) {
			ctx.globalAlpha = (focus.glow - 0.5) / 0.5;
			ctx.font = `500 ${Math.round(11 * scale)}px ui-monospace, monospace`;
			ctx.lineWidth = 3;
			ctx.strokeStyle = 'rgba(8,12,22,0.85)';
			const lx = focus.x + focus.r + 6 * scale;
			ctx.strokeText(focus.label, lx, focus.y);
			ctx.fillStyle = 'rgba(255,255,255,0.95)';
			ctx.fillText(focus.label, lx, focus.y);
		}

		// hub labels — small, understated, dark outline for contrast
		ctx.globalAlpha = 1;
		ctx.textAlign = 'center';
		ctx.font = `500 ${Math.round(10 * scale)}px ui-sans-serif, system-ui, sans-serif`;
		ctx.lineWidth = 2.5;
		ctx.strokeStyle = 'rgba(8,12,22,0.8)';
		for (const h of hubs) {
			const ly = h.y + h.r + 9 * scale;
			ctx.globalAlpha = 0.32 + 0.45 * h.glow;
			ctx.strokeText(h.label, h.x, ly);
			ctx.fillStyle = 'rgba(255,255,255,0.88)';
			ctx.fillText(h.label, h.x, ly);
		}

		// focus ring
		if (focus) {
			ctx.globalAlpha = 0.85 * focus.glow;
			ctx.lineWidth = 1.5 * scale;
			ctx.strokeStyle = 'rgba(255,255,255,0.85)';
			ctx.beginPath();
			ctx.arc(focus.x, focus.y, focus.r * 2.6 + 4, 0, TAU);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}

	onMount(() => {
		if (wrap) {
			W = wrap.clientWidth || W;
			H = wrap.clientHeight || H;
		}
		sizeCanvas();
		startAuto();
		last = performance.now();
		raf = requestAnimationFrame(frame);

		const ro = new ResizeObserver(() => {
			if (!wrap) return;
			W = wrap.clientWidth || W;
			H = wrap.clientHeight || H;
			sizeCanvas();
		});
		if (wrap) ro.observe(wrap);

		return () => {
			cancelAnimationFrame(raf);
			if (timer) clearInterval(timer);
			ro.disconnect();
		};
	});

	// Card placement — near the focused node but offset by a clear gap, pushed
	// toward the emptier outer edge so it doesn't cover the dense centre.
	const tip = $derived.by(() => {
		const f = focusSat;
		if (!f?.quote) return null;
		const gap = 54; // clear space between node and card
		const cardH = 300; // generous estimate, for on-screen clamping
		const onRight = focusXY.x > W / 2;
		// prefer the outward side (toward the nearer edge / clearer space)
		let left = onRight ? focusXY.x + gap : focusXY.x - gap - CARD_W;
		// if that runs off-screen, fall back to the inward side
		if (left < CARD_M || left + CARD_W > W - CARD_M)
			left = onRight ? focusXY.x - gap - CARD_W : focusXY.x + gap;
		left = Math.max(CARD_M, Math.min(W - CARD_W - CARD_M, left));
		const top = Math.max(CARD_M, Math.min(H - cardH - CARD_M, focusXY.y - 80));
		return { sat: f, left, top };
	});

	/** Split a quote so the spoken keyword can be emphasised. */
	function parts(text: string, surface: string): { s: string; hit: boolean }[] {
		if (!surface) return [{ s: text, hit: false }];
		const re = new RegExp(`(${surface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
		return text
			.split(re)
			.filter(Boolean)
			.map((s) => ({ s, hit: s.toLowerCase() === surface.toLowerCase() }));
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div
	bind:this={wrap}
	class="absolute inset-0 overflow-hidden bg-[#0c1320]"
	class:cursor-crosshair={mode === 'manual'}
	class:cursor-pointer={onThemeSelect && mode === 'auto'}
	onpointermove={onPointer}
	onpointerdown={onPointer}
	onpointerleave={() => (hovered = null)}
	onclick={onClick}
>
	<canvas bind:this={canvas} class="absolute inset-0 h-full w-full"></canvas>

	<!-- question + manual nav -->
	<div class="absolute bottom-12 left-0 flex max-w-2xl flex-col gap-1.5 p-6">
		<div class="flex items-center gap-2">
			{#if mode === 'manual'}
				<button
					class="pointer-events-auto flex size-6 items-center justify-center rounded-full border border-white/25 text-sm text-white/75 transition-colors hover:bg-white/10"
					aria-label="Previous question"
					onclick={() => setQuestion(qPtr - 1)}>‹</button
				>
			{/if}
			<span class="font-mono text-xs uppercase tracking-wider text-white/55">
				GLP-1 Interviews · Question {qPtr + 1} / {qList.length}
			</span>
			{#if mode === 'manual'}
				<button
					class="pointer-events-auto flex size-6 items-center justify-center rounded-full border border-white/25 text-sm text-white/75 transition-colors hover:bg-white/10"
					aria-label="Next question"
					onclick={() => setQuestion(qPtr + 1)}>›</button
				>
			{/if}
		</div>
		{#key activeQid}
			<h3
				in:fade={{ duration: 700 }}
				class="font-heading text-2xl font-light leading-tight text-white md:text-3xl"
			>
				{questionLabel(activeQid)}
			</h3>
		{/key}
	</div>

	<!-- sentiment legend + mode toggle -->
	<div class="absolute bottom-12 right-0 flex flex-col items-end gap-3 p-6">
		<div class="flex flex-col items-end gap-1">
			{#each SENTIMENT_ORDER as s (s)}
				<span class="flex items-center gap-1.5 font-mono text-[11px] text-white/70">
					{SENTIMENT_LABEL[s]}
					<span class="size-2.5 rounded-full" style:background-color={SENTIMENT_COLORS[s]}></span>
				</span>
			{/each}
		</div>
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
		{#each qList as q, i (q)}
			<button
				class="group flex-1 py-2 {mode === 'manual' ? 'pointer-events-auto cursor-pointer' : ''}"
				disabled={mode !== 'manual'}
				aria-label="Question {i + 1}"
				onclick={() => setQuestion(i)}
			>
				<span
					class="block h-1 rounded-full transition-colors duration-500"
					style="background: {i === qPtr
						? 'rgba(255,255,255,0.85)'
						: 'rgba(255,255,255,0.16)'}"
				></span>
			</button>
		{/each}
	</div>

	<!-- quote card — far corner, opposite the focused node -->
	{#if tip}
		{#key tip.sat.id}
			<div
				class="pointer-events-none absolute rounded-xl border border-white/25 bg-white/75 p-5 shadow-2xl backdrop-blur-md"
				style="left: {tip.left}px; top: {tip.top}px; width: {CARD_W}px;"
				in:fade={{ duration: 600 }}
			>
				<div class="flex items-center justify-between gap-3">
					<span class="font-mono text-xs font-medium uppercase tracking-wide text-slate-600">
						{tip.sat.label}
					</span>
					<span class="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
						<span
							class="size-2.5 rounded-full"
							style:background-color={sentColor(tip.sat.quote!.sentiment)}
						></span>
						{SENTIMENT_LABEL[clampS(tip.sat.quote!.sentiment)]}
					</span>
				</div>
				<p class="mt-3 font-heading text-lg font-light leading-snug text-slate-800">
					{#each parts(tip.sat.quote!.text, tip.sat.quote!.surface) as p, i (i)}{#if p.hit}<span
								class="font-medium text-slate-950">{p.s}</span
							>{:else}{p.s}{/if}{/each}
				</p>
				{#if tip.sat.quote!.emotions.length}
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#each tip.sat.quote!.emotions as e (e)}
							{@const es = emotionStyle(e)}
							<span
								class="flex items-center gap-1.5 rounded-full bg-slate-900/8 px-2 py-0.5 font-mono text-[10px] text-slate-700"
							>
								<span class="size-2.5 rounded-full" style:background={es.css}></span>
								{es.label}
							</span>
						{/each}
					</div>
				{/if}
				{#if tip.sat.quote!.tags.length}
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#each tip.sat.quote!.tags.slice(0, 8) as tag (tag.id)}
							<span
								class="rounded-full bg-slate-900/8 px-2 py-0.5 font-mono text-[10px] text-slate-600"
							>
								{tag.label}
							</span>
						{/each}
					</div>
				{/if}
				<div class="mt-3 flex items-center gap-2 border-t border-slate-900/10 pt-3">
					<ParticipantAvatar interviewId={tip.sat.quote!.interviewId} size="sm" />
					<span class="font-mono text-xs text-slate-500">{tip.sat.quote!.participant}</span>
				</div>
			</div>
		{/key}
	{/if}
</div>

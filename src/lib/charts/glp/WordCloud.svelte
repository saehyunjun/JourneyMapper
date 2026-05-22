<script lang="ts" module>
	export type WordCloudDatum = {
		text: string;
		value: number;
		sentiment?: number;
		id?: string;
		[key: string]: unknown;
	};

	/** Boundary the force layout keeps words inside. */
	export type CloudShape = 'circle' | 'square' | 'wide-rectangle';

	/** A curated word — the input datum plus any local edit provenance. */
	export type CuratedWord = WordCloudDatum & {
		mergedFrom?: WordCloudDatum[];
		edited?: boolean;
	};
</script>

<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import cloud from 'd3-cloud';
	import { scaleSqrt } from 'd3-scale';
	import {
		forceSimulation,
		forceX,
		forceY,
		forceCollide,
		forceManyBody,
		type Simulation
	} from 'd3-force';

	let {
		words = [],
		width = 900,
		height = 625,
		minFontSize = 10,
		maxFontSize = 32,
		padding = 2,
		angles = [-75, -60, -45, -30, -15, 0, 0, 0, 15, 30, 45, 60, 75, 90, -90],
		fontFamily = "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
		color,
		onpick,
		onchange,
		tooltip,
		seed = 1,
		interactive = true,
		editable = false,
		repelOnDrag = true,
		pinDragged = true,
		collisionPadding = 5,
		centerStrength = 0.03,
		repelStrength = 0,
		autoSize = true,
		sizeBoost = 1,
		cloudShape = 'circle',
		boundaryPadding = 8,
		boundaryStrength = 0.16
	}: {
		words?: WordCloudDatum[];
		width?: number;
		height?: number;
		minFontSize?: number;
		maxFontSize?: number;
		padding?: number;
		angles?: number[];
		fontFamily?: string;
		color?: (d: WordCloudDatum, i: number) => string;
		onpick?: (d: WordCloudDatum) => void;
		/** Fires with the curated word list after every local edit (merge/remove/restore). */
		onchange?: (words: CuratedWord[]) => void;
		/** Per-word tooltip content rendered while the word is hovered/focused. */
		tooltip?: Snippet<[WordCloudDatum]>;
		seed?: number;
		/** Enable drag + force interaction. When false the cloud is static. */
		interactive?: boolean;
		/** Enable the curation layer (drag-to-merge / drag-to-trash, undo). */
		editable?: boolean;
		/** Run the force simulation while dragging so neighbours move out of the way. */
		repelOnDrag?: boolean;
		/** Keep a dragged word pinned where it was dropped (vs. releasing it). */
		pinDragged?: boolean;
		/** Extra space around each word's collision circle (px). */
		collisionPadding?: number;
		/** forceX/forceY strength that gently recentres words during settling. */
		centerStrength?: number;
		/** forceManyBody charge for extra repulsion (negative repels; 0 = off). */
		repelStrength?: number;
		/** Scale font sizes with the visible word count (fewer = bigger). */
		autoSize?: boolean;
		/** Manual font-size multiplier applied on top of auto sizing. */
		sizeBoost?: number;
		/** Boundary the force layout keeps words inside. */
		cloudShape?: CloudShape;
		/** Inset between a word's bounds and the shape edge (px). */
		boundaryPadding?: number;
		/** How firmly the boundary force pushes stray words back inside. */
		boundaryStrength?: number;
	} = $props();

	/** A word in the editable cloud — input datum plus a stable id + provenance. */
	type EditableWord = CuratedWord & { __id: string };

	/** Cloud output: editable word + deterministic position/rotation. */
	type SourceWord = EditableWord & { rotate: number; x: number; y: number };

	/** Force node: a source word plus the live bits d3-force reads/writes. */
	type ForceNode = SourceWord & {
		size: number;
		radius: number;
		vx?: number;
		vy?: number;
		index?: number;
		fx?: number | null;
		fy?: number | null;
	};

	type DropZone = 'merge' | 'trash' | null;

	type Pos = { x: number; y: number };

	type EditAction =
		| { type: 'remove'; word: EditableWord; pos: Pos }
		| { type: 'merge'; merged: EditableWord; sources: EditableWord[]; positions: Pos[] };

	/** A word staged in the merge box (pulled from the cloud, awaiting merge). */
	type StagedWord = { word: EditableWord; pos: Pos };

	// --- Reactive state ----------------------------------------------------
	let placed = $state<PlacedAlias[]>([]);
	let laidOut = $state(false);
	let hoveredId = $state<string | null>(null);
	let draggingId = $state<string | null>(null);
	let svgEl = $state<SVGSVGElement | null>(null);

	// The local, mutable curation set. Seeded from `words` (kept immutable) and
	// never written back to the prop.
	let editableWords = $state<EditableWord[]>([]);
	let removedWords = $state<EditableWord[]>([]);
	let history = $state<EditAction[]>([]);

	// Merge flow: words are staged in a basket as they're dropped on the merge
	// box, then combined when the user clicks the (saturated) Merge button.
	let mergeBasket = $state<StagedWord[]>([]);
	let mergeLabelOpen = $state(false);
	let mergeLabelChoice = $state<string>(''); // a staged word's __id, or '__custom'
	let mergeCustom = $state('');
	let activeDropZone = $state<DropZone>(null);

	type PlacedAlias = ForceNode;

	// d3-cloud output, set when a layout pass finishes. Tracked by the build
	// effect; rebuilt only when the `words` *prop* set changes.
	let source = $state<SourceWord[]>([]);

	// Simulation state lives outside the reactive graph. NB: simNodes is mutated
	// in place (splice/push) so the tick handler's captured reference stays valid.
	let simulation: Simulation<ForceNode, undefined> | null = null;
	let simNodes: ForceNode[] = [];
	// Extra collision padding added by "Clean up" to tease apart overlaps.
	let tidyPad = $state(0);

	// Drop-zone elements, hit-tested against the pointer during a drag.
	let mergeZoneEl = $state<HTMLElement | null>(null);
	let trashZoneEl = $state<HTMLElement | null>(null);

	// Drag bookkeeping for click-vs-drag discrimination.
	let dragNode: ForceNode | null = null;
	let pointerStart: { x: number; y: number } | null = null;
	let didDrag = false;
	let suppressClickId: string | null = null;
	const DRAG_THRESHOLD = 3;

	function mulberry32(s: number): () => number {
		return () => {
			s |= 0;
			s = (s + 0x6d2b79f5) | 0;
			let t = Math.imul(s ^ (s >>> 15), 1 | s);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	function hashWord(text: string, i: number, s: number): number {
		let h = 2166136261 ^ s ^ i;
		for (let n = 0; n < text.length; n++) {
			h ^= text.charCodeAt(n);
			h = Math.imul(h, 16777619);
		}
		return Math.abs(h);
	}

	function angleFor(d: WordCloudDatum, i: number): number {
		if (!angles.length) return 0;
		return angles[hashWord(d.text, i, seed) % angles.length];
	}

	/** Stable id: explicit `id`, else deterministic from seed/index/text. */
	function idFor(d: WordCloudDatum, i: number): string {
		return d.id != null ? String(d.id) : `${seed}:${i}:${d.text}`;
	}

	// Fields that never leave the component on a curated-word emit / mergedFrom.
	const INTERNAL = new Set([
		'__id',
		'x',
		'y',
		'rotate',
		'size',
		'radius',
		'vx',
		'vy',
		'fx',
		'fy',
		'index'
	]);

	/** Strip internal layout fields, keeping text/value/metadata + provenance. */
	function cleanDatum(o: Record<string, unknown>): CuratedWord {
		const r: Record<string, unknown> = {};
		for (const k in o) if (!INTERNAL.has(k)) r[k] = o[k];
		return r as CuratedWord;
	}

	// --- Responsive sizing -------------------------------------------------

	/** Multiplier from the number of visible words: few → larger, many → smaller. */
	function visibleWordCountScale(n: number): number {
		if (n <= 0) return 1;
		const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
		if (n <= 10) return 1.9;
		if (n <= 20) return lerp(1.9, 1.12, (n - 10) / 10);
		if (n <= 40) return lerp(1.12, 1.0, (n - 20) / 20);
		if (n <= 60) return lerp(1.0, 0.82, (n - 40) / 20);
		return 0.82;
	}

	const sizeMultiplier = $derived(
		sizeBoost * (autoSize ? visibleWordCountScale(editableWords.length) : 1)
	);

	const baseSizeScale = $derived.by(() => {
		const vs = editableWords.map((d) => d.value);
		const lo = vs.length ? Math.min(...vs) : 0;
		const hi = vs.length ? Math.max(...vs) : 1;
		return scaleSqrt()
			.domain(lo === hi ? [0, hi || 1] : [lo, hi])
			.range([minFontSize, maxFontSize]);
	});

	function displaySizeFor(value: number): number {
		const base = baseSizeScale(value);
		return Math.max(minFontSize, Math.min(maxFontSize * 2.6, base * sizeMultiplier));
	}

	function radiusFor(size: number, text: string): number {
		return Math.max(size * 0.8, text.length * size * 0.28);
	}

	const wordById = $derived(new Map(editableWords.map((d) => [d.__id, d] as const)));

	// Identity of the *prop* set — d3-cloud reruns only when this changes. Local
	// edits mutate `editableWords`/`simNodes` directly and never touch it.
	const propKey = $derived(words.map((d) => d.text).join(''));

	// --- Source layout (d3-cloud) ------------------------------------------
	$effect(() => {
		void propKey;
		const w = width;
		const h = height;
		const pad = padding;
		const family = fontFamily;
		const layoutSeed = seed;
		void angles;

		const items = untrack(() => words);

		// Reset the curation set whenever the prop changes (never mutate `words`).
		editableWords = items.map((d, i) => ({ ...d, __id: idFor(d, i) }) as EditableWord);
		removedWords = [];
		history = [];
		tidyPad = 0;

		if (!items.length) {
			source = [];
			placed = [];
			laidOut = true;
			return;
		}

		laidOut = false;
		hoveredId = null;
		draggingId = null;
		activeDropZone = null;
		mergeBasket = [];
		mergeLabelOpen = false;

		const layoutWords = untrack(() =>
			editableWords.map((d) => ({ ...d, size: displaySizeFor(d.value) }))
		);

		let cancelled = false;

		const layout = cloud<(typeof layoutWords)[number]>()
			.size([w, h])
			.words(layoutWords)
			.padding((d) => Math.max(1, Math.round(pad + (d.size ?? minFontSize) * 0.05)))
			.rotate((d) => angleFor(d, hashWord(d.text, 0, layoutSeed)))
			.font(family)
			.fontSize((d) => d.size ?? minFontSize)
			.fontWeight((d) => ((d.size ?? 0) > maxFontSize * 0.72 ? 700 : 500))
			.spiral('archimedean')
			.random(mulberry32(layoutSeed))
			.on('end', (out) => {
				if (cancelled) return;
				source = out as unknown as SourceWord[];
				laidOut = true;
			});

		layout.start();

		return () => {
			cancelled = true;
			layout.stop();
		};
	});

	// --- Shape boundary force ----------------------------------------------
	function boundaryForce() {
		let nodes: ForceNode[] = [];
		const force = () => {
			const push = boundaryStrength;
			const pad = boundaryPadding;
			const shape = cloudShape;

			if (shape === 'circle') {
				const limit = Math.min(width, height) / 2;
				for (const n of nodes) {
					const r = Math.min(n.radius + pad, limit * 0.92);
					const R = limit - r;
					if (R <= 0) continue;
					const dist = Math.hypot(n.x, n.y);
					if (dist > R && dist > 0) {
						const over = (dist - R) / dist;
						n.vx = (n.vx ?? 0) - n.x * over * push;
						n.vy = (n.vy ?? 0) - n.y * over * push;
						if (dist > R * 1.3) {
							n.x = (n.x / dist) * R;
							n.y = (n.y / dist) * R;
						}
					}
				}
			} else {
				const halfW = shape === 'wide-rectangle' ? width * 0.45 : Math.min(width, height) / 2;
				const halfH = shape === 'wide-rectangle' ? height * 0.275 : Math.min(width, height) / 2;
				for (const n of nodes) {
					const rx = Math.min(n.radius + pad, halfW * 0.92);
					const ry = Math.min(n.radius + pad, halfH * 0.92);
					const hx = halfW - rx;
					const hy = halfH - ry;
					if (n.x > hx) {
						n.vx = (n.vx ?? 0) - (n.x - hx) * push;
						if (n.x > hx * 1.3) n.x = hx;
					} else if (n.x < -hx) {
						n.vx = (n.vx ?? 0) + (-hx - n.x) * push;
						if (n.x < -hx * 1.3) n.x = -hx;
					}
					if (n.y > hy) {
						n.vy = (n.vy ?? 0) - (n.y - hy) * push;
						if (n.y > hy * 1.3) n.y = hy;
					} else if (n.y < -hy) {
						n.vy = (n.vy ?? 0) + (-hy - n.y) * push;
						if (n.y < -hy * 1.3) n.y = -hy;
					}
				}
			}
		};
		force.initialize = (n: ForceNode[]) => {
			nodes = n;
		};
		return force;
	}

	/** Collision radius accessor — reads `tidyPad` live (re-read on re-init). */
	function collideRadius(d: ForceNode): number {
		return d.radius + collisionPadding + tidyPad;
	}

	/** Re-read radii into the forces (after sizes/padding change) and settle. */
	function reinitAndSettle(alpha = 0.5) {
		if (!simulation) return;
		simulation.nodes(simNodes);
		placed = simNodes.slice();
		simulation.alpha(alpha).alphaTarget(0).restart();
	}

	/** Wake the simulation for a short, self-decaying settle. */
	function settle(alpha = 0.5) {
		simulation?.alpha(alpha).alphaTarget(0).restart();
	}

	// --- Build the simulation from the source layout -----------------------
	$effect(() => {
		const src = source;
		if (!interactive) {
			placed = untrack(() =>
				src.map((s) => {
					const size = displaySizeFor(s.value);
					return { ...s, size, radius: radiusFor(size, s.text) } as ForceNode;
				})
			);
			return;
		}

		const center = centerStrength;
		const repel = repelStrength;
		const useRepel = repelOnDrag;

		if (!src.length) {
			placed = [];
			return;
		}

		const nodes: ForceNode[] = src.map((s) => {
			const size = untrack(() => displaySizeFor(s.value));
			return { ...s, size, radius: radiusFor(size, s.text), vx: 0, vy: 0 };
		});

		const sim = forceSimulation<ForceNode>(nodes)
			.force('x', forceX<ForceNode>(0).strength(center))
			.force('y', forceY<ForceNode>(0).strength(center))
			.force('collide', forceCollide<ForceNode>(collideRadius).iterations(3))
			.force('bounds', boundaryForce())
			.velocityDecay(0.5)
			.alphaDecay(0.06)
			.alphaTarget(0)
			.on('tick', () => {
				placed = nodes.slice();
			})
			.stop();

		if (useRepel && repel) {
			sim.force('charge', forceManyBody<ForceNode>().strength(repel));
		}

		simulation = sim;
		simNodes = nodes;
		placed = nodes.slice();
		sim.alpha(0.7).restart();

		return () => {
			sim.on('tick', null);
			sim.stop();
			if (simulation === sim) {
				simulation = null;
				simNodes = [];
			}
		};
	});

	// --- Re-size in place (no cloud rerun) ---------------------------------
	$effect(() => {
		void sizeMultiplier;
		void minFontSize;
		void maxFontSize;
		const byId = wordById;

		untrack(() => {
			if (simNodes.length) {
				for (const n of simNodes) {
					const d = byId.get(n.__id);
					if (d) Object.assign(n, d);
					n.size = displaySizeFor(n.value);
					n.radius = radiusFor(n.size, n.text);
				}
				// Re-read the new radii into the collision force, then settle.
				reinitAndSettle(0.45);
			} else if (!interactive && source.length) {
				placed = source.map((s) => {
					const size = displaySizeFor(s.value);
					return { ...s, size, radius: radiusFor(size, s.text) } as ForceNode;
				});
			}
		});
	});

	// --- Re-settle on shape change -----------------------------------------
	$effect(() => {
		void cloudShape;
		void width;
		void height;
		untrack(() => {
			if (simNodes.length) settle(0.5);
		});
	});

	// --- Curation actions --------------------------------------------------

	function emitChange() {
		onchange?.(editableWords.map((w) => cleanDatum(w as Record<string, unknown>)));
	}

	function nodeIndex(id: string): number {
		return simNodes.findIndex((n) => n.__id === id);
	}

	/** Drop a word: pull it from the cloud and stash it for undo. */
	function removeWord(node: ForceNode) {
		const idx = nodeIndex(node.__id);
		if (idx < 0) return;
		const word = editableWords.find((w) => w.__id === node.__id);
		simNodes.splice(idx, 1);
		editableWords = editableWords.filter((w) => w.__id !== node.__id);
		if (word) {
			removedWords = [...removedWords, word];
			history = [...history, { type: 'remove', word, pos: { x: node.x, y: node.y } }];
		}
		reinitAndSettle(0.5);
		emitChange();
	}

	/** Add a node + editable word back into the cloud at a position. */
	function addNode(word: EditableWord, pos?: { x: number; y: number }) {
		const size = displaySizeFor(word.value);
		simNodes.push({
			...word,
			rotate: 0,
			x: pos?.x ?? 0,
			y: pos?.y ?? 0,
			size,
			radius: radiusFor(size, word.text),
			vx: 0,
			vy: 0
		});
		editableWords = [...editableWords.filter((w) => w.__id !== word.__id), word];
	}

	/** Pull a word out of the cloud and into the merge box. */
	function stageForMerge(node: ForceNode) {
		const word = editableWords.find((w) => w.__id === node.__id);
		if (!word || mergeBasket.some((s) => s.word.__id === node.__id)) return;
		const idx = nodeIndex(node.__id);
		if (idx >= 0) simNodes.splice(idx, 1);
		editableWords = editableWords.filter((w) => w.__id !== node.__id);
		mergeBasket = [...mergeBasket, { word, pos: { x: node.x, y: node.y } }];
		reinitAndSettle(0.4);
	}

	/** Return one staged word to the cloud. */
	function unstageMerge(id: string) {
		const staged = mergeBasket.find((s) => s.word.__id === id);
		if (!staged) return;
		mergeBasket = mergeBasket.filter((s) => s.word.__id !== id);
		addNode(staged.word, staged.pos);
		reinitAndSettle(0.4);
		if (mergeBasket.length < 2) mergeLabelOpen = false;
	}

	/** Return every staged word to the cloud and close the box. */
	function cancelMerge() {
		for (const s of mergeBasket) addNode(s.word, s.pos);
		mergeBasket = [];
		mergeLabelOpen = false;
		reinitAndSettle(0.5);
	}

	function openMergeLabel() {
		if (mergeBasket.length < 2) return;
		// Default to keeping the largest word's label.
		const largest = mergeBasket.reduce((a, b) => (b.word.value > a.word.value ? b : a));
		mergeLabelChoice = largest.word.__id;
		mergeCustom = '';
		mergeLabelOpen = true;
	}

	/** Combine every staged word into one merged word under the chosen label. */
	function confirmMergeBasket() {
		if (mergeBasket.length < 2) return;
		const words = mergeBasket.map((s) => s.word);
		const value = words.reduce((sum, w) => sum + w.value, 0);

		// Value-weighted sentiment over the words that carry one.
		let sNum = 0;
		let sDen = 0;
		for (const w of words)
			if (w.sentiment != null) {
				sNum += w.sentiment * w.value;
				sDen += w.value;
			}
		const sentiment = sDen ? sNum / sDen : undefined;

		const base = words.find((w) => w.__id === mergeLabelChoice) ?? words[0];
		const label =
			mergeLabelChoice === '__custom' ? mergeCustom.trim() || base.text : base.text;
		const mergedFrom = words.flatMap(
			(w) => w.mergedFrom ?? [cleanDatum(w as Record<string, unknown>)]
		);

		const merged: EditableWord = {
			...cleanDatum(base as Record<string, unknown>),
			__id: `merge:${seed}:${words.map((w) => w.__id).join('+')}`,
			text: label,
			value,
			sentiment,
			mergedFrom,
			edited: true
		};

		const pos = mergeBasket[0].pos;
		const size = displaySizeFor(value);
		simNodes.push({
			...merged,
			rotate: 0,
			x: pos.x,
			y: pos.y,
			size,
			radius: radiusFor(size, label),
			vx: 0,
			vy: 0
		});
		editableWords = [...editableWords, merged];
		history = [
			...history,
			{ type: 'merge', merged, sources: words, positions: mergeBasket.map((s) => s.pos) }
		];

		mergeBasket = [];
		mergeLabelOpen = false;
		mergeCustom = '';
		mergeLabelChoice = '';
		reinitAndSettle(0.6);
		emitChange();
	}

	/** Reverse the most recent edit (merge or remove). */
	export function undo() {
		const last = history[history.length - 1];
		if (!last) return;
		history = history.slice(0, -1);
		if (last.type === 'remove') {
			addNode(last.word, last.pos);
			removedWords = removedWords.filter((w) => w.__id !== last.word.__id);
		} else {
			const idx = nodeIndex(last.merged.__id);
			if (idx >= 0) simNodes.splice(idx, 1);
			editableWords = editableWords.filter((w) => w.__id !== last.merged.__id);
			last.sources.forEach((w, i) => addNode(w, last.positions[i]));
		}
		reinitAndSettle(0.6);
		emitChange();
	}

	/** Put every trashed word back into the cloud. */
	export function restoreRemoved() {
		if (!removedWords.length) return;
		for (const w of removedWords) addNode(w);
		// Drop the corresponding remove actions from the undo history.
		const restored = new Set(removedWords.map((w) => w.__id));
		history = history.filter((a) => a.type !== 'remove' || !restored.has(a.word.__id));
		removedWords = [];
		reinitAndSettle(0.6);
		emitChange();
	}

	/** Nudge collision padding up and re-settle to tease apart any overlaps. */
	export function cleanUp() {
		tidyPad += 3;
		reinitAndSettle(0.85);
	}

	/** Re-seed positions from the computed layout and drop any pins. */
	export function resetToSource() {
		const byId = new Map(source.map((s) => [s.__id, s] as const));
		if (!simNodes.length) {
			placed = source.map((s) => {
				const size = displaySizeFor(s.value);
				return { ...s, size, radius: radiusFor(size, s.text) } as ForceNode;
			});
			return;
		}
		for (const n of simNodes) {
			const s = byId.get(n.__id);
			if (s) {
				n.x = s.x;
				n.y = s.y;
				n.rotate = s.rotate;
			}
			n.vx = 0;
			n.vy = 0;
			n.fx = null;
			n.fy = null;
		}
		tidyPad = 0;
		reinitAndSettle(0.7);
	}

	// --- Merge label helpers ----------------------------------------------
	const mergeValueTotal = $derived(mergeBasket.reduce((sum, s) => sum + s.word.value, 0));
	const mergeResolvedLabel = $derived.by(() => {
		if (mergeLabelChoice === '__custom')
			return mergeCustom.trim() || (mergeBasket[0]?.word.text ?? '');
		return mergeBasket.find((s) => s.word.__id === mergeLabelChoice)?.word.text ?? '';
	});

	// --- Dragging ----------------------------------------------------------

	function toLayoutPoint(clientX: number, clientY: number): { x: number; y: number } | null {
		const ctm = svgEl?.getScreenCTM();
		if (!ctm) return null;
		const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
		return { x: p.x - width / 2, y: p.y - height / 2 };
	}

	/** Which edit drop zone, if any, the pointer is currently over. */
	function zoneAt(clientX: number, clientY: number): DropZone {
		const inside = (el: HTMLElement | null) => {
			if (!el) return false;
			const r = el.getBoundingClientRect();
			return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
		};
		if (inside(mergeZoneEl)) return 'merge';
		if (inside(trashZoneEl)) return 'trash';
		return null;
	}

	function onWordPointerDown(event: PointerEvent, d: PlacedAlias) {
		if (!interactive) return;
		const node = simNodes.find((n) => n.__id === d.__id);
		if (!node) return;

		suppressClickId = null;
		didDrag = false;
		dragNode = node;
		pointerStart = { x: event.clientX, y: event.clientY };
		node.fx = node.x;
		node.fy = node.y;
		// Listen on window for the rest of the gesture so it completes regardless
		// of what's under the pointer or how the cloud re-renders mid-drag (pointer
		// capture on an SVG <text> that re-renders during a settle is unreliable).
		window.addEventListener('pointermove', onWordPointerMove);
		window.addEventListener('pointerup', onWindowPointerUp);
		window.addEventListener('pointercancel', onWindowPointerUp);
	}

	function onWindowPointerUp() {
		window.removeEventListener('pointermove', onWordPointerMove);
		window.removeEventListener('pointerup', onWindowPointerUp);
		window.removeEventListener('pointercancel', onWindowPointerUp);
		onWordPointerUp();
	}

	function onWordPointerMove(event: PointerEvent) {
		if (!dragNode || !pointerStart) return;

		if (!didDrag) {
			const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
			if (moved < DRAG_THRESHOLD) return;
			didDrag = true;
			draggingId = dragNode.__id;
			if (repelOnDrag) simulation?.alphaTarget(0.2).restart();
		}

		const p = toLayoutPoint(event.clientX, event.clientY);
		if (!p) return;
		dragNode.fx = p.x;
		dragNode.fy = p.y;

		if (editable) activeDropZone = zoneAt(event.clientX, event.clientY);

		if (!repelOnDrag) {
			dragNode.x = p.x;
			dragNode.y = p.y;
			placed = simNodes.slice();
		}
	}

	function onWordPointerUp() {
		if (!dragNode) return;
		const node = dragNode;
		const zone = editable ? activeDropZone : null;
		const dragged = didDrag;

		// Reset drag bookkeeping before acting so re-renders see a clean state.
		draggingId = null;
		dragNode = null;
		pointerStart = null;
		didDrag = false;
		activeDropZone = null;

		if (dragged) suppressClickId = node.__id;

		if (dragged && zone === 'trash') {
			removeWord(node);
			return;
		}
		if (dragged && zone === 'merge') {
			stageForMerge(node); // adds to the merge basket
			return;
		}

		if (dragged) {
			if (!pinDragged) {
				node.fx = null;
				node.fy = null;
			}
			if (repelOnDrag) simulation?.alphaTarget(0);
		} else {
			node.fx = null;
			node.fy = null;
		}
	}

	function onWordClick(d: PlacedAlias) {
		if (suppressClickId === d.__id) {
			suppressClickId = null;
			return;
		}
		onpick?.(d);
	}

	// Render order: the dragged word goes last so it paints on top of the rest.
	const renderWords = $derived.by(() => {
		if (draggingId === null) return placed;
		const front = placed.find((d) => d.__id === draggingId);
		if (!front) return placed;
		return [...placed.filter((d) => d.__id !== draggingId), front];
	});

	const valueExtent = $derived.by(() => {
		if (!placed.length) return [0, 1] as const;
		const vs = placed.map((d) => d.value);
		return [Math.min(...vs), Math.max(...vs)] as const;
	});

	function fillFor(d: PlacedAlias, i: number): string {
		if (color) return color(d, i);
		const [lo, hi] = valueExtent;
		const t = hi === lo ? 1 : (d.value - lo) / (hi - lo);
		const opacity = 0.42 + 0.58 * t;
		return `color-mix(in srgb, var(--ink, #1a1a1a) ${Math.round(opacity * 100)}%, transparent)`;
	}

	const HOVER_SCALE = 1.12;

	const hoveredWord = $derived(
		hoveredId !== null ? (placed.find((d) => d.__id === hoveredId) ?? null) : null
	);

	const tooltipPos = $derived.by(() => {
		if (!hoveredWord) return null;
		const xPct = ((width / 2 + hoveredWord.x) / width) * 100;
		const yPct = ((height / 2 + hoveredWord.y) / height) * 100;
		const offsetX = xPct > 55 ? 'calc(-100% - 12px)' : '12px';
		const offsetY = yPct > 60 ? 'calc(-100% - 12px)' : '12px';
		return { xPct, yPct, offsetX, offsetY };
	});

	// The panel shows while dragging (drop targets) and whenever words are staged
	// in the merge basket (so the user can keep adding and then merge).
	const showDropPanel = $derived(editable && (draggingId !== null || mergeBasket.length > 0));
	const mergeReady = $derived(mergeBasket.length >= 2);
</script>

<div class="word-cloud" class:is-empty={!words.length} class:is-hovering={hoveredId !== null}>
	{#if words.length}
		<svg
			bind:this={svgEl}
			{width}
			{height}
			viewBox="0 0 {width} {height}"
			role="img"
			aria-label="Word cloud of {words.length} words"
		>
			<g transform="translate({width / 2}, {height / 2})">
				{#each renderWords as d (d.__id)}
					<g transform="translate({d.x}, {d.y}) rotate({d.rotate})">
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<text
							class="word"
							class:dimmed={hoveredId !== null && hoveredId !== d.__id}
							class:hovered={hoveredId === d.__id}
							class:clickable={!!onpick}
							class:draggable={interactive}
							class:dragging={draggingId === d.__id}
							class:merged={d.edited}
							data-wc-id={d.__id}
							style:font-size="{d.size}px"
							style:transform={hoveredId === d.__id ? `scale(${HOVER_SCALE})` : 'scale(1)'}
							text-anchor="middle"
							dominant-baseline="middle"
							font-family={fontFamily}
							font-weight={(d.size ?? 0) > maxFontSize * 0.72 ? 700 : 500}
							fill={fillFor(d, 0)}
							role={onpick ? 'button' : undefined}
							tabindex={onpick ? 0 : undefined}
							aria-label={onpick ? `${d.text}, ${d.value}` : undefined}
							onmouseenter={() => (hoveredId = d.__id)}
							onmouseleave={() => {
								if (hoveredId === d.__id) hoveredId = null;
							}}
							onfocus={() => (hoveredId = d.__id)}
							onblur={() => {
								if (hoveredId === d.__id) hoveredId = null;
							}}
							onpointerdown={(e) => onWordPointerDown(e, d)}
							onclick={() => onWordClick(d)}
							onkeydown={(e) => {
								if (onpick && (e.key === 'Enter' || e.key === ' ')) {
									e.preventDefault();
									onpick(d);
								}
							}}
						>
							{d.text}
						</text>
					</g>
				{/each}
			</g>
		</svg>

		{#if tooltip && hoveredWord && tooltipPos}
			<div
				class="word-cloud__tooltip"
				style="left: {tooltipPos.xPct}%; top: {tooltipPos.yPct}%; transform: translate({tooltipPos.offsetX}, {tooltipPos.offsetY});"
			>
				{@render tooltip(hoveredWord)}
			</div>
		{/if}

		<!-- Edit drop panel — drop targets while dragging + the merge basket. -->
		{#if showDropPanel}
			<div class="wc-edit-panel">
				<div
					class="wc-zone wc-zone--merge"
					class:active={activeDropZone === 'merge'}
					bind:this={mergeZoneEl}
				>
					<span class="wc-zone__head">
						<span class="wc-zone__icon" aria-hidden="true">⛓</span>
						<span>Merge box</span>
					</span>
					<span class="wc-zone__hint">
						{#if activeDropZone === 'merge'}
							Drop to merge word
						{:else if draggingId !== null}
							Drop words here
						{:else}
							Drag words in to combine
						{/if}
					</span>

					{#if mergeBasket.length}
						<div class="wc-basket">
							{#each mergeBasket as s (s.word.__id)}
								<button
									type="button"
									class="wc-chip"
									title="Remove from merge"
									onclick={() => unstageMerge(s.word.__id)}
								>
									{s.word.text}
									<span class="wc-chip__x" aria-hidden="true">×</span>
								</button>
							{/each}
						</div>
					{/if}

					<div class="wc-merge-actions">
						<button
							type="button"
							class="wc-merge-btn"
							class:ready={mergeReady}
							disabled={!mergeReady}
							onclick={openMergeLabel}
						>
							<span aria-hidden="true">⛓</span>
							Merge{mergeBasket.length ? ` ${mergeBasket.length}` : ''}
						</button>
						{#if mergeBasket.length}
							<button type="button" class="wc-zone__cancel" onclick={cancelMerge}>Cancel</button>
						{/if}
					</div>
				</div>

				{#if draggingId !== null}
					<div
						class="wc-zone wc-zone--trash"
						class:active={activeDropZone === 'trash'}
						bind:this={trashZoneEl}
					>
						<span class="wc-zone__icon" aria-hidden="true">🗑</span>
						<span class="wc-zone__label">
							{activeDropZone === 'trash' ? 'Drop to remove word' : 'Remove'}
						</span>
					</div>
				{/if}
			</div>
		{/if}

		{#if !laidOut}
			<div class="word-cloud__status">Building word cloud…</div>
		{/if}
	{:else}
		<p class="word-cloud__status">No words to show for this selection.</p>
	{/if}

	<!-- Merge label modal -->
	{#if mergeLabelOpen}
		<div
			class="wc-modal-backdrop"
			role="presentation"
			onclick={() => (mergeLabelOpen = false)}
			onkeydown={(e) => {
				if (e.key === 'Escape') mergeLabelOpen = false;
			}}
		>
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div
				class="wc-modal"
				role="dialog"
				aria-modal="true"
				tabindex="-1"
				onclick={(e) => e.stopPropagation()}
			>
				<h3 class="wc-modal__title">Keep which label?</h3>
				<p class="wc-modal__sub">
					Merging {mergeBasket.length} words → combined count
					<strong>{mergeValueTotal}</strong>
				</p>
				<div class="wc-modal__labels">
					{#each mergeBasket as s (s.word.__id)}
						<label>
							<input type="radio" value={s.word.__id} bind:group={mergeLabelChoice} />
							{s.word.text} <span class="wc-modal__count">({s.word.value})</span>
						</label>
					{/each}
					<label>
						<input type="radio" value="__custom" bind:group={mergeLabelChoice} />
						Custom
					</label>
					{#if mergeLabelChoice === '__custom'}
						<input
							class="wc-modal__filter"
							type="text"
							placeholder="Custom label"
							bind:value={mergeCustom}
						/>
					{/if}
				</div>
				<div class="wc-modal__actions">
					<button type="button" class="wc-btn" onclick={() => (mergeLabelOpen = false)}>
						Back
					</button>
					<button type="button" class="wc-btn wc-btn--primary" onclick={confirmMergeBasket}>
						Merge into “{mergeResolvedLabel}”
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.word-cloud {
		position: relative;
		width: 100%;
	}

	.word-cloud.is-empty {
		display: grid;
		place-items: center;
		min-height: 8rem;
	}

	svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
	}

	.word {
		paint-order: stroke;
		transform-box: fill-box;
		transform-origin: center;
		transition:
			font-size 260ms cubic-bezier(0.4, 0, 0.2, 1),
			transform 180ms cubic-bezier(0.4, 0, 0.2, 1),
			opacity 180ms ease,
			filter 180ms ease,
			fill 140ms ease;
	}

	.word.clickable {
		cursor: pointer;
	}

	.word.draggable {
		cursor: grab;
		touch-action: none;
	}

	.word.dragging {
		cursor: grabbing;
		transition: none;
	}

	.word.dimmed {
		opacity: 0.28;
		filter: saturate(0.3);
	}

	.word.hovered {
		opacity: 1;
	}

	.word.merged {
		text-decoration: underline;
		text-decoration-style: dotted;
		text-decoration-color: var(--accent-mint, #4f9d8a);
		text-underline-offset: 3px;
	}

	.word.clickable:focus {
		outline: none;
	}

	.word.clickable:focus-visible {
		outline: 2px solid var(--accent-mint, #4f9d8a);
		outline-offset: 2px;
	}

	.word-cloud__tooltip {
		pointer-events: none;
		position: absolute;
		z-index: 20;
		max-width: 18rem;
		min-width: 9rem;
	}

	.word-cloud__status {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 0.9rem;
		color: var(--muted-foreground, #6b7280);
	}

	.is-empty .word-cloud__status {
		position: static;
		background: none;
	}

	/* Drop panel */
	.wc-edit-panel {
		position: absolute;
		top: 50%;
		right: 0;
		transform: translateY(-50%);
		z-index: 18;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		/* Interactive (Merge button/chips clickable); drag completion is handled by
		   window listeners + rect hit-testing, so this never blocks a drop. */
		pointer-events: auto;
	}

	.wc-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		width: 11rem;
		min-height: 6.5rem;
		padding: 0.6rem;
		border-radius: 0.75rem;
		border: 2px dashed color-mix(in srgb, var(--ink, #1a1a1a) 25%, transparent);
		background: color-mix(in srgb, var(--paper, #fff) 92%, transparent);
		backdrop-filter: blur(2px);
		color: var(--muted-foreground, #6b7280);
		font-size: 0.8rem;
		text-align: center;
		transition:
			border-color 120ms ease,
			background 120ms ease,
			color 120ms ease,
			transform 120ms ease;
	}

	.wc-zone__icon {
		font-size: 1.4rem;
		line-height: 1;
	}

	.wc-zone__head {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 600;
		color: var(--foreground, #1a1a1a);
	}

	.wc-zone__hint {
		font-size: 0.72rem;
		line-height: 1.2;
	}

	.wc-basket {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.25rem;
		max-height: 7rem;
		overflow-y: auto;
	}

	.wc-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.1rem 0.4rem;
		border: 1px solid color-mix(in srgb, var(--accent-mint, #4f9d8a) 45%, transparent);
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent-mint, #4f9d8a) 12%, var(--paper, #fff));
		color: color-mix(in srgb, var(--accent-mint, #4f9d8a) 85%, #000);
		font-size: 0.72rem;
		cursor: pointer;
	}

	.wc-chip__x {
		font-weight: 700;
		opacity: 0.7;
	}

	.wc-chip:hover .wc-chip__x {
		opacity: 1;
	}

	.wc-merge-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.wc-merge-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.7rem;
		border-radius: 0.5rem;
		border: 1px solid color-mix(in srgb, var(--accent-mint, #4f9d8a) 45%, transparent);
		background: color-mix(in srgb, var(--accent-mint, #4f9d8a) 10%, var(--paper, #fff));
		color: color-mix(in srgb, var(--accent-mint, #4f9d8a) 70%, #000);
		font-size: 0.8rem;
		font-weight: 600;
		cursor: not-allowed;
		opacity: 0.5;
		transition:
			background 140ms ease,
			color 140ms ease,
			opacity 140ms ease,
			box-shadow 140ms ease;
	}

	/* Fully saturated + clickable once two or more words are staged. */
	.wc-merge-btn.ready {
		background: var(--accent-mint, #4f9d8a);
		border-color: var(--accent-mint, #4f9d8a);
		color: #fff;
		opacity: 1;
		cursor: pointer;
		box-shadow: 0 1px 6px color-mix(in srgb, var(--accent-mint, #4f9d8a) 40%, transparent);
	}

	.wc-zone__cancel {
		border: none;
		background: transparent;
		color: var(--muted-foreground, #6b7280);
		font-size: 0.72rem;
		cursor: pointer;
		text-decoration: underline;
	}

	.wc-zone--merge.active {
		border-color: var(--accent-mint, #4f9d8a);
		background: color-mix(in srgb, var(--accent-mint, #4f9d8a) 16%, var(--paper, #fff));
		color: color-mix(in srgb, var(--accent-mint, #4f9d8a) 80%, #000);
		transform: scale(1.04);
	}

	.wc-zone--trash.active {
		border-color: #e11d48;
		background: color-mix(in srgb, #e11d48 14%, var(--paper, #fff));
		color: #be123c;
		transform: scale(1.04);
	}

	/* Merge modal */
	.wc-modal-backdrop {
		position: absolute;
		inset: 0;
		z-index: 30;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, #000 28%, transparent);
	}

	.wc-modal {
		width: min(22rem, 92%);
		max-height: 90%;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 1rem;
		border-radius: 0.75rem;
		background: var(--paper, #fff);
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
		color: var(--foreground, #1a1a1a);
	}

	.wc-modal__title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.wc-modal__sub {
		margin: 0;
		font-size: 0.8rem;
		color: var(--muted-foreground, #6b7280);
	}

	.wc-modal__filter {
		width: 100%;
		border: 1px solid color-mix(in srgb, var(--ink, #1a1a1a) 15%, transparent);
		border-radius: 0.375rem;
		padding: 0.4rem 0.6rem;
		font-size: 0.85rem;
	}

	.wc-modal__count {
		font-variant-numeric: tabular-nums;
		color: var(--muted-foreground, #6b7280);
		font-size: 0.75rem;
	}

	.wc-modal__labels {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.85rem;
	}

	.wc-modal__labels label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
	}

	.wc-modal__actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.wc-btn {
		border: 1px solid color-mix(in srgb, var(--ink, #1a1a1a) 15%, transparent);
		background: var(--paper, #fff);
		border-radius: 0.375rem;
		padding: 0.35rem 0.75rem;
		font-size: 0.8rem;
		cursor: pointer;
		color: inherit;
	}

	.wc-btn:hover {
		background: color-mix(in srgb, var(--ink, #1a1a1a) 5%, transparent);
	}

	.wc-btn--primary {
		background: var(--darkgrayblue, #3a4a5a);
		border-color: var(--darkgrayblue, #3a4a5a);
		color: var(--paper, #fff);
	}

	@media (prefers-reduced-motion: reduce) {
		.word,
		.wc-zone {
			transition: fill 140ms ease;
		}
	}
</style>

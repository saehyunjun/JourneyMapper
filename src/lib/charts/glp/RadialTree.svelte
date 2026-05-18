<script lang="ts">
	/**
	 * RadialTree.svelte
	 *
	 * A zoomable, collapsible d3 radial tree. Generic over any TopicTreeNode
	 * hierarchy, so the same component renders the tree scoped to all
	 * interviews, a single question, or a single interviewee — the caller just
	 * passes a differently-filtered `root`.
	 *
	 * Interaction:
	 *   - scroll / drag to zoom and pan
	 *   - click a theme or subtheme to collapse / expand its children
	 *   - hover any node for its count
	 */
	import * as d3 from 'd3';
	import { themePalette, type TopicTreeNode } from '$lib/content/wctglpdemo-data/topicTree';

	type Props = { root: TopicTreeNode; height?: number };
	let { root, height = 760 }: Props = $props();

	type HN = d3.HierarchyPointNode<TopicTreeNode>;

	let wrapEl = $state<HTMLDivElement>();
	let svgEl = $state<SVGSVGElement>();
	let width = $state(900);

	/** Node ids whose children are hidden. Persists across re-renders by id. */
	let collapsed = $state<Set<string>>(new Set());
	let hovered = $state<{ x: number; y: number; node: TopicTreeNode } | null>(null);

	let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | undefined;
	let initialized = false;

	const KIND_LABEL: Record<string, string> = {
		root: 'All themes',
		theme: 'Theme',
		subtheme: 'Subtheme',
		keyword: 'Keyword'
	};
	const NEUTRAL = '#9ca3af';

	const hasChildren = (d: TopicTreeNode) => (d.children?.length ?? 0) > 0;

	/** Internal nodes whose only children are keyword leaves — collapsed by default. */
	function keywordParents(node: TopicTreeNode, acc: string[] = []): string[] {
		if (node.children?.length) {
			if (node.children.every((c) => c.kind === 'keyword')) acc.push(node.id);
			for (const c of node.children) keywordParents(c, acc);
		}
		return acc;
	}

	const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

	// New dataset -> start with the keyword ring tucked away.
	$effect(() => {
		root;
		collapsed = new Set(keywordParents(root));
	});

	function toggle(id: string) {
		const next = new Set(collapsed);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		collapsed = next;
	}

	export function expandAll() {
		collapsed = new Set();
	}
	export function collapseKeywords() {
		collapsed = new Set(keywordParents(root));
	}
	export function resetView() {
		if (svgEl && zoomBehavior) {
			d3.select(svgEl)
				.transition()
				.duration(450)
				.call(zoomBehavior.transform, d3.zoomIdentity);
		}
	}

	$effect(() => {
		// Track the inputs that should trigger a redraw.
		void [root, collapsed, width, height];
		if (svgEl) render();
	});

	function showTip(e: PointerEvent, d: HN) {
		const r = wrapEl?.getBoundingClientRect();
		if (!r) return;
		hovered = { x: e.clientX - r.left, y: e.clientY - r.top, node: d.data };
	}

	function render() {
		const svg = d3.select(svgEl!);
		const cx = width / 2;
		const cy = height / 2;
		const radius = Math.max(140, Math.min(width, height) / 2 - 140);

		if (!initialized) {
			const zoomG = svg.append('g').attr('class', 'zoom');
			const center = zoomG.append('g').attr('class', 'center');
			center.append('g').attr('class', 'links');
			center.append('g').attr('class', 'nodes');
			zoomBehavior = d3
				.zoom<SVGSVGElement, unknown>()
				.scaleExtent([0.35, 6])
				.on('zoom', (e) => zoomG.attr('transform', e.transform.toString()));
			svg.call(zoomBehavior).on('dblclick.zoom', null);
			initialized = true;
		}
		svg.select('g.center').attr('transform', `translate(${cx},${cy})`);

		// --- Layout -------------------------------------------------------
		const hroot = d3.hierarchy<TopicTreeNode>(root, (d) =>
			collapsed.has(d.id) ? undefined : d.children
		);
		const layout = d3
			.tree<TopicTreeNode>()
			.size([2 * Math.PI, radius])
			.separation((a, b) => (a.parent === b.parent ? 1 : 2) / Math.max(a.depth, 1));
		const tree = layout(hroot) as HN;
		// The synthetic root only anchors the layout — it isn't drawn, so the
		// themes themselves form the innermost ring of the tree.
		const nodes = tree.descendants().filter((n) => n.depth > 0);
		const links = tree.links().filter((l) => l.source.depth > 0);

		const maxCount = d3.max(nodes, (n) => (n.depth ? n.data.count : 0)) ?? 1;
		const rScale = d3.scaleSqrt().domain([0, maxCount]).range([3, 13]);
		const linkGen = d3
			.linkRadial<unknown, HN>()
			.angle((d) => d.x)
			.radius((d) => d.y);
		const angleDeg = (x: number) => (x * 180) / Math.PI - 90;
		const color = (d: TopicTreeNode) => themePalette[d.themeId] ?? NEUTRAL;
		const dur = 480;

		// --- Links --------------------------------------------------------
		svg
			.select('g.links')
			.selectAll<SVGPathElement, d3.HierarchyPointLink<TopicTreeNode>>('path')
			.data(links, (d) => d.target.data.id)
			.join(
				(enter) =>
					enter
						.append('path')
						.attr('fill', 'none')
						.attr('stroke', (d) => color(d.target.data))
						.attr('stroke-opacity', 0.35)
						.attr('stroke-width', (d) => Math.max(1, rScale(d.target.data.count) / 3.2))
						.attr('d', linkGen as never)
						.call((e) => e.attr('opacity', 0).transition().duration(dur).attr('opacity', 1)),
				(update) =>
					update.call((u) =>
						u
							.transition()
							.duration(dur)
							.attr('d', linkGen as never)
							.attr('stroke', (d) => color(d.target.data))
					),
				(exit) => exit.call((x) => x.transition().duration(dur / 2).attr('opacity', 0).remove())
			);

		// --- Nodes --------------------------------------------------------
		const node = svg
			.select('g.nodes')
			.selectAll<SVGGElement, HN>('g.node')
			.data(nodes, (d) => d.data.id)
			.join(
				(enter) => {
					const g = enter.append('g').attr('class', 'node').attr('opacity', 0);
					g.append('circle');
					g.append('text');
					return g;
				},
				(update) => update,
				(exit) => exit.call((x) => x.transition().duration(dur / 2).attr('opacity', 0).remove())
			);

		node
			.style('cursor', (d) => (hasChildren(d.data) ? 'pointer' : 'default'))
			.on('click', (_, d) => hasChildren(d.data) && toggle(d.data.id))
			.on('pointerenter', (e, d) => showTip(e as PointerEvent, d))
			.on('pointermove', (e, d) => showTip(e as PointerEvent, d))
			.on('pointerleave', () => (hovered = null));

		node
			.transition()
			.duration(dur)
			.attr('opacity', 1)
			.attr('transform', (d) => `rotate(${angleDeg(d.x)}) translate(${d.y},0)`);

		node
			.select<SVGCircleElement>('circle')
			.attr('r', (d) => rScale(d.data.count))
			.attr('fill', (d) => {
				if (d.data.kind === 'keyword') return color(d.data);
				// Internal node: solid when collapsed, hollow (paper) when expanded.
				return collapsed.has(d.data.id) ? color(d.data) : 'var(--paper)';
			})
			.attr('stroke', (d) => color(d.data))
			.attr('stroke-width', 1.6);

		node
			.select<SVGTextElement>('text')
			.text((d) => trunc(d.data.name, d.data.kind === 'keyword' ? 22 : 30))
			.attr('class', (d) => `lbl lbl-${d.data.kind}`)
			.attr('dy', '0.32em')
			.attr('transform', (d) => (d.x >= Math.PI ? 'rotate(180)' : null))
			.attr('text-anchor', (d) => (d.x >= Math.PI ? 'end' : 'start'))
			.attr('x', (d) => {
				const gap = rScale(d.data.count) + 5;
				return d.x >= Math.PI ? -gap : gap;
			});
	}
</script>

<div class="relative w-full" bind:this={wrapEl} bind:clientWidth={width}>
	<!-- Controls -->
	<div class="absolute right-3 top-3 z-10 flex gap-1.5">
		<button
			type="button"
			class="rounded-md border border-(--ink)/15 bg-(--paper)/90 px-2.5 py-1 text-xs text-foreground shadow-sm transition-colors hover:bg-(--ink)/5"
			onclick={() => expandAll()}
		>
			Expand all
		</button>
		<button
			type="button"
			class="rounded-md border border-(--ink)/15 bg-(--paper)/90 px-2.5 py-1 text-xs text-foreground shadow-sm transition-colors hover:bg-(--ink)/5"
			onclick={() => collapseKeywords()}
		>
			Collapse words
		</button>
		<button
			type="button"
			class="rounded-md border border-(--ink)/15 bg-(--paper)/90 px-2.5 py-1 text-xs text-foreground shadow-sm transition-colors hover:bg-(--ink)/5"
			onclick={() => resetView()}
		>
			Reset view
		</button>
	</div>

	<svg
		bind:this={svgEl}
		{width}
		{height}
		viewBox="0 0 {width} {height}"
		class="block w-full touch-none rounded-xl border border-(--ink)/10 bg-(--panel)"
		role="img"
		aria-label="Radial tree of themes, subthemes, and the keywords used within each"
	></svg>

	{#if hovered}
		<div
			class="pointer-events-none absolute z-20 max-w-56 rounded-md border border-(--ink)/15 bg-(--paper) px-2.5 py-1.5 text-xs shadow-md"
			style="left: {hovered.x + 14}px; top: {hovered.y + 14}px"
		>
			<div class="font-semibold text-foreground">{hovered.node.name}</div>
			<div class="mt-0.5 text-muted-foreground">
				{KIND_LABEL[hovered.node.kind]} ·
				{hovered.node.count}
				{hovered.node.kind === 'keyword' ? 'mention' : 'tagged segment'}{hovered.node.count ===
				1
					? ''
					: 's'}
			</div>
			{#if hovered.node.kind === 'theme' || hovered.node.kind === 'subtheme'}
				<div class="mt-0.5 text-(--ink)/45">Click to expand / collapse</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	svg :global(.lbl) {
		font-family: var(--font-body);
		fill: var(--ink);
		paint-order: stroke;
		stroke: var(--panel);
		stroke-width: 3px;
		stroke-linejoin: round;
	}
	svg :global(.lbl-theme) {
		font-size: 12.5px;
		font-weight: 600;
	}
	svg :global(.lbl-subtheme) {
		font-size: 10.5px;
		fill: var(--gray);
	}
	svg :global(.lbl-keyword) {
		font-size: 9.5px;
		fill: var(--gray);
	}
	svg {
		cursor: grab;
	}
	svg:active {
		cursor: grabbing;
	}
</style>

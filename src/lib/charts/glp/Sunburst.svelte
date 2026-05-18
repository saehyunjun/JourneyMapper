<script lang="ts">
	/**
	 * Sunburst.svelte
	 *
	 * A zoomable d3 sunburst over the same theme -> subtheme -> keyword
	 * hierarchy as RadialTree, but here each arc's angular width encodes
	 * magnitude: a theme's span is the total keyword mentions inside it.
	 *
	 * Click an arc to zoom into that branch; click the centre to zoom back out.
	 * Like RadialTree, it is reusable — the caller passes a differently-filtered
	 * `root` to scope it to a question or an interviewee.
	 */
	import * as d3 from 'd3';
	import { themePalette, type TopicTreeNode } from '$lib/content/wctglpdemo-data/topicTree';

	type Props = { root: TopicTreeNode; size?: number };
	let { root, size = 680 }: Props = $props();

	let wrapEl = $state<HTMLDivElement>();
	let svgEl = $state<SVGSVGElement>();
	let hovered = $state<{ x: number; y: number; name: string; kind: string; value: number } | null>(
		null
	);
	let focus = $state<{ name: string; value: number } | null>(null);

	let zoomToRoot: (() => void) | undefined;
	export function resetView() {
		zoomToRoot?.();
	}

	const KIND_LABEL: Record<string, string> = {
		theme: 'Theme',
		subtheme: 'Subtheme',
		keyword: 'Keyword'
	};

	$effect(() => {
		void [root, size];
		if (svgEl) build();
	});

	function build() {
		const svg = d3.select(svgEl!);
		svg.selectAll('*').remove();

		const radius = size / 6;

		const hierarchy = d3
			.hierarchy<TopicTreeNode>(root)
			// Sized by leaf keyword mentions — arc width = vocabulary volume.
			.sum((d) => (d.kind === 'keyword' ? d.count : 0))
			.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

		const partition = d3.partition<TopicTreeNode>().size([2 * Math.PI, hierarchy.height + 1]);
		const rootNode = partition(hierarchy);
		rootNode.each((d) => ((d as any).current = d));

		const arc = d3
			.arc<any>()
			.startAngle((d) => d.x0)
			.endAngle((d) => d.x1)
			.padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
			.padRadius(radius * 1.5)
			.innerRadius((d) => d.y0 * radius)
			.outerRadius((d) => Math.max(d.y0 * radius, d.y1 * radius - 1));

		const arcVisible = (d: any) => d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
		const labelVisible = (d: any) =>
			d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.05;
		const labelTransform = (d: any) => {
			const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
			const y = ((d.y0 + d.y1) / 2) * radius;
			return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
		};

		const fillFor = (d: any) => {
			const base = themePalette[d.data.themeId] ?? '#9ca3af';
			const c = d3.color(base);
			return c ? (c as d3.HSLColor).brighter((d.depth - 1) * 0.55).formatHex() : base;
		};

		const g = svg.append('g');

		const path = g
			.append('g')
			.selectAll('path')
			.data(rootNode.descendants().slice(1))
			.join('path')
			.attr('fill', (d) => fillFor(d))
			.attr('fill-opacity', (d: any) =>
				arcVisible(d.current) ? (d.children ? 0.88 : 0.62) : 0
			)
			.attr('pointer-events', (d: any) => (arcVisible(d.current) ? 'auto' : 'none'))
			.attr('stroke', 'var(--panel)')
			.attr('stroke-width', 1)
			.attr('d', (d: any) => arc(d.current));

		path
			.filter((d: any) => !!d.children)
			.style('cursor', 'pointer')
			.on('click', (_, d) => clicked(d as any));

		path
			.on('pointerenter', (e, d: any) => showTip(e as PointerEvent, d))
			.on('pointermove', (e, d: any) => showTip(e as PointerEvent, d))
			.on('pointerleave', () => (hovered = null));

		const label = g
			.append('g')
			.attr('pointer-events', 'none')
			.attr('text-anchor', 'middle')
			.style('user-select', 'none')
			.selectAll('text')
			.data(rootNode.descendants().slice(1))
			.join('text')
			.attr('class', (d: any) => `arc-label arc-${d.data.kind}`)
			.attr('dy', '0.32em')
			.attr('fill-opacity', (d: any) => +labelVisible(d.current))
			.attr('transform', (d: any) => labelTransform(d.current))
			.text((d: any) => d.data.name);

		const center = g
			.append('circle')
			.datum(rootNode as any)
			.attr('r', radius)
			.attr('fill', 'var(--paper)')
			.attr('stroke', 'var(--ink)')
			.attr('stroke-opacity', 0.12)
			.attr('pointer-events', 'all')
			.style('cursor', 'pointer')
			.on('click', (_, d) => clicked(d as any));

		function setFocus(p: any) {
			focus =
				p.depth === 0
					? null
					: { name: p.data.name, value: p.value ?? 0 };
		}
		setFocus(rootNode);

		function clicked(p: any) {
			center.datum((p.parent || rootNode) as any);
			setFocus(p);

			rootNode.each(
				(d: any) =>
					(d.target = {
						x0:
							Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
						x1:
							Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
						y0: Math.max(0, d.y0 - p.depth),
						y1: Math.max(0, d.y1 - p.depth)
					})
			);

			const t = g.transition().duration(720);

			path
				.transition(t as any)
				.tween('data', (d: any) => {
					const i = d3.interpolate(d.current, d.target);
					return (tt: number) => (d.current = i(tt));
				})
				.filter(function (d: any) {
					return !!(+(this as Element).getAttribute('fill-opacity')! || arcVisible(d.target));
				})
				.attr('fill-opacity', (d: any) =>
					arcVisible(d.target) ? (d.children ? 0.88 : 0.62) : 0
				)
				.attr('pointer-events', (d: any) => (arcVisible(d.target) ? 'auto' : 'none'))
				.attrTween('d', (d: any) => () => arc(d.current) as string);

			label
				.filter(function (d: any) {
					return !!(+(this as Element).getAttribute('fill-opacity')! || labelVisible(d.target));
				})
				.transition(t as any)
				.attr('fill-opacity', (d: any) => +labelVisible(d.target))
				.attrTween('transform', (d: any) => () => labelTransform(d.current));
		}

		zoomToRoot = () => clicked(rootNode as any);
	}

	function showTip(e: PointerEvent, d: any) {
		const r = wrapEl?.getBoundingClientRect();
		if (!r) return;
		hovered = {
			x: e.clientX - r.left,
			y: e.clientY - r.top,
			name: d.data.name,
			kind: d.data.kind,
			value: d.value ?? 0
		};
	}
</script>

<div class="relative w-full" bind:this={wrapEl}>
	<div class="absolute right-3 top-3 z-10">
		<button
			type="button"
			class="rounded-md border border-(--ink)/15 bg-(--paper)/90 px-2.5 py-1 text-xs text-foreground shadow-sm transition-colors hover:bg-(--ink)/5"
			onclick={() => resetView()}
		>
			Reset view
		</button>
	</div>

	<div class="relative mx-auto" style="max-width: {size}px">
		<svg
			bind:this={svgEl}
			viewBox="{-size / 2} {-size / 2} {size} {size}"
			class="block w-full rounded-xl border border-(--ink)/10 bg-(--panel)"
			role="img"
			aria-label="Zoomable sunburst of themes, subthemes, and the keywords used within each"
		></svg>

		<!-- Centre focus readout -->
		<div
			class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
		>
			<span class="caption uppercase text-(--ink)/45">
				{focus ? 'Focused on' : 'All themes'}
			</span>
			{#if focus}
				<span class="max-w-32 font-heading text-lg leading-tight text-primary">
					{focus.name}
				</span>
				<span class="text-xs text-muted-foreground">{focus.value} mentions</span>
				<span class="mt-0.5 text-[10px] text-(--ink)/40">click centre to zoom out</span>
			{/if}
		</div>
	</div>

	{#if hovered}
		<div
			class="pointer-events-none absolute z-20 max-w-56 rounded-md border border-(--ink)/15 bg-(--paper) px-2.5 py-1.5 text-xs shadow-md"
			style="left: {hovered.x + 14}px; top: {hovered.y + 14}px"
		>
			<div class="font-semibold text-foreground">{hovered.name}</div>
			<div class="mt-0.5 text-muted-foreground">
				{KIND_LABEL[hovered.kind] ?? hovered.kind} · {hovered.value}
				keyword {hovered.value === 1 ? 'mention' : 'mentions'}
			</div>
		</div>
	{/if}
</div>

<style>
	svg :global(.arc-label) {
		font-family: var(--font-body);
		fill: var(--ink);
	}
	svg :global(.arc-theme) {
		font-size: 10px;
		font-weight: 600;
	}
	svg :global(.arc-subtheme) {
		font-size: 8.5px;
	}
	svg :global(.arc-keyword) {
		font-size: 8px;
		fill: var(--gray);
	}
</style>

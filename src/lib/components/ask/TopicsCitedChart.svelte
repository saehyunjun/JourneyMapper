<!--
	TopicsCitedChart — horizontal stacked bars of the codebook subthemes
	(and topic tags, where present) attached to the quotes this answer
	cited. One row per code, one segment per indication so cross-
	indication answers read as side-by-side comparisons without
	rotating long labels off the chart edge.

	The codebook codes are slugs ("trial_barriers"); this chart
	humanizes them ("Trial barriers") on render so the labels stay
	user-facing. Long labels are truncated with ellipsis and the full
	label is preserved in the hover tooltip.
-->
<script lang="ts">
	import BarXStacked from '$lib/charts/BarXStacked.svelte';
	import type { AskCitation } from '$lib/stores/ask-patientlyai.svelte';

	// Inlined — StackSegment is declared inside BarXStacked's instance
	// script (not a <script module>), so it can't be imported across files.
	// Matches the inline definition in IndicationComparisonChart.
	type StackSegment<D> = { key: keyof D; label: string; color: string };

	type Props = {
		citations: AskCitation[];
		indications: string[];
		labelFor: (id: string) => string;
		/** How many top codes to keep on the chart. Beyond ~10 the
		 *  category labels start fighting each other. */
		maxCategories?: number;
	};

	let { citations, indications, labelFor, maxCategories = 8 }: Props = $props();

	// Soft palette per indication — same family as the indication
	// chip in the citations panel so the visual identity carries
	// across panes.
	const INDICATION_PALETTE = ['#6366f1', '#0ea5e9', '#f97316', '#10b981', '#a855f7'];

	function indicationColor(ind: string): string {
		const idx = indications.indexOf(ind);
		return INDICATION_PALETTE[idx >= 0 ? idx % INDICATION_PALETTE.length : 0];
	}

	function humanize(slug: string): string {
		const s = slug.replace(/_/g, ' ').trim();
		if (!s) return slug;
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	const LABEL_MAX = 22;
	function truncate(s: string): string {
		return s.length > LABEL_MAX ? s.slice(0, LABEL_MAX - 1) + '…' : s;
	}

	type Row = Record<string, string | number> & {
		categoryId: string;
		category: string;
		categoryShort: string;
		total: number;
	};

	const rows = $derived.by<Row[]>(() => {
		const codeTotals = new Map<string, number>();
		const cells = new Map<string, number>();
		for (const c of citations) {
			const ind = c.indication ?? indications[0];
			if (!ind) continue;
			const codes = new Set<string>();
			for (const s of c.subthemes ?? []) if (s) codes.add(s);
			for (const t of c.topics ?? []) if (t) codes.add(t);
			for (const code of codes) {
				codeTotals.set(code, (codeTotals.get(code) ?? 0) + 1);
				const key = `${code}|${ind}`;
				cells.set(key, (cells.get(key) ?? 0) + 1);
			}
		}
		const topCodes = Array.from(codeTotals.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, maxCategories)
			.map(([code]) => code);

		return topCodes.map((code) => {
			const full = humanize(code);
			const row: Row = {
				categoryId: code,
				category: full,
				categoryShort: truncate(full),
				total: codeTotals.get(code) ?? 0
			};
			for (const ind of indications) {
				row[ind] = cells.get(`${code}|${ind}`) ?? 0;
			}
			return row;
		});
	});

	const segments = $derived<StackSegment<Row>[]>(
		indications.map((ind) => ({
			key: ind as keyof Row,
			label: labelFor(ind),
			color: indicationColor(ind)
		}))
	);

	const totalCoded = $derived(rows.reduce((acc, r) => acc + Number(r.total), 0));
	const hasAny = $derived(rows.length > 0 && totalCoded > 0);
</script>

{#if hasAny}
	<section class="rounded border border-muted bg-white p-3">
		<div class="flex items-baseline justify-between gap-2">
			<p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
				Topics referenced
			</p>
			<p class="text-[10px] text-muted-foreground">Top codes among cited quotes</p>
		</div>
		<div class="mt-2">
			<BarXStacked
				figure={totalCoded}
				caption="Top codebook codes attached to cited quotes, one row per code"
				data={rows}
				label="categoryShort"
				{segments}
				height={Math.max(160, rows.length * 28 + 64)}
				margin={{ top: 16, right: 36, bottom: 28, left: 132 }}
				sort="none"
				annotate={(d) => `${d.total}`}
				tooltip={(d, seg) => ({
					title: d.category as string,
					meta: seg.label,
					value: Number(d[seg.key]),
					unit: 'cited',
					swatchColor: seg.color,
					extra: `${d.total} total cited`
				})}
			/>
		</div>
	</section>
{/if}

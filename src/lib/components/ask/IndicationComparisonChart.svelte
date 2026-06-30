<!--
	IndicationComparisonChart — sentiment mix by indication.

	Shown in the Ask drawer's visualization pane only when the answer's
	citations span more than one indication. One bar per indication;
	stacked by sentiment band (positive / neutral / negative). Untagged
	citations roll into a quiet grey segment so the bar reflects total
	citation volume per indication, not just the tagged subset.

	Uses the standard $lib/charts/BarXStacked.svelte so the chart language
	matches the rest of the app.
-->
<script lang="ts">
	import BarXStacked from '$lib/charts/BarXStacked.svelte';
	import type { AskCitation } from '$lib/stores/ask-patientlyai.svelte';

	// Inlined — StackSegment is declared inside BarXStacked's instance
	// script (not a <script module>), so it can't be imported across files.
	// Mirroring the shape locally is fine since it's a tiny three-field
	// record and BarXStacked is a stable internal chart.
	type StackSegment<D> = { key: keyof D; label: string; color: string };

	type Props = {
		citations: AskCitation[];
		indications: string[];
		labelFor: (id: string) => string;
		height?: number;
	};

	let { citations, indications, labelFor, height = 220 }: Props = $props();

	type Row = Record<string, string | number> & {
		indication: string;
		label: string;
		positive: number;
		neutral: number;
		negative: number;
		untagged: number;
	};

	const rows = $derived.by<Row[]>(() => {
		const byInd = new Map<string, Row>();
		for (const ind of indications) {
			byInd.set(ind, {
				indication: ind,
				label: labelFor(ind),
				positive: 0,
				neutral: 0,
				negative: 0,
				untagged: 0
			});
		}
		for (const c of citations) {
			const ind = c.indication ?? indications[0];
			let row = byInd.get(ind);
			if (!row) {
				row = {
					indication: ind,
					label: labelFor(ind),
					positive: 0,
					neutral: 0,
					negative: 0,
					untagged: 0
				};
				byInd.set(ind, row);
			}
			if (c.sentiment === null || c.sentiment === undefined) row.untagged += 1;
			else if (c.sentiment > 0) row.positive += 1;
			else if (c.sentiment < 0) row.negative += 1;
			else row.neutral += 1;
		}
		return Array.from(byInd.values()).filter(
			(r) => r.positive + r.neutral + r.negative + r.untagged > 0
		);
	});

	const totalCitations = $derived(citations.length);

	const segments: StackSegment<Row>[] = [
		{ key: 'positive', label: 'Positive', color: '#34d399' },
		{ key: 'neutral', label: 'Neutral', color: '#cbd5e1' },
		{ key: 'negative', label: 'Negative', color: '#fb7185' },
		{ key: 'untagged', label: 'Untagged', color: '#e2e8f0' }
	];
</script>

{#if rows.length > 1}
	<section class="rounded border border-muted bg-white p-3">
		<div class="flex items-baseline justify-between gap-2">
			<p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
				Sentiment by indication
			</p>
			<p class="text-[10px] text-muted-foreground">Cited fragments per indication</p>
		</div>
		<div class="mt-2 -mx-1">
			<BarXStacked
				figure={totalCitations}
				caption="Cited fragments grouped by source indication, stacked by sentiment band"
				data={rows}
				label="label"
				{segments}
				{height}
				margin={{ top: 16, right: 32, bottom: 36, left: 96 }}
				sort="desc"
				annotate={(d) => `${d.positive + d.neutral + d.negative + d.untagged}`}
				tooltip={(d, seg) => ({
					title: d.label,
					meta: seg.label,
					value: Number(d[seg.key]),
					unit: 'cited',
					swatchColor: seg.color,
					extra: `${d.positive + d.neutral + d.negative + d.untagged} total cited`
				})}
			/>
		</div>
	</section>
{/if}

<!--
	StagesCitedChart — radar of journey-stage coverage among the
	cited quotes, one polygon per indication. Quickly reveals which
	stages each indication's voice clusters around, and where they
	overlap or diverge.

	Falls back to a small horizontal bar chart when only one stage
	dimension is in play (a 1- or 2-axis radar is unreadable). Hidden
	entirely when no cited quote has a stage tag.
-->
<script lang="ts">
	import Radar from '$lib/charts/Radar.svelte';
	import BarXStacked from '$lib/charts/BarXStacked.svelte';
	import type { AskCitation } from '$lib/stores/ask-patientlyai.svelte';

	type Props = {
		citations: AskCitation[];
		indications: string[];
		labelFor: (id: string) => string;
		stageLabels: Record<string, string>;
		/** Optional explicit ordering of stage ids — typically the journey's
		 *  natural reading order. Falls back to first-seen order if absent. */
		stageOrder?: string[];
		height?: number;
	};

	let {
		citations,
		indications,
		labelFor,
		stageLabels,
		stageOrder,
		height = 280
	}: Props = $props();

	const INDICATION_PALETTE = ['#6366f1', '#0ea5e9', '#f97316', '#10b981', '#a855f7'];
	function indicationColor(ind: string): string {
		const idx = indications.indexOf(ind);
		return INDICATION_PALETTE[idx >= 0 ? idx % INDICATION_PALETTE.length : 0];
	}

	function stageLabel(id: string): string {
		return stageLabels[id] ?? id.replace(/_/g, ' ');
	}

	type Row = {
		categoryId: string;
		category: string;
		group: string;
		groupId: string;
		value: number;
	};

	// Each cited quote with a stage tag counts toward (stage × indication).
	// A quote tagged with multiple stages contributes to each — the radar
	// reads as "how many cited quotes touch this stage from this indication".
	const stageOrderResolved = $derived.by<string[]>(() => {
		if (stageOrder && stageOrder.length > 0) return stageOrder;
		const seen = new Set<string>();
		const out: string[] = [];
		for (const c of citations) {
			for (const s of c.stages ?? []) {
				if (!seen.has(s.stage_id)) {
					seen.add(s.stage_id);
					out.push(s.stage_id);
				}
			}
		}
		return out;
	});

	const rows = $derived.by<Row[]>(() => {
		const cells = new Map<string, number>(); // key: stage|ind
		for (const c of citations) {
			const ind = c.indication ?? indications[0];
			if (!ind) continue;
			const stages = new Set<string>();
			for (const s of c.stages ?? []) if (s.stage_id) stages.add(s.stage_id);
			for (const stage of stages) {
				cells.set(`${stage}|${ind}`, (cells.get(`${stage}|${ind}`) ?? 0) + 1);
			}
		}
		const out: Row[] = [];
		for (const stage of stageOrderResolved) {
			for (const ind of indications) {
				out.push({
					categoryId: stage,
					category: stageLabel(stage),
					group: labelFor(ind),
					groupId: ind,
					value: cells.get(`${stage}|${ind}`) ?? 0
				});
			}
		}
		return out;
	});

	const totalTouched = $derived(rows.reduce((acc, r) => acc + r.value, 0));
	const stageCount = $derived(stageOrderResolved.length);
	const useRadar = $derived(stageCount >= 3);

	const legend = $derived(
		indications.map((ind) => ({ label: labelFor(ind), color: indicationColor(ind) }))
	);

	// Fallback bar layout: one row per stage, one segment per indication.
	type FallbackRow = Record<string, string | number> & {
		stage: string;
		stageId: string;
	};
	const fallbackData = $derived.by<FallbackRow[]>(() =>
		stageOrderResolved.map((stage) => {
			const r: FallbackRow = { stage: stageLabel(stage), stageId: stage };
			for (const ind of indications) {
				r[ind] = rows.find((x) => x.categoryId === stage && x.groupId === ind)?.value ?? 0;
			}
			return r;
		})
	);
	const fallbackSegments = $derived(
		indications.map((ind) => ({
			key: ind as keyof FallbackRow,
			label: labelFor(ind),
			color: indicationColor(ind)
		}))
	);
</script>

{#if stageCount > 0 && totalTouched > 0}
	<section class="rounded border border-muted bg-white p-3">
		<div class="flex items-baseline justify-between gap-2">
			<p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
				Journey stages cited
			</p>
			<p class="text-[10px] text-muted-foreground">
				{useRadar ? 'Each axis is one journey stage' : 'Quotes per stage'}
			</p>
		</div>
		<div class="mt-2">
			{#if useRadar}
				<Radar
					figure={totalTouched}
					caption="Cited quotes touching each journey stage, one polygon per indication"
					data={rows}
					category="category"
					group="group"
					value="value"
					colorBy={(grp) => {
						const match = rows.find((r) => r.group === grp);
						return match ? indicationColor(match.groupId) : '#94a3b8';
					}}
					{legend}
					{height}
					margin={{ top: 32, right: 96, bottom: 32, left: 96 }}
					tooltip={(d) => ({
						title: String(d.category),
						meta: String(d.group),
						value: Number(d.value),
						unit: 'cited'
					})}
				/>
			{:else}
				<BarXStacked
					figure={totalTouched}
					caption="Cited quotes per journey stage"
					data={fallbackData}
					label="stage"
					segments={fallbackSegments}
					height={Math.max(140, stageCount * 36)}
					margin={{ top: 16, right: 32, bottom: 24, left: 120 }}
					sort="none"
				/>
			{/if}
		</div>
	</section>
{/if}

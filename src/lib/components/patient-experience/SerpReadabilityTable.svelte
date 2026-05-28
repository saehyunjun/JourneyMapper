<!--
	SerpReadabilityTable — editorial-style table replicating Fig. 6 layout.

	Renders SERP results grouped into sections (Advertisements, Organic Content,
	AI Overviews). Each row is one result; cells show reading level, linked
	contact, and searchable-trials status. Ad rows render the data columns as
	blank/greyed; organic rows show Yes/No; AI Overview rows extend with extra
	columns (cited sources, names specific trials, safety disclaimer).

	Data shape: see src/lib/content/patient-experience/serp-readability.json.
-->
<script lang="ts" module>
	export type SectionTone = 'ad' | 'organic' | 'ai';

	export type SerpResult = {
		id: string;
		title: string;
		source: string;
		sourceMarker?: string;
		readingLevel: number | null;
		readingGrade: string | null;
		linkedContact: boolean | null;
		searchableTrials: boolean | null;
		// AI Overview specific (optional)
		citedSources?: number;
		namesSpecificTrials?: boolean;
		safetyDisclaimer?: boolean;
		citesGovEdu?: boolean;
		sourcesMedianYear?: number;
		factualErrorFlagged?: boolean;
		containsCta?: boolean;
	};

	export type SerpSection = {
		id: string;
		label: string;
		tone: SectionTone;
		results: SerpResult[];
	};

	export type SerpFootnote = { marker: string; text: string };

	export type SerpReadabilityData = {
		figureNumber?: number;
		title: string;
		query?: string;
		capturedOn?: string;
		footnotes?: SerpFootnote[];
		sections: SerpSection[];
	};
</script>

<script lang="ts">
	let { data }: { data: SerpReadabilityData } = $props();

	const hasAi = $derived(data.sections.some((s) => s.tone === 'ai'));

	function yesNoLabel(v: boolean | null | undefined): string {
		if (v === true) return 'Yes';
		if (v === false) return 'No';
		return '';
	}

	function yesNoClass(v: boolean | null | undefined): string {
		if (v === true) return 'cell-yes';
		if (v === false) return 'cell-no';
		return 'cell-blank';
	}
</script>

<figure class="serp-table">
	{#if data.figureNumber !== undefined}
		<div class="fig-caption">Fig. {data.figureNumber}</div>
	{/if}
	<h3 class="fig-title">{data.title}</h3>

	<div class="table-frame">
		<table>
			<thead>
				<tr>
					<th class="col-dot" scope="col"></th>
					<th class="col-info" scope="col">Search result general information</th>
					<th class="col-reading" scope="col">Reading level<sup>*</sup></th>
					<th class="col-contact" scope="col">Linked contact</th>
					<th class="col-trials" scope="col">Searchable trials</th>
					{#if hasAi}
						<th class="col-cites" scope="col">Cited sources</th>
						<th class="col-gov" scope="col">Cites .gov/.edu</th>
						<th class="col-year" scope="col">Median source year</th>
						<th class="col-names" scope="col">Names specific trials</th>
						<th class="col-disclaimer" scope="col">Safety disclaimer</th>
						<th class="col-error" scope="col">Factual error<sup>†</sup></th>
						<th class="col-cta" scope="col">Contains CTA</th>
					{/if}
				</tr>
			</thead>

			{#each data.sections as section (section.id)}
				<tbody data-tone={section.tone}>
					{#each section.results as row, i (row.id)}
						<tr>
							<td class="col-dot">
								<span class="dot dot-{section.tone}" aria-hidden="true"></span>
								{#if i === 0}
									<span class="section-label">{section.label}</span>
								{/if}
							</td>
							<td class="col-info">
								<div class="result-title">{row.title}</div>
								<div class="result-source">
									{row.source}{#if row.sourceMarker}<sup>{row.sourceMarker}</sup>{/if}
								</div>
							</td>
							<td class="col-reading">
								{#if row.readingLevel !== null && row.readingLevel !== undefined}
									<div class="reading-score">{row.readingLevel.toFixed(1)}</div>
									{#if row.readingGrade}
										<div class="reading-grade">{row.readingGrade}</div>
									{/if}
								{/if}
							</td>
							<td class={['col-contact', yesNoClass(row.linkedContact)]}>
								{yesNoLabel(row.linkedContact)}
							</td>
							<td class={['col-trials', yesNoClass(row.searchableTrials)]}>
								{yesNoLabel(row.searchableTrials)}
							</td>
							{#if hasAi}
								<td class="col-cites tabular-nums">
									{row.citedSources !== undefined ? row.citedSources : ''}
								</td>
								<td class={['col-gov', yesNoClass(row.citesGovEdu)]}>
									{yesNoLabel(row.citesGovEdu)}
								</td>
								<td class="col-year tabular-nums">
									{row.sourcesMedianYear ?? ''}
								</td>
								<td class={['col-names', yesNoClass(row.namesSpecificTrials)]}>
									{yesNoLabel(row.namesSpecificTrials)}
								</td>
								<td class={['col-disclaimer', yesNoClass(row.safetyDisclaimer)]}>
									{yesNoLabel(row.safetyDisclaimer)}
								</td>
								<!-- Note inversion: a flagged error is BAD, so true → pink, false → green -->
								<td class={['col-error', yesNoClass(row.factualErrorFlagged === undefined ? null : !row.factualErrorFlagged)]}>
									{yesNoLabel(row.factualErrorFlagged)}
								</td>
								<td class={['col-cta', yesNoClass(row.containsCta)]}>
									{yesNoLabel(row.containsCta)}
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			{/each}
		</table>

		<div class="legend">
			<div class="legend-items">
				{#each data.sections as section (section.id)}
					<div class="legend-item">
						<span class="dot dot-{section.tone}" aria-hidden="true"></span>
						<span>{section.label}</span>
					</div>
				{/each}
			</div>
			{#if data.footnotes && data.footnotes.length}
				<div class="footnotes">
					{#each data.footnotes as note}
						<div class="footnote">
							<span class="marker">{note.marker}</span>
							<span class="text">{note.text}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</figure>

<style>
	.serp-table {
		font-family: var(--font-body, "IBM Plex Sans", system-ui, sans-serif);
		color: var(--ink, #312f28);
		margin: 0;
	}
	.fig-caption {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-style: italic;
		font-size: 0.78rem;
		color: var(--ink, #312f28);
		margin-bottom: 0.25rem;
	}
	.fig-title {
		font-family: var(--font-heading-serif, "Spectral", serif);
		font-weight: 600;
		font-size: 1.1rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink, #312f28);
		margin: 0 0 0.6rem 0;
		line-height: 1.2;
	}
	.table-frame {
		border: 0.5px solid var(--ink, #312f28);
		background: #fff;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.78rem;
	}
	thead th {
		text-align: left;
		font-family: var(--font-heading-alt, "Space Grotesk", sans-serif);
		font-weight: 700;
		font-size: 0.66rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink, #312f28);
		background: #ecebe5;
		padding: 0.6rem 0.7rem;
		vertical-align: top;
		border: 0.5px solid var(--ink, #312f28);
		line-height: 1.25;
	}
	thead .col-dot {
		background: transparent;
		border-top: none;
		border-left: none;
		border-bottom: none;
		width: 2.25rem;
	}
	tbody td {
		padding: 0.75rem 0.7rem;
		border: 0.5px solid var(--ink, #312f28);
		vertical-align: middle;
		line-height: 1.35;
	}
	tbody td.col-dot {
		border-left: none;
		background: transparent;
		width: 2.25rem;
		position: relative;
		padding: 0.75rem 0.4rem;
	}
	.dot {
		display: inline-block;
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 50%;
		border: 0.5px solid var(--ink, #312f28);
		vertical-align: middle;
	}
	.dot-ad {
		background: #e0408a;
	}
	.dot-organic {
		background: #d8e2ee;
	}
	.dot-ai {
		background: #c9b8e6;
	}
	.section-label {
		display: none;
	}
	.col-info {
		width: 32%;
	}
	.result-title {
		font-family: var(--font-body);
		font-size: 0.82rem;
		color: var(--ink);
		margin-bottom: 0.2rem;
		line-height: 1.3;
	}
	.result-source {
		font-family: var(--font-heading-alt, "Space Grotesk", sans-serif);
		font-weight: 700;
		font-size: 0.78rem;
		color: var(--ink);
		line-height: 1.3;
	}
	.col-reading {
		width: 11%;
	}
	.reading-score {
		font-family: var(--font-heading-alt);
		font-weight: 700;
		font-size: 0.95rem;
		font-variant-numeric: tabular-nums;
		line-height: 1.1;
	}
	.reading-grade {
		font-size: 0.72rem;
		color: var(--ink);
		opacity: 0.85;
		margin-top: 0.1rem;
	}
	.col-contact,
	.col-trials,
	.col-names,
	.col-disclaimer,
	.col-gov,
	.col-error,
	.col-cta {
		text-align: left;
		font-family: var(--font-heading-alt);
		font-weight: 600;
		font-size: 0.85rem;
	}
	.col-cites,
	.col-year {
		text-align: left;
		font-family: var(--font-heading-alt);
		font-weight: 700;
		font-size: 0.9rem;
		font-variant-numeric: tabular-nums;
	}
	.cell-yes {
		background: #d6ebd9;
	}
	.cell-no {
		background: #ead7e0;
	}
	.cell-blank {
		background: #ecebe5;
		color: transparent;
	}
	/* Ad rows leave reading/contact/trials as greyed empty cells, like the source figure */
	tbody[data-tone='ad'] .col-reading,
	tbody[data-tone='ad'] .col-contact,
	tbody[data-tone='ad'] .col-trials,
	tbody[data-tone='ad'] .col-cites,
	tbody[data-tone='ad'] .col-gov,
	tbody[data-tone='ad'] .col-year,
	tbody[data-tone='ad'] .col-names,
	tbody[data-tone='ad'] .col-disclaimer,
	tbody[data-tone='ad'] .col-error,
	tbody[data-tone='ad'] .col-cta {
		background: #ecebe5;
	}

	.legend {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		gap: 1.5rem;
		padding: 0.85rem 0.9rem;
		border-top: 0.5px solid var(--ink, #312f28);
		background: #fff;
	}
	.legend-items {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.78rem;
	}
	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}
	.footnotes {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.72rem;
		line-height: 1.4;
		color: var(--ink);
	}
	.footnote {
		display: grid;
		grid-template-columns: 1.25rem 1fr;
		gap: 0.25rem;
	}
	.footnote .marker {
		text-align: left;
	}

	@media (max-width: 720px) {
		table {
			font-size: 0.72rem;
		}
		thead th {
			padding: 0.45rem 0.5rem;
		}
		tbody td {
			padding: 0.55rem 0.5rem;
		}
		.legend {
			grid-template-columns: 1fr;
		}
	}
</style>

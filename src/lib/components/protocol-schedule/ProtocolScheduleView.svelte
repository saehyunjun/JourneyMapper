<!--
	ProtocolScheduleView — renders a study's Schedule of Activities as a
	two-row-header, sticky-axes table. Phase A: structural only (no
	persona-driven friction overlay). Clicking a cell emits the selection;
	the parent route owns the drawer.

	Pattern lineage: visual idiom and expansion behavior mirror
	JourneyMapTableView.svelte, but the underlying data shape is a
	procedure × timepoint matrix rather than a stage→step→observation tree.
-->
<script lang="ts">
	import type { LoadedProtocol, Cell, Phase, Procedure, Timepoint } from '$lib/content/protocols/types';
	import type { Persona } from '$lib/content/personas/types';
	import type { FrictionMap, FrictionConsequence } from '$lib/content/protocols/friction-types';
	import { cellKey, CONSEQUENCE_META } from '$lib/content/protocols/friction-types';
	import { frictionBucket } from '$lib/protocols/score-friction';
	import type { CellSelection } from './types';
	import { ChevronRight } from '@lucide/svelte';

	type Props = {
		protocol: LoadedProtocol;
		persona?: Persona | null;
		friction?: FrictionMap;
		onCellClick?: (selection: CellSelection) => void;
		showHeader?: boolean;
	};

	let { protocol, persona = null, friction = {}, onCellClick, showHeader = true }: Props = $props();

	const { meta, schedule, footnotes } = $derived(protocol);

	/** Flat ordered list of timepoints across all phases — for body rows. */
	const allTimepoints = $derived(schedule.phases.flatMap((p) => p.timepoints));

	/** Expansion state. Default: everything open (information-dense first paint). */
	let expandedGroups = $state<Record<string, boolean>>({});

	$effect(() => {
		for (const g of schedule.procedure_groups) {
			if (!(g.id in expandedGroups)) expandedGroups[g.id] = true;
		}
	});

	function toggleGroup(id: string) {
		expandedGroups[id] = !expandedGroups[id];
	}

	function expandAll() {
		for (const g of schedule.procedure_groups) expandedGroups[g.id] = true;
	}
	function collapseAll() {
		for (const g of schedule.procedure_groups) expandedGroups[g.id] = false;
	}

	function cellFor(procedureId: string, timepointId: string): Cell | null {
		return schedule.cells[procedureId]?.[timepointId] ?? null;
	}

	function selectCell(procedure: Procedure, timepoint: Timepoint, phase: Phase) {
		const cell = cellFor(procedure.id, timepoint.id);
		onCellClick?.({ procedure, timepoint, cell, phase_label: phase.label });
	}

	function frictionBucketFor(procedureId: string, timepointId: string): 'none' | 'low' | 'med' | 'high' {
		const f = friction[cellKey(procedureId, timepointId)];
		if (!f) return 'none';
		return frictionBucket(f.score);
	}

	/** Dominant-consequence display meta for a cell's corner tag, or null. */
	function consequenceTagFor(procedureId: string, timepointId: string) {
		const f = friction[cellKey(procedureId, timepointId)];
		if (!f || !f.dominant) return null;
		return CONSEQUENCE_META[f.dominant];
	}

	/** Consequences actually present in the current friction map, sorted for a
	 *  stable legend. Empty when no persona / no friction. */
	const presentConsequences = $derived.by(() => {
		const set = new Set<FrictionConsequence>();
		for (const key of Object.keys(friction)) {
			const d = friction[key].dominant;
			if (d) set.add(d);
		}
		return [...set].sort((a, b) => CONSEQUENCE_META[a].order - CONSEQUENCE_META[b].order);
	});

	function statusGlyph(cell: Cell | null): string {
		if (!cell) return '';
		switch (cell.status) {
			case 'required':
				return '●';
			case 'optional':
				return '○';
			case 'as_needed':
				return '◌';
			case 'conditional':
				return '◆';
		}
	}

	function statusTitle(cell: Cell | null): string {
		if (!cell) return '';
		switch (cell.status) {
			case 'required':
				return 'Required';
			case 'optional':
				return 'Optional';
			case 'as_needed':
				return 'As needed';
			case 'conditional':
				return `Conditional — ${cell.note}`;
		}
	}

	/** Phase tints — pulled from the app's existing palette tokens. Used in the
	 *  phase-group header band, and as a thin top border on each column to keep
	 *  phase boundaries visible as you scroll right. */
	const PHASE_TINT: Record<string, string> = {
		screening: 'var(--lightgrayblue)',
		leukapheresis: 'var(--lightteal)',
		baseline: 'var(--lightgrayblue)',
		ld: 'var(--lightorange)',
		infusion: 'var(--lightorange)',
		follow_up: 'var(--panel)',
		early_term: 'var(--panel-mid)'
	};

	function phaseTint(phaseId: string): string {
		return PHASE_TINT[phaseId] ?? 'var(--panel)';
	}

	const totalProcedures = $derived(
		schedule.procedure_groups.reduce((n, g) => n + g.procedures.length, 0)
	);
	const totalCells = $derived(
		Object.values(schedule.cells).reduce((n, m) => n + Object.keys(m).length, 0)
	);
</script>

<div class="protocol-schedule">
	{#if showHeader}
		<header class="page-header">
			<div class="header-eyebrow">
				<span class="eyebrow-text">Protocol Schedule of Activities</span>
				{#if persona}
					<span class="persona-chip" style="--persona-color: {persona.color ?? '#446079'}">
						<span class="persona-dot"></span>
						<span>{persona.label}</span>
					</span>
				{/if}
			</div>
			<h1 class="header-title">{meta.label}</h1>
			<div class="header-meta">
				<span class="meta-chip">{meta.indication.replace(/_/g, ' ')}</span>
				{#if meta.phase}
					<span>·</span>
					<span>{meta.phase.replace(/_/g, ' ').replace('phase', 'Phase')}</span>
				{/if}
				{#if meta.intervention}
					<span>·</span>
					<span>{meta.intervention}</span>
				{/if}
				<span>·</span>
				<span>{totalProcedures} procedures</span>
				<span>·</span>
				<span>{totalCells} scheduled events</span>
			</div>
			{#if meta.demo_note}
				<p class="demo-note">{meta.demo_note}</p>
			{/if}
		</header>
	{/if}

	<div class="toolbar">
		<div class="legends">
			<div class="legend">
				<span class="legend-label">Status</span>
				<span class="legend-item"><span class="glyph">●</span> Required</span>
				<span class="legend-item"><span class="glyph">○</span> Optional</span>
				<span class="legend-item"><span class="glyph">◌</span> As needed</span>
				<span class="legend-item"><span class="glyph">◆</span> Conditional</span>
			</div>
			{#if persona}
				<div class="legend friction-legend">
					<span class="legend-label">Friction · {persona.label}</span>
					<span class="legend-item"><span class="friction-swatch" data-friction="low"></span> Low</span>
					<span class="legend-item"><span class="friction-swatch" data-friction="med"></span> Medium</span>
					<span class="legend-item"><span class="friction-swatch" data-friction="high"></span> High</span>
				</div>
			{/if}
			{#if persona && presentConsequences.length > 0}
				<div class="legend consequence-legend">
					<span class="legend-label">Risk type</span>
					{#each presentConsequences as c (c)}
						<span class="legend-item">
							<span class="consequence-tag legend-tag" style="color: {CONSEQUENCE_META[c].color}"
								>{CONSEQUENCE_META[c].tag}</span
							>
							{CONSEQUENCE_META[c].label}
						</span>
					{/each}
				</div>
			{/if}
		</div>
		<div class="bulk-controls">
			<button type="button" class="bulk-btn" onclick={expandAll}>Expand all</button>
			<button type="button" class="bulk-btn" onclick={collapseAll}>Collapse all</button>
		</div>
	</div>

	<div class="table-scroll" role="region" aria-label="Schedule of activities table">
		<table class="soa-table">
			<thead>
				<tr class="phase-row">
					<th class="corner-cell" rowspan="2">Procedure</th>
					{#each schedule.phases as phase (phase.id)}
						<th
							class="phase-cell"
							colspan={phase.timepoints.length}
							style="background-color: {phaseTint(phase.id)}"
						>
							<span class="phase-label">{phase.label}</span>
						</th>
					{/each}
				</tr>
				<tr class="timepoint-row">
					{#each allTimepoints as tp (tp.id)}
						<th class="timepoint-cell" scope="col">
							<div class="tp-label">{tp.label}</div>
							{#if tp.window_days}
								<div class="tp-window">{tp.window_days}</div>
							{:else}
								<div class="tp-window tp-window-empty">—</div>
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each schedule.procedure_groups as group (group.id)}
					{@const expanded = !!expandedGroups[group.id]}
					<tr class="group-row" class:expanded>
						<th class="group-cell" colspan={1 + allTimepoints.length} scope="rowgroup">
							<button
								type="button"
								class="group-toggle"
								aria-expanded={expanded}
								onclick={() => toggleGroup(group.id)}
							>
								<ChevronRight
									size={14}
									strokeWidth={2}
									class={expanded ? 'chev chev-rot' : 'chev'}
								/>
								<span class="group-label">{group.label}</span>
								<span class="group-count">{group.procedures.length}</span>
							</button>
						</th>
					</tr>

					{#if expanded}
						{#each group.procedures as proc (proc.id)}
							<tr class="proc-row">
								<th class="proc-cell" scope="row">
									<span class="proc-label">{proc.label}</span>
									{#if proc.footnote_refs.length > 0}
										<span class="proc-footnotes">
											{#each proc.footnote_refs as ref (ref)}
												<sup
													class="footnote-ref"
													title={footnotes[String(ref)] ?? `Footnote ${ref}`}
												>{ref}</sup>
											{/each}
										</span>
									{/if}
								</th>
								{#each schedule.phases as phase (phase.id)}
									{#each phase.timepoints as tp (tp.id)}
										{@const cell = cellFor(proc.id, tp.id)}
										{@const fb = frictionBucketFor(proc.id, tp.id)}
										{@const tag = consequenceTagFor(proc.id, tp.id)}
										<td
											class="data-cell"
											class:has-cell={cell !== null}
											data-status={cell?.status ?? 'empty'}
											data-friction={fb}
										>
											<button
												type="button"
												class="cell-btn"
												title={statusTitle(cell)}
												aria-label={`${proc.label} at ${tp.label}: ${statusTitle(cell) || 'not scheduled'}`}
												onclick={() => selectCell(proc, tp, phase)}
											>
												<span class="glyph">{statusGlyph(cell)}</span>
												{#if cell?.status === 'conditional'}
													<span class="cell-note">{cell.note.length > 14 ? cell.note.slice(0, 14) + '…' : cell.note}</span>
												{/if}
											</button>
											{#if tag}
												<span class="consequence-tag" style="color: {tag.color}">{tag.tag}</span>
											{/if}
										</td>
									{/each}
								{/each}
							</tr>
						{/each}
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.protocol-schedule {
		display: flex;
		flex-direction: column;
		gap: 16px;
		font-family: var(--font-body);
		color: var(--ink);
	}

	/* -------- Header -------- */
	.page-header {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 16px 20px 12px;
		border-bottom: 1px solid var(--panel-mid);
	}
	.header-eyebrow {
		display: flex;
		align-items: center;
		gap: 12px;
		font-family: var(--font-heading-alt);
		font-size: 11px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--grayblue);
	}
	.persona-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 2px 8px;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--persona-color) 12%, white);
		color: var(--ink);
		text-transform: none;
		letter-spacing: 0;
		font-family: var(--font-body);
		font-size: 12px;
	}
	.persona-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--persona-color);
	}
	.header-title {
		font-family: var(--font-heading-serif);
		font-size: 24px;
		line-height: 1.2;
		margin: 0;
	}
	.header-meta {
		display: flex;
		gap: 8px;
		font-size: 12px;
		color: var(--gray);
	}
	.meta-chip {
		padding: 1px 8px;
		border-radius: var(--radius-full);
		background: var(--panel);
		color: var(--ink);
		text-transform: capitalize;
	}
	.demo-note {
		margin: 8px 0 0;
		padding: 8px 10px;
		font-size: 12px;
		color: var(--grayblue);
		background: var(--lightgrayblue);
		border-left: 2px solid var(--midgrayblue);
		border-radius: 2px;
	}

	/* -------- Toolbar -------- */
	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 20px;
		gap: 16px;
		flex-wrap: wrap;
	}
	.legends {
		display: flex;
		gap: 24px;
		align-items: center;
		flex-wrap: wrap;
	}
	.legend {
		display: flex;
		gap: 12px;
		font-size: 12px;
		color: var(--gray);
		align-items: center;
	}
	.legend-label {
		font-family: var(--font-heading-alt);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--grayblue);
	}
	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.legend-item .glyph {
		font-size: 14px;
		color: var(--ink);
	}
	.friction-swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}
	.friction-swatch[data-friction='low'] {
		background: color-mix(in srgb, var(--orange) 16%, white);
	}
	.friction-swatch[data-friction='med'] {
		background: color-mix(in srgb, var(--orange) 38%, white);
	}
	.friction-swatch[data-friction='high'] {
		background: color-mix(in srgb, var(--orange) 64%, white);
	}
	.bulk-controls {
		display: flex;
		gap: 6px;
	}
	.bulk-btn {
		font-family: var(--font-body);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 4px 10px;
		border: 1px solid var(--panel-mid);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--grayblue);
		cursor: pointer;
	}
	.bulk-btn:hover {
		background: var(--panel);
	}

	/* -------- Table -------- */
	.table-scroll {
		overflow: auto;
		max-height: calc(100vh - 220px);
		border-top: 1px solid var(--panel-mid);
		border-bottom: 1px solid var(--panel-mid);
		background: var(--paper);
	}

	.soa-table {
		border-collapse: separate;
		border-spacing: 0;
		font-size: 12px;
		min-width: 100%;
	}

	thead th {
		position: sticky;
		top: 0;
		background: white;
		z-index: 3;
	}
	thead tr.timepoint-row th {
		top: 32px;
	}

	.corner-cell {
		position: sticky;
		left: 0;
		top: 0;
		z-index: 5;
		background: white;
		border-bottom: 1px solid var(--panel-mid);
		border-right: 1px solid var(--panel-mid);
		text-align: left;
		padding: 8px 12px;
		min-width: 240px;
		font-family: var(--font-heading-alt);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--grayblue);
	}

	.phase-cell {
		border-bottom: 1px solid var(--panel-mid);
		border-right: 1px solid var(--panel-mid);
		padding: 6px 8px;
		font-family: var(--font-heading-alt);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink);
		text-align: center;
		white-space: nowrap;
		height: 32px;
	}
	.phase-cell:last-child {
		border-right: 1px solid var(--panel-mid);
	}

	.timepoint-cell {
		background: white;
		border-bottom: 1px solid var(--panel-mid);
		border-right: 1px solid var(--panel-dark);
		padding: 4px 6px;
		text-align: center;
		font-size: 11px;
		min-width: 56px;
		height: 40px;
	}
	.tp-label {
		font-family: var(--font-heading-alt);
		font-weight: 500;
		color: var(--ink);
	}
	.tp-window {
		font-size: 10px;
		color: var(--gray);
		font-family: var(--font-mono);
	}
	.tp-window-empty {
		color: var(--panel-mid);
	}

	/* -------- Body rows -------- */
	.group-row {
		background: var(--panel);
	}
	.group-cell {
		position: sticky;
		left: 0;
		padding: 0;
		border-bottom: 1px solid var(--panel-mid);
		text-align: left;
	}
	.group-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 12px;
		background: transparent;
		border: none;
		font-family: var(--font-heading-alt);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--darkgrayblue);
		cursor: pointer;
		text-align: left;
	}
	.group-toggle:hover {
		background: var(--panel-mid);
	}
	.group-count {
		margin-left: auto;
		font-size: 10px;
		color: var(--gray);
		font-family: var(--font-mono);
	}
	:global(.chev) {
		transition: transform 0.15s ease;
		color: var(--grayblue);
	}
	:global(.chev-rot) {
		transform: rotate(90deg);
	}

	.proc-row:hover .proc-cell {
		background: var(--lightgrayblue);
	}
	.proc-cell {
		position: sticky;
		left: 0;
		background: white;
		border-bottom: 1px solid var(--panel);
		border-right: 1px solid var(--panel-mid);
		padding: 6px 12px 6px 28px;
		text-align: left;
		font-weight: 400;
		min-width: 240px;
		max-width: 240px;
		font-size: 12px;
		color: var(--ink);
		z-index: 1;
	}
	.proc-label {
		display: inline;
	}
	.proc-footnotes {
		margin-left: 4px;
	}
	.footnote-ref {
		font-size: 9px;
		color: var(--grayblue);
		cursor: help;
	}

	.data-cell {
		position: relative;
		border-bottom: 1px solid var(--panel);
		border-right: 1px solid var(--panel);
		padding: 0;
		text-align: center;
		height: 28px;
		min-width: 56px;
		transition: background 0.18s ease;
	}
	/* Dominant-consequence code, top-right corner. pointer-events:none so the
	 * whole cell stays clickable through it. */
	.consequence-tag {
		position: absolute;
		top: 1px;
		right: 2px;
		font-family: var(--font-mono);
		font-size: 8px;
		font-weight: 600;
		line-height: 1;
		letter-spacing: 0.02em;
		pointer-events: none;
	}
	.legend-tag {
		position: static;
		font-size: 10px;
	}
	.data-cell:hover {
		background: var(--lightgrayblue);
	}
	.data-cell[data-friction='low'].has-cell {
		background: color-mix(in srgb, var(--orange) 14%, transparent);
	}
	.data-cell[data-friction='med'].has-cell {
		background: color-mix(in srgb, var(--orange) 32%, transparent);
	}
	.data-cell[data-friction='high'].has-cell {
		background: color-mix(in srgb, var(--orange) 56%, transparent);
	}
	.data-cell[data-friction='low'].has-cell:hover,
	.data-cell[data-friction='med'].has-cell:hover,
	.data-cell[data-friction='high'].has-cell:hover {
		filter: brightness(1.05);
	}
	.cell-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		width: 100%;
		height: 100%;
		padding: 0;
		background: transparent;
		border: none;
		font-family: var(--font-body);
		font-size: 13px;
		cursor: pointer;
		color: var(--ink);
	}
	.cell-btn:hover {
		background: color-mix(in srgb, var(--midgrayblue) 15%, transparent);
	}

	.data-cell[data-status='required'] .glyph {
		color: var(--ink);
	}
	.data-cell[data-status='optional'] .glyph {
		color: var(--grayblue);
	}
	.data-cell[data-status='as_needed'] .glyph {
		color: var(--midgrayblue);
	}
	.data-cell[data-status='conditional'] .glyph {
		color: var(--orange);
	}
	.cell-note {
		font-size: 9px;
		color: var(--gray);
		font-family: var(--font-mono);
	}

	/* Phase column-group divider: thicker right border on the last column of each phase. */
	.phase-cell {
		border-right: 2px solid var(--panel-mid);
	}
</style>

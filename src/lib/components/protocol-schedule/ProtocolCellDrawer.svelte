<!--
	ProtocolCellDrawer — opens when a cell in ProtocolScheduleView is
	clicked. Renders structural detail (phase, timepoint, status, footnotes)
	plus the persona-driven friction breakdown: which rules fired, the
	asserted persona attributes each rule reads, and the suggested protocol
	modifications attached to each rule.

	Receipts (supporting fragments) are a follow-up — `evidence_fragment_ids`
	is wired through but not yet rendered.
-->
<script lang="ts">
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import { ArrowRight } from '@lucide/svelte';
	import type { CellSelection } from './types';
	import type { FootnoteMap } from '$lib/content/protocols/types';
	import type { Persona } from '$lib/content/personas/types';
	import type { FrictionRule, FrictionMap } from '$lib/content/protocols/friction-types';
	import { cellKey, formatAttrValue, CONSEQUENCE_META } from '$lib/content/protocols/friction-types';
	import { frictionBucket } from '$lib/protocols/score-friction';

	type Props = {
		open: boolean;
		selection: CellSelection | null;
		footnotes: FootnoteMap;
		persona?: Persona | null;
		rules?: FrictionRule[];
		friction?: FrictionMap;
	};

	let {
		open = $bindable(false),
		selection,
		footnotes,
		persona = null,
		rules = [],
		friction = {}
	}: Props = $props();

	const statusLabel = $derived.by(() => {
		const cell = selection?.cell;
		if (!cell) return 'Not scheduled';
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
	});

	const resolvedFootnotes = $derived(
		selection?.procedure.footnote_refs.map((ref) => ({
			ref,
			text: footnotes[String(ref)] ?? `Footnote ${ref} — text not provided`
		})) ?? []
	);

	const ruleById = $derived(new Map(rules.map((r) => [r.id, r])));

	const cellFriction = $derived.by(() => {
		if (!selection) return null;
		const key = cellKey(selection.procedure.id, selection.timepoint.id);
		return friction[key] ?? null;
	});

	const firedRules = $derived(
		cellFriction
			? cellFriction.fired_rule_ids
					.map((id) => ruleById.get(id))
					.filter((r): r is FrictionRule => !!r)
			: []
	);

	const frictionBand = $derived.by(() => {
		if (!cellFriction) return null;
		return frictionBucket(cellFriction.score);
	});

	const frictionPct = $derived.by(() => {
		if (!cellFriction) return 0;
		return Math.round(cellFriction.score * 100);
	});

	function attrFor(rule: FrictionRule) {
		const key = rule.persona_predicate.attr;
		const v = persona?.demo_profile?.attrs[key];
		return v ? { key, value: formatAttrValue(v) } : null;
	}
</script>

<RightDrawer bind:open>
	{#if selection}
		<div class="drawer-body">
			<header class="drawer-header">
				<div class="eyebrow">
					{selection.phase_label} · {selection.timepoint.label}
					{#if selection.timepoint.window_days}
						<span class="window">window {selection.timepoint.window_days}</span>
					{/if}
				</div>
				<h2 class="title">{selection.procedure.label}</h2>
				<div class="header-pills">
					<span class="status-pill" data-status={selection.cell?.status ?? 'empty'}>{statusLabel}</span>
					{#if frictionBand && frictionBand !== 'none'}
						<span class="friction-pill" data-friction={frictionBand}>
							{frictionPct}% friction · {firedRules.length}
							{firedRules.length === 1 ? 'rule' : 'rules'}
						</span>
					{/if}
					{#if cellFriction?.dominant}
						<span
							class="consequence-pill"
							style="--c: {CONSEQUENCE_META[cellFriction.dominant].color}"
							>{CONSEQUENCE_META[cellFriction.dominant].label}</span
						>
					{/if}
				</div>
			</header>

			{#if firedRules.length > 0 && persona}
				<section class="section">
					<h3 class="section-title">
						Why this is hard for
						<span class="persona-name" style="--persona-color: {persona.color ?? '#446079'}"
							>{persona.label}</span
						>
					</h3>
					<ul class="rule-list">
						{#each firedRules as rule (rule.id)}
							{@const attr = attrFor(rule)}
							<li class="rule-item">
								<div class="rule-head">
									<span class="rule-weight">+{Math.round(rule.weight * 100)}%</span>
									<span class="rule-label">{rule.label}</span>
									<span
										class="rule-consequence"
										style="--c: {CONSEQUENCE_META[rule.consequence].color}"
										>{CONSEQUENCE_META[rule.consequence].label}</span
									>
								</div>
								<p class="rule-desc">{rule.description}</p>
								{#if attr}
									<div class="rule-attr">
										<span class="attr-key">{attr.key.replace(/_/g, ' ')}</span>
										<ArrowRight size={11} strokeWidth={2} />
										<span class="attr-value">{attr.value}</span>
										<span class="attr-source">(asserted, demo)</span>
									</div>
								{/if}
								{#if rule.suggested_mods.length > 0}
									<div class="mod-list">
										<div class="mod-list-label">Suggested protocol modification{rule.suggested_mods.length === 1 ? '' : 's'}</div>
										<ul>
											{#each rule.suggested_mods as mod (mod.id)}
												<li class="mod-item">
													<div class="mod-label">{mod.label}</div>
													<div class="mod-rationale">{mod.rationale}</div>
												</li>
											{/each}
										</ul>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{:else if cellFriction === null && persona && persona.demo_profile}
				<section class="section section-quiet">
					<h3 class="section-title">No friction for {persona.label} here</h3>
					<p class="quiet-body">
						None of the {rules.length} active rules apply to this procedure × timepoint × persona
						combination. Cells like this read as "low-burden by design" for the selected persona.
					</p>
				</section>
			{:else if !persona}
				<section class="section section-quiet">
					<h3 class="section-title">Apply a persona to see friction</h3>
					<p class="quiet-body">
						Pick a persona on the left to score this cell against persona-attribute logistics
						(distance, caregiving, work flexibility, etc.).
					</p>
				</section>
			{:else if !persona.demo_profile}
				<section class="section section-quiet">
					<h3 class="section-title">{persona.label} has no demo profile yet</h3>
					<p class="quiet-body">
						This persona doesn't define a <code>demo_profile</code> block, so friction rules have
						nothing to read. Add one to the persona JSON to enable scoring.
					</p>
				</section>
			{/if}

			{#if resolvedFootnotes.length > 0}
				<section class="section">
					<h3 class="section-title">Source footnotes</h3>
					<ul class="footnote-list">
						{#each resolvedFootnotes as fn (fn.ref)}
							<li class="footnote-item">
								<sup>{fn.ref}</sup>
								<span>{fn.text}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if selection.procedure.burden_hint}
				<section class="section section-quiet">
					<h3 class="section-title">Procedure burden</h3>
					<div class="burden-grid">
						<div><span class="burden-key">setting</span><span class="burden-val">{selection.procedure.burden_hint.setting.replace(/_/g, ' ')}</span></div>
						{#if selection.procedure.burden_hint.duration_minutes}
							<div><span class="burden-key">duration</span><span class="burden-val">{selection.procedure.burden_hint.duration_minutes} min</span></div>
						{/if}
						{#if selection.procedure.burden_hint.fasting_required}
							<div><span class="burden-key">fasting</span><span class="burden-val">required</span></div>
						{/if}
						{#if selection.procedure.burden_hint.caregiver_required}
							<div><span class="burden-key">caregiver</span><span class="burden-val">required</span></div>
						{/if}
						{#if selection.procedure.burden_hint.specialist_required}
							<div><span class="burden-key">specialist</span><span class="burden-val">required</span></div>
						{/if}
					</div>
				</section>
			{/if}
		</div>
	{/if}
</RightDrawer>

<style>
	.drawer-body {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 24px 20px 40px;
		font-family: var(--font-body);
		color: var(--ink);
	}

	.drawer-header {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.eyebrow {
		display: flex;
		gap: 8px;
		align-items: center;
		font-family: var(--font-heading-alt);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--grayblue);
	}
	.window {
		font-family: var(--font-mono);
		color: var(--gray);
		text-transform: none;
		letter-spacing: 0;
	}
	.title {
		margin: 0;
		font-family: var(--font-heading-serif);
		font-size: 22px;
		line-height: 1.25;
	}
	.header-pills {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.status-pill,
	.friction-pill {
		display: inline-block;
		padding: 3px 10px;
		border-radius: var(--radius-full);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-family: var(--font-heading-alt);
	}
	.status-pill[data-status='required'] {
		background: color-mix(in srgb, var(--ink) 12%, white);
		color: var(--ink);
	}
	.status-pill[data-status='optional'] {
		background: var(--lightgrayblue);
		color: var(--grayblue);
	}
	.status-pill[data-status='as_needed'] {
		background: color-mix(in srgb, var(--midgrayblue) 22%, white);
		color: var(--darkgrayblue);
	}
	.status-pill[data-status='conditional'] {
		background: var(--lightorange);
		color: var(--orange);
	}
	.status-pill[data-status='empty'] {
		background: var(--panel);
		color: var(--gray);
	}
	.friction-pill[data-friction='low'] {
		background: color-mix(in srgb, var(--orange) 18%, white);
		color: var(--orange);
	}
	.friction-pill[data-friction='med'] {
		background: color-mix(in srgb, var(--orange) 38%, white);
		color: color-mix(in srgb, var(--orange) 80%, black);
	}
	.friction-pill[data-friction='high'] {
		background: var(--orange);
		color: white;
	}
	/* Consequence chips — full-perimeter tinted pill (no side rail; honors the
	 * rounded-rect rule). --c is the consequence palette token. */
	.consequence-pill {
		display: inline-block;
		padding: 3px 10px;
		border-radius: var(--radius-full);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-family: var(--font-heading-alt);
		color: var(--c);
		background: color-mix(in srgb, var(--c) 12%, white);
	}
	.rule-consequence {
		margin-left: auto;
		align-self: center;
		padding: 2px 7px;
		border-radius: var(--radius-full);
		font-family: var(--font-heading-alt);
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--c);
		background: color-mix(in srgb, var(--c) 12%, white);
		white-space: nowrap;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.section-title {
		margin: 0;
		font-family: var(--font-heading-alt);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--grayblue);
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.persona-name {
		color: var(--persona-color);
		text-transform: none;
		letter-spacing: 0;
		font-family: var(--font-body);
	}

	.section-quiet {
		padding: 12px;
		background: var(--panel);
		border-radius: var(--radius-sm);
		border-left: 2px solid var(--midgrayblue);
	}
	.quiet-body {
		margin: 0;
		font-size: 12px;
		color: var(--gray);
		line-height: 1.5;
	}
	.quiet-body code {
		font-family: var(--font-mono);
		font-size: 11px;
		background: white;
		padding: 1px 4px;
		border-radius: 2px;
	}

	/* -------- Rule list -------- */
	.rule-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.rule-item {
		padding: 12px;
		background: white;
		border: 1px solid var(--panel-mid);
		border-left: 3px solid var(--orange);
		border-radius: var(--radius-sm);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.rule-head {
		display: flex;
		gap: 8px;
		align-items: baseline;
	}
	.rule-weight {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--orange);
		font-weight: 500;
	}
	.rule-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--ink);
		line-height: 1.3;
	}
	.rule-desc {
		margin: 0;
		font-size: 12px;
		color: var(--gray);
		line-height: 1.5;
	}
	.rule-attr {
		display: flex;
		gap: 6px;
		align-items: center;
		font-size: 11px;
		color: var(--grayblue);
		padding: 4px 8px;
		background: var(--lightgrayblue);
		border-radius: var(--radius-sm);
		width: fit-content;
	}
	.attr-key {
		font-family: var(--font-mono);
	}
	.attr-value {
		font-family: var(--font-mono);
		color: var(--ink);
		font-weight: 500;
	}
	.attr-source {
		color: var(--gray);
	}

	.mod-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-top: 8px;
		border-top: 1px dashed var(--panel-mid);
	}
	.mod-list-label {
		font-family: var(--font-heading-alt);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--grayblue);
	}
	.mod-list ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.mod-item {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding-left: 14px;
		position: relative;
	}
	.mod-item::before {
		content: '→';
		position: absolute;
		left: 0;
		top: 0;
		color: var(--teal);
		font-weight: 500;
	}
	.mod-label {
		font-size: 12px;
		color: var(--ink);
		font-weight: 500;
		line-height: 1.35;
	}
	.mod-rationale {
		font-size: 11px;
		color: var(--gray);
		line-height: 1.45;
	}

	/* -------- Footnotes -------- */
	.footnote-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.footnote-item {
		display: flex;
		gap: 6px;
		font-size: 12px;
		line-height: 1.45;
		color: var(--ink);
	}
	.footnote-item sup {
		color: var(--grayblue);
		font-size: 10px;
		min-width: 14px;
	}

	/* -------- Burden grid -------- */
	.burden-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px 16px;
		font-size: 12px;
	}
	.burden-grid > div {
		display: flex;
		gap: 6px;
		align-items: baseline;
	}
	.burden-key {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--grayblue);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.burden-val {
		color: var(--ink);
	}
</style>

<script lang="ts">
	import ProtocolScheduleView from '$lib/components/protocol-schedule/ProtocolScheduleView.svelte';
	import ProtocolCellDrawer from '$lib/components/protocol-schedule/ProtocolCellDrawer.svelte';
	import type { CellSelection } from '$lib/components/protocol-schedule/types';
	import { scoreSchedule } from '$lib/protocols/score-friction';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const protocol = $derived(data.protocol);
	const applicable_personas = $derived(data.applicable_personas);

	// Default to the first persona that actually has a demo_profile so the
	// friction overlay is visible on first paint. Falls back to the first
	// applicable persona, then to "no persona."
	const defaultPersonaId =
		data.applicable_personas.find((p) => p.demo_profile)?.id ??
		data.applicable_personas[0]?.id ??
		null;

	let selectedPersonaId = $state<string | null>(defaultPersonaId);
	const selectedPersona = $derived(
		applicable_personas.find((p) => p.id === selectedPersonaId) ?? null
	);

	const friction = $derived(
		scoreSchedule(protocol.schedule, selectedPersona?.demo_profile ?? null, protocol.rules)
	);

	let drawerOpen = $state(false);
	let activeSelection = $state<CellSelection | null>(null);

	function handleCellClick(selection: CellSelection) {
		activeSelection = selection;
		drawerOpen = true;
	}
</script>

<svelte:head>
	<title>{protocol.meta.short_label ?? protocol.meta.label} — sim protocol</title>
</svelte:head>

<div class="sim-protocol-page">
	<aside class="persona-rail">
		<div class="rail-section">
			<h3 class="rail-title">Apply persona</h3>
			<p class="rail-help">
				Selecting a persona re-scores every scheduled cell against this protocol. Hot cells indicate
				where the persona's attributes (distance, caregiving, work flexibility, …) collide with
				the procedure's logistical burden. Click any cell for the breakdown.
			</p>
			{#if applicable_personas.length === 0}
				<p class="rail-empty">
					No personas registered for indication
					<code>{protocol.meta.indication}</code>.
				</p>
			{:else}
				<ul class="persona-list">
					<li>
						<button
							type="button"
							class="persona-btn"
							class:active={selectedPersonaId === null}
							onclick={() => (selectedPersonaId = null)}
						>
							<span class="persona-dot persona-dot-empty"></span>
							<span class="persona-name">No persona — structural view</span>
						</button>
					</li>
					{#each applicable_personas as p (p.id)}
						<li>
							<button
								type="button"
								class="persona-btn"
								class:active={selectedPersonaId === p.id}
								onclick={() => (selectedPersonaId = p.id)}
							>
								<span
									class="persona-dot"
									style="background-color: {p.color ?? '#446079'}"
								></span>
								<div class="persona-meta">
									<span class="persona-name">{p.label}</span>
									{#if p.description}
										<span class="persona-desc">{p.description}</span>
									{/if}
								</div>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</aside>

	<main class="schedule-main">
		<ProtocolScheduleView
			{protocol}
			persona={selectedPersona}
			{friction}
			onCellClick={handleCellClick}
		/>
	</main>

	<ProtocolCellDrawer
		bind:open={drawerOpen}
		selection={activeSelection}
		footnotes={protocol.footnotes}
		persona={selectedPersona}
		rules={protocol.rules}
		{friction}
	/>
</div>

<style>
	.sim-protocol-page {
		display: grid;
		grid-template-columns: 280px 1fr;
		min-height: calc(100vh - 60px);
		background: var(--paper);
		font-family: var(--font-body);
	}

	.persona-rail {
		border-right: 1px solid var(--panel-mid);
		background: white;
		padding: 24px 16px;
		overflow-y: auto;
	}
	.rail-title {
		margin: 0 0 6px;
		font-family: var(--font-heading-alt);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--grayblue);
	}
	.rail-help {
		margin: 0 0 16px;
		font-size: 11px;
		color: var(--gray);
		line-height: 1.5;
	}
	.rail-empty {
		font-size: 12px;
		color: var(--gray);
	}
	.rail-empty code {
		font-family: var(--font-mono);
		background: var(--panel);
		padding: 1px 4px;
		border-radius: 2px;
	}

	.persona-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.persona-btn {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		width: 100%;
		padding: 8px 10px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		text-align: left;
		cursor: pointer;
		color: var(--ink);
	}
	.persona-btn:hover {
		background: var(--lightgrayblue);
	}
	.persona-btn.active {
		background: var(--lightgrayblue);
		border-color: var(--midgrayblue);
	}
	.persona-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
		margin-top: 4px;
	}
	.persona-dot-empty {
		background: transparent;
		border: 1px dashed var(--gray);
	}
	.persona-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.persona-name {
		font-size: 12px;
		font-weight: 500;
		color: var(--ink);
	}
	.persona-desc {
		font-size: 11px;
		color: var(--gray);
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.schedule-main {
		min-width: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
</style>

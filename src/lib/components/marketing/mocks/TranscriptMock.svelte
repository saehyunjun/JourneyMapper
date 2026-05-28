<script lang="ts">
	import DashboardTag from '../DashboardTag.svelte';

	const segments = [
		{
			speaker: 'P-014',
			text: 'I waited about eight months before anyone actually used the word trial with me.',
			tags: [
				{ label: 'Stage', value: 'Awareness', color: 'green' as const },
				{ label: 'Emotion', value: 'Frustration', color: 'orange' as const }
			]
		},
		{
			speaker: 'P-014',
			text: 'My rheumatologist mentioned it once and then we moved on. I had to bring it back up at the next visit.',
			tags: [
				{ label: 'Subtheme', value: 'Provider trust', color: 'blue' as const },
				{ label: 'Emotion', value: 'Ambivalence', color: 'amber' as const }
			]
		},
		{
			speaker: 'P-014',
			text: 'The travel was the part I kept stuck on. Two hours each way, every two weeks.',
			tags: [
				{ label: 'Stage', value: 'Decision', color: 'amber' as const },
				{ label: 'Friction', value: 'Travel burden', color: 'orange' as const }
			]
		},
		{
			speaker: 'P-014',
			text: 'When my daughter offered to drive me, that changed everything.',
			tags: [
				{ label: 'Subtheme', value: 'Caregiver role', color: 'green' as const },
				{ label: 'Emotion', value: 'Relief', color: 'green' as const }
			]
		}
	];
</script>

<div class="mock">
	<div class="mock-head">
		<div class="mock-filters">
			<DashboardTag label="Transcript" value="P-014" color="green" size="sm" />
			<DashboardTag label="Codebook" value="LN.v3.1" color="neutral" size="sm" />
			<DashboardTag label="Pass" value="Autotag → Review" color="amber" size="sm" />
		</div>
		<span class="mock-meta">14 / 38 segments reviewed</span>
	</div>

	<div class="split">
		<div class="transcript">
			{#each segments as seg, i}
				<div class="segment" class:active={i === 2}>
					<div class="seg-marker">
						<span class="seg-num">{(i + 1).toString().padStart(3, '0')}</span>
						<span class="seg-speaker">{seg.speaker}</span>
					</div>
					<p>{seg.text}</p>
					<div class="seg-tags">
						{#each seg.tags as t}
							<DashboardTag label={t.label} value={t.value} color={t.color} size="sm" />
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<aside class="drawer">
			<div class="drawer-head">
				<DashboardTag label="Open" value="003" color="amber" size="sm" />
				<span class="drawer-meta">Segment 003</span>
			</div>

			<div class="drawer-section">
				<span class="drawer-label">Quote</span>
				<p class="drawer-quote">"The travel was the part I kept stuck on. Two hours each way, every two weeks."</p>
			</div>

			<div class="drawer-section">
				<span class="drawer-label">Proposed</span>
				<div class="drawer-tags">
					<DashboardTag label="Stage" value="Decision" color="amber" size="sm" />
					<DashboardTag label="Subtheme" value="Travel burden" color="orange" size="sm" />
					<DashboardTag label="Emotion" value="Hesitation" color="amber" size="sm" />
				</div>
			</div>

			<div class="drawer-section">
				<span class="drawer-label">Codebook match</span>
				<div class="drawer-match">
					<span class="match-bar"><span style="width: 84%"></span></span>
					<span class="match-pct">0.84</span>
				</div>
			</div>

			<div class="drawer-actions">
				<button class="btn primary">Accept</button>
				<button class="btn">Edit</button>
				<button class="btn ghost">Skip</button>
			</div>
		</aside>
	</div>
</div>

<style>
	.mock {
		display: grid;
		gap: 1.4rem;
	}

	.mock-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.mock-filters {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.mock-meta {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.4);
	}

	.split {
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
		gap: 1rem;
	}

	.transcript {
		display: grid;
		gap: 0.6rem;
	}

	.segment {
		padding: 0.85rem 0.95rem;
		background: rgba(232, 233, 235, 0.025);
		border: 1px solid rgba(232, 233, 235, 0.07);
		border-radius: 6px;
		transition: border-color 200ms ease, background 200ms ease;
	}

	.segment.active {
		border-color: rgba(212, 169, 58, 0.45);
		background: rgba(212, 169, 58, 0.06);
	}

	.seg-marker {
		display: flex;
		gap: 0.7rem;
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.4);
		margin-bottom: 0.5rem;
	}

	.seg-speaker {
		color: rgba(232, 233, 235, 0.7);
	}

	.segment p {
		font-family: var(--font-body);
		font-size: 0.92rem;
		line-height: 1.55;
		color: rgba(232, 233, 235, 0.86);
		margin-bottom: 0.65rem;
	}

	.seg-tags {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.drawer {
		display: grid;
		align-content: start;
		gap: 1rem;
		padding: 1rem;
		background: rgba(232, 233, 235, 0.03);
		border: 1px solid rgba(232, 233, 235, 0.08);
		border-radius: 6px;
	}

	.drawer-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.drawer-meta {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.4);
	}

	.drawer-section {
		display: grid;
		gap: 0.4rem;
	}

	.drawer-label {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.4);
	}

	.drawer-quote {
		font-family: var(--font-heading-serif);
		font-size: 0.96rem;
		line-height: 1.45;
		color: rgba(232, 233, 235, 0.88);
	}

	.drawer-tags {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.drawer-match {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.match-bar {
		flex: 1;
		height: 4px;
		background: rgba(232, 233, 235, 0.1);
		border-radius: 2px;
		overflow: hidden;
	}

	.match-bar span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, #7DBFA7, #D4A93A);
		border-radius: 2px;
	}

	.match-pct {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		color: rgba(232, 233, 235, 0.78);
	}

	.drawer-actions {
		display: flex;
		gap: 0.35rem;
		margin-top: 0.3rem;
	}

	.btn {
		flex: 1;
		padding: 0.5rem 0.6rem;
		border-radius: 4px;
		border: 1px solid rgba(232, 233, 235, 0.14);
		background: transparent;
		color: rgba(232, 233, 235, 0.85);
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.btn.primary {
		background: rgba(125, 191, 167, 0.16);
		border-color: rgba(125, 191, 167, 0.4);
		color: #B5E5D2;
	}

	.btn.ghost {
		opacity: 0.5;
	}

	@media (max-width: 760px) {
		.split {
			grid-template-columns: 1fr;
		}
	}
</style>

<script lang="ts">
	import DashboardTag from '../DashboardTag.svelte';

	const stages = ['Awareness', 'Decision', 'Participation', 'Follow-up'];

	function seededRandom(seed: number) {
		const x = Math.sin(seed) * 10000;
		return x - Math.floor(x);
	}

	const dots = Array.from({ length: 96 }, (_, i) => {
		const stageIdx = Math.floor(seededRandom(i + 1) * 4);
		const stage = stageIdx;
		const jitterY = (seededRandom(i + 100) - 0.5) * 0.75;
		const localX = (seededRandom(i + 200) - 0.5) * 0.18;
		const stageColors = ['#7DBFA7', '#D4A93A', '#FF8341', '#6a99c2'];
		return {
			x: ((stage + 0.5) / 4) * 100 + localX * 100,
			y: 50 + jitterY * 90,
			r: 2 + seededRandom(i + 300) * 4,
			color: stageColors[stage],
			opacity: 0.45 + seededRandom(i + 400) * 0.55
		};
	});

	const focusDot = { x: 26, y: 38, r: 7 };
</script>

<div class="mock">
	<div class="mock-head">
		<div class="mock-filters">
			<DashboardTag label="Persona" value="Curious patient" color="amber" size="sm" />
			<DashboardTag label="Sentiment" value="−1.0 to +1.0" color="neutral" size="sm" />
			<DashboardTag label="Sources" value="3 corpora" color="neutral" size="sm" />
			<DashboardTag label="Role" value="Patient" color="blue" size="sm" />
		</div>
		<span class="mock-meta">96 visible / 248 total</span>
	</div>

	<div class="canvas">
		<div class="axis">
			{#each stages as label, i}
				<span class="axis-label" style="left: {((i + 0.5) / 4) * 100}%">{label}</span>
			{/each}
		</div>

		<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="bees">
			{#each [25, 50, 75] as gx}
				<line x1={gx} y1="6" x2={gx} y2="94" stroke="rgba(232,233,235,0.06)" stroke-width="0.15" />
			{/each}

			{#each dots as d}
				<circle
					cx={d.x}
					cy={d.y}
					r={d.r * 0.4}
					fill={d.color}
					opacity={d.opacity}
				/>
			{/each}

			<circle
				cx={focusDot.x}
				cy={focusDot.y}
				r={focusDot.r * 0.4}
				fill="none"
				stroke="#E8E9EB"
				stroke-width="0.4"
			/>
			<line
				x1={focusDot.x + 3}
				y1={focusDot.y - 1}
				x2="60"
				y2="22"
				stroke="rgba(232,233,235,0.4)"
				stroke-width="0.25"
				stroke-dasharray="1 1"
			/>
		</svg>

		<div class="callout" style="left: 60%; top: 18%">
			<DashboardTag label="Fragment" value="F-0182" color="green" size="sm" />
			<p>"I didn't realize my fatigue was tied to flare cycles until my third visit."</p>
			<span class="callout-meta">Speaker 14 · Awareness · −0.31</span>
		</div>
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

	.canvas {
		position: relative;
		aspect-ratio: 16 / 7;
		min-height: 16rem;
		border-radius: 6px;
		background:
			linear-gradient(180deg, rgba(232, 233, 235, 0.02), transparent),
			rgba(0, 0, 0, 0.18);
		border: 1px solid rgba(232, 233, 235, 0.06);
		overflow: hidden;
	}

	.bees {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.axis {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0.6rem;
		height: 1.5rem;
		pointer-events: none;
	}

	.axis-label {
		position: absolute;
		transform: translateX(-50%);
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.4);
	}

	.callout {
		position: absolute;
		display: grid;
		gap: 0.4rem;
		padding: 0.7rem 0.85rem;
		max-width: 16rem;
		background: rgba(11, 14, 20, 0.92);
		border: 1px solid rgba(232, 233, 235, 0.16);
		border-radius: 6px;
	}

	.callout p {
		font-family: var(--font-body);
		font-size: 0.84rem;
		line-height: 1.45;
		color: rgba(232, 233, 235, 0.88);
	}

	.callout-meta {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		color: rgba(232, 233, 235, 0.46);
	}
</style>

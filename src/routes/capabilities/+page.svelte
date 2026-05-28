<script lang="ts">
	import {
		Route,
		Workflow,
		Tags,
		Users,
		LineChart,
		Sparkles,
		GitBranch,
		Clock,
		ArrowRightLeft,
		Layers,
		FileText,
		Network,
		ArrowRight
	} from '@lucide/svelte';
	import DashboardTag from '$lib/components/marketing/DashboardTag.svelte';
	import CapabilityTile from '$lib/components/marketing/CapabilityTile.svelte';
	import MarketingHeader from '$lib/components/marketing/MarketingHeader.svelte';

	const capabilities = [
		{
			tagLabel: 'Mode',
			tagValue: 'Synthesis',
			tagColor: 'green' as const,
			icon: Route,
			title: 'Journey Map',
			description:
				'A per-indication, per-persona view of the patient experience — Awareness, Decision, Participation, and the moments inside each — synthesized from interviews, social listening, and search. Every stage carries its evidence; every emotion is traceable to a quote.',
			href: '/capabilities/journey-map'
		},
		{
			tagLabel: 'Mode',
			tagValue: 'Exploration',
			tagColor: 'amber' as const,
			icon: Workflow,
			title: 'Journey Workbench',
			description:
				'A persona-scoped beeswarm of every fragment in the study, filterable by stage, sentiment, subtheme, and speaker role. Click any moment to open the speaker, the quote, the annotation, and the lens that surfaced it.',
			href: '/capabilities/journey-workbench'
		},
		{
			tagLabel: 'Mode',
			tagValue: 'Pipeline',
			tagColor: 'orange' as const,
			icon: Tags,
			title: 'Transcription Autotagging',
			description:
				'Upload transcripts; PatientlyIQ proposes segment-level codes — theme, subtheme, Plutchik-grounded emotion, and journey stage — against a project-specific codebook. Analysts review, accept, or override; the codebook tightens with use.',
			href: '/capabilities/transcription-autotagging'
		},
		{
			tagLabel: 'Mode',
			tagValue: 'Lens',
			tagColor: 'blue' as const,
			icon: Users,
			title: 'Personas',
			description:
				'In PatientlyIQ a persona is a filter over the patient evidence, not an avatar. Every persona resolves to the moments that match: the speakers, the quotes, the theme distribution, the stage profile. Drop one into any view as the active lens, or compare two side by side.',
			href: '/capabilities/personas'
		},
		{
			tagLabel: 'Mode',
			tagValue: 'Signal',
			tagColor: 'red' as const,
			icon: LineChart,
			title: 'Digital Data',
			description:
				'The qualitative read sits next to external signal — search volumes, community engagement, ad spend, the clinical-trial landscape, lexicon clusters — scoped to the active indication. Patient voice and patient behavior in the same view.',
			href: '/capabilities/digital-data'
		}
	];

	const onDeck = [
		{
			icon: Sparkles,
			name: 'Persona Builder UI',
			blurb: 'Author and fork personas inline with live match-count preview — no JSON round-trip.'
		},
		{
			icon: GitBranch,
			name: 'Evidence-driven journey stages',
			blurb:
				'Derive the stage taxonomy for a new indication from the evidence itself, not from clinical intuition.'
		},
		{
			icon: Clock,
			name: 'Sentiment & volume over time',
			blurb:
				'CAR-T in 2022 vs 2026; GLP-1s across the obesity uptake curve. Side-by-side with the quotes that explain the shift.'
		},
		{
			icon: ArrowRightLeft,
			name: 'Cross-indication comparison',
			blurb:
				'How lupus patients frame CAR-T vs how MS patients frame it. Same mechanism, different audience.'
		},
		{
			icon: Layers,
			name: 'Borrowed baselines',
			blurb:
				'When primary research has not been fielded, an indication-similarity model proposes travel tolerance, washout fear, and caregiver dependency from the most-similar diseases — with confidence and source chains.'
		},
		{
			icon: FileText,
			name: 'Content briefs from information gaps',
			blurb:
				'Every "my doctor never told me X" moment aggregates into a ranked content backlog, voiced in real patient phrasing.'
		},
		{
			icon: Network,
			name: 'Idea Graph Explorer',
			blurb:
				'The same evidence as a force-directed network — ask which barriers cluster together across diseases, not only what sits underneath a finding.'
		}
	];

	const audiences = [
		{
			tagColor: 'green' as const,
			tagValue: 'Pre-lock',
			title: 'Protocol design & CRO teams',
			detail: 'Pressure-test whether the study is patient-executable before lock.'
		},
		{
			tagColor: 'amber' as const,
			tagValue: 'In-flight',
			title: 'Study-rescue teams',
			detail:
				'Diagnose why patients are not enrolling, staying, or complying — beyond what site or media data alone can show.'
		},
		{
			tagColor: 'orange' as const,
			tagValue: 'Pre-launch',
			title: 'Commercial pre-launch',
			detail:
				'Patient-tested positioning, message development, and journey strategy grounded in how patients actually think, decide, and persist.'
		}
	];
</script>

<svelte:head>
	<title>PatientlyIQ — Capabilities</title>
	<meta
		name="description"
		content="PatientlyIQ converts patient voice into structured evidence — about burden, motivation, trust, and decision friction — so sponsors can optimize protocols, rescue underperforming studies, and prepare for commercialization."
	/>
</svelte:head>

<main class="page">
	<div class="ambient" aria-hidden="true"></div>
	<div class="grid-wash" aria-hidden="true"></div>

	<MarketingHeader />

	<section class="hero">
		<div class="hero-meta">
			<DashboardTag label="System" value="PatientlyIQ" color="green" size="sm" />
			<DashboardTag label="Build" value="v0.6.2026" color="neutral" size="sm" />
		</div>

		<h1 class="hero-title">
			Convert patient voice into <span class="hero-emph">structured evidence</span>.
		</h1>

		<p class="hero-lede">
			PatientlyIQ helps sponsors optimize protocols, rescue underperforming studies,
			and prepare for commercialization by turning interviews, social listening, and
			search data into evidence teams can act on.
		</p>

		<div class="hero-actions">
			<a class="cta-primary" href="/patientlyiq">
				Request demo
				<ArrowRight size={14} strokeWidth={2} />
			</a>
			<a class="cta-secondary" href="/patientlyiq/journey">See an example journey</a>
		</div>

		<div class="hero-readout" aria-hidden="true">
			<div class="readout-row">
				<span class="readout-label">Corpora</span>
				<span class="readout-value">12</span>
				<span class="readout-axis">indications</span>
			</div>
			<div class="readout-row">
				<span class="readout-label">Fragments</span>
				<span class="readout-value">38,420</span>
				<span class="readout-axis">tagged</span>
			</div>
			<div class="readout-row">
				<span class="readout-label">Personas</span>
				<span class="readout-value">47</span>
				<span class="readout-axis">active filters</span>
			</div>
		</div>
	</section>

	<section class="block">
		<div class="block-head">
			<DashboardTag label="Section" value="01 / Capabilities" color="neutral" size="sm" />
			<h2>Five capabilities. One source of evidence.</h2>
			<p class="block-lede">
				Each capability is a different way to interrogate the same fragment-level
				evidence — synthesis, exploration, pipeline, lens, and external signal.
			</p>
		</div>

		<div class="tile-grid">
			{#each capabilities as cap}
				<CapabilityTile
					tagLabel={cap.tagLabel}
					tagValue={cap.tagValue}
					tagColor={cap.tagColor}
					title={cap.title}
					description={cap.description}
					icon={cap.icon}
					href={cap.href}
				/>
			{/each}

			<article class="tile-fill" aria-hidden="true">
				<div class="fill-grid">
					<span></span><span></span><span></span><span></span>
					<span></span><span></span><span></span><span></span>
					<span></span><span></span><span></span><span></span>
				</div>
				<span class="fill-mark">PIQ</span>
			</article>
		</div>
	</section>

	<section class="block">
		<div class="block-head">
			<DashboardTag label="Section" value="02 / Roadmap" color="amber" size="sm" />
			<h2>What we are building next.</h2>
			<p class="block-lede">
				The roadmap extends the same five capabilities — deeper authoring tools for
				personas, evidence-derived journeys, time- and audience-axis comparisons.
			</p>
		</div>

		<div class="deck">
			{#each onDeck as item, i}
				{@const Icon = item.icon}
				<div class="deck-row">
					<span class="deck-index">{String(i + 1).padStart(2, '0')}</span>
					<span class="deck-icon" aria-hidden="true">
						<Icon size={16} strokeWidth={1.5} />
					</span>
					<span class="deck-name">{item.name}</span>
					<span class="deck-blurb">{item.blurb}</span>
				</div>
			{/each}
		</div>
	</section>

	<section class="block">
		<div class="block-head">
			<DashboardTag label="Section" value="03 / Audiences" color="orange" size="sm" />
			<h2>Three teams. Three moments in the study lifecycle.</h2>
		</div>

		<div class="audience-grid">
			{#each audiences as a}
				<div class="audience">
					<DashboardTag label="Stage" value={a.tagValue} color={a.tagColor} size="sm" />
					<h3>{a.title}</h3>
					<p>{a.detail}</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="cta-block">
		<div class="cta-inner">
			<DashboardTag label="System" value="Ready" color="green" size="sm" />
			<h2>Patient voices in. Sharper decisions out.</h2>
			<div class="hero-actions">
				<a class="cta-primary" href="/patientlyiq">
					Request demo
					<ArrowRight size={14} strokeWidth={2} />
				</a>
				<a class="cta-secondary" href="/patientlyiq/key-findings">Explore the platform</a>
			</div>
		</div>
	</section>

	<footer class="foot">
		<div class="foot-row">
			<span class="foot-mark">PatientlyIQ</span>
			<span class="foot-meta">Patient voices → evidence · 2026</span>
		</div>
	</footer>
</main>

<style>
	:global(body) {
		background: #0b0e14;
	}

	.page {
		position: relative;
		min-height: 100vh;
		color: rgba(232, 233, 235, 0.92);
		background: #0b0e14;
		overflow: clip;
	}

	.ambient {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			radial-gradient(ellipse 50% 30% at 50% 12%, rgba(255, 131, 65, 0.08), transparent 70%),
			radial-gradient(ellipse 40% 40% at 80% 70%, rgba(106, 153, 194, 0.06), transparent 70%);
	}

	.grid-wash {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background-image:
			linear-gradient(rgba(232, 233, 235, 0.025) 1px, transparent 1px),
			linear-gradient(90deg, rgba(232, 233, 235, 0.025) 1px, transparent 1px);
		background-size: 64px 64px;
		mask-image: radial-gradient(ellipse 80% 80% at 50% 30%, black, transparent 80%);
	}

	/* ───── Hero ───── */
	.hero {
		position: relative;
		z-index: 2;
		max-width: 1180px;
		margin: 0 auto;
		padding: clamp(4rem, 12vw, 8rem) clamp(1.2rem, 3vw, 2rem) clamp(3rem, 7vw, 5rem);
		display: grid;
		gap: 1.6rem;
	}

	.hero-meta {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.hero-title {
		font-family: var(--font-heading-alt);
		font-size: clamp(2.6rem, 7vw, 5.4rem);
		line-height: 1;
		letter-spacing: -0.04em;
		font-weight: 400;
		color: rgba(232, 233, 235, 0.98);
		max-width: 18ch;
	}

	.hero-emph {
		color: var(--brightorange, #FF8341);
		font-style: italic;
		font-weight: 300;
	}

	.hero-lede {
		max-width: 42rem;
		font-size: clamp(1rem, 1.4vw, 1.12rem);
		line-height: 1.6;
		color: rgba(232, 233, 235, 0.62);
	}

	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		margin-top: 0.6rem;
	}

	.cta-primary,
	.cta-secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 2.7rem;
		padding: 0 1.1rem;
		border-radius: 4px;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		font-weight: 500;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		text-decoration: none;
		transition: background 180ms ease, border-color 180ms ease, transform 180ms ease;
	}

	.cta-primary {
		background: rgba(232, 233, 235, 0.96);
		color: #0b0e14;
		border: 1px solid rgba(232, 233, 235, 0.96);
	}

	.cta-secondary {
		background: transparent;
		color: rgba(232, 233, 235, 0.92);
		border: 1px solid rgba(232, 233, 235, 0.18);
	}

	.cta-primary:hover,
	.cta-secondary:hover {
		transform: translateY(-1px);
	}

	.cta-secondary:hover {
		border-color: rgba(232, 233, 235, 0.36);
	}

	.hero-readout {
		display: flex;
		gap: 0;
		margin-top: 2.5rem;
		padding-top: 1.6rem;
		border-top: 1px solid rgba(232, 233, 235, 0.08);
	}

	.readout-row {
		display: grid;
		gap: 0.3rem;
		padding-right: 2.5rem;
		border-right: 1px solid rgba(232, 233, 235, 0.06);
		padding-left: 0;
	}

	.readout-row + .readout-row {
		padding-left: 2.5rem;
	}

	.readout-row:last-child {
		border-right: none;
	}

	.readout-label {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.45);
	}

	.readout-value {
		font-family: var(--font-heading-alt);
		font-size: 1.85rem;
		font-weight: 300;
		line-height: 1;
		color: rgba(232, 233, 235, 0.98);
	}

	.readout-axis {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.5);
	}

	/* ───── Blocks ───── */
	.block {
		position: relative;
		z-index: 2;
		max-width: 1180px;
		margin: 0 auto;
		padding: clamp(3.5rem, 8vw, 6rem) clamp(1.2rem, 3vw, 2rem);
		border-top: 1px solid rgba(232, 233, 235, 0.06);
	}

	.block-head {
		display: grid;
		gap: 1rem;
		max-width: 46rem;
		margin-bottom: 2.5rem;
	}

	.block-head h2 {
		font-family: var(--font-heading-alt);
		font-size: clamp(1.9rem, 4vw, 3rem);
		line-height: 1.04;
		letter-spacing: -0.03em;
		font-weight: 400;
		color: rgba(232, 233, 235, 0.96);
		margin-top: 0.4rem;
	}

	.block-lede {
		font-size: 0.98rem;
		line-height: 1.6;
		color: rgba(232, 233, 235, 0.58);
		max-width: 38rem;
	}

	/* ───── Tile grid ───── */
	.tile-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	.tile-fill {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 17rem;
		padding: 1.4rem;
		background: rgba(255, 255, 255, 0.015);
		border: 1px solid rgba(232, 233, 235, 0.06);
		border-radius: 8px;
		overflow: hidden;
	}

	.fill-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.4rem;
		width: 60%;
		opacity: 0.4;
	}

	.fill-grid span {
		aspect-ratio: 1;
		background: rgba(232, 233, 235, 0.08);
		border-radius: 2px;
	}

	.fill-grid span:nth-child(3n) {
		background: rgba(255, 131, 65, 0.35);
	}

	.fill-grid span:nth-child(5n) {
		background: rgba(125, 191, 167, 0.3);
	}

	.fill-mark {
		position: absolute;
		bottom: 1.2rem;
		left: 1.2rem;
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.32);
	}

	@media (max-width: 1000px) {
		.tile-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.tile-fill {
			display: none;
		}
	}

	@media (max-width: 640px) {
		.tile-grid {
			grid-template-columns: 1fr;
		}
	}

	/* ───── Deck ───── */
	.deck {
		display: grid;
		gap: 0;
	}

	.deck-row {
		display: grid;
		grid-template-columns: 3rem 2rem minmax(13rem, 18rem) 1fr;
		align-items: baseline;
		gap: 1.2rem;
		padding: 1.1rem 0.4rem;
		border-top: 1px solid rgba(232, 233, 235, 0.06);
	}

	.deck-row:last-child {
		border-bottom: 1px solid rgba(232, 233, 235, 0.06);
	}

	.deck-row:hover {
		background: rgba(255, 255, 255, 0.015);
	}

	.deck-index {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		color: rgba(232, 233, 235, 0.36);
	}

	.deck-icon {
		display: inline-flex;
		align-self: center;
		color: rgba(232, 233, 235, 0.6);
	}

	.deck-name {
		font-family: var(--font-heading-alt);
		font-size: 1.05rem;
		font-weight: 500;
		color: rgba(232, 233, 235, 0.94);
		letter-spacing: -0.005em;
	}

	.deck-blurb {
		font-family: var(--font-body);
		font-size: 0.94rem;
		line-height: 1.55;
		color: rgba(232, 233, 235, 0.6);
	}

	@media (max-width: 760px) {
		.deck-row {
			grid-template-columns: 2.4rem 1.6rem 1fr;
			grid-template-rows: auto auto;
			row-gap: 0.4rem;
		}

		.deck-blurb {
			grid-column: 3 / -1;
		}
	}

	/* ───── Audiences ───── */
	.audience-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	.audience {
		display: grid;
		gap: 0.9rem;
		padding: 1.6rem 1.4rem;
		background: rgba(255, 255, 255, 0.025);
		border: 1px solid rgba(232, 233, 235, 0.08);
		border-radius: 8px;
	}

	.audience h3 {
		font-family: var(--font-heading-alt);
		font-size: 1.2rem;
		font-weight: 500;
		color: rgba(232, 233, 235, 0.96);
		letter-spacing: -0.005em;
		margin-top: 0.3rem;
	}

	.audience p {
		font-size: 0.92rem;
		line-height: 1.55;
		color: rgba(232, 233, 235, 0.6);
	}

	@media (max-width: 900px) {
		.audience-grid {
			grid-template-columns: 1fr;
		}
	}

	/* ───── CTA + Foot ───── */
	.cta-block {
		position: relative;
		z-index: 2;
		max-width: 1180px;
		margin: 0 auto;
		padding: clamp(4rem, 9vw, 7rem) clamp(1.2rem, 3vw, 2rem);
		border-top: 1px solid rgba(232, 233, 235, 0.08);
	}

	.cta-inner {
		display: grid;
		gap: 1.4rem;
		justify-items: start;
	}

	.cta-block h2 {
		font-family: var(--font-heading-alt);
		font-size: clamp(2rem, 5vw, 3.6rem);
		line-height: 1;
		letter-spacing: -0.035em;
		font-weight: 400;
		color: rgba(232, 233, 235, 0.98);
		max-width: 16ch;
	}

	.foot {
		position: relative;
		z-index: 2;
		max-width: 1180px;
		margin: 0 auto;
		padding: 1.8rem clamp(1.2rem, 3vw, 2rem) 2.5rem;
		border-top: 1px solid rgba(232, 233, 235, 0.06);
	}

	.foot-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.5);
	}

	.foot-mark {
		color: rgba(232, 233, 235, 0.85);
	}
</style>

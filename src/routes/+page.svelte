<script lang="ts">
	import { onMount } from 'svelte';
	import TranscriptRibbon, {
		type TranscriptTag
	} from '$lib/components/marketing/TranscriptRibbon.svelte';
	import BubbleChart from '$lib/components/BubbleChart.svelte';

	const transcriptSnippets = [
		'"I spent months waiting for answers before anyone connected the dots."',
		'"The nearest specialist was three hours away, so every visit took over the whole day."',
		'"I was not sure if the treatment was working or if I was just learning to live around it."',
		'"The side effects became harder to manage than the symptoms themselves."',
		'"We spent weeks fighting insurance before care could even begin."',
		'"I felt like I had to become my own expert before anyone took me seriously."',
		'"My partner kept track of every refill because I was too exhausted to think straight."'
	];

	const transcriptTags: TranscriptTag[] = [
		{
			label: 'Theme: Treatment Burden',
			detail: '18% of coded segments',
			x: 270,
			y: 148,
			anchor: 'center',
			tone: 'theme',
			delay: 0.3
		},
		{
			label: 'Information Gap',
			detail: 'Qualification uncertainty',
			x: 820,
			y: 278,
			anchor: 'center',
			tone: 'barrier',
			delay: 2.6
		},
		{
			label: 'Clinical Trial Barrier',
			detail: 'Travel + eligibility friction',
			x: 944,
			y: 592,
			anchor: 'center',
			tone: 'barrier',
			delay: 4.6
		},
		{
			label: 'Emotion: Frustration',
			detail: 'Trust concern detected',
			x: 330,
			y: 986,
			anchor: 'center',
			tone: 'emotion',
			delay: 1.3
		},
		{
			label: 'Journey Stage: Diagnosis',
			detail: 'Delay and escalation',
			x: 948,
			y: 1860,
			tone: 'journey',
			delay: 2
		},
		{
			label: 'Finding: Insurance Barrier',
			detail: '42% of caregivers mention payer friction',
			x: 876,
			y: 2310,
			anchor: 'right',
			tone: 'finding',
			delay: 2.4
		},
		{
			label: 'Decision Signal',
			detail: 'Evidence ready for teams',
			x: 658,
			y: 3326,
			tone: 'decision',
			delay: 3
		}
	];

	const themeItems = [
		{ label: 'Fatigue', value: 31 },
		{ label: 'Treatment Burden', value: 27 },
		{ label: 'Access', value: 24 },
		{ label: 'Trust', value: 22 },
		{ label: 'Caregiver Stress', value: 18 },
		{ label: 'Financial Impact', value: 16 }
	];

	const emotions = [
		{ label: 'Hope', value: 72, tone: 'var(--teal)' },
		{ label: 'Relief', value: 61, tone: 'var(--midgrayblue)' },
		{ label: 'Frustration', value: 84, tone: 'var(--orange)' },
		{ label: 'Fear', value: 69, tone: 'var(--gold)' },
		{ label: 'Exhaustion', value: 78, tone: 'var(--grayblue)' }
	];

	const journeyStages = [
		{ title: 'Symptoms', detail: 'Signals begin as uncertainty, pain, and workarounds.' },
		{ title: 'Diagnosis', detail: 'Delay, dismissal, and specialist access define the transition.' },
		{ title: 'Treatment Search', detail: 'Patients weigh efficacy, side effects, and information gaps.' },
		{ title: 'Treatment Initiation', detail: 'Coverage, education, and emotional readiness determine adoption.' },
		{ title: 'Long-Term Management', detail: 'Burden, adherence, caregiver support, and trust remain in motion.' }
	];

	const findings = [
		{ value: '67%', label: 'discussed diagnostic delays' },
		{ value: '42%', label: 'reported insurance barriers' },
		{ value: '31%', label: 'questioned treatment effectiveness' },
		{ value: '29%', label: 'described caregiver burnout' }
	];

	const workspaceModules = [
		'Journey Maps',
		'Persona Maps',
		'Theme Analysis',
		'Sentiment Intelligence',
		'Insight Workspace'
	];

	let prefersReducedMotion = $state(false);
	const quoteWords = `"I felt like I had to become my own expert before anyone took my symptoms seriously."`
		.split(' ');

	onMount(() => {
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => {
			prefersReducedMotion = media.matches;
		};
		sync();
		media.addEventListener('change', sync);
		return () => media.removeEventListener('change', sync);
	});
</script>

<svelte:head>
	<title>PatientlyIQ</title>
	<meta
		name="description"
		content="PatientlyIQ transforms patient conversations into structured evidence for research, medical affairs, clinical development, and patient engagement teams."
	/>
</svelte:head>

<main class="landing-shell">
	<div class="background-wash"></div>
	<div class="grain"></div>

	<section class="topbar">
		<div class="brand-lockup">
			<div class="brand-mark" aria-hidden="true"></div>
			<div>
				<p class="brand-name">PatientlyIQ</p>
				<p class="brand-subtitle">Patient voices into evidence</p>
			</div>
		</div>
		<nav class="top-links" aria-label="Primary">
			<a href="/patientlyiq">Platform</a>
			<a href="/patientlyiq/key-findings">Insights</a>
			<a href="/patientlyiq/journey">Journey</a>
		</nav>
	</section>

	<div class="story-shell">
		<TranscriptRibbon
			id="homepage"
			transcripts={transcriptSnippets}
			tags={transcriptTags}
			centerBubble={{
				x: 842,
				y: 404,
				label: 'PatientlyIQ system',
				detail: 'Patient voices into evidence',
				delay: 0.8
			}}
			speed={0.9}
			interactive={true}
			reducedMotion={prefersReducedMotion}
			height={3550}
		/>

		<section class="hero section-block">
			<div class="eyebrow">Patient language, clarified</div>
			<div class="hero-grid">
				<div class="hero-copy">
					<h1>Thousands of patient conversations. One clear understanding.</h1>
					<p class="lede">
						PatientlyIQ transforms interviews, social listening, patient forums,
						transcripts, and caregiver stories into structured insights for research,
						medical affairs, clinical development, and patient engagement teams.
					</p>
					<div class="hero-actions">
						<a class="cta-primary" href="/patientlyiq">Request Demo</a>
						<a class="cta-secondary" href="/patientlyiq/journey">See Example Journey</a>
					</div>
				</div>

				<div class="hero-proof">
					<p class="proof-kicker">Conversation → classification → evidence</p>
					<ul>
						<li><span>Patient conversations</span><strong>Interviews, forums, listening</strong></li>
						<li><span>PatientlyIQ</span><strong>Tags, themes, emotions, journeys</strong></li>
						<li><span>Insights</span><strong>Findings teams can trust</strong></li>
						<li><span>Decisions</span><strong>Research, care, and strategy with context</strong></li>
					</ul>
				</div>
			</div>
		</section>

		<section class="section-block section-detection">
			<div class="section-intro narrow">
				<div class="eyebrow">Living transcript ribbon</div>
				<h2>Language stays human while the structure begins to emerge.</h2>
				<p>
					As patient language moves through the page, annotations appear inline instead of
					arriving as separate system messages. The analysis feels attached to the words
					that produced it.
				</p>
			</div>

			<div class="annotation-stack">
				<div class="annotation-card">
					<p class="annotation-quote">
						“I could not find clear information about whether I qualified...”
					</p>
					<div class="annotation-tags">
						<span>Information Gap</span>
						<span>Clinical Trial Barrier</span>
					</div>
				</div>
				<div class="annotation-card subtle">
					<p class="annotation-quote">
						“I was exhausted all the time and nobody seemed concerned.”
					</p>
					<div class="annotation-tags">
						<span>Symptom: Fatigue</span>
						<span>Emotion: Frustration</span>
						<span>Provider Trust Concern</span>
					</div>
				</div>
			</div>
		</section>

		<section class="section-block section-themes">
			<div class="section-intro">
				<div class="eyebrow">Structured intelligence</div>
				<h2>The transcript literally becomes data.</h2>
				<p>
					Themes condense out of repeated language patterns, not out of a dashboard imposed
					too early. Prevalence grows from the stream itself.
				</p>
			</div>

			<div class="theme-layout">
				<div class="theme-bullets">
					<p>Patient language</p>
					<p>Themes</p>
					<p>Insights</p>
				</div>
				<div class="theme-chart">
					<BubbleChart
						items={themeItems.map((item) => item.label)}
						values={themeItems.map((item) => item.value)}
						labels={themeItems.map((item) => item.label)}
						units=""
						context="card"
						variant="cluster"
						allowUserOverride={false}
						width={520}
						height={320}
						reducedMotion={prefersReducedMotion}
					/>
				</div>
			</div>
		</section>

		<section class="section-block section-emotion">
			<div class="section-intro narrow">
				<div class="eyebrow">Emotion intelligence</div>
				<h2>Hope, frustration, fear, and relief stay visible instead of being flattened away.</h2>
				<p>
					PatientlyIQ extracts emotional signals alongside clinical and behavioral ones, so
					teams can see not just what happened, but how it felt.
				</p>
			</div>

			<div class="emotion-map" role="img" aria-label="Emotion intensity map from patient language">
				<div class="emotion-center">
					<span>Emotion</span>
					<strong>Signals</strong>
				</div>
				{#each emotions as emotion, index}
					<div
						class="emotion-spoke"
						style={`--angle:${index * 72}deg; --distance:${110 + emotion.value * 0.6}px; --tone:${emotion.tone};`}
					>
						<span class="emotion-dot"></span>
						<div class="emotion-label">
							<strong>{emotion.label}</strong>
							<span>{emotion.value}% signal strength</span>
						</div>
					</div>
				{/each}
			</div>
		</section>

		<section class="section-block section-journey">
			<div class="section-intro">
				<div class="eyebrow">Journey intelligence</div>
				<h2>Conversations become journeys without forcing patients into a rigid template first.</h2>
				<p>
					The same evidence stream organizes into lived stages, helping teams locate friction,
					delay, burden, and support across the full patient experience.
				</p>
			</div>

			<div class="journey-rail">
				{#each journeyStages as stage, index}
					<div class="journey-node">
						<div class="journey-step">{index + 1}</div>
						<h3>{stage.title}</h3>
						<p>{stage.detail}</p>
					</div>
				{/each}
			</div>
		</section>

		<section class="section-block quote-section">
			<div class="eyebrow">Quote spotlight</div>
			<blockquote>
				{#each quoteWords as word, index}
					<span
						class:reduced={prefersReducedMotion}
						style={`animation-delay:${index * 55}ms;`}
						>{word}</span
					>
				{/each}
			</blockquote>
			<div class="quote-meta">
				<p>Participant 08 · autoimmune diagnosis · caregiver-supported household</p>
				<div class="quote-themes">
					<span>Self-advocacy</span>
					<span>Diagnostic delay</span>
					<span>Provider trust</span>
				</div>
			</div>
		</section>

		<section class="section-block executive-section">
			<div class="section-intro narrow">
				<div class="eyebrow">Executive insight generation</div>
				<h2>Findings arrive with a visible chain of evidence behind them.</h2>
				<p>
					By the time a percentage appears, visitors have already watched the underlying
					language become classification, pattern, and conclusion.
				</p>
			</div>

			<div class="finding-list">
				{#each findings as finding}
					<div class="finding-row">
						<span class="finding-value">{finding.value}</span>
						<span class="finding-label">{finding.label}</span>
					</div>
				{/each}
			</div>
		</section>

		<section class="section-block product-section">
			<div class="section-intro">
				<div class="eyebrow">Product preview</div>
				<h2>Only then does the interface appear.</h2>
				<p>
					The platform view lands after the process is understood, reinforcing that the
					workspace is powered by patient voices rather than replacing them.
				</p>
			</div>

			<div class="workspace-preview">
				<div class="workspace-sidebar">
					<p>PatientlyIQ Workspace</p>
					{#each workspaceModules as module}
						<span>{module}</span>
					{/each}
				</div>
				<div class="workspace-main">
					<div class="workspace-stream">
						<span>“Weeks fighting insurance...”</span>
						<span>Coverage barrier</span>
						<span>Access insight</span>
					</div>
					<div class="workspace-grid">
						<div class="workspace-panel panel-wide">
							<p class="panel-kicker">Journey map</p>
							<div class="mini-journey">
								<span></span><span></span><span></span><span></span><span></span>
							</div>
						</div>
						<div class="workspace-panel">
							<p class="panel-kicker">Theme analysis</p>
							<div class="mini-bars"><span></span><span></span><span></span></div>
						</div>
						<div class="workspace-panel">
							<p class="panel-kicker">Sentiment intelligence</p>
							<div class="mini-ring"></div>
						</div>
						<div class="workspace-panel panel-wide">
							<p class="panel-kicker">Insight workspace</p>
							<div class="workspace-lines">
								<span></span><span></span><span></span><span></span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section class="section-block cta-section">
			<div class="cta-card">
				<div>
					<div class="eyebrow">PatientlyIQ</div>
					<h2>Patient voices in. Sharper decisions out.</h2>
				</div>
				<div class="cta-actions">
					<a class="cta-primary" href="/patientlyiq">Request Demo</a>
					<a class="cta-secondary" href="/patientlyiq/key-findings">Explore PatientlyIQ</a>
				</div>
			</div>
		</section>
	</div>
</main>

<style>
	:global(body) {
		background: #f6f1e6;
	}

	.landing-shell {
		position: relative;
		overflow: clip;
		background:
			radial-gradient(circle at 15% 14%, rgba(253, 220, 204, 0.6), transparent 28%),
			radial-gradient(circle at 82% 8%, rgba(208, 217, 220, 0.7), transparent 24%),
			linear-gradient(180deg, #f8f3e8 0%, #f2eee6 46%, #eef1ef 100%);
		color: var(--ink);
	}

	.background-wash,
	.grain {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.background-wash {
		background:
			radial-gradient(circle at 78% 26%, rgba(125, 191, 167, 0.16), transparent 18%),
			radial-gradient(circle at 24% 62%, rgba(106, 153, 194, 0.12), transparent 18%);
	}

	.grain {
		opacity: 0.22;
		background-image:
			linear-gradient(rgba(41, 68, 87, 0.05) 1px, transparent 1px),
			linear-gradient(90deg, rgba(41, 68, 87, 0.04) 1px, transparent 1px);
		background-size: 24px 24px;
		mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.55), transparent 85%);
	}

	.topbar {
		position: relative;
		z-index: 2;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1.5rem;
		padding: 1.1rem clamp(1.2rem, 2vw, 2rem);
	}

	.brand-lockup {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.brand-mark {
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 999px;
		background:
			radial-gradient(circle at 35% 35%, rgba(253, 220, 204, 0.95), transparent 35%),
			linear-gradient(140deg, var(--darkgrayblue), var(--grayblue));
		box-shadow: inset 0 0 0 1px rgba(244, 245, 243, 0.3);
	}

	.brand-name {
		font-family: var(--font-heading);
		font-size: 1.05rem;
		line-height: 1;
		color: var(--darkgrayblue);
	}

	.brand-subtitle {
		font-size: 0.78rem;
		color: rgba(49, 47, 40, 0.62);
	}

	.top-links {
		display: flex;
		gap: 1rem;
		font-size: 0.92rem;
	}

	.top-links a {
		color: rgba(49, 47, 40, 0.76);
		text-decoration: none;
	}

	.story-shell {
		position: relative;
		max-width: 1240px;
		margin: 0 auto;
		padding: 0 clamp(1.2rem, 3vw, 2rem) 5rem;
	}

	.section-block {
		position: relative;
		z-index: 2;
		padding-block: clamp(4rem, 12vw, 7rem);
	}

	.eyebrow {
		margin-bottom: 1rem;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(68, 96, 121, 0.88);
	}

	.hero {
		padding-top: clamp(2.5rem, 8vw, 5.5rem);
		min-height: 42rem;
	}

	.hero-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.25fr) minmax(18rem, 0.8fr);
		align-items: end;
		gap: clamp(2rem, 5vw, 4rem);
	}

	.hero-copy h1,
	.section-intro h2,
	.cta-card h2 {
		font-size: clamp(3.4rem, 8vw, 6.8rem);
		line-height: 0.96;
		letter-spacing: -0.06em;
		text-transform: none;
		max-width: 11ch;
	}

	.hero-copy .lede,
	.section-intro p {
		max-width: 38rem;
		font-size: clamp(1.05rem, 1.8vw, 1.24rem);
		line-height: 1.55;
		color: rgba(49, 47, 40, 0.78);
	}

	.hero-actions,
	.cta-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.9rem;
		margin-top: 2rem;
	}

	.cta-primary,
	.cta-secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 3rem;
		padding: 0 1.25rem;
		border-radius: 999px;
		font-size: 0.98rem;
		font-weight: 600;
		text-decoration: none;
		transition:
			transform 200ms var(--ease-smooth),
			background-color 200ms ease,
			color 200ms ease;
	}

	.cta-primary {
		background: var(--darkgrayblue);
		color: rgba(244, 245, 243, 0.98);
	}

	.cta-secondary {
		border: 1px solid rgba(68, 96, 121, 0.18);
		background: rgba(244, 245, 243, 0.72);
		color: var(--darkgrayblue);
	}

	.cta-primary:hover,
	.cta-secondary:hover {
		transform: translateY(-1px);
	}

	.hero-proof {
		padding: 1.5rem;
		border: 1px solid rgba(68, 96, 121, 0.14);
		background: rgba(244, 245, 243, 0.74);
		backdrop-filter: blur(6px);
	}

	.proof-kicker {
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(204, 99, 36, 0.84);
	}

	.hero-proof ul {
		display: grid;
		gap: 1rem;
		margin-top: 1.25rem;
	}

	.hero-proof li {
		display: grid;
		gap: 0.3rem;
		padding-bottom: 0.8rem;
		border-bottom: 1px solid rgba(68, 96, 121, 0.12);
	}

	.hero-proof span {
		font-size: 0.84rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(68, 96, 121, 0.76);
	}

	.hero-proof strong {
		font-family: var(--font-heading-serif);
		font-size: 1.14rem;
		line-height: 1.35;
		font-weight: 500;
		color: var(--ink);
	}

	.section-intro {
		max-width: 54rem;
	}

	.section-intro.narrow {
		max-width: 43rem;
	}

	.annotation-stack {
		display: grid;
		gap: 1rem;
		max-width: 31rem;
		margin-left: auto;
	}

	.annotation-card {
		padding: 1.2rem 1.2rem 1rem;
		border: 1px solid rgba(68, 96, 121, 0.13);
		background: rgba(244, 245, 243, 0.8);
		box-shadow: 0 16px 38px rgba(49, 47, 40, 0.06);
	}

	.annotation-card.subtle {
		margin-right: 2.75rem;
	}

	.annotation-quote {
		font-family: var(--font-heading-serif);
		font-size: 1.28rem;
		line-height: 1.42;
		color: var(--ink);
	}

	.annotation-tags,
	.quote-themes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin-top: 1rem;
	}

	.annotation-tags span,
	.quote-themes span {
		padding: 0.46rem 0.72rem;
		border-radius: 999px;
		font-size: 0.82rem;
		font-weight: 600;
		background: rgba(253, 220, 204, 0.72);
		color: var(--darkgrayblue);
	}

	.theme-layout {
		display: grid;
		grid-template-columns: minmax(12rem, 0.55fr) minmax(0, 1fr);
		align-items: center;
		gap: 1.5rem;
		margin-top: 2rem;
	}

	.theme-bullets {
		display: grid;
		gap: 1rem;
	}

	.theme-bullets p {
		font-family: var(--font-heading-serif);
		font-size: clamp(1.35rem, 2.4vw, 2rem);
		color: var(--darkgrayblue);
	}

	.theme-bullets p:not(:last-child)::after {
		content: "↓";
		display: block;
		margin-top: 0.65rem;
		font-family: var(--font-body);
		font-size: 1rem;
		color: rgba(68, 96, 121, 0.54);
	}

	.theme-chart {
		display: flex;
		justify-content: center;
		padding: 1rem;
		border: 1px solid rgba(68, 96, 121, 0.12);
		background: rgba(244, 244, 255, 0.72);
	}

	.section-emotion .section-intro {
		margin-left: auto;
	}

	.emotion-map {
		position: relative;
		width: min(38rem, 100%);
		height: 34rem;
		margin: 2.5rem auto 0;
	}

	.emotion-center {
		position: absolute;
		inset: 50% auto auto 50%;
		transform: translate(-50%, -50%);
		display: grid;
		place-items: center;
		width: 10rem;
		height: 10rem;
		border-radius: 999px;
		border: 1px solid rgba(68, 96, 121, 0.16);
		background: rgba(244, 245, 243, 0.9);
		text-align: center;
	}

	.emotion-center span {
		font-size: 0.82rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(68, 96, 121, 0.72);
	}

	.emotion-center strong {
		font-family: var(--font-heading-serif);
		font-size: 1.6rem;
		line-height: 1;
	}

	.emotion-spoke {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0;
		height: 0;
		transform: rotate(var(--angle)) translateX(var(--distance));
		transform-origin: 0 0;
	}

	.emotion-dot {
		position: absolute;
		top: -0.55rem;
		left: -0.55rem;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 999px;
		background: var(--tone);
		box-shadow: 0 0 0 8px color-mix(in srgb, var(--tone) 16%, transparent);
	}

	.emotion-label {
		position: absolute;
		top: -1rem;
		left: 1.2rem;
		display: grid;
		gap: 0.15rem;
		min-width: 9rem;
	}

	.emotion-label strong {
		font-family: var(--font-heading);
		font-size: 1.05rem;
		font-weight: 500;
		line-height: 1;
		text-transform: none;
	}

	.emotion-label span {
		font-size: 0.82rem;
		color: rgba(49, 47, 40, 0.65);
	}

	.section-journey .section-intro {
		max-width: 44rem;
	}

	.journey-rail {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 1rem;
		margin-top: 2rem;
	}

	.journey-node {
		position: relative;
		padding: 1rem 0.9rem 0.9rem;
		border-top: 1px solid rgba(68, 96, 121, 0.16);
	}

	.journey-node::before {
		content: "";
		position: absolute;
		top: -0.42rem;
		left: 0;
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 999px;
		background: var(--darkgrayblue);
	}

	.journey-step {
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(204, 99, 36, 0.88);
	}

	.journey-node h3 {
		margin-top: 0.65rem;
		font-size: 1.18rem;
		line-height: 1.1;
		text-transform: none;
	}

	.journey-node p {
		margin-top: 0.45rem;
		font-size: 0.94rem;
		line-height: 1.5;
		color: rgba(49, 47, 40, 0.72);
	}

	.quote-section {
		max-width: 56rem;
	}

	blockquote {
		font-family: var(--font-heading-serif);
		font-size: clamp(2rem, 5vw, 4.7rem);
		line-height: 1.02;
		letter-spacing: -0.04em;
		color: var(--darkgrayblue);
	}

	blockquote span {
		display: inline-block;
		margin-right: 0.28em;
		opacity: 0;
		transform: translateY(0.5em);
		animation: word-rise 720ms var(--ease-smooth) forwards;
	}

	blockquote span.reduced {
		opacity: 1;
		transform: none;
		animation: none;
	}

	.quote-meta {
		margin-top: 1.4rem;
		max-width: 32rem;
		font-size: 0.95rem;
		line-height: 1.55;
		color: rgba(49, 47, 40, 0.72);
	}

	.finding-list {
		display: grid;
		gap: 0.6rem;
		margin-top: 2rem;
	}

	.finding-row {
		display: grid;
		grid-template-columns: minmax(6rem, auto) 1fr;
		align-items: baseline;
		gap: 1rem;
		padding: 0.95rem 0;
		border-top: 1px solid rgba(68, 96, 121, 0.12);
	}

	.finding-value {
		font-family: var(--font-heading);
		font-size: clamp(2rem, 4vw, 3.2rem);
		line-height: 1;
		color: var(--darkgrayblue);
	}

	.finding-label {
		font-family: var(--font-heading-serif);
		font-size: clamp(1.15rem, 2vw, 1.7rem);
		color: rgba(49, 47, 40, 0.9);
	}

	.workspace-preview {
		display: grid;
		grid-template-columns: 15rem 1fr;
		gap: 1rem;
		margin-top: 2rem;
		padding: 1rem;
		border: 1px solid rgba(68, 96, 121, 0.14);
		background: rgba(244, 245, 243, 0.82);
		box-shadow: 0 18px 42px rgba(49, 47, 40, 0.08);
	}

	.workspace-sidebar {
		display: grid;
		align-content: start;
		gap: 0.65rem;
		padding: 0.75rem;
		border-right: 1px solid rgba(68, 96, 121, 0.12);
	}

	.workspace-sidebar p,
	.panel-kicker {
		font-size: 0.76rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(68, 96, 121, 0.78);
	}

	.workspace-sidebar span {
		padding: 0.65rem 0.72rem;
		background: rgba(244, 244, 255, 0.92);
		font-family: var(--font-heading);
		font-size: 1rem;
		color: var(--darkgrayblue);
	}

	.workspace-main {
		display: grid;
		gap: 0.9rem;
		padding: 0.4rem;
	}

	.workspace-stream {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.7rem;
		padding: 0.8rem 0.9rem;
		background: rgba(253, 220, 204, 0.52);
		color: var(--darkgrayblue);
	}

	.workspace-stream span {
		padding: 0.3rem 0.55rem;
		background: rgba(244, 245, 243, 0.94);
		border-radius: 999px;
		font-size: 0.84rem;
		font-weight: 600;
	}

	.workspace-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.9rem;
	}

	.workspace-panel {
		min-height: 9rem;
		padding: 1rem;
		background: rgba(244, 244, 255, 0.84);
	}

	.panel-wide {
		grid-column: span 2;
	}

	.mini-journey,
	.mini-bars,
	.workspace-lines {
		display: flex;
		align-items: end;
		gap: 0.55rem;
		margin-top: 1rem;
	}

	.mini-journey span,
	.mini-bars span,
	.workspace-lines span {
		display: block;
		flex: 1;
		background: rgba(68, 96, 121, 0.16);
	}

	.mini-journey span {
		height: 2rem;
		border-radius: 999px;
	}

	.mini-journey span:nth-child(2) {
		height: 3rem;
	}

	.mini-journey span:nth-child(3) {
		height: 2.3rem;
	}

	.mini-journey span:nth-child(4) {
		height: 3.6rem;
	}

	.mini-journey span:nth-child(5) {
		height: 2.7rem;
	}

	.mini-bars span:nth-child(1) {
		height: 4rem;
	}

	.mini-bars span:nth-child(2) {
		height: 2.5rem;
	}

	.mini-bars span:nth-child(3) {
		height: 5.2rem;
	}

	.mini-ring {
		width: 5.2rem;
		height: 5.2rem;
		margin-top: 0.8rem;
		border-radius: 999px;
		background: conic-gradient(
			var(--orange) 0 110deg,
			var(--teal) 110deg 215deg,
			var(--midgrayblue) 215deg 360deg
		);
		mask: radial-gradient(circle at center, transparent 44%, black 45%);
	}

	.workspace-lines {
		flex-direction: column;
		align-items: stretch;
	}

	.workspace-lines span:nth-child(1) {
		height: 0.7rem;
		width: 85%;
	}

	.workspace-lines span:nth-child(2) {
		height: 0.7rem;
		width: 68%;
	}

	.workspace-lines span:nth-child(3) {
		height: 0.7rem;
		width: 92%;
	}

	.workspace-lines span:nth-child(4) {
		height: 0.7rem;
		width: 58%;
	}

	.cta-card {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 2rem;
		padding: clamp(1.6rem, 4vw, 2.3rem);
		border-top: 1px solid rgba(68, 96, 121, 0.15);
	}

	.cta-card h2 {
		max-width: 10ch;
		font-size: clamp(2.6rem, 5vw, 4.8rem);
	}

	@keyframes word-rise {
		from {
			opacity: 0;
			transform: translateY(0.5em);
		}

		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 960px) {
		.topbar,
		.hero-grid,
		.theme-layout,
		.workspace-preview,
		.cta-card {
			grid-template-columns: 1fr;
			flex-direction: column;
			align-items: flex-start;
		}

		.top-links {
			display: none;
		}

		.hero {
			min-height: auto;
		}

		.annotation-stack {
			margin-left: 0;
		}

		.annotation-card.subtle {
			margin-right: 0;
		}

		.journey-rail,
		.workspace-grid {
			grid-template-columns: 1fr;
		}

		.panel-wide {
			grid-column: auto;
		}

		.workspace-sidebar {
			border-right: 0;
			border-bottom: 1px solid rgba(68, 96, 121, 0.12);
		}
	}

	@media (max-width: 720px) {
		.story-shell {
			padding-bottom: 3rem;
		}

		.hero-copy h1,
		.section-intro h2,
		.cta-card h2 {
			max-width: none;
		}

		.emotion-map {
			height: 28rem;
		}

		.finding-row {
			grid-template-columns: 1fr;
			gap: 0.4rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		blockquote span {
			opacity: 1;
			transform: none;
			animation: none;
		}

		.cta-primary,
		.cta-secondary {
			transition: none;
		}
	}
</style>

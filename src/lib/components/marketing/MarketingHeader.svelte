<script lang="ts">
	type NavLink = { label: string; href: string };

	type Props = {
		links?: NavLink[];
		ctaLabel?: string;
		ctaHref?: string;
	};

	let {
		links = [
			{ label: 'Platform', href: '/patientlyiq' },
			{ label: 'Workbench', href: '/patientlyiq/journey-workbench' },
			{ label: 'Insights', href: '/patientlyiq/key-findings' },
			{ label: 'Capabilities', href: '/capabilities' }
		],
		ctaLabel = 'Request demo',
		ctaHref = '/patientlyiq'
	}: Props = $props();
</script>

<header class="bar">
	<a class="brand" href="/">
		<span class="brand-mark" aria-hidden="true"></span>
		<span class="brand-text">
			<span class="brand-name">PatientlyIQ</span>
			<span class="brand-sub">Patient voices → evidence</span>
		</span>
	</a>

	<nav class="nav" aria-label="Primary">
		{#each links as link}
			<a href={link.href}>{link.label}</a>
		{/each}
	</nav>

	<a class="cta" href={ctaHref}>
		{ctaLabel}
	</a>
</header>

<style>
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1.5rem;
		padding: 1rem clamp(1.2rem, 2.5vw, 2rem);
		border-bottom: 1px solid rgba(232, 233, 235, 0.08);
		background: rgba(11, 14, 20, 0.72);
		backdrop-filter: blur(12px);
		position: sticky;
		top: 0;
		z-index: 50;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		text-decoration: none;
		color: inherit;
	}

	.brand-mark {
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 999px;
		background:
			radial-gradient(circle at 30% 30%, rgba(255, 131, 65, 0.9), transparent 50%),
			linear-gradient(140deg, #6a99c2, #294457);
		box-shadow: 0 0 0 1px rgba(232, 233, 235, 0.15);
	}

	.brand-text {
		display: grid;
		line-height: 1.05;
	}

	.brand-name {
		font-family: var(--font-heading-alt);
		font-size: 0.92rem;
		font-weight: 500;
		color: rgba(232, 233, 235, 0.98);
		letter-spacing: -0.01em;
	}

	.brand-sub {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.5);
	}

	.nav {
		display: flex;
		gap: 1.8rem;
	}

	.nav a {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.62);
		text-decoration: none;
		transition: color 180ms ease;
	}

	.nav a:hover {
		color: rgba(232, 233, 235, 0.98);
	}

	.cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.4rem;
		padding: 0 1rem;
		border-radius: 4px;
		border: 1px solid rgba(232, 233, 235, 0.18);
		background: rgba(232, 233, 235, 0.06);
		color: rgba(232, 233, 235, 0.98);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-decoration: none;
		transition: background 180ms ease, border-color 180ms ease;
	}

	.cta:hover {
		background: rgba(232, 233, 235, 0.12);
		border-color: rgba(232, 233, 235, 0.32);
	}

	@media (max-width: 820px) {
		.nav {
			display: none;
		}
	}
</style>

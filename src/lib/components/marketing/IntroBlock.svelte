<script lang="ts">
	type Anchor = { number: string; label: string; href: string };

	type Props = {
		subhead: string;
		body: string;
		anchors?: Anchor[];
	};

	let { subhead, body, anchors = [] }: Props = $props();
</script>

<section class="intro">
	<div class="intro-grid">
		<div class="intro-subhead">
			<h2>{subhead}</h2>
		</div>
		<div class="intro-body">
			<p>{body}</p>
			{#if anchors.length}
				<div class="intro-anchors">
					{#each anchors as a}
						<a href={a.href} class="anchor">
							<span class="anchor-num">{a.number}</span>
							<span class="anchor-label">{a.label}</span>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</section>

<style>
	.intro {
		position: relative;
		z-index: 2;
		max-width: 1180px;
		margin: 0 auto;
		padding: clamp(2rem, 5vw, 3.5rem) clamp(1.2rem, 3vw, 2rem) clamp(3rem, 6vw, 5rem);
	}

	.intro-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
		gap: clamp(2rem, 6vw, 5rem);
	}

	.intro-subhead h2 {
		font-family: var(--font-heading-alt);
		font-size: clamp(1.5rem, 2.6vw, 2.1rem);
		line-height: 1.1;
		letter-spacing: -0.02em;
		font-weight: 600;
		color: rgba(232, 233, 235, 0.96);
		max-width: 18ch;
	}

	.intro-body p {
		font-family: var(--font-body);
		font-size: clamp(1rem, 1.3vw, 1.1rem);
		line-height: 1.6;
		color: rgba(232, 233, 235, 0.66);
		max-width: 38rem;
	}

	.intro-anchors {
		display: flex;
		gap: 1.6rem;
		margin-top: 1.8rem;
		flex-wrap: wrap;
	}

	.anchor {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		letter-spacing: 0.08em;
		color: rgba(232, 233, 235, 0.68);
		text-decoration: none;
		transition: color 180ms ease;
	}

	.anchor:hover {
		color: rgba(232, 233, 235, 0.98);
	}

	.anchor-num {
		color: rgba(232, 233, 235, 0.42);
	}

	@media (max-width: 760px) {
		.intro-grid {
			grid-template-columns: 1fr;
		}
	}
</style>

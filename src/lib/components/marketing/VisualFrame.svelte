<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		caption?: string;
		footerLeft?: string;
		footerRight?: string;
		children: Snippet;
	};

	let { caption, footerLeft, footerRight, children }: Props = $props();
</script>

<section class="frame-wrap">
	<div class="frame">
		<div class="frame-chrome">
			<div class="chrome-dots" aria-hidden="true">
				<span></span><span></span><span></span>
			</div>
			{#if caption}
				<span class="chrome-caption">{caption}</span>
			{/if}
			<div class="chrome-spacer"></div>
		</div>
		<div class="frame-body">
			{@render children()}
		</div>
		{#if footerLeft || footerRight}
			<div class="frame-foot">
				<span>{footerLeft ?? ''}</span>
				<span>{footerRight ?? ''}</span>
			</div>
		{/if}
	</div>
</section>

<style>
	.frame-wrap {
		position: relative;
		z-index: 2;
		max-width: 1180px;
		margin: 0 auto;
		padding: 0 clamp(1.2rem, 3vw, 2rem) clamp(3rem, 6vw, 5rem);
	}

	.frame {
		position: relative;
		border: 1px solid rgba(232, 233, 235, 0.1);
		background: linear-gradient(180deg, #0d1118 0%, #0a0d12 100%);
		border-radius: 10px;
		overflow: hidden;
		box-shadow: 0 30px 90px rgba(0, 0, 0, 0.5);
	}

	.frame-chrome {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.7rem 1rem;
		border-bottom: 1px solid rgba(232, 233, 235, 0.06);
		background: rgba(232, 233, 235, 0.02);
	}

	.chrome-dots {
		display: flex;
		gap: 0.4rem;
	}

	.chrome-dots span {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 999px;
		background: rgba(232, 233, 235, 0.16);
	}

	.chrome-caption {
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.4);
	}

	.chrome-spacer {
		flex: 1;
	}

	.frame-body {
		position: relative;
		padding: clamp(1rem, 3vw, 2rem);
		min-height: 24rem;
	}

	.frame-foot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.7rem 1rem;
		border-top: 1px solid rgba(232, 233, 235, 0.06);
		background: rgba(232, 233, 235, 0.02);
		font-family: var(--font-mono);
		font-size: 0.66rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(232, 233, 235, 0.4);
	}
</style>

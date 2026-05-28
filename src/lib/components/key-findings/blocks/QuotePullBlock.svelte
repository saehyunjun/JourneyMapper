<!--
	QuotePullBlock — bold poster-format quote for shareable export.

	Distinct from `QuoteBlock`: this one is a paste-and-style poster, not a
	corpus-aware picker. The analyst already has the quote text and wants a
	high-impact artwork — accent colour, background treatment, and reveal
	animation are first-class so a single quote can be reskinned without
	re-typing.

	Layout: huge centred quote, big stylised quote mark, attribution chip with
	persona avatar dot + sentiment dot at the bottom, optional theme chip.
	Background swaps between light, dark, and accent for palette A/B.

	Reveal animation reuses the same primitive set as QuoteBlock so the library
	stays consistent: 'fade' tweens opacity, 'word' staggers per word, and
	'typewriter' character-counts the text.
-->
<script lang="ts">
	import { Quote as QuoteIcon } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import type { QuotePullBlock } from '$lib/key-findings/types';

	let {
		block,
		editable = true,
		animate = false,
		replayKey = 0,
		onUpdate,
		onConfigure
	}: {
		block: QuotePullBlock;
		editable?: boolean;
		animate?: boolean;
		replayKey?: number;
		onUpdate: (patch: Partial<QuotePullBlock>, coalesceKey?: string) => void;
		onConfigure: () => void;
	} = $props();

	// Reveal — drives the typewriter and word-stagger animations. `revealAt`
	// is the fraction of the quote (0..1) currently visible.
	let revealAt = $state(1);
	const text = $derived(block.text || '');
	const words = $derived(text.split(/(\s+)/));

	const replayToken = $derived(`${replayKey}|${animate}|${block.reveal}|${text}`);
	$effect(() => {
		replayToken;
		if (!animate || block.reveal === 'none') {
			revealAt = 1;
			return;
		}
		let raf = 0;
		const duration = block.reveal === 'typewriter' ? Math.max(1200, text.length * 32) : 900;
		const start = performance.now() + 120;
		revealAt = 0;
		function tick(now: number) {
			const t = Math.max(0, Math.min(1, (now - start) / duration));
			revealAt = t;
			if (t < 1) raf = requestAnimationFrame(tick);
		}
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	onMount(() => {
		revealAt = 1;
	});

	const charsRevealed = $derived(Math.floor(text.length * revealAt));
	const typewriterText = $derived(text.slice(0, charsRevealed));
	const wordRevealCount = $derived(Math.ceil(words.length * revealAt));

	const sentimentColor = $derived(
		block.sentiment >= 2 ? '#059669' :
		block.sentiment === 1 ? '#34d399' :
		block.sentiment === -1 ? '#fb7185' :
		block.sentiment <= -2 ? '#b91c1c' :
		'#94a3b8'
	);

	// Background resolves to a flat fill, foreground text colour, and a small
	// quote-mark colour. 'accent' uses the accent as background, white text.
	const bgFill = $derived(
		block.background === 'dark' ? '#0f172a' :
		block.background === 'accent' ? block.accentColor :
		'#ffffff'
	);
	const fgFill = $derived(
		block.background === 'light' ? '#0f172a' : '#ffffff'
	);
	const markFill = $derived(
		block.background === 'light' ? block.accentColor : 'rgba(255,255,255,0.18)'
	);
	const subtleFill = $derived(
		block.background === 'light' ? '#64748b' : 'rgba(255,255,255,0.7)'
	);

	const fontScale = $derived(block.fontScale || 1);
</script>

{#if !block.configured && !block.text}
	<button
		type="button"
		class="kf-placeholder"
		onclick={onConfigure}
		disabled={!editable}
		aria-label="Configure quote pull"
	>
		<QuoteIcon class="size-6 text-slate-300" />
		<span class="font-medium text-slate-500">Quote pull</span>
		<span class="text-xs text-slate-400">Click to paste a quote and style it</span>
	</button>
{:else}
	<figure
		class="qp-stage"
		style="--accent: {block.accentColor}; --bg: {bgFill}; --fg: {fgFill}; --mark: {markFill}; --subtle: {subtleFill}; font-size: {fontScale}em;"
		data-bg={block.background}
	>
		{#if editable}
			<button class="qp-settings" onclick={onConfigure} aria-label="Open settings">Settings</button>
		{/if}

		<span class="qp-mark" aria-hidden="true">"</span>

		<blockquote class="qp-quote">
			{#if animate && block.reveal === 'typewriter'}
				<span class="qp-text">{typewriterText}<span class="qp-caret" aria-hidden="true">|</span></span>
			{:else if animate && block.reveal === 'word'}
				<span class="qp-text">
					{#each words as word, i (i)}
						<span class="qp-word" style="opacity: {i < wordRevealCount ? 1 : 0}; transition: opacity 220ms ease;">{word}</span>
					{/each}
				</span>
			{:else if animate && block.reveal === 'fade'}
				<span class="qp-text" style="opacity: {revealAt}; transition: opacity 800ms ease;">{text}</span>
			{:else}
				<span class="qp-text">{text}</span>
			{/if}
		</blockquote>

		<footer class="qp-footer">
			<div class="qp-meta">
				<span class="qp-sentiment-dot" style="background: {sentimentColor};" aria-hidden="true"></span>
				<div class="qp-attr">
					<p class="qp-attribution">{block.attribution || 'Anonymous'}</p>
					{#if block.context}<p class="qp-context">{block.context}</p>{/if}
				</div>
			</div>
			{#if block.themeLabel}
				<span class="qp-chip">{block.themeLabel}</span>
			{/if}
		</footer>
	</figure>
{/if}

<style>
	.kf-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		width: 100%;
		min-height: 150px;
		border: 2px dashed #e2e8f0;
		border-radius: 0.75rem;
		padding: 1.25rem;
		text-align: center;
		transition:
			border-color 0.15s ease,
			background 0.15s ease;
	}
	.kf-placeholder:hover:not(:disabled) {
		border-color: var(--teal, #7dbfa7);
		background: #f8fafc;
	}
	.kf-placeholder:focus-visible {
		outline: 2px solid var(--teal, #7dbfa7);
		outline-offset: 2px;
	}

	.qp-stage {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		min-height: 0;
		flex: 1;
		padding: 1rem 1.1rem 0.9rem;
		border-radius: 0.75rem;
		background: var(--bg);
		color: var(--fg);
		overflow: hidden;
		container-type: inline-size;
	}
	/* Subtle accent rail on the left for the light background variant. */
	.qp-stage[data-bg='light'] {
		border-left: 4px solid var(--accent);
	}
	.qp-stage[data-bg='dark']::before,
	.qp-stage[data-bg='accent']::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 60%);
		pointer-events: none;
	}

	.qp-settings {
		position: absolute;
		top: 0.5rem;
		right: 0.6rem;
		border: 0;
		background: transparent;
		font-size: 0.7rem;
		color: var(--subtle);
		cursor: pointer;
		padding: 0.15rem 0.35rem;
		border-radius: 4px;
	}
	.qp-settings:hover {
		background: color-mix(in srgb, var(--fg) 10%, transparent);
	}

	.qp-mark {
		font-family: 'Georgia', serif;
		font-size: clamp(3rem, 12cqi, 5.5rem);
		line-height: 0.7;
		color: var(--mark);
		font-weight: 700;
		margin-top: -0.3rem;
		margin-bottom: -0.2rem;
		user-select: none;
	}

	.qp-quote {
		flex: 1;
		margin: 0;
		display: flex;
		align-items: center;
	}
	.qp-text {
		font-family: var(--font-heading, var(--font-body, system-ui));
		font-weight: 600;
		font-size: clamp(1.15rem, 5cqi, 2.1rem);
		line-height: 1.18;
		letter-spacing: -0.01em;
		color: var(--fg);
	}
	.qp-word {
		display: inline;
	}
	.qp-caret {
		display: inline-block;
		width: 0.5ch;
		color: var(--accent);
		animation: qp-caret-blink 800ms steps(2, end) infinite;
	}
	@keyframes qp-caret-blink {
		to { opacity: 0; }
	}

	.qp-footer {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid color-mix(in srgb, var(--fg) 10%, transparent);
	}
	.qp-meta {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		min-width: 0;
	}
	.qp-sentiment-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.qp-attr {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
	}
	.qp-attribution {
		font-size: 0.8rem;
		font-weight: 700;
		color: var(--fg);
		margin: 0;
		line-height: 1.1;
	}
	.qp-context {
		font-size: 0.7rem;
		color: var(--subtle);
		margin: 0;
		line-height: 1.15;
	}
	.qp-chip {
		display: inline-block;
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.25rem 0.55rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 25%, transparent);
		color: var(--fg);
		white-space: nowrap;
		flex-shrink: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.qp-caret { animation: none; }
		.qp-text { transition: none !important; opacity: 1 !important; }
		.qp-word { opacity: 1 !important; }
	}
</style>

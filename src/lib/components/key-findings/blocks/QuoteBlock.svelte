<!--
	QuoteBlock — a patient/caregiver/HCP quote module.

	Blank until configured (click the placeholder opens the right drawer to pick
	a starred quote or start a blank one). Once configured it renders one of
	three layouts, sentiment-tinted, with attribution/persona/role/source. Pull
	and banner layouts support reveal-on-view animation; quote text stays inline-
	editable while the card is active.
-->
<script lang="ts">
	import KeyQuoteCard from '$lib/components/KeyQuoteCard.svelte';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import { Quote as QuoteIcon } from '@lucide/svelte';
	import { reveal, animateProgress } from '$lib/charts/reveal';
	import { questionLabel, participantLabel, titleCase } from '$lib/content/wctglpdemo-data/analysis';
	import { profileName, type ParticipantProfile } from '$lib/types/participant-profile';
	import type { QuoteBlock, QuoteReveal } from '$lib/key-findings/types';

	let {
		block,
		editable = true,
		animate = false,
		replayKey = 0,
		fontScale = 1,
		profiles,
		onUpdate,
		onConfigure,
		onparticipant
	}: {
		block: QuoteBlock;
		editable?: boolean;
		animate?: boolean;
		replayKey?: number;
		fontScale?: number;
		profiles: Record<string, ParticipantProfile>;
		onUpdate: (patch: Partial<QuoteBlock>, coalesceKey?: string) => void;
		onConfigure: () => void;
		onparticipant: (interviewId: string) => void;
	} = $props();

	const effectiveReveal = $derived<QuoteReveal>(editable || !animate ? 'none' : block.reveal);

	let revealed = $state(false);
	let progress = $state(0);
	const words = $derived(block.text.split(/(\s+)/));

	function startReveal() {
		revealed = true;
		if (effectiveReveal === 'typewriter')
			animateProgress(Math.min(6000, Math.max(900, block.text.length * 32)), (t) => (progress = t));
	}
	// Replay on export.
	$effect(() => {
		void replayKey;
		if (animate && !editable && block.reveal !== 'none') {
			revealed = false;
			progress = 0;
			requestAnimationFrame(() => startReveal());
		}
	});

	const shownChars = $derived(
		effectiveReveal === 'typewriter' && revealed ? Math.ceil(progress * block.text.length) : block.text.length
	);

	function tone(value: number) {
		if (value > 0) return 'text-emerald-500';
		if (value < 0) return 'text-rose-500';
		return 'text-slate-400';
	}
	function tintBg(value: number) {
		if (value > 0) return 'bg-emerald-50';
		if (value < 0) return 'bg-rose-50';
		return 'bg-slate-50';
	}

	// Attribution prefers the analyst override, then the participant profile.
	const attribution = $derived(
		block.attribution ||
			(block.interviewId ? profileName(profiles[block.interviewId], participantLabel(block.interviewId)) : '')
	);
	const meta = $derived(
		[block.persona, block.role].filter(Boolean).join(' · ')
	);
</script>

{#if !block.configured}
	<button type="button" class="kf-placeholder" onclick={onConfigure} disabled={!editable} aria-label="Configure quote">
		<QuoteIcon class="size-6 text-slate-300" />
		<span class="font-medium text-slate-500">Patient quote</span>
		<span class="text-xs text-slate-400">Click to pick a starred quote or write one</span>
	</button>
{:else}
	{#snippet revealText()}
		{#if effectiveReveal === 'typewriter'}
			<span>{block.text.slice(0, shownChars)}</span>{#if shownChars < block.text.length}<span class="kf-caret">▏</span>{/if}
		{:else if effectiveReveal === 'word'}
			{#each words as w, i (i)}<span class="kf-word" class:shown={revealed} style="transition-delay: {i * 55}ms">{w}</span>{/each}
		{:else}
			{block.text}
		{/if}
	{/snippet}

	<div class="kf-quote" use:reveal={{ onReveal: startReveal, once: true }}>
		{#if editable}
			<button class="mb-1 ml-auto block text-xs text-slate-400 hover:text-slate-700" onclick={onConfigure}>Edit quote</button>
		{/if}

		{#if block.layout === 'card' && block.interviewId}
			<KeyQuoteCard
				text={block.text}
				sentiment={block.sentiment}
				interviewId={block.interviewId}
				questionId={block.questionId}
				themes={block.themes}
				{profiles}
				{onparticipant}
				size="lg"
			/>
		{:else if block.layout === 'banner'}
			<div class="rounded-2xl {tintBg(block.sentiment)} p-6 text-center">
				<blockquote
					class="font-medium leading-snug text-slate-800 {effectiveReveal === 'fade' ? 'kf-fade' : ''}"
					class:shown={revealed}
					style="font-family: var(--font-body, sans-serif); font-size: {1.25 * fontScale}rem;"
					contenteditable={editable}
					oninput={(e) => onUpdate({ text: e.currentTarget.textContent ?? '' }, `quote:${block.id}`)}
				>{#if editable}{block.text}{:else}{@render revealText()}{/if}</blockquote>
				{#if attribution || meta || block.questionId}
					<div class="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-slate-500">
						{#if block.interviewId}<ParticipantAvatar interviewId={block.interviewId} size="sm" src={profiles[block.interviewId]?.avatar_url} />{/if}
						{#if attribution}<span class="font-medium">{attribution}</span>{/if}
						{#if meta}<span class="text-slate-300">·</span><span>{meta}</span>{/if}
						{#if block.questionId}<span class="text-slate-300">·</span><span>{questionLabel(block.questionId)}</span>{/if}
					</div>
				{/if}
				{#if block.source}<p class="mt-1 text-xs text-slate-400">{block.source}</p>{/if}
			</div>
		{:else}
			<!-- pull (default) -->
			<figure>
				<svg class="mb-1 {tone(block.sentiment)}" width="30" height="20" viewBox="0 0 65 44" fill="currentColor" aria-hidden="true">
					<path d="M31.1877 16.947V0H25.0119C9.10927 0 0 9.32862 0 24.7208V44H21.4608V27.053C21.4608 20.8339 23.7767 16.947 28.563 16.947H31.1877ZM65 16.947V0H58.8242C42.9216 0 33.8124 9.32862 33.8124 24.7208V44H55.2732V27.053C55.2732 20.8339 57.5891 16.947 62.3753 16.947H65Z" />
				</svg>
				<blockquote
					class="leading-relaxed text-slate-800 {effectiveReveal === 'fade' ? 'kf-fade' : ''}"
					class:shown={revealed}
					style="font-family: var(--font-body, sans-serif); font-size: {1.125 * fontScale}rem;"
					contenteditable={editable}
					oninput={(e) => onUpdate({ text: e.currentTarget.textContent ?? '' }, `quote:${block.id}`)}
				>{#if editable}{block.text}{:else}{@render revealText()}{/if}</blockquote>
				{#if attribution || meta || block.questionId || block.themes.length || block.source}
					<figcaption class="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
						{#if block.interviewId}
							<button type="button" class="flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900" onclick={() => onparticipant(block.interviewId)}>
								<ParticipantAvatar interviewId={block.interviewId} size="sm" src={profiles[block.interviewId]?.avatar_url} />
								{attribution}
							</button>
						{:else if attribution}
							<span class="font-medium text-slate-600">{attribution}</span>
						{/if}
						{#if meta}<span class="text-slate-300">·</span><span class="text-xs">{meta}</span>{/if}
						{#if block.questionId}<span class="text-slate-300">·</span><span class="text-xs">{questionLabel(block.questionId)}</span>{/if}
						{#if block.themes.length}
							<span class="ml-auto flex flex-wrap gap-1">
								{#each block.themes as t (t)}<span class="rounded-full bg-accent-mint/15 px-2 py-0.5 text-xs text-accent-mint">{titleCase(t)}</span>{/each}
							</span>
						{/if}
					</figcaption>
				{/if}
				{#if block.source}<p class="mt-1 text-xs text-slate-400">{block.source}</p>{/if}
			</figure>
		{/if}
	</div>
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
		transition: border-color 0.15s ease, background 0.15s ease;
	}
	.kf-placeholder:hover:not(:disabled) {
		border-color: var(--teal, #7dbfa7);
		background: #f8fafc;
	}
	.kf-placeholder:focus-visible {
		outline: 2px solid var(--teal, #7dbfa7);
		outline-offset: 2px;
	}
	.kf-fade { opacity: 0; transition: opacity 700ms ease; }
	.kf-fade.shown { opacity: 1; }
	.kf-word { opacity: 0; transition: opacity 320ms ease; }
	.kf-word.shown { opacity: 1; }
	.kf-caret { animation: kf-blink 0.9s steps(2) infinite; color: #94a3b8; }
	@keyframes kf-blink { 50% { opacity: 0; } }
	[contenteditable='true'] { outline: none; }
	[contenteditable='true']:focus { border-radius: 4px; box-shadow: 0 0 0 2px color-mix(in srgb, var(--teal, #7dbfa7) 40%, transparent); }
	@media (prefers-reduced-motion: reduce) {
		.kf-fade, .kf-word { opacity: 1; transition: none; }
		.kf-caret { animation: none; }
	}
</style>

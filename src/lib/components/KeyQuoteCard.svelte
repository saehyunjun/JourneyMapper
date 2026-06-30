<!--
	KeyQuoteCard — a single starred-quote card.

	The bordered "key quote" card used across the Lab Book: a centered
	blockquote framed by sentiment-tinted quote marks, a clickable participant
	chip, the source question, and an optional theme/score footer. Extracted
	from KeyQuotesSection so the same card can be reused on the analysis page's
	key-findings cards and the personas / community pages.

	Two sizes via the `size` prop:
	  - `sm` (default) — compact, for carousels and grids (3-up).
	  - `lg` — roomier marks, padding, and quote text for feature placements.
-->
<script lang="ts">
	import {
		questionLabel,
		participantLabel,
		titleCase,
		SENTIMENT_LABELS
	} from '$lib/content/wctglpdemo-data/analysis';
	import KeywordText from '$lib/components/KeywordText.svelte';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import { AppCard } from '$lib/components/ui/app-card';
	import { profileName, type ParticipantProfile } from '$lib/types/participant-profile';

	let {
		text,
		sentiment,
		interviewId,
		questionId,
		themes = [],
		profiles,
		onparticipant,
		size = 'sm',
		variant = 'default'
	}: {
		text: string;
		sentiment: number;
		interviewId: string;
		questionId: string;
		themes?: string[];
		profiles: Record<string, ParticipantProfile>;
		onparticipant: (interviewId: string) => void;
		size?: 'sm' | 'lg';
		/** Visual treatment.
		 *  - `default` — the canonical lab-book quote card: centered serif
		 *    text, sentiment-tinted SVG quote marks at the corners, a
		 *    pill participant chip beneath, optional theme chips below.
		 *  - `compact` — testimonial-style card from the 2026-05-29 mockup:
		 *    flat paper-tinted background, left-aligned bold sans body,
		 *    one heavy typographic quote glyph at top-left, name + role
		 *    bottom-left, avatar bottom-right. Smaller and denser. Use
		 *    inside card stacks where multiple quotes are visible at
		 *    once. */
		variant?: 'default' | 'compact';
	} = $props();

	// Per-size geometry — quote-mark dimensions, the spacing/type scale, and the
	// corner offset that places each mark inside the card.
	// pt/pb are larger than px so the marks (top-3/bottom-3) don't crowd the text.
	const SIZES = {
		sm: { markW: 26, markH: 18, pad: 'px-4 pt-7 pb-5', gap: 'gap-2', quote: 'text-xl', open: 'top-2 left-2', close: 'right-2 bottom-2' },
		lg: { markW: 36, markH: 24, pad: 'px-5 pt-9 pb-7', gap: 'gap-3', quote: 'text-2xl', open: 'top-3 left-3', close: 'right-3 bottom-3' }
	} as const;
	const s = $derived(SIZES[size]);

	// Tone applied to the quote-mark SVGs — color = sentiment.
	function sentimentTone(value: number) {
		if (value > 0) return 'text-emerald-500';
		if (value < 0) return 'text-rose-500';
		return 'text-primary';
	}
</script>

{#if variant === 'compact'}
	<!-- Compact testimonial variant: flat tinted card, single heavy quote
		 glyph top-left, left-aligned bold sans body, name+role / avatar
		 footer. Smaller and denser than the default — designed for stacks
		 and grids where multiple quotes coexist. -->
	<AppCard variant="default" tag="article" class="kqc-compact relative flex h-full flex-col">
		<span class="kqc-glyph" aria-hidden="true">&ldquo;</span>
		<blockquote class="kqc-body">
			<KeywordText {text} />
		</blockquote>
		<div class="kqc-footer">
			<button
				type="button"
				class="kqc-attribution"
				onclick={(e) => {
					e.stopPropagation();
					onparticipant(interviewId);
				}}
				title="View participant details"
			>
				<span class="kqc-name">
					{profileName(profiles[interviewId], participantLabel(interviewId))}
				</span>
				<span class="kqc-role">{questionLabel(questionId)}</span>
			</button>
			<!-- Small marker-sized avatar — the previous `lg` (128px) dominated
				 the footer; `sm` (28px) reads as an identity dot next to the
				 name, matching the scale Aaron flagged from the dashboard
				 reference mock. -->
			<ParticipantAvatar
				{interviewId}
				size="sm"
				src={profiles[interviewId]?.avatar_url}
			/>
		</div>
	</AppCard>
{:else}
	<AppCard variant="quote" tag="article" class="relative flex h-full flex-col {s.gap} {s.pad}">
		<!-- Opening quote mark — inside the top-left corner, colored by sentiment -->
		<svg
			class="pointer-events-none absolute opacity-40 {s.open} {sentimentTone(sentiment)}"
			width={s.markW}
			height={s.markH}
			viewBox="0 0 65 44"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label="{SENTIMENT_LABELS[sentiment]} quote"
		>
			<title>{SENTIMENT_LABELS[sentiment]} quote</title>
			<path
				fill="currentColor"
				d="M31.1877 16.947V0H25.0119C9.10927 0 0 9.32862 0 24.7208V44H21.4608V27.053C21.4608 20.8339 23.7767 16.947 28.563 16.947H31.1877ZM65 16.947V0H58.8242C42.9216 0 33.8124 9.32862 33.8124 24.7208V44H55.2732V27.053C55.2732 20.8339 57.5891 16.947 62.3753 16.947H65Z"
			/>
		</svg>
		<p class="text-center text-sm font-medium text-muted-foreground my-2">{questionLabel(questionId)}</p>

		<blockquote class="flex-1 px-1 text-center {s.quote} leading-relaxed text-primary">
			<KeywordText {text} />
		</blockquote>

		<div class="flex flex-col items-center gap-1.5">
			<button
				type="button"
				onclick={(e) => {
					// Stop the click bubbling to any clickable container (e.g. the
					// key-findings card opens its drawer on click).
					e.stopPropagation();
					onparticipant(interviewId);
				}}
				class="flex w-fit items-center gap-1.5 rounded-full border border-secondary bg-(--paper) py-0.5 pr-2.5 pl-0.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:cursor-pointer hover:border-accent-mint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-mint"
				title="View participant details"
			>
				<ParticipantAvatar
					{interviewId}
					size="md"
					src={profiles[interviewId]?.avatar_url}
				/>
				{profileName(profiles[interviewId], participantLabel(interviewId))}
			</button>

		</div>

		<!-- Closing quote mark — inside the bottom-right corner, same tone -->
		<svg
			class="pointer-events-none absolute opacity-40 {s.close} {sentimentTone(sentiment)}"
			width={s.markW}
			height={s.markH}
			viewBox="0 0 65 44"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
		>
			<path
				fill="currentColor"
				d="M33.8123 27.053L33.8123 44L39.9881 44C55.8907 44 65 34.6714 65 19.2792L65 5.68248e-06L43.5392 3.80632e-06L43.5392 16.947C43.5392 23.1661 41.2233 27.053 36.437 27.053L33.8123 27.053ZM1.48155e-06 27.053L0 44L6.1758 44C22.0784 44 31.1876 34.6714 31.1876 19.2792L31.1876 2.72651e-06L9.7268 8.50344e-07L9.7268 16.947C9.7268 23.1661 7.4109 27.053 2.6247 27.053L1.48155e-06 27.053Z"
			/>
		</svg>

		{#if themes.length}
			<div class="-mt-1 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3">
				{#each themes as t (t)}
					<span class="rounded-full bg-accent-mint/15 px-2 py-0.5 text-xs text-accent-mint">
						{titleCase(t)}
					</span>
				{/each}
			</div>
		{/if}
	</AppCard>
{/if}

<style>
	/* Compact testimonial variant styles. Scoped to .kqc-compact so they
	   don't bleed into the default rendering.
	   The footer auto-margin (.kqc-footer { margin-top: auto }) pins
	   name + avatar to the card's bottom edge regardless of body length —
	   short quotes used to leave the footer floating mid-card. */
	:global(.kqc-compact) {
		padding: 1.1rem 1.25rem 0.85rem;
		gap: 0.75rem;
		background: rgba(214, 226, 240, 0.55);
		border: 1px solid rgba(86, 109, 142, 0.18);
		border-radius: 12px;
	}
	.kqc-glyph {
		font-family: var(--font-heading, "Jost", sans-serif);
		font-weight: 900;
		font-size: 2.5rem;
		line-height: 0.6;
		color: var(--ink, #312f28);
		letter-spacing: -0.05em;
	}
	.kqc-body {
		flex: 1;
		margin: 0;
		font-family: var(--font-heading, "Jost", sans-serif);
		font-weight: 700;
		font-size: 0.95rem;
		line-height: 1.35;
		color: var(--ink, #312f28);
		text-wrap: pretty;
		display: -webkit-box;
		-webkit-line-clamp: 5;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.kqc-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		/* `margin-top: auto` pushes the footer to the card's bottom edge so a
		   short body doesn't leave the attribution floating in the middle. */
		margin-top: auto;
		padding-top: 0.55rem;
		border-top: 1px solid rgba(48, 47, 40, 0.08);
	}
	.kqc-attribution {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.05rem;
		padding: 0;
		border: none;
		background: transparent;
		text-align: left;
		cursor: pointer;
		min-width: 0;
		flex: 1;
	}
	.kqc-name {
		font-family: var(--font-heading, "Jost", sans-serif);
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--ink, #312f28);
		line-height: 1.15;
	}
	.kqc-role {
		font-family: var(--font-body, "IBM Plex Sans", system-ui);
		font-weight: 400;
		font-size: 0.78rem;
		color: var(--muted-foreground, #6b7280);
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}
</style>

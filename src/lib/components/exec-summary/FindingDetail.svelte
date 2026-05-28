<!--
	FindingDetail — right-pane detail view for one selected key finding.

	Lean editorial read: eyebrow, headline (lede), supporting paragraph,
	sentiment donut, and the analyst-voice considerations callouts. The
	denser evidence material (cluster bubble chart, anchor quote,
	participants, every tagged quote) lives in FindingEvidenceDrawer and
	opens via the "View evidence" CTA.

	Selection lives in the parent. Clicking a participant avatar (in the
	drawer) bubbles up via `onparticipant`, which the parent uses to open
	ParticipantDrawer.
-->
<script lang="ts">
	import type { Finding } from '$lib/content/wctglpdemo-data/executive-summary';
	import type { ParticipantProfile } from '$lib/types/participant-profile';
	import type { Consideration } from '$lib/content/wctglpdemo-data/dashboard-blurbs';
	import SentimentDonut from '$lib/components/SentimentDonut.svelte';
	import BlurbText, { type RefKind } from './BlurbText.svelte';
	import FindingEvidenceDrawer from './FindingEvidenceDrawer.svelte';
	import { ArrowRight } from '@lucide/svelte';

	type FindingWithBlurb = Finding & { considerations?: Consideration[] };

	type Props = {
		finding: FindingWithBlurb;
		profiles: Record<string, ParticipantProfile>;
		onparticipant: (interviewId: string) => void;
		onref?: (kind: RefKind, id: string) => void;
		knownRefs?: Partial<Record<RefKind, Set<string>>>;
	};

	let { finding, profiles, onparticipant, onref, knownRefs }: Props = $props();

	// Prefer the analyst-voice copy (Haiku-generated, from dashboard-blurbs.ts)
	// when present; fall back to the runtime template strings otherwise.
	const headlineText = $derived(finding.lede?.trim() || finding.headline);
	const bodyText = $derived(finding.analysis?.trim() || finding.detail);
	const considerations = $derived(finding.considerations ?? []);

	const toneAccent: Record<Finding['tone'], string> = {
		positive: 'text-emerald-700',
		negative: 'text-rose-700',
		divisive: 'text-amber-700',
		neutral: 'text-accent-mint'
	};

	const considerationMeta: Record<Consideration['kind'], { label: string; accent: string }> = {
		insight: { label: 'Insight', accent: 'border-l-accent-mint' },
		tension: { label: 'Tension', accent: 'border-l-amber-500' },
		implication: { label: 'Implication', accent: 'border-l-sky-600' }
	};

	// Evidence drawer — counts in the CTA give the reader a sense of what's
	// behind it before they open.
	let evidenceOpen = $state(false);
	const participantCount = $derived(
		new Set(finding.fragments.map((f) => f.interview_id)).size
	);
</script>

<div class="flex flex-col gap-8 p-8">
	<!-- Header -->
	<header class="flex flex-col gap-4">
		<div class="flex items-start justify-between gap-6">
			<div class="flex min-w-0 flex-1 flex-col gap-2">
				<span class="text-[11px] font-semibold uppercase tracking-wider {toneAccent[finding.tone]}">
					{finding.eyebrow}
				</span>
				<h2 class="font-heading text-2xl font-light text-primary md:text-3xl">
					<BlurbText text={headlineText} {onref} known={knownRefs} />
				</h2>
				<p class="max-w-3xl text-base leading-7 text-muted-foreground">
					<BlurbText text={bodyText} {onref} known={knownRefs} />
				</p>
			</div>
			<div class="shrink-0">
				<SentimentDonut
					positive={finding.distribution.positive}
					neutral={finding.distribution.neutral}
					negative={finding.distribution.negative}
				/>
			</div>
		</div>

		<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
			<span class="text-2xl font-medium {toneAccent[finding.tone]} tabular-nums">
				{finding.stat.value}
			</span>
			<span>· {finding.stat.caption}</span>
		</div>
	</header>

	<!-- Considerations — pull-quote-style callouts for the standout claims -->
	{#if considerations.length}
		<section class="flex flex-col gap-2">
			{#each considerations as c, i (i)}
				<div
					class="flex flex-col gap-1 border-l-2 bg-(--ink)/3 px-4 py-3 {considerationMeta[c.kind].accent}"
				>
					<span class="figcaption text-[10px] text-muted-foreground">
						{considerationMeta[c.kind].label}
					</span>
					<p class="text-pretty text-[15px] leading-relaxed text-primary">
						<BlurbText text={c.text} {onref} known={knownRefs} />
					</p>
				</div>
			{/each}
		</section>
	{/if}

	<!-- Evidence CTA — opens FindingEvidenceDrawer -->
	<button
		type="button"
		class="evidence-cta group"
		onclick={() => (evidenceOpen = true)}
	>
		<span class="flex flex-col items-start gap-0.5">
			<span class="text-sm font-medium text-primary">View evidence</span>
			<span class="text-xs text-muted-foreground">
				{finding.clusters.length} clusters · {participantCount} participants · {finding.fragments.length} tagged quotes
			</span>
		</span>
		<ArrowRight class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
	</button>
</div>

<FindingEvidenceDrawer bind:open={evidenceOpen} {finding} {profiles} {onparticipant} />

<style>
	.evidence-cta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		padding: 0.875rem 1rem;
		border: 1px solid rgba(48, 47, 40, 0.15);
		border-radius: 8px;
		background: transparent;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 160ms ease,
			background 160ms ease;
	}
	.evidence-cta:hover,
	.evidence-cta:focus-visible {
		border-color: rgba(48, 47, 40, 0.4);
		background: rgba(48, 47, 40, 0.03);
		outline: none;
	}
</style>

<!--
	FindingEvidenceDrawer — the evidence behind a finding, opened from
	FindingDetail. Holds the keyword-cluster bubble chart, anchor quote,
	participants, and every tagged quote — the dense, exploratory material
	that used to sit inline in the right pane.

	Right-pane reads stay short and editorial; the reader pops the drawer
	when they want to inspect what the finding is built on.
-->
<script lang="ts">
	import type { Finding } from '$lib/content/wctglpdemo-data/executive-summary';
	import type { ParticipantProfile } from '$lib/types/participant-profile';
	import { participantLabel } from '$lib/content/wctglpdemo-data/analysis';
	import { profileName } from '$lib/types/participant-profile';
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import BubbleChart from '$lib/components/BubbleChart.svelte';
	import KeyQuoteCard from '$lib/components/KeyQuoteCard.svelte';
	import CodedFragmentCard from '$lib/components/CodedFragmentCard.svelte';
	import ParticipantAvatar from '$lib/components/ParticipantAvatar.svelte';
	import { Star } from '@lucide/svelte';

	type Props = {
		open: boolean;
		finding: Finding;
		profiles: Record<string, ParticipantProfile>;
		onparticipant: (interviewId: string) => void;
	};

	let { open = $bindable(false), finding, profiles, onparticipant }: Props = $props();

	const toneAccent: Record<Finding['tone'], string> = {
		positive: 'text-emerald-700',
		negative: 'text-rose-700',
		divisive: 'text-amber-700',
		neutral: 'text-accent-mint'
	};

	const participants = $derived(
		Array.from(new Set(finding.fragments.map((f) => f.interview_id)))
	);

	// Width measurement for the BubbleChart so it fills the drawer gracefully.
	let bubbleWrapW = $state(0);
</script>

<RightDrawer bind:open>
	<div class="flex h-full flex-col">
		<!-- Drawer header — anchors which finding's evidence is on display -->
		<header class="flex flex-col gap-1 border-b border-(--ink)/10 px-8 py-6 pr-16">
			<span class="text-[11px] font-semibold uppercase tracking-wider {toneAccent[finding.tone]}">
				{finding.eyebrow}
			</span>
			<h2 class="font-heading text-xl font-light text-primary">Evidence</h2>
			<p class="text-xs text-muted-foreground">
				<span class="tabular-nums">{finding.stat.value}</span> · {finding.stat.caption}
			</p>
		</header>

		<div class="flex flex-1 flex-col gap-8 overflow-y-auto p-8">
			<!-- Keyword clusters -->
			{#if finding.clusters.length}
				<section class="flex flex-col gap-3">
					<div class="flex items-baseline justify-between">
						<h3 class="figcaption text-muted-foreground">Driving keyword clusters</h3>
						<span class="text-xs text-muted-foreground">
							{finding.clusters.length} clusters
						</span>
					</div>
					<div bind:clientWidth={bubbleWrapW}>
						{#if bubbleWrapW > 0}
							<BubbleChart
								items={finding.clusters.map((c) => c.label)}
								values={finding.clusters.map((c) => c.count)}
								context="card"
								units="%"
								width={Math.max(320, bubbleWrapW)}
								height={320}
								allowUserOverride={true}
							/>
						{/if}
					</div>
				</section>
			{/if}

			<!-- Anchor quote -->
			{#if finding.quote}
				<section class="flex flex-col gap-3 border-t border-(--ink)/10 pt-6">
					<h3 class="figcaption text-muted-foreground">Anchor quote</h3>
					<KeyQuoteCard
						text={finding.quote.text}
						sentiment={finding.quote.sentiment}
						interviewId={finding.quote.interview_id}
						questionId={finding.quote.question_id}
						{profiles}
						onparticipant={onparticipant}
						size="lg"
					/>
					{#if finding.quote.isStarred}
						<span class="flex items-center gap-1 self-start text-xs text-amber-600">
							<Star class="size-3.5 fill-amber-400 text-amber-400" />
							Analyst-starred highlight
						</span>
					{/if}
				</section>
			{/if}

			<!-- Participants involved -->
			{#if participants.length}
				<section class="flex flex-col gap-3 border-t border-(--ink)/10 pt-6">
					<h3 class="figcaption text-muted-foreground">
						Participants ({participants.length})
					</h3>
					<div class="flex flex-wrap gap-2">
						{#each participants as id (id)}
							<button
								type="button"
								class="flex items-center gap-2 rounded-full border border-(--ink)/15 bg-(--paper) py-1 pr-3 pl-1 text-xs text-foreground transition-colors hover:bg-(--ink)/5"
								onclick={() => onparticipant(id)}
							>
								<ParticipantAvatar interviewId={id} size="sm" src={profiles[id]?.avatar_url} />
								{profileName(profiles[id], participantLabel(id))}
							</button>
						{/each}
					</div>
				</section>
			{/if}

			<!-- All tagged quotes -->
			<section class="flex flex-col gap-3 border-t border-(--ink)/10 pt-6">
				<div class="flex items-baseline justify-between">
					<h3 class="figcaption text-muted-foreground">Tagged quotes</h3>
					<span class="text-xs text-muted-foreground tabular-nums">
						{finding.fragments.length}
					</span>
				</div>
				{#if finding.fragments.length}
					<div class="flex flex-col gap-3">
						{#each finding.fragments as f (f.segment_id)}
							<CodedFragmentCard fragment={f} {profiles} />
						{/each}
					</div>
				{:else}
					<p class="rounded-lg border border-dashed border-(--ink)/15 p-6 text-center text-sm text-muted-foreground">
						No tagged quotes behind this finding yet (placeholder data).
					</p>
				{/if}
			</section>
		</div>
	</div>
</RightDrawer>

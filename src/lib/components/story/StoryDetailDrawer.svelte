
<!--
	StoryDetailDrawer — the side drawer that opens when the user clicks an
	inline numeric phrase or the "view drivers" CTA on a story slide.

	Renders the slide's SlideDetail payload: header (eyebrow + headline +
	summary) → one or more labelled driver sections (each row: label · micro
	sentiment bar · count) → optional list of the underlying tagged quotes
	rendered with the shared CodedFragmentCard so the drawer matches the
	dashboard's existing detail surfaces.
-->
<script lang="ts">
	import RightDrawer from '$lib/components/RightDrawer.svelte';
	import CodedFragmentCard from '$lib/components/CodedFragmentCard.svelte';
	import SentimentMicroBar from './viz/SentimentMicroBar.svelte';
	import type { SlideDetail } from '$lib/story/types';
	import type { ParticipantProfile } from '$lib/types/participant-profile';

	let {
		open = $bindable(false),
		detail,
		profiles
	}: {
		open?: boolean;
		detail: SlideDetail | null;
		profiles: Record<string, ParticipantProfile>;
	} = $props();
</script>

<RightDrawer bind:open>
	{#if detail}
		<div class="flex h-full flex-col">
			<div class="flex flex-col gap-1 border-b border-slate-200 p-6">
				<span class="font-heading text-xs font-semibold uppercase tracking-[0.14em] text-accent-mint">
					{detail.eyebrow}
				</span>
				<h2 class="font-heading text-2xl font-light leading-tight text-primary">
					{detail.headline}
				</h2>
				<p class="text-sm leading-relaxed text-muted-foreground">{detail.summary}</p>
			</div>

			<div class="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
				{#each detail.sections as section, si (section.label + si)}
					<section class="flex flex-col gap-3">
						<header class="flex items-baseline justify-between">
							<h3 class="font-heading text-sm font-medium uppercase tracking-wide text-accent-mint">
								{section.label}
							</h3>
							<span class="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
								{section.drivers.length} {section.drivers.length === 1 ? 'driver' : 'drivers'}
							</span>
						</header>
						<ul class="flex flex-col gap-2.5">
							{#each section.drivers as d, di (d.label + di)}
								{@const total = d.positive + d.neutral + d.negative}
								<li class="grid grid-cols-[minmax(0,1fr)_140px_2.25rem] items-center gap-3 border-b border-slate-100 pb-2 text-sm last:border-b-0">
									<span class="truncate text-primary" title={d.label}>{d.label}</span>
									<SentimentMicroBar
										positive={d.positive}
										neutral={d.neutral}
										negative={d.negative}
										width={140}
										delay={120 + di * 60}
									/>
									<span class="text-right font-mono tabular-nums text-xs text-muted-foreground">
										{total}
									</span>
								</li>
							{/each}
						</ul>
					</section>
				{/each}

				{#if detail.fragments?.length}
					<section class="flex flex-col gap-3 border-t border-slate-200 pt-6">
						<header class="flex items-baseline justify-between">
							<h3 class="font-heading text-sm font-medium uppercase tracking-wide text-accent-mint">
								Tagged quotes
							</h3>
							<span class="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
								{detail.fragments.length}
							</span>
						</header>
						<div class="flex flex-col gap-3">
							{#each detail.fragments as f (f.segment_id)}
								<CodedFragmentCard fragment={f} {profiles} />
							{/each}
						</div>
					</section>
				{/if}
			</div>
		</div>
	{/if}
</RightDrawer>

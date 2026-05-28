<!--
	InsightOverview — the default detail state for the dashboard right pane.

	Per the approach-1 refinement: a single editorial read (typeset paragraph
	+ slim onward rail) so the dot grid stays the page's only visual. The
	inline IndicationPoster was dropped — its visual job is now the grid's.

	When `overviewBlurb` is supplied (from dashboard-blurbs.json, Haiku-
	generated), it replaces the programmatic `summaryText` so the reader gets
	an analyst-voice paragraph instead of a template string. Falls back to
	`summaryText` when no blurb is available for the active indication.
-->
<script lang="ts">
	import { MoveUpRight } from '@lucide/svelte';
	import BlurbText, { type RefKind } from './BlurbText.svelte';

	type ExploreLink = { href: string; title: string; blurb: string };

	type Props = {
		summaryText: string;
		overviewBlurb?: string | null;
		explore: ExploreLink[];
		onref?: (kind: RefKind, id: string) => void;
		knownRefs?: Partial<Record<RefKind, Set<string>>>;
	};

	let { summaryText, overviewBlurb = null, explore, onref, knownRefs }: Props = $props();

	const bodyText = $derived(overviewBlurb && overviewBlurb.trim() ? overviewBlurb : summaryText);
</script>

<div class="flex flex-col gap-10 p-8">
	<section class="flex flex-col gap-3">
		<span class="figcaption text-accent-mint">The read</span>
		<p class="text-pretty text-lg leading-relaxed text-secondary-foreground">
			<BlurbText text={bodyText} {onref} known={knownRefs} />
		</p>
		<p class="pt-2 text-sm text-muted-foreground">
			Pick a finding, theme, or quote on the left to drill in — or jump to one of the
			deeper views below.
		</p>
	</section>

	{#if explore.length}
		<section class="flex flex-col gap-3 border-t border-(--ink)/15 pt-8">
			<span class="figcaption text-accent-mint">Go deeper</span>
			<ul class="flex flex-col">
				{#each explore as out (out.href)}
					<li>
						<a
							href={out.href}
							class="group flex items-center justify-between gap-4 border-b border-(--ink)/10 py-3 transition-colors hover:bg-(--ink)/3"
						>
							<div class="flex min-w-0 flex-col gap-0.5">
								<span class="text-sm font-medium uppercase tracking-tight text-accent-mint">
									{out.title}
								</span>
								<span class="truncate text-xs text-muted-foreground">{out.blurb}</span>
							</div>
							<MoveUpRight
								class="size-4 shrink-0 text-accent-mint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
							/>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

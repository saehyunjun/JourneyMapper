<!--
	SponsorDrawer — tertiary drawer for one clinical-trial sponsor / org.
	Shows what we observed for this sponsor in the indication's clinical-trial
	registry: trial count (lead vs. collaborator), org classes, and the list of
	NCT ids (each links out to clinicaltrials.gov).

	Source: sponsors_observed.json via /api/sponsors-observed. Org names like
	"Fate Therapeutics" surface in workbench answers and are matched verbatim
	against this list — click → opens this drawer.

	Presentational only: caller owns the open/close state and the active
	sponsor selection.
-->
<script lang="ts">
	import TertiaryDrawer from '$lib/components/TertiaryDrawer.svelte';
	import type { ObservedSponsor } from '$lib/types/observed-sponsor';

	let {
		sponsor,
		onclose,
		level = 'top'
	}: {
		sponsor: ObservedSponsor | null;
		onclose: () => void;
		level?: 'secondary' | 'top';
	} = $props();

	const open = $derived(sponsor !== null);

	function classLabel(cls: string): string {
		const map: Record<string, string> = {
			INDUSTRY: 'Industry',
			NIH: 'NIH',
			FED: 'Federal',
			OTHER_GOV: 'Government',
			NETWORK: 'Network',
			AMBIG: 'Ambiguous',
			INDIV: 'Individual',
			OTHER: 'Other / academic'
		};
		return map[cls] ?? cls;
	}

	function ctgovUrl(nctId: string): string {
		return `https://clinicaltrials.gov/study/${nctId}`;
	}
</script>

<TertiaryDrawer
	{open}
	{onclose}
	ariaLabel="Clinical-trial sponsor detail"
	{level}
	width="wide"
	eyebrow={sponsor ? 'Sponsor · observed in trial registry' : undefined}
	title={sponsor?.name}
	subtitle={sponsor
		? `${sponsor.total_count} ${sponsor.total_count === 1 ? 'trial' : 'trials'} in this indication`
		: undefined}
>
	{#if sponsor}
		<div class="flex flex-1 flex-col gap-6 p-4">
			<!-- Headline counts -->
			<div class="grid grid-cols-3 gap-2">
				<div class="border-b border-accent pb-2">
					<p class="text-2xl font-semibold tabular-nums text-slate-800">{sponsor.total_count}</p>
					<p class="text-[10px] uppercase tracking-wider text-slate-500">Total trials</p>
				</div>
				<div class="border-b border-accent pb-2">
					<p class="text-2xl font-semibold tabular-nums text-slate-800">{sponsor.lead_count}</p>
					<p class="text-[10px] uppercase tracking-wider text-slate-500">As lead</p>
				</div>
				<div class="border-b border-accent pb-2">
					<p class="text-2xl font-semibold tabular-nums text-slate-800">
						{sponsor.collaborator_count}
					</p>
					<p class="text-[10px] uppercase tracking-wider text-slate-500">As collaborator</p>
				</div>
			</div>

			<!-- Classes -->
			{#if sponsor.classes.length > 0}
				<div>
					<h3 class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
						Classification
					</h3>
					<ul class="flex flex-wrap gap-1.5">
						{#each sponsor.classes as cls (cls)}
							<li
								class="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700"
							>
								{classLabel(cls)}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- NCT ids -->
			<div>
				<h3 class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
					Trials on ClinicalTrials.gov
				</h3>
				{#if sponsor.nct_ids.length === 0}
					<p class="text-xs text-slate-500">No NCT ids recorded for this sponsor.</p>
				{:else}
					<ul class="grid grid-cols-2 gap-1 text-xs sm:grid-cols-3">
						{#each sponsor.nct_ids as nct (nct)}
							<li>
								<a
									href={ctgovUrl(nct)}
									target="_blank"
									rel="noopener noreferrer"
									class="block rounded border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
								>
									{nct}
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<p class="text-[11px] text-slate-500">
				Trial counts and NCT ids are from the indication's
				<code class="rounded bg-slate-100 px-1 py-0.5 text-[10px]">sponsors_observed.json</code>
				snapshot. Click any NCT to open the registry record.
			</p>
		</div>
	{/if}
</TertiaryDrawer>

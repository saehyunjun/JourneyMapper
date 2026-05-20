<!--
	KeywordTagDrawer — tertiary drawer for filing a highlighted phrase into the
	keyword lexicon. Opened from the segment tag drawer's right-click menu.

	Stacks on top of the segment tag drawer (z-60 backdrop, z-70 panel). The
	parent passes the snapshot of the highlighted text, the live lexicon, and a
	callback that runs the server-side mutation; this component only handles
	the UI of picking a category, picking an existing keyword, or naming a new
	one.
-->
<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';

	type Keyword = { id: string; label: string; variants: string[] };
	type Category = { id: string; label: string; description: string; keywords: Keyword[] };

	let {
		open = $bindable(false),
		selection,
		categories,
		busy = false,
		errorMsg = '',
		onapplyVariant,
		oncreate
	}: {
		open?: boolean;
		selection: string;
		categories: Category[];
		busy?: boolean;
		errorMsg?: string;
		onapplyVariant: (keywordId: string) => void;
		oncreate: (categoryId: string) => void;
	} = $props();

	const selLower = $derived(selection.trim().toLowerCase());

	// Keywords whose label or existing variants already include the selection.
	type Suggestion = { categoryLabel: string; keyword: Keyword };
	const suggestions = $derived.by((): Suggestion[] => {
		if (!selLower) return [];
		const out: Suggestion[] = [];
		for (const cat of categories) {
			for (const kw of cat.keywords) {
				if (
					kw.label.toLowerCase().includes(selLower) ||
					kw.variants.some((v) => v.toLowerCase().includes(selLower))
				) {
					out.push({ categoryLabel: cat.label, keyword: kw });
				}
			}
		}
		return out;
	});
</script>

{#if open}
	<!-- Backdrop — clicking it closes without applying. Sits above the segment
		 drawer's own backdrop (z-40) and its panel (z-50). -->
	<div
		class="fixed inset-0 z-60 bg-slate-900/30"
		transition:fade={{ duration: 180 }}
		onclick={() => (open = false)}
		aria-hidden="true"
	></div>

	<aside
		class="fixed inset-y-0 right-0 z-70 flex w-full max-w-md flex-col bg-white shadow-2xl"
		transition:fly={{ x: 120, duration: 240, easing: cubicOut }}
		aria-label="Tag as keyword"
	>
		<header class="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
			<div class="min-w-0">
				<p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
					Tag as keyword
				</p>
				<h2 class="mt-1 truncate font-heading text-xl font-light text-primary">
					“{selection}”
				</h2>
			</div>
			<Button variant="ghost" size="sm" onclick={() => (open = false)} aria-label="Close">
				<XIcon />
			</Button>
		</header>

		<div class="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
			{#if errorMsg}
				<p class="rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
					{errorMsg}
				</p>
			{/if}

			{#if suggestions.length}
				<section>
					<p class="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
						Already a variant of
					</p>
					<div class="flex flex-col gap-1">
						{#each suggestions as s (s.keyword.id)}
							<button
								type="button"
								class="flex items-center justify-between gap-2 rounded border border-slate-200 px-2 py-1.5 text-left text-sm transition-colors hover:border-slate-400 disabled:opacity-50"
								disabled={busy}
								onclick={() => onapplyVariant(s.keyword.id)}
							>
								<span>
									<span class="font-medium text-slate-700">{s.keyword.label}</span>
									<span class="ml-2 text-[10px] text-slate-400">{s.categoryLabel}</span>
								</span>
								<span class="text-[10px] text-slate-400">{s.keyword.variants.length} variants</span>
							</button>
						{/each}
					</div>
				</section>
			{/if}

			{#each categories as cat (cat.id)}
				<section>
					<div class="mb-2 flex items-baseline justify-between gap-2">
						<p class="text-[10px] font-bold uppercase tracking-wide text-slate-500">
							{cat.label}
						</p>
						<button
							type="button"
							class="text-[11px] text-accent-mint hover:underline disabled:opacity-50"
							disabled={busy}
							onclick={() => oncreate(cat.id)}
						>
							+ New keyword here
						</button>
					</div>
					<div class="flex flex-wrap gap-1.5">
						{#each cat.keywords as kw (kw.id)}
							<button
								type="button"
								class="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 transition-colors hover:border-slate-400 disabled:opacity-50"
								disabled={busy}
								onclick={() => onapplyVariant(kw.id)}
							>
								{kw.label}
							</button>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	</aside>
{/if}

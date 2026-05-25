<!--
	KeywordTagDrawer — tertiary drawer for linking a highlighted phrase to a
	keyword under a codebook subtheme. Opened from the segment tag drawer.

	Two modes:
	  - Tag mode (default): clicking a keyword writes a per-instance tag row
	    (cluster_id, segment_id, char_start, char_end). The same surface form in
	    a different segment can link to a different keyword — context decides.
	  - Move mode (currentKeyword set): clicking a keyword moves the variant
	    from `currentKeyword` to the clicked cluster. The variant is a lexicon-
	    level concept; the existing per-instance tag rows are left alone.

	"+ New keyword here" reveals an inline form so the analyst can name the new
	keyword (e.g. "Trial duration") with the highlighted phrase as its first
	variant. In move mode the same form defines the move target.

	Variants in keyword_lexicon.json are SUGGESTION FUEL — they rank keywords in
	the "Suggested" section and drive bolding in the segment quote.

	Body-only; the chrome (backdrop, slide-in, header with close button, body
	scroll container) is owned by TertiaryDrawer.
-->
<script lang="ts">
	import TertiaryDrawer from '$lib/components/TertiaryDrawer.svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	type Keyword = { id: string; label: string; variants: string[] };
	type Category = { id: string; label: string; description: string; keywords: Keyword[] };

	let {
		open = $bindable(false),
		selection,
		categories,
		currentKeyword = null,
		busy = false,
		errorMsg = '',
		successMsg = '',
		formResetSeq = 0,
		ontag,
		oncreate,
		onclose
	}: {
		open?: boolean;
		selection: string;
		categories: Category[];
		/** The source cluster being moved away from. When set, the drawer is in
		 *  "move" mode: ontag moves the variant, oncreate moves it to a brand-new
		 *  cluster. The source cluster's chip is shown disabled. */
		currentKeyword?: { id: string; label: string } | null;
		busy?: boolean;
		errorMsg?: string;
		/** Success notice rendered in-drawer. The parent's flash banner sits
		 *  behind the tertiary backdrop, so move-mode confirmations need to
		 *  surface here. */
		successMsg?: string;
		/** Bumped by the parent after a successful create-and-move so the inline
		 *  "new keyword" form clears without us having to toggle `open`. */
		formResetSeq?: number;
		/** Tag mode: link the pinned span to this keyword.
		 *  Move mode: move the variant to this keyword. */
		ontag: (keywordId: string) => void;
		/** Tag mode: define a new keyword and link the pinned span to it.
		 *  Move mode: define a new keyword and move the variant into it. */
		oncreate: (input: { categoryId: string; label: string; description: string }) => void;
		/** Forwarded to TertiaryDrawer so the parent can clear move-mode state
		 *  when the analyst dismisses the drawer without acting. */
		onclose?: () => void;
	} = $props();

	const isMoveMode = $derived(!!currentKeyword);
	const selLower = $derived(selection.trim().toLowerCase());

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

	// Inline "new keyword" form — only one category can be in form-mode at a
	// time. `newClusterFor` is the subtheme id whose form is currently open;
	// empty string means no form is open.
	let newClusterFor = $state('');
	let newClusterLabel = $state('');
	let newClusterDescription = $state('');

	// Reset the form whenever the drawer toggles, so a previously abandoned
	// form doesn't reappear when the analyst re-opens the drawer on a new span.
	$effect(() => {
		open;
		formResetSeq;
		newClusterFor = '';
		newClusterLabel = '';
		newClusterDescription = '';
	});

	function openNewClusterForm(categoryId: string) {
		newClusterFor = categoryId;
		newClusterLabel = '';
		newClusterDescription = '';
	}

	function cancelNewClusterForm() {
		newClusterFor = '';
		newClusterLabel = '';
		newClusterDescription = '';
	}

	function submitNewClusterForm() {
		const label = newClusterLabel.trim();
		if (!label || busy) return;
		oncreate({
			categoryId: newClusterFor,
			label,
			description: newClusterDescription.trim()
		});
	}

	const isCurrent = (id: string) => currentKeyword?.id === id;
	const eyebrowText = $derived(isMoveMode ? 'Move keyword' : 'Link to keyword');
	const ariaLabelText = $derived(isMoveMode ? 'Move to a different keyword' : 'Link to keyword');
	const submitLabel = $derived(isMoveMode ? 'Define & move' : 'Create & link');
	const submitBusyLabel = $derived(isMoveMode ? 'Moving…' : 'Linking…');
</script>

<TertiaryDrawer
	bind:open
	ariaLabel={ariaLabelText}
	eyebrow={eyebrowText}
	title={`“${selection}”`}
	{onclose}
>
	<div class="flex flex-col gap-5 p-4">
		{#if isMoveMode && currentKeyword}
			<p class="rounded border border-amber-200 bg-amber-50 p-2 text-xs leading-snug text-amber-900">
				Currently linked to
				<span class="font-semibold">“{currentKeyword.label}”</span>. Pick a different keyword to
				move
				<span class="font-semibold">“{selection}”</span>, or define a new one.
			</p>
		{:else}
			<p class="text-[11px] leading-snug text-slate-400">
				Pick a keyword to link this span to it, or define a new one under a subtheme. The same
				span in a different segment can link to a different keyword — context decides.
			</p>
		{/if}

		{#if errorMsg}
			<p class="rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
				{errorMsg}
			</p>
		{/if}

		{#if successMsg}
			<p class="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
				{successMsg}
			</p>
		{/if}

		{#if suggestions.length}
			<section>
				<p class="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
					Suggested (variant match)
				</p>
				<div class="flex flex-col gap-1">
					{#each suggestions as s (s.keyword.id)}
						{@const current = isCurrent(s.keyword.id)}
						<Button
							variant="outline"
							size="sm"
							pressed={current}
							activeClass="cursor-not-allowed border-amber-200 bg-amber-50"
							class="h-auto justify-between gap-2 rounded border-slate-200 px-2 py-1.5 text-left hover:border-accent-mint hover:bg-accent-mint/10"
							disabled={busy || current}
							onclick={() => ontag(s.keyword.id)}
						>
							<span>
								<span class="font-medium text-slate-700">{s.keyword.label}</span>
								<span class="ml-2 text-[10px] text-slate-400">{s.categoryLabel}</span>
							</span>
							<span class="text-[10px] text-slate-400">
								{#if current}
									currently linked
								{:else}
									{s.keyword.variants.length} variants
								{/if}
							</span>
						</Button>
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
					<Button
						variant="link"
						size="xs"
						class="text-[11px] text-accent-mint"
						disabled={busy || newClusterFor === cat.id}
						onclick={() => openNewClusterForm(cat.id)}
					>
						+ New keyword here
					</Button>
				</div>

				{#if newClusterFor === cat.id}
					<div class="mb-2 rounded-md border border-accent-mint/40 bg-accent-mint/5 p-3">
						<p class="mb-2 text-[11px] leading-snug text-slate-500">
							{#if isMoveMode}
								Define a new keyword in
								<span class="font-medium text-slate-700">{cat.label}</span>.
								<span class="font-medium text-slate-700">“{selection}”</span> will be moved into
								it.
							{:else}
								Define a new keyword in
								<span class="font-medium text-slate-700">{cat.label}</span>.
								<span class="font-medium text-slate-700">“{selection}”</span> becomes its first
								variant.
							{/if}
						</p>
						<label class="mb-2 flex flex-col gap-1 text-xs">
							<span class="font-medium text-slate-600">Keyword name</span>
							<input
								type="text"
								bind:value={newClusterLabel}
								placeholder="e.g. Trial duration"
								disabled={busy}
								class="rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
							/>
						</label>
						<label class="mb-2 flex flex-col gap-1 text-xs">
							<span class="font-medium text-slate-600">
								Description <span class="text-slate-400">(optional)</span>
							</span>
							<textarea
								bind:value={newClusterDescription}
								rows="2"
								placeholder="One sentence on what this keyword covers."
								disabled={busy}
								class="resize-y rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
							></textarea>
						</label>
						<div class="flex justify-end gap-2">
							<Button
								variant="outline"
								size="xs"
								class="rounded border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
								disabled={busy}
								onclick={cancelNewClusterForm}
							>
								Cancel
							</Button>
							<Button
								variant="secondary"
								size="xs"
								class="rounded bg-accent-mint font-medium text-white hover:bg-accent-mint/90"
								disabled={busy || !newClusterLabel.trim()}
								onclick={submitNewClusterForm}
							>
								{busy ? submitBusyLabel : submitLabel}
							</Button>
						</div>
					</div>
				{/if}

				<div class="flex flex-wrap gap-1.5">
					{#each cat.keywords as kw (kw.id)}
						{@const current = isCurrent(kw.id)}
						<Button
							variant="outline"
							size="xs"
							pressed={current}
							activeClass="cursor-not-allowed border-amber-300 bg-amber-50 text-amber-900"
							title={current ? 'Currently linked — pick another keyword to move it' : kw.label}
							class="rounded-full border-slate-200 text-slate-600 hover:border-accent-mint hover:bg-accent-mint/10"
							disabled={busy || current}
							onclick={() => ontag(kw.id)}
						>
							{kw.label}{#if current} · current{/if}
						</Button>
					{/each}
					{#if !cat.keywords.length && newClusterFor !== cat.id}
						<p class="text-[11px] text-slate-400">
							No keywords yet — click <em>+ New keyword here</em> to define one.
						</p>
					{/if}
				</div>
			</section>
		{/each}
	</div>
</TertiaryDrawer>

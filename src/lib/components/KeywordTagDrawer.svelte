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

	The single "+ New keyword" action at the top reveals an inline form with a
	subtheme picker so the analyst can name a new keyword (e.g. "Trial duration")
	with the highlighted phrase as its first variant. In move mode the same form
	defines the move target.

	When `scopedSubthemes` is non-empty the categories are partitioned: subthemes
	the fragment/segment already tagged appear up front; the rest are tucked
	under a collapsed "Other subthemes" disclosure. Typing in the search box
	auto-opens that disclosure so matches in unscoped subthemes aren't hidden.

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
		scopedSubthemes = [],
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
		/** Subtheme IDs the fragment/segment has already selected. When non-empty
		 *  these categories render up front; the rest collapse under "Other
		 *  subthemes". Empty array = show everything inline (legacy behavior). */
		scopedSubthemes?: string[];
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

	// Suggested (variant match against the highlighted span). High-signal and
	// span-driven; sits above the searchable list.
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

	// Scope partition — subthemes the analyst has already tagged on the parent
	// surface (fragment or segment) come first. The rest are tucked away.
	const scopeSet = $derived(new Set(scopedSubthemes));
	const hasScope = $derived(scopedSubthemes.length > 0);
	const inScopeCategories = $derived(
		hasScope ? categories.filter((c) => scopeSet.has(c.id)) : categories
	);
	const otherCategories = $derived(
		hasScope ? categories.filter((c) => !scopeSet.has(c.id)) : []
	);

	// Search — filters across keyword label, variants, and the subtheme label
	// itself (so typing "trial" surfaces every keyword under TRIAL BARRIERS).
	let query = $state('');
	const queryLower = $derived(query.trim().toLowerCase());
	function matches(kw: Keyword, catLabel: string) {
		if (!queryLower) return true;
		if (kw.label.toLowerCase().includes(queryLower)) return true;
		if (catLabel.toLowerCase().includes(queryLower)) return true;
		return kw.variants.some((v) => v.toLowerCase().includes(queryLower));
	}
	const visibleKeywords = (cat: Category) => cat.keywords.filter((kw) => matches(kw, cat.label));

	// Other-subthemes collapse — collapsed by default; auto-opens when the
	// analyst types so they don't miss matches outside scope.
	let otherOpen = $state(false);
	const otherEffectivelyOpen = $derived(otherOpen || queryLower.length > 0);

	// Inline "new keyword" form — one shared form at the top with a subtheme
	// picker, replacing the per-section + buttons that dominated the prior
	// layout. `newFormOpen` toggles visibility; the rest carries the draft.
	let newFormOpen = $state(false);
	let newClusterFor = $state('');
	let newClusterLabel = $state('');
	let newClusterDescription = $state('');

	function defaultNewCategory(): string {
		if (inScopeCategories.length) return inScopeCategories[0].id;
		if (categories.length) return categories[0].id;
		return '';
	}

	// Reset transient UI whenever the drawer toggles or the parent signals a
	// successful create — keeps abandoned/queries forms from carrying over to
	// the next span.
	$effect(() => {
		open;
		formResetSeq;
		query = '';
		otherOpen = false;
		newFormOpen = false;
		newClusterFor = '';
		newClusterLabel = '';
		newClusterDescription = '';
	});

	function openNewClusterForm() {
		newFormOpen = true;
		newClusterFor = defaultNewCategory();
		newClusterLabel = '';
		newClusterDescription = '';
	}

	function cancelNewClusterForm() {
		newFormOpen = false;
		newClusterFor = '';
		newClusterLabel = '';
		newClusterDescription = '';
	}

	function submitNewClusterForm() {
		const label = newClusterLabel.trim();
		if (!label || !newClusterFor || busy) return;
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

{#snippet section(cat: Category)}
	{@const visible = visibleKeywords(cat)}
	{#if visible.length || !queryLower}
		<section>
			<p class="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
				{cat.label}
			</p>
			<div class="flex flex-wrap gap-1.5">
				{#each visible as kw (kw.id)}
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
				{#if !cat.keywords.length}
					<p class="text-[11px] text-slate-400">No keywords yet.</p>
				{/if}
			</div>
		</section>
	{/if}
{/snippet}

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

		<!-- Toolbar: search + single create action. Replaces the eight per-
			 section "+ New keyword here" buttons that used to dominate the panel. -->
		<div class="flex items-center gap-2">
			<div class="relative flex-1">
				<input
					type="search"
					bind:value={query}
					placeholder="Search keywords or subthemes…"
					disabled={busy}
					class="w-full rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
				/>
			</div>
			<Button
				variant="link"
				size="xs"
				class="whitespace-nowrap text-[11px] text-accent-mint"
				disabled={busy || newFormOpen}
				onclick={openNewClusterForm}
			>
				+ New keyword
			</Button>
		</div>

		{#if newFormOpen}
			<div class="rounded-md border border-accent-mint/40 bg-accent-mint/5 p-3">
				<p class="mb-2 text-[11px] leading-snug text-slate-500">
					{#if isMoveMode}
						Define a new keyword.
						<span class="font-medium text-slate-700">“{selection}”</span> will be moved into it.
					{:else}
						Define a new keyword.
						<span class="font-medium text-slate-700">“{selection}”</span> becomes its first variant.
					{/if}
				</p>
				<label class="mb-2 flex flex-col gap-1 text-xs">
					<span class="font-medium text-slate-600">Subtheme</span>
					<select
						bind:value={newClusterFor}
						disabled={busy}
						class="rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
					>
						{#if hasScope && inScopeCategories.length}
							<optgroup label="In this fragment's subthemes">
								{#each inScopeCategories as cat (cat.id)}
									<option value={cat.id}>{cat.label}</option>
								{/each}
							</optgroup>
							{#if otherCategories.length}
								<optgroup label="Other subthemes">
									{#each otherCategories as cat (cat.id)}
										<option value={cat.id}>{cat.label}</option>
									{/each}
								</optgroup>
							{/if}
						{:else}
							{#each categories as cat (cat.id)}
								<option value={cat.id}>{cat.label}</option>
							{/each}
						{/if}
					</select>
				</label>
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
						disabled={busy || !newClusterLabel.trim() || !newClusterFor}
						onclick={submitNewClusterForm}
					>
						{busy ? submitBusyLabel : submitLabel}
					</Button>
				</div>
			</div>
		{/if}

		<!-- Primary list: in-scope subthemes when a scope hint was provided,
			 otherwise the full categories list. -->
		{#if hasScope}
			<div class="flex flex-col gap-5">
				<p class="text-[10px] font-bold uppercase tracking-wide text-slate-500">
					In this fragment's subthemes
				</p>
				{#if inScopeCategories.length}
					{#each inScopeCategories as cat (cat.id)}
						{@render section(cat)}
					{/each}
				{:else}
					<p class="text-[11px] text-slate-400">
						No subthemes selected on this fragment yet. Pick a subtheme in the main drawer to
						narrow this list, or expand <em>Other subthemes</em> below.
					</p>
				{/if}
			</div>
		{:else}
			<div class="flex flex-col gap-5">
				{#each inScopeCategories as cat (cat.id)}
					{@render section(cat)}
				{/each}
			</div>
		{/if}

		{#if hasScope && otherCategories.length}
			<div class="border-t border-slate-100 pt-3">
				<button
					type="button"
					class="flex w-full items-center justify-between gap-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:text-slate-700"
					onclick={() => (otherOpen = !otherOpen)}
				>
					<span>
						Other subthemes
						<span class="ml-1 font-normal normal-case tracking-normal text-slate-400">
							({otherCategories.length})
						</span>
					</span>
					<span class="text-slate-400">{otherEffectivelyOpen ? '▾' : '▸'}</span>
				</button>
				{#if otherEffectivelyOpen}
					<div class="mt-3 flex flex-col gap-5">
						{#each otherCategories as cat (cat.id)}
							{@render section(cat)}
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		{#if queryLower && !categories.some((c) => visibleKeywords(c).length)}
			<p class="text-[11px] text-slate-400">
				No keywords match <span class="font-medium text-slate-600">“{query}”</span>. Try a
				different word, or click <em>+ New keyword</em> to define one.
			</p>
		{/if}
	</div>
</TertiaryDrawer>

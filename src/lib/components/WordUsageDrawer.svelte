<!--
	WordUsageDrawer — slide-in panel that explains one word from the
	citation-derived word-usage chart.

	Shows the word, total occurrences across the cited fragments, and a
	scrollable list of the citations that use it, with the word highlighted
	in the surrounding quote. Presentational only — caller owns the
	open/close state and the active word.

	Citation cards link out via the supplied onopen callback, mirroring the
	contract of the inline citation rail (in-corpus fragments open the
	parent page's fragment drawer; out-of-corpus fragments are still readable
	in the card itself).
-->
<script lang="ts">
	import TertiaryDrawer from '$lib/components/TertiaryDrawer.svelte';

	export type WordUsageCitation = {
		id: string;
		text: string;
		speaker_label: string;
	};

	let {
		word,
		citations,
		totalCount = 0,
		onclose,
		onopen,
		level = 'top'
	}: {
		/** The content word being inspected. `null` closes the drawer. */
		word: string | null;
		/** Citations whose `text` matches the word. Ordered by the caller. */
		citations: WordUsageCitation[];
		/** Total occurrence count across the whole citation set, not just
		 *  matching cards. Helpful when a word lands many times in a few
		 *  citations. */
		totalCount?: number;
		onclose: () => void;
		/** Open the parent page's fragment drawer for a citation that exists
		 *  in the active corpus. */
		onopen?: (citationId: string) => void;
		level?: 'secondary' | 'top';
	} = $props();

	const open = $derived(word !== null);

	function highlightedSegments(
		text: string,
		w: string
	): Array<{ text: string; hit: boolean }> {
		if (!w) return [{ text, hit: false }];
		// Match the word as a whole token, case-insensitive. Hyphens/curly
		// apostrophes survive because `\b` treats them as boundaries, which
		// matches the tokeniser's behaviour upstream.
		const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const re = new RegExp(`\\b(${escaped})\\b`, 'gi');
		const out: Array<{ text: string; hit: boolean }> = [];
		let last = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(text)) !== null) {
			if (m.index > last) out.push({ text: text.slice(last, m.index), hit: false });
			out.push({ text: m[0], hit: true });
			last = m.index + m[0].length;
		}
		if (last < text.length) out.push({ text: text.slice(last), hit: false });
		return out.length > 0 ? out : [{ text, hit: false }];
	}
</script>

<TertiaryDrawer
	{open}
	{onclose}
	ariaLabel="Word usage detail"
	{level}
	width="compact"
	eyebrow={word ? 'Word usage · across cited fragments' : undefined}
	title={word ?? undefined}
	subtitle={word
		? `${totalCount} ${totalCount === 1 ? 'occurrence' : 'occurrences'} in ${citations.length} ${
				citations.length === 1 ? 'citation' : 'citations'
			}`
		: undefined}
>
	{#if word}
		<div class="flex flex-1 flex-col gap-3 p-4">
			{#if citations.length === 0}
				<p class="text-xs text-muted-foreground">No citations matched this word.</p>
			{:else}
				<ul class="flex flex-col gap-2">
					{#each citations as c (c.id)}
						<li>
							<button
								type="button"
								onclick={() => onopen?.(c.id)}
								class="block w-full rounded border border-muted bg-white p-2 text-left text-xs transition-colors hover:border-indigo-300 hover:bg-indigo-50/40"
								title="Open fragment detail"
							>
								<div class="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
									<code class="truncate">{c.id}</code>
									<span class="shrink-0">{c.speaker_label}</span>
								</div>
								<p class="mt-1 leading-relaxed text-primary">
									"{#each highlightedSegments(c.text, word) as seg, i (i)}{#if seg.hit}<mark
												class="rounded bg-amber-100 px-0.5 text-amber-900"
												>{seg.text}</mark
											>{:else}{seg.text}{/if}{/each}"
								</p>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</TertiaryDrawer>

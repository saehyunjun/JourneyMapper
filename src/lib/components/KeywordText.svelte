<!--
  KeywordText.svelte

  The shared renderer for participant speech. Highlights it deterministically
  (see quote-text.ts): keyword-lexicon matches shown semibold, theme-term
  matches underlined with a dotted line. A word can be both.

  Each highlighted keyword/theme is clickable — it opens the secondary
  group-stats drawer (groupDrawer store). Pass `onpick` to also react to the
  click (e.g. open the segment's edit-tags drawer first). Emits inline content
  only — no wrapper element — so it drops into a <blockquote>, <p>, etc.
-->
<script lang="ts">
	import { quoteRuns, type QuoteRun } from '$lib/content/wctglpdemo-data/quote-text';
	import type { InstanceKeywordTag, KeywordMatcher } from '$lib/content/wctglpdemo-data/keywords';
	import { groupDrawer } from '$lib/stores/group-drawer.svelte.js';

	type Pick = { kind: 'keyword' | 'theme'; id: string; label: string };

	let {
		text,
		instanceTags = [],
		matcher,
		onpick
	}: {
		text: string;
		instanceTags?: InstanceKeywordTag[];
		/** Indication-scoped matcher. When omitted, the legacy static-lexicon
		 *  path runs — keeps interview-side callers unchanged. */
		matcher?: KeywordMatcher;
		onpick?: (sel: Pick) => void;
	} = $props();

	const runs = $derived(quoteRuns(text ?? '', instanceTags, matcher));

	function runTitle(run: QuoteRun): string {
		const parts: string[] = [];
		if (run.keyword) parts.push(`${run.keyword.keywordLabel} · ${run.keyword.categoryLabel}`);
		if (run.theme) parts.push(`Theme: ${run.theme.themeLabel}`);
		return parts.length ? `${parts.join(' — ')} — click for stats` : '';
	}

	// A run can be both keyword and theme; the keyword wins the click target.
	function selectionFor(run: QuoteRun): Pick | null {
		if (run.keyword) {
			return { kind: 'keyword', id: run.keyword.keywordId, label: run.keyword.keywordLabel };
		}
		if (run.theme) {
			return { kind: 'theme', id: run.theme.themeId, label: run.theme.themeLabel };
		}
		return null;
	}

	function pick(event: Event, run: QuoteRun) {
		const sel = selectionFor(run);
		if (!sel) return;
		// Don't let the click bubble to a surrounding card/quote handler.
		event.stopPropagation();
		onpick?.(sel);
		groupDrawer.open(sel.kind, sel.id);
	}
</script>
{#each runs as run, i (i)}{#if run.keyword || run.theme}<span
			role="button"
			tabindex="0"
			title={runTitle(run)}
			data-keyword-id={run.keyword?.keywordId ?? null}
			data-keyword-label={run.keyword?.keywordLabel ?? null}
			data-keyword-surface={run.keyword?.text ?? null}
			data-keyword-instance={run.keyword?.isInstance ? 'true' : null}
			data-keyword-start={run.keyword?.isInstance ? run.keyword.start : null}
			data-keyword-end={run.keyword?.isInstance ? run.keyword.end : null}
			class="cursor-pointer rounded-sm hover:bg-accent-mint/30{run.keyword
				? ' font-semibold underline decoration-dotted decoration-2 underline-offset-2'
				: ''}{run.theme ? ' underline decoration-dotted decoration-1 underline-offset-2' : ''}"
			onclick={(e) => pick(e, run)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					pick(e, run);
				}
			}}>{run.text}</span>{:else}{run.text}{/if}{/each}

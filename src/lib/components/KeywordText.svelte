<!--
  KeywordText.svelte

  Renders a span of participant speech with every keyword-lexicon match shown
  semibold. Matching is deterministic (see keywords.ts) so the same words bold
  wherever participant text appears. Emits inline content only — no wrapper
  element — so it drops into a <blockquote>, <p>, etc. without affecting layout.
-->
<script lang="ts">
	import { keywordRuns } from '$lib/content/wctglpdemo-data/keywords';

	let { text }: { text: string } = $props();

	const runs = $derived(keywordRuns(text ?? ''));
</script>
{#each runs as run, i (i)}{#if run.span}<strong
			class="font-semibold text-inherit"
			title="{run.span.keywordLabel} · {run.span.categoryLabel}">{run.text}</strong>{:else}{run.text}{/if}{/each}

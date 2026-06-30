<!--
  KeywordText.svelte

  The shared renderer for participant speech. Highlights it deterministically
  (see quote-text.ts): keyword-lexicon matches shown semibold, theme-term
  matches underlined with a dotted line, entity matches (Phase 3 of the
  codebook migration) shown with a colored background per entity kind. A
  word can be more than one of these at once.

  Each highlighted run is clickable. Dispatch precedence (entity wins when
  multiple sources cover the same span):
    1. entity → entityDrawer.open(entity.id)  — opens EntityDetailDrawer
    2. keyword → groupDrawer.open('keyword', cluster_id)  — legacy
    3. theme  → groupDrawer.open('theme', theme_id)  — legacy

  Pass `onpick` to also react to the click (e.g. open the segment's edit-tags
  drawer first). Emits inline content only — no wrapper element — so it
  drops into a <blockquote>, <p>, etc.
-->
<script lang="ts">
	import { quoteRuns, type QuoteRun } from '$lib/content/wctglpdemo-data/quote-text';
	import type { InstanceKeywordTag, KeywordMatcher } from '$lib/content/wctglpdemo-data/keywords';
	import type { EntityId, EntityKind } from '$lib/content/entities/types';
	import { groupDrawer } from '$lib/stores/group-drawer.svelte.js';
	import { entityDrawer } from '$lib/stores/entity-drawer.svelte';

	type Pick =
		| { kind: 'keyword' | 'theme'; id: string; label: string }
		| { kind: 'entity'; id: EntityId; label: string; entityKind: EntityKind };

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

	// Per-kind background tints for entity spans. Mirrors the drawer's
	// chip palette so the visual lineage is consistent. Full background
	// (no side rails — hard rule #4) with a darker text color for legibility.
	const ENTITY_KIND_BG: Record<EntityKind, string> = {
		drug: 'bg-emerald-100/70 text-emerald-900',
		biomarker: 'bg-sky-100/70 text-sky-900',
		sponsor: 'bg-amber-100/70 text-amber-900',
		concept: 'bg-violet-100/70 text-violet-900',
		symptom: 'bg-rose-100/70 text-rose-900',
		trial: 'bg-indigo-100/70 text-indigo-900',
		condition: 'bg-slate-100/70 text-slate-900'
	};

	function runTitle(run: QuoteRun): string {
		const parts: string[] = [];
		if (run.entity) parts.push(`${run.entity.entityLabel} (${run.entity.entityKind})`);
		if (run.keyword) parts.push(`${run.keyword.keywordLabel} · ${run.keyword.categoryLabel}`);
		if (run.theme) parts.push(`Theme: ${run.theme.themeLabel}`);
		return parts.length ? `${parts.join(' — ')} — click for detail` : '';
	}

	// Dispatch precedence: entity > keyword > theme. Same span can carry
	// multiple matches, but the primary click target is the most specific
	// (entity layer is the new canonical system).
	function selectionFor(run: QuoteRun): Pick | null {
		if (run.entity) {
			return {
				kind: 'entity',
				id: run.entity.entityId as EntityId,
				label: run.entity.entityLabel,
				entityKind: run.entity.entityKind
			};
		}
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
		if (sel.kind === 'entity') {
			entityDrawer.open(sel.id);
		} else {
			groupDrawer.open(sel.kind, sel.id);
		}
	}

	function entityBgClass(run: QuoteRun): string {
		if (!run.entity) return '';
		return ' ' + ENTITY_KIND_BG[run.entity.entityKind];
	}
</script>
{#each runs as run, i (i)}{#if run.keyword || run.theme || run.entity}<span
			role="button"
			tabindex="0"
			title={runTitle(run)}
			data-keyword-id={run.keyword?.keywordId ?? null}
			data-keyword-label={run.keyword?.keywordLabel ?? null}
			data-keyword-surface={run.keyword?.text ?? null}
			data-keyword-instance={run.keyword?.isInstance ? 'true' : null}
			data-keyword-start={run.keyword?.isInstance ? run.keyword.start : null}
			data-keyword-end={run.keyword?.isInstance ? run.keyword.end : null}
			data-entity-id={run.entity?.entityId ?? null}
			data-entity-kind={run.entity?.entityKind ?? null}
			class="cursor-pointer rounded-sm px-0.5 hover:brightness-95{run.keyword
				? ' font-semibold underline decoration-dotted decoration-2 underline-offset-2'
				: ''}{run.theme
				? ' underline decoration-dotted decoration-1 underline-offset-2'
				: ''}{entityBgClass(run)}"
			onclick={(e) => pick(e, run)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					pick(e, run);
				}
			}}>{run.text}</span>{:else}{run.text}{/if}{/each}

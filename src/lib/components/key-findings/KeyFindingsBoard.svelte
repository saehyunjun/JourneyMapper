<!--
	KeyFindingsBoard — the card-based insight builder.

	A responsive grid of KeyFindingCards where exactly one card is editable at a
	time: clicking (or right-clicking) a card activates it; clicking the empty
	board background or pressing Escape deactivates it (flushing its autosave
	first). The block library on the left drags blocks into cards; non-text
	blocks open the contextual right drawer to configure. Cards export to PNG/GIF.
	State persists through the keyFindings store (localStorage + undo/redo).
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { dragHandleZone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { Plus, Undo2, Redo2, Trash2, Image, ChevronDown } from '@lucide/svelte';
	import KeyFindingCard from './KeyFindingCard.svelte';
	import WidgetPalette from './WidgetPalette.svelte';
	import BlockConfigDrawer from './BlockConfigDrawer.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { keyFindings } from '$lib/stores/key-findings.svelte';
	import { blankCard, type Card, type Block } from '$lib/key-findings/types';
	import { createBlock } from '$lib/key-findings/widgets';
	import { exportPng, exportGif, slug } from '$lib/key-findings/export';
	import type { ParticipantProfile } from '$lib/types/participant-profile';

	let {
		profiles,
		starredQuoteIds = [],
		onparticipant
	}: {
		profiles: Record<string, ParticipantProfile>;
		starredQuoteIds?: string[];
		onparticipant: (interviewId: string) => void;
	} = $props();

	const store = keyFindings;

	// Exactly one active (editable) card. Switching flushes the prior autosave.
	let activeCardId = $state<string | null>(null);
	function setActive(id: string | null) {
		if (id === activeCardId) return;
		store.flush();
		activeCardId = id;
	}

	// GIF export restarts a card's animations by bumping its replay key.
	let replayKeys = $state<Record<string, number>>({});

	let dragging = $state(false);
	let items = $state<Card[]>([]);
	$effect(() => {
		if (!dragging) items = store.board.cards;
	});

	const FLIP_MS = 160;
	function onConsider(e: CustomEvent<{ items: Card[] }>) {
		dragging = true;
		items = e.detail.items;
	}
	function onFinalize(e: CustomEvent<{ items: Card[] }>) {
		items = e.detail.items;
		dragging = false;
		store.reorderCards(items);
	}

	function addCard() {
		const card = blankCard({ title: 'New finding' });
		store.addCard(card);
		setActive(card.id);
	}

	// ---- Block configuration drawer ----------------------------------------
	let drawerOpen = $state(false);
	let cfgCardId = $state<string | null>(null);
	let cfgBlockId = $state<string | null>(null);
	const configuringBlock = $derived.by<Block | null>(() => {
		const card = store.board.cards.find((c) => c.id === cfgCardId);
		return card?.blocks.find((b) => b.id === cfgBlockId) ?? null;
	});
	function openConfigure(cardId: string, blockId: string) {
		setActive(cardId);
		cfgCardId = cardId;
		cfgBlockId = blockId;
		drawerOpen = true;
	}
	// Live-apply each drawer selection to the card (drawer stays open). Coalesced
	// so a configuration session collapses to a single undo step.
	function applyConfig(patch: Partial<Block>) {
		if (cfgCardId && cfgBlockId)
			store.updateBlock(cfgCardId, cfgBlockId, { ...patch, configured: true } as Partial<Block>, `cfg:${cfgBlockId}`);
	}

	// ---- Export -------------------------------------------------------------
	function cardNode(cardId: string): HTMLElement | null {
		return document.querySelector(`[data-kf-card="${cardId}"]`);
	}
	async function exportCard(cardId: string, format: 'png' | 'gif') {
		setActive(null);
		await tick();
		await new Promise((r) => requestAnimationFrame(() => r(null)));
		const node = cardNode(cardId);
		if (!node) return;
		const card = store.board.cards.find((c) => c.id === cardId);
		const name = slug(card?.title ?? '', 'key-finding');
		if (format === 'png') await exportPng(node, name);
		else await exportGif(node, name, { onStart: () => (replayKeys[cardId] = (replayKeys[cardId] ?? 0) + 1) });
	}

	let boardContentEl = $state<HTMLElement>();
	async function exportBoardPng() {
		setActive(null);
		await tick();
		if (boardContentEl) await exportPng(boardContentEl, slug(store.board.title, 'key-findings'));
	}

	// ---- Click-outside to deactivate ---------------------------------------
	// Only background regions of the scroll area deactivate; cards activate
	// themselves, and bits-ui menus/drawers are portalled outside this subtree.
	function onBackgroundClick(e: MouseEvent) {
		const t = e.target as HTMLElement;
		if (t.closest('[data-kf-card]') || t.closest('[data-kf-no-deselect]')) return;
		setActive(null);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			setActive(null);
			return;
		}
		const meta = e.metaKey || e.ctrlKey;
		if (!meta || e.key.toLowerCase() !== 'z') return;
		const t = e.target as HTMLElement | null;
		if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		e.preventDefault();
		if (e.shiftKey) store.redo();
		else store.undo();
	}

	onMount(() => {
		store.load();
		store.seedIfEmpty(() => {
			const intro = blankCard({ title: 'How to use this board', size: 'landscape' });
			const introText = createBlock('richtext');
			if (introText.kind === 'richtext')
				introText.html =
					'<p>Build findings from <strong>cards</strong>. Drag a block from the left into a card, then click it to configure. Click a card to edit it; click empty space to finish. Changes autosave.</p>';
			intro.blocks = [introText];

			const dist = blankCard({ title: 'Overall sentiment' });
			const distBlock = createBlock('distribution');
			if (distBlock.kind === 'distribution') {
				distBlock.configured = true;
				distBlock.metric = 'sentiment';
				distBlock.chartType = 'donut';
			}
			dist.blocks = [distBlock];

			return [intro, dist];
		});
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div class="flex h-full flex-col">
	<!-- Toolbar -->
	<header class="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white/80 px-4 py-2.5 backdrop-blur" data-kf-no-deselect>
		<input
			class="min-w-0 max-w-xs flex-1 bg-transparent text-lg font-semibold text-slate-800 outline-none"
			style="font-family: var(--font-body);"
			value={store.board.title}
			oninput={(e) => store.update((b) => (b.title = e.currentTarget.value), 'board-title')}
			aria-label="Board title"
		/>

		<div class="ml-auto flex items-center gap-1">
			<button class="kf-tbtn" onclick={() => store.undo()} disabled={!store.canUndo} title="Undo (⌘Z)" aria-label="Undo"><Undo2 class="size-4" /></button>
			<button class="kf-tbtn" onclick={() => store.redo()} disabled={!store.canRedo} title="Redo (⇧⌘Z)" aria-label="Redo"><Redo2 class="size-4" /></button>
			<span class="mx-1 h-5 w-px bg-slate-200"></span>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger class="kf-tbtn" title="Export"><Image class="size-4" /> Export <ChevronDown class="size-3" /></DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-48">
					<DropdownMenu.Item onSelect={exportBoardPng}><Image class="size-4" /> Board as PNG</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
			<button class="kf-tbtn-primary" onclick={addCard}><Plus class="size-4" /> Card</button>
		</div>
	</header>

	<div class="flex min-h-0 flex-1">
		<div class="hidden shrink-0 border-r border-slate-200 bg-slate-50/60 sm:block" data-kf-no-deselect>
			<WidgetPalette />
		</div>

		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div
			class="min-w-0 flex-1 overflow-y-auto px-4 py-5 pb-24"
			onclick={onBackgroundClick}
		>
			{#if items.length === 0}
				<div class="mx-auto mt-16 max-w-md rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
					<p class="text-slate-500">Your board is empty.</p>
					<button class="kf-tbtn-primary mx-auto mt-3" onclick={addCard}><Plus class="size-4" /> Add your first card</button>
				</div>
			{:else}
				<div bind:this={boardContentEl}>
					<section
						class="kf-grid"
						use:dragHandleZone={{ items, flipDurationMs: FLIP_MS, dropTargetStyle: {} }}
						onconsider={onConsider}
						onfinalize={onFinalize}
					>
						{#each items as card (card.id)}
							<div class="kf-cell {card.size === 'landscape' ? 'ls' : 'sq'}" animate:flip={{ duration: FLIP_MS }}>
								<KeyFindingCard
									{card}
									active={card.id === activeCardId}
									replayKey={replayKeys[card.id] ?? 0}
									{profiles}
									onactivate={setActive}
									onconfigure={openConfigure}
									onexport={exportCard}
									{onparticipant}
								/>
							</div>
						{/each}
					</section>
				</div>
				<div class="mt-4 flex items-center gap-3" data-kf-no-deselect>
					<button class="kf-tbtn" onclick={addCard}><Plus class="size-4" /> Add card</button>
					<button class="kf-tbtn text-rose-500 hover:bg-rose-50" onclick={() => { if (confirm('Clear all cards? This can be undone with ⌘Z.')) store.clearAll(); }}>
						<Trash2 class="size-4" /> Clear all
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>

<BlockConfigDrawer
	bind:open={drawerOpen}
	block={configuringBlock}
	{profiles}
	{starredQuoteIds}
	onApply={applyConfig}
/>

<style>
	:global(.kf-tbtn) {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border-radius: 0.5rem;
		padding: 0.35rem 0.6rem;
		font-size: 0.8rem;
		font-weight: 500;
		color: #475569;
		transition: background 0.12s ease, color 0.12s ease;
	}
	:global(.kf-tbtn:hover:not(:disabled)) { background: #f1f5f9; color: #0f172a; }
	:global(.kf-tbtn:disabled) { opacity: 0.4; cursor: not-allowed; }
	:global(.kf-tbtn-primary) {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border-radius: 0.5rem;
		padding: 0.35rem 0.7rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: white;
		background: var(--accent-mint-foreground, #294457);
		transition: opacity 0.12s ease;
	}
	:global(.kf-tbtn-primary:hover) { opacity: 0.9; }

	/* Responsive flex layout: square = 1 column, landscape = 2 columns. Using
	   flex-basis (not grid spans) lets the width animate, and neighbours reflow
	   continuously during the transition. gap is 1rem. */
	.kf-grid {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 1rem;
	}
	.kf-cell {
		flex: 1 1 100%;
		max-width: 100%;
		min-width: 0;
		transition:
			flex-basis 0.35s var(--ease-standard, ease),
			max-width 0.35s var(--ease-standard, ease);
	}
	@media (min-width: 768px) {
		.kf-cell.sq {
			flex-basis: calc((100% - 1rem) / 2);
			max-width: calc((100% - 1rem) / 2);
		}
		.kf-cell.ls {
			flex-basis: 100%;
			max-width: 100%;
		}
	}
	@media (min-width: 1024px) {
		.kf-cell.sq {
			flex-basis: calc((100% - 2rem) / 3);
			max-width: calc((100% - 2rem) / 3);
		}
		.kf-cell.ls {
			flex-basis: calc(((100% - 2rem) / 3) * 2 + 1rem);
			max-width: calc(((100% - 2rem) / 3) * 2 + 1rem);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.kf-cell {
			transition: none;
		}
	}
</style>

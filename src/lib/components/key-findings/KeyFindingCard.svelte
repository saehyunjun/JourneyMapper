<!--
	KeyFindingCard — one self-contained finding on the board.

	Only the *active* card shows editing chrome (drag handle, title input, size
	buttons, block controls, kebab). Activating happens on click or right-click;
	the board enforces that exactly one card is active at a time. Non-text blocks
	are configured via the right drawer (the card emits `onconfigure`); rich text
	edits inline. Sizing is square/landscape only — no freeform resize.
-->
<script lang="ts">
	import { dragHandle } from 'svelte-dnd-action';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import {
		GripVertical,
		MoreVertical,
		Copy,
		Trash2,
		Plus,
		ArrowUp,
		ArrowDown,
		Sparkles,
		Check,
		Square,
		RectangleHorizontal,
		Image,
		Film,
		X
	} from '@lucide/svelte';
	import RichTextBlock from './blocks/RichTextBlock.svelte';
	import DistributionBlock from './blocks/DistributionBlock.svelte';
	import WordCloudBlock from './blocks/WordCloudBlock.svelte';
	import QuoteBlock from './blocks/QuoteBlock.svelte';
	import { keyFindings } from '$lib/stores/key-findings.svelte';
	import { WIDGETS, createBlock } from '$lib/key-findings/widgets';
	import { PRIORITIES, PRIORITY_META, SIZE_META, type Card, type Block, type CardSize } from '$lib/key-findings/types';
	import type { ParticipantProfile } from '$lib/types/participant-profile';

	let {
		card,
		active = false,
		replayKey = 0,
		profiles,
		onactivate,
		onconfigure,
		onexport,
		onparticipant
	}: {
		card: Card;
		active?: boolean;
		replayKey?: number;
		profiles: Record<string, ParticipantProfile>;
		onactivate: (cardId: string) => void;
		onconfigure: (cardId: string, blockId: string) => void;
		onexport: (cardId: string, format: 'png' | 'gif') => void;
		onparticipant: (interviewId: string) => void;
	} = $props();

	const store = keyFindings;
	const animated = $derived(card.animation.mode === 'animated');
	const SIZES: CardSize[] = ['square', 'landscape'];

	let tagInput = $state('');
	let dropActive = $state(false);

	function addWidget(kind: Block['kind'], atIndex?: number) {
		store.addBlock(card.id, createBlock(kind), atIndex);
	}
	function blockUpdate(blockId: string, p: Partial<Block>, coalesceKey?: string) {
		store.updateBlock(card.id, blockId, p, coalesceKey);
	}

	// Font-size control for text-bearing blocks (rich text + quote).
	function fontScaleOf(b: Block): number {
		return 'fontScale' in b && b.fontScale ? b.fontScale : 1;
	}
	function bumpFont(b: Block, delta: number) {
		const next = Math.min(2, Math.max(0.7, +(fontScaleOf(b) + delta).toFixed(2)));
		store.updateBlock(card.id, b.id, { fontScale: next } as Partial<Block>);
	}

	// ---- Widget drop target -------------------------------------------------
	const MIME = 'application/x-kf-widget';
	function onDragOver(e: DragEvent) {
		if (e.dataTransfer?.types.includes(MIME)) {
			e.preventDefault();
			e.dataTransfer.dropEffect = 'copy';
			dropActive = true;
		}
	}
	function onDrop(e: DragEvent) {
		dropActive = false;
		const kind = e.dataTransfer?.getData(MIME) as Block['kind'] | undefined;
		if (kind) {
			e.preventDefault();
			onactivate(card.id);
			addWidget(kind);
		}
	}
</script>

{#snippet commonActions(Item: typeof ContextMenu.Item | typeof DropdownMenu.Item)}
	<Item onSelect={() => store.duplicateCard(card.id)}><Copy class="size-4" /> Duplicate</Item>
	<Item onSelect={() => store.setAnimation(card.id, { ...card.animation, mode: animated ? 'static' : 'animated' })}>
		<Sparkles class="size-4" /> {animated ? 'Make static' : 'Animate'}
	</Item>
	<Item onSelect={() => onexport(card.id, 'png')}><Image class="size-4" /> Export PNG</Item>
	<Item onSelect={() => onexport(card.id, 'gif')}><Film class="size-4" /> Export GIF</Item>
	<Item variant="destructive" onSelect={() => store.removeCard(card.id)}><Trash2 class="size-4" /> Delete</Item>
{/snippet}

<ContextMenu.Root onOpenChange={(o) => o && onactivate(card.id)}>
	<ContextMenu.Trigger>
		{#snippet child({ props })}
			<article
				{...props}
				data-kf-card={card.id}
				class="kf-card group/card relative flex flex-col rounded-2xl border bg-white shadow-sm {active ? 'border-accent-mint ring-2 ring-accent-mint/30' : dropActive ? 'border-accent-mint' : 'border-slate-200 hover:shadow-md'}"
				style="aspect-ratio: {SIZE_META[card.size].aspect}; min-height: 240px;"
				aria-label={card.title || 'Key finding'}
				onclick={() => !active && onactivate(card.id)}
				ondragover={onDragOver}
				ondragleave={() => (dropActive = false)}
				ondrop={onDrop}
			>
				<!-- Header -->
				<header class="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2">
					{#if active}
						<button use:dragHandle aria-label="Reorder card" class="cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing">
							<GripVertical class="size-4" />
						</button>
					{/if}
					{#if card.priority !== 'none'}
						<span class="size-2 shrink-0 rounded-full {PRIORITY_META[card.priority].dot}" title="{PRIORITY_META[card.priority].label} priority"></span>
					{/if}

					{#if active}
						<input
							class="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-300"
							style="font-family: var(--font-body);"
							placeholder="Untitled finding"
							value={card.title}
							oninput={(e) => store.setTitle(card.id, e.currentTarget.value)}
						/>
						<!-- Size: square / landscape only -->
						<div class="flex shrink-0 items-center gap-0.5 rounded-md bg-slate-100 p-0.5">
							<button class="rounded p-1 {card.size === 'square' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}" title="Square" aria-label="Square size" aria-pressed={card.size === 'square'} onclick={() => store.setSize(card.id, 'square')}><Square class="size-3.5" /></button>
							<button class="rounded p-1 {card.size === 'landscape' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}" title="Landscape" aria-label="Landscape size" aria-pressed={card.size === 'landscape'} onclick={() => store.setSize(card.id, 'landscape')}><RectangleHorizontal class="size-3.5" /></button>
						</div>
						<DropdownMenu.Root>
							<DropdownMenu.Trigger class="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Card actions">
								<MoreVertical class="size-4" />
							</DropdownMenu.Trigger>
							<DropdownMenu.Content align="end" class="w-44">
								{@render commonActions(DropdownMenu.Item)}
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					{:else}
						<h3 class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800" style="font-family: var(--font-body);">
							{card.title || 'Untitled finding'}
						</h3>
					{/if}
				</header>

				<!-- Body -->
				<div class="flex flex-1 flex-col gap-4 overflow-auto p-4">
					{#each card.blocks as block (block.id)}
						<div class="kf-block group/block relative">
							{#if active}
								<div class="absolute -top-1 right-0 z-10 flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5 opacity-0 shadow-sm transition-opacity group-hover/block:opacity-100">
									{#if block.kind === 'richtext' || block.kind === 'quote'}
										<button class="rounded px-1 py-0.5 text-xs font-semibold text-slate-400 hover:bg-slate-100" onclick={() => bumpFont(block, -0.1)} aria-label="Decrease font size">A−</button>
										<button class="rounded px-1 py-0.5 text-sm font-semibold text-slate-500 hover:bg-slate-100" onclick={() => bumpFont(block, 0.1)} aria-label="Increase font size">A+</button>
										<span class="mx-0.5 h-4 w-px bg-slate-200"></span>
									{/if}
									<button class="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={card.blocks[0]?.id === block.id} onclick={() => store.moveBlock(card.id, block.id, -1)} aria-label="Move block up"><ArrowUp class="size-3.5" /></button>
									<button class="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" disabled={card.blocks[card.blocks.length - 1]?.id === block.id} onclick={() => store.moveBlock(card.id, block.id, 1)} aria-label="Move block down"><ArrowDown class="size-3.5" /></button>
									<button class="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500" onclick={() => store.removeBlock(card.id, block.id)} aria-label="Delete block"><Trash2 class="size-3.5" /></button>
								</div>
							{/if}

							{#if block.kind === 'richtext'}
								<RichTextBlock html={block.html} editable={active} fontScale={block.fontScale ?? 1} onChange={(html) => blockUpdate(block.id, { html }, `rt:${block.id}`)} />
							{:else if block.kind === 'distribution'}
								<DistributionBlock {block} editable={active} animate={animated} {replayKey} onUpdate={(p) => blockUpdate(block.id, p, `title:${block.id}`)} onConfigure={() => onconfigure(card.id, block.id)} />
							{:else if block.kind === 'wordcloud'}
								<WordCloudBlock {block} editable={active} onUpdate={(p) => blockUpdate(block.id, p, `title:${block.id}`)} onConfigure={() => onconfigure(card.id, block.id)} />
							{:else if block.kind === 'quote'}
								<QuoteBlock {block} editable={active} animate={animated} {replayKey} fontScale={block.fontScale ?? 1} {profiles} onUpdate={(p, key) => blockUpdate(block.id, p, key)} onConfigure={() => onconfigure(card.id, block.id)} {onparticipant} />
							{/if}
						</div>
					{/each}

					{#if active && card.blocks.length === 0}
						<div class="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed {dropActive ? 'border-accent-mint bg-accent-mint/5' : 'border-slate-200'} py-8 text-center text-sm text-slate-400">
							<p>Drag a block here, or</p>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger class="mt-1 inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
									<Plus class="size-3.5" /> Add block
								</DropdownMenu.Trigger>
								<DropdownMenu.Content class="w-52">
									{#each WIDGETS as w (w.id)}
										{@const Icon = w.icon}
										<DropdownMenu.Item onSelect={() => addWidget(w.id)}><Icon class="size-4" /> {w.label}</DropdownMenu.Item>
									{/each}
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>
					{/if}

					{#if active || card.tags.length}
						<div class="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
							{#each card.tags as tag (tag)}
								<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
									{tag}
									{#if active}<button onclick={() => store.removeTag(card.id, tag)} aria-label="Remove tag {tag}" class="hover:text-rose-500"><X class="size-3" /></button>{/if}
								</span>
							{/each}
							{#if active}
								<input
									class="w-20 bg-transparent text-xs text-slate-500 outline-none placeholder:text-slate-300"
									placeholder="+ tag"
									bind:value={tagInput}
									onkeydown={(e) => { if (e.key === 'Enter' && tagInput.trim()) { store.addTag(card.id, tagInput); tagInput = ''; } }}
								/>
							{/if}
						</div>
					{/if}
				</div>
			</article>
		{/snippet}
	</ContextMenu.Trigger>

	<ContextMenu.Content class="w-52">
		<ContextMenu.Label>{card.title || 'Key finding'}</ContextMenu.Label>
		<ContextMenu.Separator />

		<ContextMenu.Sub>
			<ContextMenu.SubTrigger><Plus class="size-4" /> Add block</ContextMenu.SubTrigger>
			<ContextMenu.SubContent class="w-52">
				{#each WIDGETS as w (w.id)}
					{@const Icon = w.icon}
					<ContextMenu.Item onSelect={() => addWidget(w.id)}><Icon class="size-4" /> {w.label}</ContextMenu.Item>
				{/each}
			</ContextMenu.SubContent>
		</ContextMenu.Sub>

		<ContextMenu.Sub>
			<ContextMenu.SubTrigger>Size</ContextMenu.SubTrigger>
			<ContextMenu.SubContent class="w-40">
				{#each SIZES as size (size)}
					<ContextMenu.Item onSelect={() => store.setSize(card.id, size)}>
						{#if card.size === size}<Check class="size-4" />{:else}<span class="size-4"></span>{/if}
						{SIZE_META[size].label}
					</ContextMenu.Item>
				{/each}
			</ContextMenu.SubContent>
		</ContextMenu.Sub>

		<ContextMenu.Sub>
			<ContextMenu.SubTrigger>Priority</ContextMenu.SubTrigger>
			<ContextMenu.SubContent class="w-40">
				{#each PRIORITIES as p (p)}
					<ContextMenu.Item onSelect={() => store.setPriority(card.id, p)}>
						{#if card.priority === p}<Check class="size-4" />{:else}<span class="size-2 rounded-full {PRIORITY_META[p].dot}"></span>{/if}
						{PRIORITY_META[p].label}
					</ContextMenu.Item>
				{/each}
			</ContextMenu.SubContent>
		</ContextMenu.Sub>

		<ContextMenu.Separator />

		<ContextMenu.Item onSelect={() => store.setAnimation(card.id, { ...card.animation, mode: animated ? 'static' : 'animated' })}>
			{#if animated}<Check class="size-4" />{:else}<span class="size-4"></span>{/if} Animated
		</ContextMenu.Item>
		<ContextMenu.Item disabled={!animated} onSelect={() => store.setAnimation(card.id, { ...card.animation, loop: !card.animation.loop })}>
			{#if card.animation.loop}<Check class="size-4" />{:else}<span class="size-4"></span>{/if} Loop reveal
		</ContextMenu.Item>

		<ContextMenu.Separator />
		{@render commonActions(ContextMenu.Item)}
	</ContextMenu.Content>
</ContextMenu.Root>

<style>
	/* Ease the height change when toggling square ↔ landscape. The cell width
	   animates via flex-basis (board); aspect-ratio animates the height here. */
	.kf-card {
		transition:
			aspect-ratio 0.35s var(--ease-standard, ease),
			box-shadow 0.2s ease;
	}
	@media (prefers-reduced-motion: reduce) {
		.kf-card {
			transition: box-shadow 0.2s ease;
		}
	}
</style>

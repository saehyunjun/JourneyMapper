<!--
	WidgetPalette — the compact block library (four approved block types).

	Each entry is a native drag source (writes its block kind to dataTransfer):
	drag it onto a card to drop a blank placeholder. Drag is the only way to add
	a block — there is no click-to-create.
-->
<script lang="ts">
	import { WIDGETS, type WidgetDef } from '$lib/key-findings/widgets';
	import SentimentDonut from '$lib/components/SentimentDonut.svelte';
	import { sentimentLean } from '$lib/content/wctglpdemo-data/executive-summary';
	import { Button } from '$lib/components/ui/button/index.js';
	import type { VizMotionMode } from '$lib/motion/viz';

	const MIME = 'application/x-kf-widget';

	function onDragStart(e: DragEvent, w: WidgetDef) {
		if (!e.dataTransfer) return;
		e.dataTransfer.setData(MIME, w.id);
		e.dataTransfer.setData('text/plain', w.label);
		e.dataTransfer.effectAllowed = 'copy';
	}

	let storyMode = $state<VizMotionMode>('story');
	let storyReplayKey = $state(0);
	const storyModes: VizMotionMode[] = ['story', 'dashboard', 'none'];
</script>

<aside class="kf-palette" aria-label="Block library" data-kf-no-deselect>
	<p class="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Blocks</p>
	<div class="flex flex-col gap-1">
		{#each WIDGETS as w (w.id)}
			{@const Icon = w.icon}
			<Button
				variant="ghost"
				draggable="true"
				ondragstart={(e) => onDragStart(e, w)}
				class="kf-widget h-auto cursor-grab items-start justify-start rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-left hover:border-slate-200 hover:bg-white active:cursor-grabbing"
				title="Drag onto a card"
			>
				<span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
					<Icon class="size-3.5" />
				</span>
				<span class="min-w-0">
					<span class="block truncate text-sm font-medium text-slate-700">{w.label}</span>
					<span class="block truncate text-xs text-slate-400">{w.description}</span>
				</span>
			</Button>
		{/each}
	</div>
	<p class="mt-4 px-1 text-[11px] leading-relaxed text-slate-400">
		Drag a block onto a card to drop in a blank placeholder, then click it to configure.
	</p>

	<div class="mt-5 border-t border-slate-200 pt-4">
		<p class="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Animation preview</p>
		<div class="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-3">
			<SentimentDonut
				positive={sentimentLean.positive}
				neutral={sentimentLean.neutral}
				negative={sentimentLean.negative}
				size={72}
				motionMode={storyMode}
				replayKey={storyReplayKey}
				showTotal
			/>
			<div class="flex flex-col gap-1.5 text-xs text-slate-500">
				<span>Same data, replayable — for exports.</span>
				<div class="flex items-center gap-1.5">
					<div class="inline-flex overflow-hidden rounded-sm border border-slate-200">
						{#each storyModes as m (m)}
							<Button
								variant="outline"
								size="xs"
								pressed={storyMode === m}
								activeClass="bg-slate-700 text-white hover:bg-slate-700"
								onclick={() => (storyMode = m)}
								class="rounded-none border-0 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500 hover:bg-slate-100"
							>{m}</Button>
						{/each}
					</div>
					<Button
						variant="outline"
						size="xs"
						onclick={() => (storyReplayKey += 1)}
						class="rounded-sm border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 hover:bg-slate-100"
					>Replay</Button>
				</div>
			</div>
		</div>
	</div>
</aside>

<style>
	.kf-palette {
		width: 15rem;
		flex-shrink: 0;
		overflow-y: auto;
		padding: 0.75rem 0.5rem;
	}
</style>

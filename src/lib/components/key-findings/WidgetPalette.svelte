<!--
	WidgetPalette — the compact block library (four approved block types).

	Each entry is a native drag source (writes its block kind to dataTransfer):
	drag it onto a card to drop a blank placeholder. Drag is the only way to add
	a block — there is no click-to-create.
-->
<script lang="ts">
	import { WIDGETS, type WidgetDef } from '$lib/key-findings/widgets';

	const MIME = 'application/x-kf-widget';

	function onDragStart(e: DragEvent, w: WidgetDef) {
		if (!e.dataTransfer) return;
		e.dataTransfer.setData(MIME, w.id);
		e.dataTransfer.setData('text/plain', w.label);
		e.dataTransfer.effectAllowed = 'copy';
	}
</script>

<aside class="kf-palette" aria-label="Block library" data-kf-no-deselect>
	<p class="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Blocks</p>
	<div class="flex flex-col gap-1">
		{#each WIDGETS as w (w.id)}
			{@const Icon = w.icon}
			<button
				type="button"
				draggable="true"
				ondragstart={(e) => onDragStart(e, w)}
				class="kf-widget flex w-full cursor-grab items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-slate-200 hover:bg-white active:cursor-grabbing"
				title="Drag onto a card"
			>
				<span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
					<Icon class="size-3.5" />
				</span>
				<span class="min-w-0">
					<span class="block truncate text-sm font-medium text-slate-700">{w.label}</span>
					<span class="block truncate text-xs text-slate-400">{w.description}</span>
				</span>
			</button>
		{/each}
	</div>
	<p class="mt-4 px-1 text-[11px] leading-relaxed text-slate-400">
		Drag a block onto a card to drop in a blank placeholder, then click it to configure.
	</p>
</aside>

<style>
	.kf-palette {
		width: 15rem;
		flex-shrink: 0;
		overflow-y: auto;
		padding: 0.75rem 0.5rem;
	}
	.kf-widget:focus-visible {
		outline: 2px solid var(--teal, #7dbfa7);
		outline-offset: 1px;
	}
</style>

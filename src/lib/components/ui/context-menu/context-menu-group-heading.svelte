<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		inset,
		...restProps
	}: ComponentProps<typeof ContextMenuPrimitive.GroupHeading> & {
		inset?: boolean;
	} = $props();
</script>

<ContextMenuPrimitive.GroupHeading
	bind:ref
	data-slot="context-menu-group-heading"
	data-inset={inset}
	class={cn(
		"text-muted-foreground px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide data-[inset]:ps-8",
		className
	)}
	{...restProps}
/>

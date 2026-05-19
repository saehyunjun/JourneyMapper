<script lang="ts">
	import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";
	import ContextMenuPortal from "./context-menu-portal.svelte";
	import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		portalProps,
		...restProps
	}: ContextMenuPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof ContextMenuPortal>>;
	} = $props();
</script>

<ContextMenuPortal {...portalProps}>
	<ContextMenuPrimitive.Content
		bind:ref
		data-slot="context-menu-content"
		class={cn(
			"data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/5 dark:ring-foreground/10 bg-popover text-popover-foreground min-w-52 rounded-3xl p-1.5 shadow-lg ring-1 duration-100 z-50 max-h-(--bits-context-menu-content-available-height) overflow-x-hidden overflow-y-auto outline-none",
			className
		)}
		{...restProps}
	/>
</ContextMenuPortal>

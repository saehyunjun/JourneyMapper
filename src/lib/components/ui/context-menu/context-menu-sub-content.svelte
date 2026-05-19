<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: ContextMenuPrimitive.SubContentProps = $props();
</script>

<ContextMenuPrimitive.SubContent
	bind:ref
	data-slot="context-menu-sub-content"
	class={cn(
		"data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/5 dark:ring-foreground/10 bg-popover text-popover-foreground min-w-44 rounded-3xl p-1.5 shadow-lg ring-1 duration-100 z-50 w-auto overflow-x-hidden overflow-y-auto outline-none",
		className
	)}
	{...restProps}
/>

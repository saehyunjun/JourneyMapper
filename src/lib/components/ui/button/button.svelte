<script lang="ts" module>
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";
	import { type VariantProps, tv } from "tailwind-variants";

	export const buttonVariants = tv({
		base: "focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 hover:cursor-pointer bg-clip-padding text-sm font-medium focus-visible:ring-3 active:not-aria-[haspopup]:translate-y-px aria-invalid:ring-3 [&_svg:not([class*='size-'])]:size-4 group/button inline-flex shrink-0 items-center justify-center  whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		variants: {
			variant: {
				default: "bg-accent-orange border-2 border-muted shadow-sm rounded-4xl  text-primary-foreground hover:bg-accent-orange-foreground hover:text-accent-orange-background hover:border-accent-orange",
				outline: "border border-mauve bg-muted rounded-full hover:bg-accent-orange-foreground hover:text-primary dark:hover:bg-input/30 aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-transparent ",
				secondary: "bg-orange-200 border-1 border-accent-orange rounded-full text-accent-orange-background hover:bg-orange-300 hover:text-slate-800 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
				action: "bg-accent-orange rounded-full text-accent-orange-foreground shadow-md hover:bg-accent-orange hover:shadow-none duration-400",
				ghost: "bg-mauve hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-expanded:bg-muted aria-expanded:text-foreground",
				destructive: "bg-destructive/10 hover:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/20 text-destructive focus-visible:border-destructive/40 dark:hover:bg-destructive/30",
				link: "text-primary w-fit border-b capitalize hover:border-b-2 ",
			},
			size: {
				default: "h-10 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
				xs: "py-1 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				lg: "h-12 gap-1.5 px-4 text-base capitalize has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
				icon: "size-9",
				"icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8",
				"icon-lg": "size-12",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
	export type ButtonSize = VariantProps<typeof buttonVariants>["size"];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
			/** Toggle state — reflected to `aria-pressed` and gates `activeClass`. */
			pressed?: boolean;
			/** Extra classes applied only while `pressed` is true. */
			activeClass?: string;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = "default",
		size = "default",
		ref = $bindable(null),
		href = undefined,
		type = "button",
		disabled,
		pressed = undefined,
		activeClass = undefined,
		children,
		...restProps
	}: ButtonProps = $props();
</script>

{#if href}
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className, pressed && activeClass)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		aria-pressed={pressed}
		role={disabled ? "link" : undefined}
		tabindex={disabled ? -1 : undefined}
		{...restProps}
	>
		{@render children?.()}
	</a>

{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className, pressed && activeClass)}
		{type}
		{disabled}
		aria-pressed={pressed}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}

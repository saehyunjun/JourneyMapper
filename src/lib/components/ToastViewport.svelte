<!--
	ToastViewport — fixed bottom-right stack of toasts.

	The newest toast sits on top of older ones. Each slides in from the right;
	on dismiss it slides out over 650ms. Mount once near the app root.

	Variants:
	  - success (default): emerald border, check icon, dismiss after duration
	  - progress: sky border, spinning loader, optional bar that fills from
	    progress (0..1). Persistent until the owner dismisses or upgrades it
	  - error: rose border, alert icon
-->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { toasts, type ToastVariant } from '$lib/stores/toasts.svelte.js';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import XIcon from '@lucide/svelte/icons/x';

	function borderFor(v: ToastVariant | undefined): string {
		if (v === 'progress') return 'border-sky-200';
		if (v === 'error') return 'border-rose-300';
		return 'border-emerald-200';
	}
</script>

<div
	class="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2"
	aria-live="polite"
>
	{#each toasts.list as toast (toast.id)}
		<div
			animate:flip={{ duration: 250, easing: cubicOut }}
			in:fly={{ x: 28, duration: 220, easing: cubicOut }}
			out:fly={{ x: 28, duration: 650, easing: cubicOut }}
			class="pointer-events-auto flex w-80 items-start gap-2.5 rounded-lg border bg-white p-3 shadow-lg {borderFor(
				toast.variant
			)}"
		>
			{#if toast.variant === 'progress'}
				<LoaderIcon class="mt-0.5 size-5 shrink-0 animate-spin text-sky-600" />
			{:else if toast.variant === 'error'}
				<AlertTriangleIcon class="mt-0.5 size-5 shrink-0 text-rose-600" />
			{:else}
				<CircleCheckIcon class="mt-0.5 size-5 shrink-0 text-emerald-600" />
			{/if}
			<div class="flex min-w-0 flex-1 flex-col gap-0.5">
				<p class="text-sm text-slate-800">{toast.message}</p>
				{#if toast.variant === 'progress'}
					<!-- Progress bar — fills when toast.progress is set, otherwise
						 renders an indeterminate shimmer so the analyst sees activity
						 even before the first step report lands. -->
					<div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sky-100">
						{#if typeof toast.progress === 'number'}
							<div
								class="h-full rounded-full bg-sky-500 transition-[width] duration-300 ease-out"
								style:width="{Math.max(0, Math.min(1, toast.progress)) * 100}%"
							></div>
						{:else}
							<div class="indeterminate h-full w-1/3 rounded-full bg-sky-500"></div>
						{/if}
					</div>
					{#if toast.progressLabel}
						<p class="mt-1 text-[11px] text-slate-500">{toast.progressLabel}</p>
					{/if}
				{/if}
				{#if toast.href}
					<a
						href={toast.href}
						onclick={() => toasts.dismiss(toast.id)}
						class="w-fit text-xs font-medium text-accent-mint hover:underline"
					>
						{toast.linkLabel ?? 'View persona →'}
					</a>
				{/if}
			</div>
			<button
				type="button"
				onclick={() => toasts.dismiss(toast.id)}
				aria-label="Dismiss notification"
				class="shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
			>
				<XIcon class="size-4" />
			</button>
		</div>
	{/each}
</div>

<style>
	@keyframes indeterminate-slide {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(300%);
		}
	}
	.indeterminate {
		animation: indeterminate-slide 1.4s ease-in-out infinite;
	}
</style>

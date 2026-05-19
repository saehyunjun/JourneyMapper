<!--
	ToastViewport — fixed bottom-right stack of success toasts.

	The newest toast sits on top of older ones. Each slides in from the right;
	on dismiss it slides out over 650ms. Mount once near the app root.
-->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { toasts } from '$lib/stores/toasts.svelte.js';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import XIcon from '@lucide/svelte/icons/x';
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
			class="pointer-events-auto flex w-80 items-start gap-2.5 rounded-lg border border-emerald-200 bg-white p-3 shadow-lg"
		>
			<CircleCheckIcon class="mt-0.5 size-5 shrink-0 text-emerald-600" />
			<div class="flex min-w-0 flex-1 flex-col gap-0.5">
				<p class="text-sm text-slate-800">{toast.message}</p>
				{#if toast.href}
					<a
						href={toast.href}
						onclick={() => toasts.dismiss(toast.id)}
						class="w-fit text-xs font-medium text-accent-mint hover:underline"
					>
						{toast.linkLabel ?? 'View fingerprint →'}
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

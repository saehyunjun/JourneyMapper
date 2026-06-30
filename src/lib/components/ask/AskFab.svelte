<!--
	AskFab — floating action button for the Ask PatientlyAI flow.

	Persistent across every patientlyiq route. The gradient on the FAB
	encodes the system's current state so the user can navigate away
	while a question is in flight and still know when the answer lands:

	  idle      steady mauve→orange gradient (matches the legacy header)
	  thinking  rainbow gradient slides around the circle on a 2.6s loop
	  ready     mint-green gradient + speech-bubble alert beside the FAB
	  viewed    steady mint-green (drawer was opened to read the answer;
	            no alert, but the FAB stays green so the user can pop
	            back in to see the same answer again)
	  error     red-tinted gradient, no animation

	The alert bubble auto-dismisses after ALERT_TIMEOUT_MS but the FAB
	itself stays in the "ready" color until the drawer is opened.
-->
<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { askStore } from '$lib/stores/ask-patientlyai.svelte';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import CheckIcon from '@lucide/svelte/icons/check';
	import AlertIcon from '@lucide/svelte/icons/alert-triangle';

	let { hidden = false }: { hidden?: boolean } = $props();

	const ALERT_TIMEOUT_MS = 8000;

	const fabState = $derived(askStore.fabState);
	let alertVisible = $state(false);

	let alertTimer: ReturnType<typeof setTimeout> | null = null;

	// When fabState flips to "ready", show the alert bubble; clear any
	// existing timer first so a fast second-answer resets the countdown.
	$effect(() => {
		if (fabState === 'ready') {
			alertVisible = true;
			if (alertTimer) clearTimeout(alertTimer);
			alertTimer = setTimeout(() => {
				alertVisible = false;
				alertTimer = null;
			}, ALERT_TIMEOUT_MS);
		} else {
			alertVisible = false;
			if (alertTimer) {
				clearTimeout(alertTimer);
				alertTimer = null;
			}
		}
	});

	function onClick() {
		askStore.openDrawer();
	}

	const ariaLabel = $derived.by(() => {
		switch (fabState) {
			case 'thinking':
				return 'Ask PatientlyAI — thinking…';
			case 'ready':
				return 'Ask PatientlyAI — answer ready';
			case 'viewed':
				return 'Ask PatientlyAI — view last answer';
			case 'error':
				return 'Ask PatientlyAI — error';
			default:
				return 'Ask PatientlyAI';
		}
	});

	const previewQuestion = $derived(askStore.question.trim());
</script>

{#if !hidden}
	<div class="ask-fab-anchor" data-state={fabState}>
		{#if alertVisible && fabState === 'ready'}
			<div
				class="ask-fab-alert"
				in:fly={{ x: 20, duration: 220 }}
				out:fade={{ duration: 160 }}
				role="status"
				aria-live="polite"
			>
				<div class="ask-fab-alert-dot"></div>
				<div class="ask-fab-alert-body">
					<p class="ask-fab-alert-title">Answer ready</p>
					{#if previewQuestion}
						<p class="ask-fab-alert-q" title={previewQuestion}>
							{previewQuestion.length > 64
								? previewQuestion.slice(0, 64) + '…'
								: previewQuestion}
						</p>
					{/if}
				</div>
			</div>
		{/if}

		<button
			type="button"
			class="ask-fab"
			data-state={fabState}
			aria-label={ariaLabel}
			onclick={onClick}
		>
			<span class="ask-fab-glow" aria-hidden="true"></span>
			<span class="ask-fab-icon">
				{#if fabState === 'ready' || fabState === 'viewed'}
					<CheckIcon size={20} strokeWidth={2.4} />
				{:else if fabState === 'error'}
					<AlertIcon size={20} strokeWidth={2.2} />
				{:else}
					<SparklesIcon size={20} strokeWidth={2.2} />
				{/if}
			</span>
			{#if fabState === 'ready'}
				<span class="ask-fab-pulse" aria-hidden="true"></span>
			{/if}
		</button>
	</div>
{/if}

<style>
	.ask-fab-anchor {
		position: fixed;
		right: 1.5rem;
		bottom: 1.5rem;
		z-index: 60;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		pointer-events: none;
	}
	.ask-fab-alert,
	.ask-fab {
		pointer-events: auto;
	}

	/* Speech-bubble alert that points at the FAB. */
	.ask-fab-alert {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		max-width: 280px;
		padding: 0.5rem 0.75rem;
		background: #fff;
		border: 1px solid rgb(16 185 129 / 0.4);
		border-radius: 0.75rem;
		box-shadow:
			0 8px 24px -8px rgb(16 185 129 / 0.45),
			0 2px 4px rgb(15 23 42 / 0.08);
	}
	.ask-fab-alert::after {
		content: '';
		position: absolute;
		right: -7px;
		top: 50%;
		transform: translateY(-50%) rotate(45deg);
		width: 12px;
		height: 12px;
		background: #fff;
		border-right: 1px solid rgb(16 185 129 / 0.4);
		border-top: 1px solid rgb(16 185 129 / 0.4);
	}
	.ask-fab-alert-dot {
		flex-shrink: 0;
		width: 0.5rem;
		height: 0.5rem;
		margin-top: 0.4rem;
		border-radius: 9999px;
		background: linear-gradient(135deg, #10b981, #06b6d4);
		box-shadow: 0 0 0 4px rgb(16 185 129 / 0.15);
	}
	.ask-fab-alert-body {
		min-width: 0;
	}
	.ask-fab-alert-title {
		font-size: 0.75rem;
		font-weight: 600;
		color: #047857;
		line-height: 1.2;
	}
	.ask-fab-alert-q {
		margin-top: 0.125rem;
		font-size: 0.6875rem;
		color: #475569;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Circle button. The background is a wide linear gradient with an
	   animated background-position when thinking — the same trick the
	   legacy bottom-strip used, repurposed onto the FAB face. */
	.ask-fab {
		position: relative;
		width: 56px;
		height: 56px;
		border-radius: 9999px;
		border: 1px solid rgb(255 255 255 / 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		cursor: pointer;
		box-shadow:
			0 12px 24px -8px rgb(15 23 42 / 0.35),
			0 2px 6px rgb(15 23 42 / 0.15);
		transition:
			transform 180ms ease,
			box-shadow 200ms ease;
		background-size: 300% 300%;
		background-position: 0% 50%;
	}
	.ask-fab:hover {
		transform: translateY(-1px) scale(1.04);
		box-shadow:
			0 18px 32px -10px rgb(15 23 42 / 0.4),
			0 3px 8px rgb(15 23 42 / 0.18);
	}
	.ask-fab:active {
		transform: translateY(0) scale(0.98);
	}
	.ask-fab:focus-visible {
		outline: 3px solid rgb(99 102 241 / 0.55);
		outline-offset: 3px;
	}

	.ask-fab[data-state='idle'] {
		background-image: linear-gradient(
			135deg,
			#fcd9b6 0%,
			#fbbf24 30%,
			#c084fc 60%,
			#a78bfa 100%
		);
	}
	.ask-fab[data-state='thinking'] {
		background-image: linear-gradient(
			135deg,
			#6366f1,
			#a855f7,
			#ec4899,
			#f59e0b,
			#10b981,
			#06b6d4,
			#6366f1
		);
		animation: ask-fab-shift 2.6s linear infinite;
	}
	.ask-fab[data-state='ready'],
	.ask-fab[data-state='viewed'] {
		background-image: linear-gradient(135deg, #34d399 0%, #10b981 50%, #06b6d4 100%);
	}
	.ask-fab[data-state='error'] {
		background-image: linear-gradient(135deg, #fb7185 0%, #f43f5e 100%);
	}

	@keyframes ask-fab-shift {
		0% {
			background-position: 0% 50%;
		}
		50% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 200% 50%;
		}
	}

	/* Soft halo behind the icon — strongest in "ready" so the green
	   reads from a distance even after the alert bubble has faded. */
	.ask-fab-glow {
		position: absolute;
		inset: -4px;
		border-radius: 9999px;
		opacity: 0;
		filter: blur(8px);
		transition: opacity 240ms ease;
		pointer-events: none;
	}
	.ask-fab[data-state='thinking'] .ask-fab-glow {
		opacity: 0.55;
		background: conic-gradient(
			from 0deg,
			#6366f1,
			#a855f7,
			#ec4899,
			#f59e0b,
			#10b981,
			#06b6d4,
			#6366f1
		);
		animation: ask-fab-spin 4s linear infinite;
	}
	.ask-fab[data-state='ready'] .ask-fab-glow,
	.ask-fab[data-state='viewed'] .ask-fab-glow {
		opacity: 0.5;
		background: radial-gradient(circle, #10b981, transparent 70%);
	}
	@keyframes ask-fab-spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.ask-fab-icon {
		position: relative;
		z-index: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		filter: drop-shadow(0 1px 2px rgb(15 23 42 / 0.25));
	}

	/* "Ready" attention pulse — a slow ring that expands outward.
	   Distinct from the spinning thinking glow so the two states never
	   look the same. */
	.ask-fab-pulse {
		position: absolute;
		inset: 0;
		border-radius: 9999px;
		border: 2px solid rgb(16 185 129 / 0.55);
		animation: ask-fab-pulse 1.8s ease-out infinite;
	}
	@keyframes ask-fab-pulse {
		0% {
			transform: scale(1);
			opacity: 0.8;
		}
		80% {
			transform: scale(1.6);
			opacity: 0;
		}
		100% {
			transform: scale(1.6);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ask-fab[data-state='thinking'] {
			animation: none;
		}
		.ask-fab[data-state='thinking'] .ask-fab-glow {
			animation: none;
		}
		.ask-fab-pulse {
			animation: none;
			opacity: 0.5;
		}
	}
</style>

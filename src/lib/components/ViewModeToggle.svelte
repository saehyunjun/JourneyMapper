
<!--
	ViewModeToggle — the Story / Dashboard pill switch for the topbar.

	URL-synced via ?view=story so the choice survives refresh and can be
	shared as a link. Not tied to a layout load: changes the search param
	without invalidating the page tree (keepFocus, noScroll).

	The toggle is intentionally always visible in the topbar; pages that
	don't implement story mode simply ignore the param.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { LayoutDashboard, Sparkles } from '@lucide/svelte';

	const mode = $derived(page.url.searchParams.get('view') === 'story' ? 'story' : 'dashboard');

	async function setMode(next: 'story' | 'dashboard') {
		if (next === mode) return;
		const url = new URL(page.url);
		if (next === 'story') url.searchParams.set('view', 'story');
		else url.searchParams.delete('view');
		await goto(url, { keepFocus: true, noScroll: true, replaceState: false });
	}
</script>

<div class="view-toggle" role="group" aria-label="View mode">
	<button
		type="button"
		class="view-btn"
		class:active={mode === 'dashboard'}
		onclick={() => setMode('dashboard')}
		aria-pressed={mode === 'dashboard'}
	>
		<LayoutDashboard class="size-3.5" />
		<span>Dashboard</span>
	</button>
	<button
		type="button"
		class="view-btn"
		class:active={mode === 'story'}
		onclick={() => setMode('story')}
		aria-pressed={mode === 'story'}
	>
		<Sparkles class="size-3.5" />
		<span>Story</span>
	</button>
</div>

<style>
	.view-toggle {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 3px;
		border-radius: 999px;
		background: var(--panel);
		border: 1px solid var(--panel-mid);
	}

	.view-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.3125rem 0.75rem;
		border-radius: 999px;
		font-family: var(--font-heading, 'Jost', sans-serif);
		font-size: 0.72rem;
		font-weight: 500;
		letter-spacing: 0.02em;
		color: var(--gray);
		cursor: pointer;
		transition: background-color 150ms ease, color 150ms ease, box-shadow 150ms ease;
	}

	.view-btn:hover:not(.active) {
		color: var(--darkgrayblue);
	}

	.view-btn.active {
		background: var(--paper);
		color: var(--darkgrayblue);
		box-shadow:
			0 1px 2px rgba(41, 68, 87, 0.08),
			0 0 0 1px rgba(41, 68, 87, 0.06);
	}
</style>

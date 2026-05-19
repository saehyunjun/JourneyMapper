<!--
	Ambient Booth — a full-bleed, conference-booth view: every tagged segment as
	a drifting circle that sorts itself into themes, question by question.
	ThemeConstellation fills the whole page; it reads the pipeline outputs
	directly and self-cycles. Clicking a circle opens the theme drawer.
-->
<script lang="ts">
	import ThemeConstellation from '$lib/charts/glp/ThemeConstellation.svelte';
	import ThemeDrawer from '$lib/components/ThemeDrawer.svelte';

	let themeDrawerOpen = $state(false);
	let drawerThemeId = $state<string | null>(null);

	function openTheme(themeId: string) {
		drawerThemeId = themeId;
		themeDrawerOpen = true;
	}
</script>

<div class="flex flex-1 flex-col">
	<ThemeConstellation fullBleed onThemeSelect={openTheme} />
</div>

<ThemeDrawer bind:open={themeDrawerOpen} themeId={drawerThemeId} />

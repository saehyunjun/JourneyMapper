<!--
	Keyword orbit — a full-bleed, ambient, conference-booth view: coded themes as
	hubs with the keywords participants used orbiting them, coloured by sentiment.
	KeywordOrbit reads the pipeline outputs directly and runs its own cycles.
	Clicking a theme hub (or a keyword) opens the theme drawer.
-->
<script lang="ts">
	import KeywordOrbit from '$lib/charts/glp/KeywordOrbit.svelte';
	import ThemeDrawer from '$lib/components/ThemeDrawer.svelte';

	let themeDrawerOpen = $state(false);
	let drawerThemeId = $state<string | null>(null);

	function openTheme(themeId: string) {
		drawerThemeId = themeId;
		themeDrawerOpen = true;
	}
</script>

<div class="relative flex-1">
	<KeywordOrbit onThemeSelect={openTheme} />
</div>

<ThemeDrawer bind:open={themeDrawerOpen} themeId={drawerThemeId} />

<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<!-- ── Nav bar ──────────────────────────────────────────────────────── -->
<div class="title-bar flex min-w-full shrink-0 flex-row items-center gap-3 px-2 py-2">
	<span class="h3 nav-title">PX Review</span>
	<span class="nav-title">Powered by PatientlyIQ</span>
</div>

{@render children()}



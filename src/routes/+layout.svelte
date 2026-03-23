<script lang="ts">
	import '../app.css';
</script>
  <!-- ── Nav bar ──────────────────────────────────────────────────────── -->
  <div class="title-bar flex flex-row min-w-full shrink-0 px-2 py-2">
    <span class="h3 nav-title">JourneyMapper</span>
    <span class="nav-title">Powered by PatientlyIQ</span>
  </div>

<!--
  This layout file imports global CSS (including Tailwind via @import in app.css).
  Layouts in SvelteKit use a slot as an outlet for child routes.
-->

<slot />



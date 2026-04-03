<script>
  import EventCard from './StepEvents.svelte';

   /** Full array of events from step.events */
   export let events = [];
 
 // ── Partition events into three lanes ─────────────────────────────────────
 $: journeyEvents = events.filter(e =>
   ['roadblock', 'progress', 'community', 'hospitalization'].includes(e.type)
 );
 $: infoSources   = events.filter(e => e.type === 'info_source');
 $: interventions = events.filter(e => e.type === 'intervention');

 $: hasAny = events.length > 0;
</script>

{#if hasAny}

 <!-- ── Journey Events ───────────────────────────────────────────────────── -->
 {#if journeyEvents.length > 0}
   <div class="events-section">
     <div class="section-header">
       <span class="section-eyebrow">Journey Events</span>
       <span class="section-count">{journeyEvents.length}</span>
     </div>
     <div class="events-stack">
       {#each journeyEvents as event (event.event_id)}
         <EventCard {event} />
       {/each}
     </div>
   </div>
 {/if}

 <!-- ── Information Sources ──────────────────────────────────────────────── -->
 {#if infoSources.length > 0}
   <div class="events-section">
     <div class="section-header section-header--info">
       <span class="section-eyebrow">Information Sources</span>
       <span class="section-count">{infoSources.length}</span>
     </div>
     <div class="events-stack">
       {#each infoSources as event (event.event_id)}
         <EventCard {event} />
       {/each}
     </div>
   </div>
 {/if}

 <!-- ── Intervention Opportunities ───────────────────────────────────────── -->
 {#if interventions.length > 0}
   <div class="events-section">
     <div class="section-header section-header--intervention">
       <span class="section-eyebrow">Intervention Opportunities</span>
       <span class="section-count">{interventions.length}</span>
     </div>
     <div class="events-stack">
       {#each interventions as event (event.event_id)}
         <EventCard {event} />
       {/each}
     </div>
   </div>
 {/if}

{/if}

<style>
 /* ── Section block ──────────────────────────────────────────────────────── */
 .events-section {
   display: flex;
   flex-direction: column;
   gap: 6px;
 }

 /* ── Section header ─────────────────────────────────────────────────────── */
 .section-header {
   display: flex;
   align-items: center;
   gap: 6px;
   padding-bottom: 4px;
   border-bottom: 1.5px solid #DFC3A8;
 }

 .section-eyebrow {
   font-family: 'Space Mono', monospace;
   font-size: 0.6rem;
   font-weight: 700;
   text-transform: uppercase;
   letter-spacing: 0.09em;
   color: #8A6A4A;
   flex: 1;
 }

 /* Tint the eyebrow color for info + intervention lanes */
 .section-header--info .section-eyebrow {
   color: #92701A;
 }

 .section-header--intervention .section-eyebrow {
   color: #1A7A82;
 }

 .section-count {
   font-family: 'Space Mono', monospace;
   font-size: 0.58rem;
   font-weight: 700;
   color: #BFA080;
   background: #F4EFE5;
   border: 1px solid #DFC3A8;
   border-radius: 100px;
   padding: 0px 5px;
   line-height: 1.6;
 }

 /* ── Card stack ─────────────────────────────────────────────────────────── */
 .events-stack {
   display: flex;
   flex-direction: column;
   gap: 6px;
 }
</style>
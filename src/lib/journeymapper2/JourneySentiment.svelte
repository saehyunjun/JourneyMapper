<script>
  import { sentimentToColor } from './journeyConfig.js';
  import JourneyGrid      from './JourneyGrid.svelte';
  import JourneyLine      from './JourneyLine.svelte';
  import JourneyNodes     from './JourneyNodes.svelte';
  import JourneyIndexBars from './JourneyIndexBars.svelte';

  export let data    = [];
  /**
   * Optional metric definitions array (same shape as journeyPersonas.json metrics).
   * When provided the index bars are rendered inside the grid behind the
   * sentiment line, matching the print-layout overlay style.
   */
  export let metrics = [];
</script>

<JourneyGrid {data}>
  <!--
    Index bars rendered first (lowest z-order) so they sit behind the
    sentiment line and nodes. overlayMode=true emits only a <g> so it
    participates in the SVG stacking context rather than creating a new
    SVG root.
  -->
  {#if metrics.length}
    <JourneyIndexBars {data} {metrics} overlayMode={true} />
  {/if}

  <JourneyLine
    {data}
    metricKey="sentiment"
    colorFn={sentimentToColor}
    opacity={1}
    label="Sentiment"
    showInflection={true}
    alignLeft={true}
  />
  <JourneyNodes
    {data}
    metricKey="sentiment"
    colorFn={sentimentToColor}
    opacity={1}
    alignLeft={true}
  />
</JourneyGrid>

<style>
</style>
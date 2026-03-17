<script>
  import { sentimentToColor } from './journeyConfig.js';
  import JourneyGrid  from './JourneyGrid.svelte';
  import JourneyLine  from './JourneyLine.svelte';
  import JourneyNodes from './JourneyNodes.svelte';

  export let data = [];
</script>


<JourneyGrid {data}>
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
  .section-label {
    color: #8A6A4A;
    padding: 4px 12px;
    background: #F4EFE5;
    border-top: 1px solid #DFC3A8;
    border-bottom: 1px solid #DFC3A8;
  }
</style>
<script>
  import { valueToY } from './journeyConfig.js';
  import JourneyGrid  from './JourneyGrid.svelte';
  import JourneyLine  from './JourneyLine.svelte';
  import JourneyNodes from './JourneyNodes.svelte';

  /** Journey step data array */
  export let data = [];

  /**
   * Metric definitions — each item: { key, color, label }
   * Matches the shape from journeyPersonas.json metrics array.
   */
  export let metrics = [];

  // ── Jitter offsets: separate coincident nodes on the same y position ──────
  const JITTER = 7;

  /**
   * For each step column, find metrics that land on the same y pixel and
   * spread them apart vertically by JITTER px per slot.
   *
   * @param {any[]} d
   * @param {{ key: string }[]} mets
   * @returns {number[][]}  offs[metricIndex][stepIndex]
   */
  function computeOffsets(d, mets) {
    const ns = d.length, nm = mets.length;
    const offs = mets.map(() => new     Array(ns).fill(0));
    for (let si = 0; si < ns; si++) {
      const groups = new Map();
      for (let mi = 0; mi < nm; mi++) {
        const yKey = Math.round(valueToY(d[si]?.[mets[mi].key]));
        if (!groups.has(yKey)) groups.set(yKey, []);
        groups.get(yKey).push(mi);
      }
      for (const grp of groups.values()) {
        if (grp.length < 2) continue;
        const half = (grp.length - 1) / 2;
        grp.forEach((mi, slot) => { offs[mi][si] = (slot - half) * JITTER; });
      }
    }
    return offs;
  }

  $: nodeOffsets = computeOffsets(data, metrics);
</script>

<JourneyGrid {data}>
  {#each metrics as m}
    <JourneyLine
      {data}
      metricKey={m.key}
      color={m.color}
      label={m.label}
    />
  {/each}
  {#each metrics as m, mi}
    <JourneyNodes
      {data}
      metricKey={m.key}
      color={m.color}
      offsets={nodeOffsets[mi]}
    />
  {/each}s
</JourneyGrid>
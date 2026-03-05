<script>
  import {
    ROW_VALUES,
    GRID_HEIGHT,
    LEFT_AXIS_WIDTH,
    TOP_PADDING,
    SVG_HEIGHT,
    valueToY,
  } from './journeyConfig.js';
</script>

<!--
  Sticky y-axis overlay. Place this as the first child inside .shared-scroll
  alongside the other chart SVGs. It uses `position: sticky; left: 0` so it
  pins to the left edge of the scroll container while the user scrolls right.

  It covers exactly the LEFT_AXIS_WIDTH gutter column, painting over the axis
  labels that are already embedded in each SVG — giving a clean frosted panel
  that stays visible at all times.
-->
<div class="axis-wrap" style="--axis-w: {LEFT_AXIS_WIDTH}px; --svg-h: {SVG_HEIGHT}px;">
  <svg
    width={LEFT_AXIS_WIDTH}
    height={SVG_HEIGHT}
    class="axis-svg"
    aria-hidden="true"
  >
    <!-- Solid background so chart content doesn't bleed through -->
    <rect x="0" y="0" width={LEFT_AXIS_WIDTH} height={SVG_HEIGHT} fill="#F4EFE5" />

    <!-- Right edge border -->
    <line
      x1={LEFT_AXIS_WIDTH - 0.5} y1={TOP_PADDING}
      x2={LEFT_AXIS_WIDTH - 0.5} y2={TOP_PADDING + GRID_HEIGHT}
      stroke="#DFC3A8" stroke-width="1"
    />

    <!-- Axis value labels -->
    {#each ROW_VALUES as rowVal}
      {@const y      = valueToY(rowVal)}
      {@const isZero = rowVal === 0}
      <text
        x={LEFT_AXIS_WIDTH - 6}
        y={y + 4}
        text-anchor="end"
        class="label-sm"
      >{rowVal}</text>
    {/each}
  </svg>
</div>

<style>
  .axis-wrap {
    /* Stick to the left as the user scrolls horizontally */
    position: sticky;
    left: 0;
    /* Sit exactly over the left gutter of the chart SVGs */
    width: var(--axis-w);
    height: var(--svg-h);
    /* Float above the chart rows */
    z-index: 10;
    /* Pull it up so it overlaps the grid row — negative margin
       collapses the space it would otherwise occupy in the flow */
    margin-bottom: calc(-1 * var(--svg-h));
    /* Don't capture pointer events — clicks should fall through to the grid */
    pointer-events: none;
    flex-shrink: 0;
  }

  .axis-svg {
    display: block;
  }

</style>
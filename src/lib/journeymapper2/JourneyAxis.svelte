<script>
    import {
      ROW_VALUES,
      GRID_HEIGHT,
      LEFT_AXIS_WIDTH,
      TOP_PADDING,
      SVG_HEIGHT,
      valueToY,
    } from './journeyConfig.js';

    import CircleIconRegular from "phosphor-icons-svelte/IconCircleRegular.svelte";
    import MinusCircleRegular from "phosphor-icons-svelte/IconMinusCircleRegular.svelte";
    import PlusCircleRegular from "phosphor-icons-svelte/IconPlusCircleRegular.svelte";
    
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
      <rect x="0" y="0" width={LEFT_AXIS_WIDTH} height={SVG_HEIGHT} fill="#EBEBEB" />
  
      <!-- Right edge border -->
      <line
        x1={LEFT_AXIS_WIDTH - 0.5} y1={TOP_PADDING}
        x2={LEFT_AXIS_WIDTH - 0.5} y2={TOP_PADDING + GRID_HEIGHT}
        stroke="#FF0000" stroke-width="1"
      />
  
      <!--
        Axis icons — only at the three anchor values (+5, 0, −5).
        Phosphor Regular paths (viewBox="0 0 256 256"), scaled to 14×14 px.
        Centred on the grid line: translate(cx - 7, y - 7)
      -->
      {#each ROW_VALUES as rowVal}
      {#if rowVal === 4 || rowVal === 0 || rowVal === -4}
        {@const cy = valueToY(rowVal)-8}
        {@const iconX = LEFT_AXIS_WIDTH - 26}
        {@const iconY = cy}
        <g transform="translate({iconX},{iconY})" aria-hidden="true">
          {#if rowVal === 4}
            <PlusCircleRegular />
          {:else if rowVal === 0}
            <CircleIconRegular />
          {:else if rowVal === -4}
            <MinusCircleRegular/>
          {/if}
        </g>
      {/if}
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
      background-color: #EBEBEB;
    }
  
    .axis-svg {
      display: block;
    }
  
  </style>
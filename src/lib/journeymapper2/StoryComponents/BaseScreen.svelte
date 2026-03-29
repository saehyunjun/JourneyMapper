<script>
  export let title = '';
  export let kicker = '';
  export let content = '';
  export let meta = null; // optional row (stage, step, etc.)
</script>

<div class="story-screen">
  <div class="content-wrap gap-3">

    {#if kicker}
      <span class="jm-kicker">{kicker}</span>
    {/if}

    {#if title}
      <h2 class="heading-serif-md">{title}</h2>
    {/if}

    {#if meta}
      <div class="toolbar-sm-empty">
        <span class="label-sm">{meta}</span>
      </div>
    {/if}

    {#if content}
      <p class="text-body">{@html content}</p>
    {/if}

    <slot />
  </div>
</div>
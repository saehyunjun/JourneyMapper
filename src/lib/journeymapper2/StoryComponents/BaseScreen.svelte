<script>
    let { title = '', kicker = '', content = '', meta = null, accent = 'var(--purple)', children } = $props();
  </script>
  
  <div class="screen">
    <div class="screen-inner">
  
      {#if kicker}
        <span class="screen-kicker" style="color: {accent}; border-color: {accent}20;">
          {kicker}
        </span>
      {/if}
  
      {#if meta}
        <span class="screen-meta">{meta}</span>
      {/if}
  
      {#if title}
        <h2 class="screen-title">{title}</h2>
      {/if}
  
      {#if content}
        <div class="screen-content">
          <p class="text-body">{@html content}</p>
        </div>
      {/if}
  
      {@render children?.()}
    </div>
  </div>
  
  <style>
  .screen {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 0 0 8px;
    background: linear-gradient(
      to top,
      var(--green) 0%,
      var(--midgreen) 40%,
      var(--green) 100%
    ), #0f0d0b;  /* ← add solid base color */
  }
  
    .screen-inner {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 20px 22px 10px;
    }
  
    .screen-kicker {
      display: inline-flex;
      width: fit-content;
      font-size: 0.825em;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 3px 10px;
      border-radius: 20px;
      border: 1px solid;
    }
  
  
  </style>
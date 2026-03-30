<script>
    let { profile = {}, accent = 'var(--purple)' } = $props();
  </script>
  
  <div class="screen">
    <!-- Atmospheric background glow -->
    <div class="screen-glow" style="background: radial-gradient(ellipse at 50% 60%, {accent}22 0%, transparent 70%);"></div>
  
    <div class="screen-inner">
      <span class="screen-label" style="color: {accent};">Key Quote</span>
  
      <div class="quote-mark" style="color: {accent};">&ldquo;</div>
  
      <p class="quote-text">
        {profile?.quote ?? 'No quote available.'}
      </p>
  
      <div class="quote-attribution">
        <span class="quote-name">{profile?.name}</span>
      </div>
    </div>
  </div>
  
  <style>
    .screen {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(160deg, #0f0d0b 0%, #1a1410 100%);
    }
  
    .screen-glow {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
  
    .screen-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 12px;
      padding: 32px 28px;
      z-index: 1;
    }
  
    .screen-label {
      font-family: var(--font-mono, monospace);
      font-size: 0.65em;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
  
    .quote-mark {
      font-family: var(--font-serif, Georgia, serif);
      font-size: 4rem;
      line-height: 0.7;
      opacity: 0.6;
      margin-bottom: -4px;
    }
  
    .quote-text {
      font-family: var(--font-serif, Georgia, serif);
      font-size: clamp(1.05rem, 3.5vw, 1.35rem);
      line-height: 1.55;
      color: rgba(255,255,255,0.92);
      font-style: italic;
      letter-spacing: -0.01em;
      margin: 0;
    }
  
    .quote-attribution {
      margin-top: 8px;
      padding-top: 12px;
      border-top: 1px solid rgba(255,255,255,0.12);
      width: 60%;
    }
  
    .quote-name {
      font-family: var(--font-mono, monospace);
      font-size: 0.65em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(255,255,255,0.4);
    }
  </style>
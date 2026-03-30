<script>
  let { profile = {} } = $props();
</script>

<div class="story-screen stats-animation-gradient__gradient--bright">
  <div class="content-wrap items-center justify-center h-full text-center">

    <div class="card p-6">
      <p class="pull-quote-lg">
        &ldquo;{profile?.quote ?? 'No quote available'}&rdquo;
      </p>
    </div>

  </div>
</div>
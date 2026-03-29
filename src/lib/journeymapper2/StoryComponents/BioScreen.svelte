<script>
  export let title = '';
  export let content = '';
</script>

<div class="story-screen">
  <div class="content-wrap">
    <h2 class="heading-serif-md">{title}</h2>
    <p class="text-body">{@html content}</p>
  </div>
</div>
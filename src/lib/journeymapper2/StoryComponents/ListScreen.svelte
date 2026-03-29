<script>
  export let title = '';
  export let items = [];
  export let type = 'goal';
</script>

<div class="story-screen">
  <div class="content-wrap">
    <h2 class="heading-serif-md">{title}</h2>

    <ol class="flex flex-col gap-3">
      {#each items as item, i}
        <li class="flex gap-3 items-start">
          <span
            class={type === 'goal'
              ? 'icon-toolbar-dark-sm label-sm'
              : 'icon-toolbar-red-sm label-sm'}>
            {i + 1}
          </span>
          <p class="text-body-sm">{item}</p>
        </li>
      {/each}
    </ol>
  </div>
</div>
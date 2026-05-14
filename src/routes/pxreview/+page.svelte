<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { sections } from "$lib/content";
	import { sidebarState } from "$lib/sidebar-state.svelte.js";
  import IconArrowRightRegular from "phosphor-icons-svelte/IconArrowRightRegular.svelte";
  import IconArrowCircleUpRightRegular from "phosphor-icons-svelte/IconArrowCircleUpRightRegular.svelte";

</script>

<Sidebar.Provider
	class="bg-primary-foreground w-full z-99"
	bind:open={() => sidebarState.open, (v) => (sidebarState.open = v)}
>
	<AppSidebar />
	<Sidebar.Inset>
		<header class="flex h-16 shrink-0 items-center gap-2 fixed bg-primary-foreground w-full z-99">
			<div class="flex items-center gap-2 px-3">
				<Sidebar.Trigger />
				<Separator orientation="vertical" class="me-2 h-4" />
				<Breadcrumb.Root>
					<Breadcrumb.List>
						<Breadcrumb.Item>
							<Breadcrumb.Page>PX Review</Breadcrumb.Page>
						</Breadcrumb.Item>
					</Breadcrumb.List>
				</Breadcrumb.Root>
			</div>
		</header>
		<div class="flex flex-1 flex-col gap-6 mt-16">
			<div class="flex flex-col py-24 bg-accent-mint px-8">
				<p class="text-primary-foreground justify-center text-2xl md:text-4xl md:font-light leading-8 md:leading-11 text-pretty h-64 text-center  align-middle my-auto md:w-5xl mx-auto">
          <span class="font-bold text-primary-foreground">
            PX Review</span> is a collection of best practices for patient advocacy, medical affairs, and clinical operations teams to reference as they collaborate in the building of patient experiences.
				</p>

			</div>
			<div class="flex flex-col px-8 md:w-5xl mx-auto">
				{#each sections as section (section.folder)}
        <div class="flex flex-col md:flex-row min-w-full pt-4 pb-12 justify-between">
        <div class="flex flex-col pb-4 border-y md:border-y-0 pr-8 md:border-r md:w-xs">
					<a href="{section.url}" class="flex flex-row align-middle justify-between gap-8 duration-400 cubic-in hover:font-bold hover:cursor-pointer hover:text-mint">
          <h2 class="font-semibold font-heading text-lg text-muted-foreground uppercase ">
							{section.title}
            </h2>  
            <IconArrowCircleUpRightRegular class="text-2xl text-muted-foreground "/>
          </a>	

            <p class="flex flex-col text-base">
              {section.description}
            </p>
          </div>
						<ul class="flex flex-col gap-6 justify-evenly py-8 md:py-0 space-y-2 h-full">
							{#each section.entries as entry (entry.url)}
								<a class="flex flex-col  md:w-xl md:pl-8 w-full justify-between
                hover:text-muted-foreground hover:cursor-pointer hover:-translate-y-2 duration-400 ease-in-out"
                href={entry.url}>
                  <div class="flex flex-row w-full justify-between">
                    <h3 class="text-lg leading-tight mb-2 font-medium text-accent-mint uppercase tracking-tight">
                      {entry.title}
                    </h3>
                  <IconArrowRightRegular class="text-xl text-accent-mint"/>
                </div>
                  <p class="text-sm md:max-w-sm font-primary">
                    {entry.summary}</p>  
                </a>
							{/each}

						</ul>
        </div>
				{/each}
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

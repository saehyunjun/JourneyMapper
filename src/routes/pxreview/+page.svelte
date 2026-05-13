<script lang="ts">
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { sections } from "$lib/content";
</script>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset>
		<header class="flex h-16 shrink-0 items-center gap-2">
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
		<div class="flex flex-1 flex-col gap-6 p-6">
			<div>
				<p class="text-secondary-foreground text-2xl md:text-4xl md:font-light leading-8 md:leading-11 text-pretty md:pr-8 lg:pr-64 mb-24">
          <span class="font-bold">The PX Review</span> is a collection of best practices that patient advocacy, medical affairs, and clinical operations teams can reference when building patient experiences.
				</p>
			</div>
			<div class="flex flex-col">
				{#each sections as section (section.folder)}
        <div class="flex flex-col min-w-full pt-4 pb-24 justify-between border-t-2 border-accent-foreground">
        <div class="flex flex-col gap-2 pb-8 md:pb-0 md:pr-12">
						<a href={section.url} 
            class="font-semibold text-2xl hover:font-black hover:text-secondary-foreground">
							{section.title}
						</a>
            <p class="flex flex-col text-lg gap-6">
              {section.description}
            </p>
          </div>

						<ul class="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-2 justify-evenly py-8 space-y-2">
							{#each section.entries as entry (entry.url)}
								<li class="flex flex-col gap-2 bg-accent p-8 pb-16 border-primary aspect-auto hover:bg-accent hover:-translate-y-2 hover:cursor-pointer duration-400 ease-in-out">
                  <a class="text-xl font-semibold" href={entry.url} >{entry.title}</a>
                  <p class="text-sm font-primary">
                    {entry.summary}</p>
								</li>
							{/each}
						</ul>
        </div>
				{/each}
			</div>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

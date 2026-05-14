<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { sections } from "$lib/content";
	import IconArrowRightRegular from "phosphor-icons-svelte/IconArrowRightRegular.svelte";
	import { MoveUpRight } from "@lucide/svelte";
</script>

<div class="flex flex-1 flex-col gap-6">
	<div class="flex flex-col py-24 bg-accent-mint px-8">
		<p class="text-primary-foreground justify-center text-2xl md:text-4xl md:font-light leading-8 md:leading-11 text-pretty h-64 text-center  align-middle my-auto md:w-5xl mx-auto">
			<span class="font-bold text-primary-foreground">
				PX Review</span> is a collection of best practices for patient advocacy, medical affairs, and clinical operations teams to reference as they collaborate in the building of patient experiences.
		</p>
	</div>
	<div class="flex flex-col px-8 md:w-7xl mx-auto">
		{#each sections as section (section.folder)}
			<div class="flex flex-col md:flex-row min-w-full pt-4 pb-12 justify-between">
				<div class="flex flex-col h-full justify-between md:border-r md:w-md pr-8">
					<div class="flex flex-col gap-4 justify-start pb-4 border-y md:border-y-0 pr-8">
						<h2 class="font-light font-heading text-6xl text-primary uppercase ">
							{section.title}
						</h2>
						<p class="flex-col text-xl">
							{section.description}
						</p>
					</div>
					<Button
						variant="outline"
						size="lg"
						href={section.url}>
						Read all {section.title}
						<MoveUpRight />
					</Button>
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

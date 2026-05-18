<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { sections } from "$lib/content";
	import IconArrowRightRegular from "phosphor-icons-svelte/IconArrowRightRegular.svelte";
	import { MoveUpRight } from "@lucide/svelte";
</script>

<div class="flex flex-1 flex-col gap-6">
	<div class="flex flex-col mx-auto w-full h-96 bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten align-middle justify-center">	
	<div class="flex flex-col gap-2 w-full">
		<span class="pill-white mx-auto text-base mb-8">Demo</span>
		<span class="text-lg text-white text-center mx-auto justify-center">Prepared for Worldwide Clinical Trials by Patiently Studio</span>
		<p class="text-primary-foreground justify-center text-center text-2xl md:text-5xl md:font-light leading-8 md:leading-11 text-pretty md:w-5xl mx-auto">
			<span class="font-bold text-primary-foreground">
				GLP-1</span> Patient Insights Lab Book
		</p>
	</div>
	</div>

	<!-- Data tools -->
	<div class="flex flex-col gap-4 px-8 mx-auto pt-8">
		<h2 class="text-2xl uppercase tracking-wide text-accent-mint font-medium">Explore the data</h2>

		<div class="flex flex-col gap-4 md:flex-row">
			<a
				href="/wctglpdemo/analysis"
				class="flex w-md flex-row py-2 px-4 border duration-400 ease-in-out hover:-translate-y-2 hover:text-muted-foreground hover:cursor-pointer"
			>
				<div class="flex flex-col items-start justify-center gap-2">
					<h3 class="text-lg font-medium uppercase tracking-tight text-accent-mint">
						Interview analysis workspace
					</h3>
					<p class="text-sm">
						Filter and review the AI-proposed quote bank, theme and emotion tags, and word counts
						across the interviews — every item flagged pending analyst review.
					</p>
				</div>
				<MoveUpRight class="size-8 text-accent-mint" />
			</a>
			<a
				href="/wctglpdemo/interview-words"
				class="flex flex-1 flex-col gap-2 border p-6 duration-400 ease-in-out hover:-translate-y-2 hover:text-muted-foreground"
			>
				<div class="flex flex-row items-start justify-between">
					<h3 class="text-lg font-medium uppercase tracking-tight text-accent-mint">
						What patients said
					</h3>
					<MoveUpRight class="shrink-0 text-accent-mint" />
				</div>
				<p class="text-sm">
					Sortable word-usage charts drawn from the GLP-1 patient interviews.
				</p>
			</a>
		</div>
	</div>
</div>

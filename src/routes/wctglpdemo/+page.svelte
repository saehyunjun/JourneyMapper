<script lang="ts">
	import { MoveUpRight } from "@lucide/svelte";

	const tools = [
		{
			href: "/wctglpdemo/upload",
			title: "Upload transcript",
			description:
				"Add a new interview transcript — parse and segment it, then review its question mapping and tags."
		},
		{
			href: "/wctglpdemo/tag",
			title: "Tag segments",
			description:
				"Confirm theme, emotion, sentiment, and semantic tags from the codebook for each participant segment."
		},
		{
			href: "/wctglpdemo/fingerprint",
			title: "Participant fingerprint",
			description:
				"Each interviewee's distinctive theme profile, pooled across every interview question."
		},
		{
			href: "/wctglpdemo/analysis",
			title: "Interview analysis workspace",
			description:
				"Filter and review the AI-proposed quote bank, theme and emotion tags, and word counts."
		},
		{
			href: "/wctglpdemo/interview-words",
			title: "What patients said",
			description: "Sortable word-usage and theme charts drawn from the GLP-1 patient interviews."
		},
		{
			href: "/wctglpdemo/topic-tree",
			title: "Theme radial",
			description: "Zoomable radial tree: theme → subtheme → word."
		}
	];
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
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-8 pt-8 pb-12">
		<h2 class="text-2xl uppercase tracking-wide text-accent-mint font-medium">Explore the data</h2>

		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each tools as tool (tool.href)}
				<a
					href={tool.href}
					class="flex flex-col gap-2 border p-6 duration-400 ease-in-out hover:-translate-y-2 hover:text-muted-foreground"
				>
					<div class="flex flex-row items-start justify-between gap-3">
						<h3 class="text-lg font-medium uppercase tracking-tight text-accent-mint">
							{tool.title}
						</h3>
						<MoveUpRight class="size-5 shrink-0 text-accent-mint" />
					</div>
					<p class="text-sm">{tool.description}</p>
				</a>
			{/each}
		</div>
	</div>
</div>

<!--
	Key-phrase bank — browse every canonical phrase and the participant
	utterances that have been filed under it. Tagging happens elsewhere (from
	the segment-tag drawer's right-click menu or its in-drawer panel); this
	page is a read-only view, with each variant linking back to its source
	segment in the upload review view.
-->
<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const titleCase = (id: string) => id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

	// Highlight the variant snippet inside its source segment so the reviewer
	// can see what was filed and the context it sat in.
	function withHighlight(full: string | undefined, snippet: string): string {
		if (!full) return '';
		const i = full.toLowerCase().indexOf(snippet.toLowerCase());
		if (i === -1) return full;
		return (
			full.slice(0, i) +
			`<mark class="bg-accent-mint/30 text-inherit">${full.slice(i, i + snippet.length)}</mark>` +
			full.slice(i + snippet.length)
		);
	}

	const totalVariants = $derived(
		data.keyPhrases.reduce((n, kp) => n + kp.variants.length, 0)
	);
</script>

<svelte:head>
	<title>Key phrases — WCT GLP-1</title>
</svelte:head>

<div class="flex flex-1 flex-col">
	<div
		class="flex h-64 w-full flex-col justify-center bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center bg-blend-lighten"
	>
		<div class="mx-auto flex w-full max-w-6xl flex-col gap-3 px-8">
			<span class="figcaption text-white">GLP-1 Interviews</span>
			<h1 class="font-heading text-5xl font-light capitalize text-primary-foreground md:text-6xl">
				Key phrases
			</h1>
			<p class="max-w-2xl text-lg leading-7 text-primary-foreground/85">
				Canonical labels that unify disparate participant phrasings — “gained weight
				multiple times” and “always gained it back eventually” can sit under one phrase
				like “Recurrent past weight gain”.
			</p>
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-8 py-12">
		<div class="flex items-baseline justify-between border-b border-slate-200 pb-3">
			<p class="text-sm text-slate-500">
				<span class="font-medium text-slate-700">{data.keyPhrases.length}</span> key phrase{data
					.keyPhrases.length === 1
					? ''
					: 's'}
				·
				<span class="font-medium text-slate-700">{totalVariants}</span> variant{totalVariants === 1
					? ''
					: 's'}
			</p>
			<p class="text-xs text-slate-400">
				Tag new variants from the segment-tag drawer in the upload review view.
			</p>
		</div>

		{#if data.keyPhrases.length === 0}
			<div
				class="rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center"
			>
				<p class="text-sm text-slate-600">No key phrases yet.</p>
				<p class="mt-1 text-xs text-slate-400">
					Open a segment in <a
						href="/patientlyiq/upload"
						class="text-accent-mint underline">upload review</a
					>, highlight a phrase, and use the “As a key phrase” menu to start the bank.
				</p>
			</div>
		{:else}
			<div class="flex flex-col gap-6">
				{#each data.keyPhrases as kp (kp.id)}
					<article class="rounded-lg border border-slate-200 bg-white p-5">
						<header class="mb-3 flex items-baseline justify-between gap-3">
							<h2 class="text-xl font-medium text-slate-800">{kp.label}</h2>
							<span class="font-mono text-xs text-slate-400">{kp.id}</span>
						</header>
						<p class="mb-3 text-xs text-slate-500">
							{kp.variants.length} variant{kp.variants.length === 1 ? '' : 's'}
						</p>
						<ul class="flex flex-col gap-2.5">
							{#each kp.variants as v (v.segment_id + v.text)}
								<li class="rounded-md border border-slate-100 bg-slate-50 p-3">
									<div class="mb-1.5 flex items-baseline justify-between gap-3">
										<a
											href={`/patientlyiq/upload?interview=${v.interview_id}`}
											class="font-mono text-xs text-accent-mint hover:underline"
										>
											{titleCase(v.interview_id)} · {v.segment_id}
										</a>
										<span class="font-mono text-[10px] text-slate-400">
											{v.created_at.slice(0, 10)}
										</span>
									</div>
									<p class="text-sm leading-snug text-slate-700">
										{@html withHighlight(data.segmentText[v.segment_id], v.text)}
									</p>
								</li>
							{/each}
						</ul>
					</article>
				{/each}
			</div>
		{/if}
	</div>
</div>

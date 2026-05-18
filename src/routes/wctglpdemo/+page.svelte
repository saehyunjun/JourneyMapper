<script lang="ts">
	import { untrack } from 'svelte';
	import {
		MoveUpRight,
		Upload,
		ClipboardList,
		Fingerprint,
		MessageSquareQuote,
		Network,
		Check
	} from '@lucide/svelte';
	import { studyStats, pendingInterviews, quotes } from '$lib/content/wctglpdemo-data/analysis';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// --- Tagging progress (static, from the segment-tags artifact) ---
	const totalInterviews = studyStats.interviews;
	const pendingTagging = pendingInterviews.length;
	const taggedCount = totalInterviews - pendingTagging;

	// --- Quote-review progress (from the live quote-reviews store) ---
	const totalQuotes = quotes.length;
	const reviewValues = Object.values(untrack(() => data.quoteReviews));
	const reviewedCount = reviewValues.filter((s) => s === 'approved' || s === 'rejected').length;
	const pendingQuotes = totalQuotes - reviewedCount;

	// 'open' — an ongoing entry point with no "done" state (uploading).
	// 'active' — review work is still pending.
	// 'done' — every item in this stage is reviewed.
	type Status = 'open' | 'active' | 'done';

	const steps: {
		n: number;
		href: string;
		icon: typeof Upload;
		title: string;
		blurb: string;
		stat: string;
		progress: number;
		status: Status;
		cta: string;
	}[] = [
		{
			n: 1,
			href: '/wctglpdemo/upload',
			icon: Upload,
			title: 'Upload & review interviews',
			blurb:
				'Upload a transcript — it is parsed, segmented, and AI-tagged automatically — then review and correct its question mapping and segment tags.',
			stat:
				pendingTagging > 0
					? `${taggedCount} of ${totalInterviews} reviewed · ${pendingTagging} pending`
					: `All ${totalInterviews} interviews reviewed`,
			progress: totalInterviews ? taggedCount / totalInterviews : 1,
			status: pendingTagging > 0 ? 'active' : 'done',
			cta: pendingTagging > 0 ? 'Review pending interviews' : 'Upload or revisit interviews'
		},
		{
			n: 2,
			href: '/wctglpdemo/analysis',
			icon: ClipboardList,
			title: 'Review quote bank',
			blurb: 'Approve or reject the AI-proposed pull quotes, and star highlights for the magazine.',
			stat:
				pendingQuotes > 0
					? `${reviewedCount} of ${totalQuotes} quotes reviewed · ${pendingQuotes} pending`
					: `All ${totalQuotes} quotes reviewed`,
			progress: totalQuotes ? reviewedCount / totalQuotes : 1,
			status: pendingQuotes > 0 ? 'active' : 'done',
			cta: pendingQuotes > 0 ? 'Review the quote bank' : 'Open the quote bank'
		}
	];

	const outputs = [
		{
			href: '/wctglpdemo/fingerprint',
			icon: Fingerprint,
			title: 'Participant fingerprint',
			blurb: "Each interviewee's distinctive theme profile, pooled across every interview question."
		},
		{
			href: '/wctglpdemo/interview-words',
			icon: MessageSquareQuote,
			title: 'What patients said',
			blurb: 'Sortable word-usage and theme charts drawn from the GLP-1 patient interviews.'
		},
		{
			href: '/wctglpdemo/topic-tree',
			icon: Network,
			title: 'Theme radial',
			blurb: 'Zoomable radial tree: theme → subtheme → word.'
		}
	];
</script>

<div class="flex flex-1 flex-col gap-6">
	<div
		class="mx-auto flex h-96 w-full flex-col justify-center bg-accent-mint-background bg-[url('/content-assets/bgtexture.png')] bg-center align-middle bg-blend-lighten"
	>
		<div class="flex w-full flex-col gap-2">
			<span class="pill-white mx-auto mb-8 text-base">Demo</span>
			<span class="mx-auto justify-center text-center text-lg text-white">
				Prepared for Worldwide Clinical Trials by Patiently Studio
			</span>
			<p
				class="mx-auto justify-center text-pretty text-center text-2xl leading-8 text-primary-foreground md:w-5xl md:text-5xl md:font-light md:leading-11"
			>
				<span class="font-bold text-primary-foreground">GLP-1</span> Patient Insights Lab Book
			</p>
		</div>
	</div>

	<div class="mx-auto flex w-full max-w-6xl flex-col gap-12 px-8 pt-8 pb-12">
		<!-- Pipeline — two review stages, in order. -->
		<section class="flex flex-col gap-4">
			<div class="flex flex-col gap-1">
				<h2 class="text-2xl font-medium uppercase tracking-wide text-accent-mint">
					Analysis pipeline
				</h2>
				<p class="text-sm text-muted-foreground">
					Two review stages, in order — each one feeds the next.
				</p>
			</div>

			<div class="grid gap-4 md:grid-cols-2">
				{#each steps as step (step.n)}
					{@const Icon = step.icon}
					<a
						href={step.href}
						class="group flex flex-col gap-3 border p-6 duration-300 ease-in-out hover:-translate-y-2"
					>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<span
									class="flex size-7 items-center justify-center rounded-full text-sm font-medium
										{step.status === 'done'
										? 'bg-emerald-100 text-emerald-700'
										: 'bg-accent-mint text-white'}"
								>
									{#if step.status === 'done'}<Check class="size-4" />{:else}{step.n}{/if}
								</span>
								<Icon class="size-5 text-accent-mint" />
							</div>
							{#if step.status === 'active'}
								<span
									class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
								>
									Needs review
								</span>
							{:else if step.status === 'done'}
								<span
									class="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
								>
									Complete
								</span>
							{/if}
						</div>

						<h3 class="text-lg font-medium uppercase tracking-tight text-accent-mint">
							{step.title}
						</h3>
						<p class="text-sm text-muted-foreground">{step.blurb}</p>

						<div class="mt-auto flex flex-col gap-2 pt-2">
							{#if step.status !== 'open'}
								<div class="h-1.5 w-full rounded-full bg-slate-100">
									<div
										class="h-full rounded-full {step.status === 'done'
											? 'bg-emerald-400'
											: 'bg-accent-mint'}"
										style="width: {step.progress * 100}%"
									></div>
								</div>
							{/if}
							<span class="text-xs text-slate-500">{step.stat}</span>
							<span class="mt-1 flex items-center gap-1 text-sm font-medium text-accent-mint">
								{step.cta}
								<MoveUpRight
									class="size-4 duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
								/>
							</span>
						</div>
					</a>
				{/each}
			</div>
		</section>

		<!-- Read-only views over the reviewed data. -->
		<section class="flex flex-col gap-4">
			<div class="flex flex-col gap-1">
				<h2 class="text-2xl font-medium uppercase tracking-wide text-accent-mint">
					Explore the outputs
				</h2>
				<p class="text-sm text-muted-foreground">Read-only views over the reviewed data.</p>
			</div>

			<div class="grid gap-4 md:grid-cols-3">
				{#each outputs as out (out.href)}
					{@const Icon = out.icon}
					<a
						href={out.href}
						class="flex flex-col gap-2 border p-6 duration-400 ease-in-out hover:-translate-y-2 hover:text-muted-foreground"
					>
						<div class="flex flex-row items-start justify-between gap-3">
							<Icon class="size-5 shrink-0 text-accent-mint" />
							<MoveUpRight class="size-5 shrink-0 text-accent-mint" />
						</div>
						<h3 class="text-lg font-medium uppercase tracking-tight text-accent-mint">
							{out.title}
						</h3>
						<p class="text-sm">{out.blurb}</p>
					</a>
				{/each}
			</div>
		</section>
	</div>
</div>

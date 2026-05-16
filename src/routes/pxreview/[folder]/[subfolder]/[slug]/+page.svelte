<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import { findEntry } from "$lib/content";
	import TableOfContents from "$lib/components/TableOfContents.svelte";

	let { data } = $props();

	const entry = $derived(findEntry(data.folder, data.subfolder, data.slug));

	let articleEl: HTMLElement | null = $state(null);

	// Selector targets only direct, prose-level children. Charts (`figure`) and
	// boxed components (`section`, `aside`) animate themselves.
	const REVEAL_SELECTOR =
		':scope > h1, :scope > h2, :scope > h3, :scope > p, :scope > ul, :scope > ol, :scope > blockquote, :scope > hr, :scope > table';

	function findScrollParent(node: HTMLElement): Element | null {
		let el: HTMLElement | null = node.parentElement;
		while (el && el !== document.documentElement) {
			const overflowY = getComputedStyle(el).overflowY;
			if (overflowY === 'auto' || overflowY === 'scroll') return el;
			el = el.parentElement;
		}
		return null;
	}

	$effect(() => {
		const root = articleEl?.querySelector<HTMLElement>('.markdown-body');
		if (!root) return;
		// Re-run when the article (slug) changes.
		void data.slug;

		const targets = Array.from(root.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
		targets.forEach((el) => el.classList.add('reveal-text'));

		const scrollParent = findScrollParent(root);
		const viewH = () => window.innerHeight || document.documentElement.clientHeight;

		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						entry.target.classList.add('reveal-text--in');
						io.unobserve(entry.target);
					}
				}
			},
			{ root: scrollParent, rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
		);

		targets.forEach((el) => io.observe(el));

		// Fallback: anything already in view at mount gets revealed immediately.
		const t = window.setTimeout(() => {
			const h = viewH();
			for (const el of targets) {
				if (el.classList.contains('reveal-text--in')) continue;
				const rect = el.getBoundingClientRect();
				if (rect.top < h && rect.bottom > 0) {
					el.classList.add('reveal-text--in');
					io.unobserve(el);
				}
			}
		}, 400);

		return () => {
			io.disconnect();
			clearTimeout(t);
		};
	});
</script>

<div class="flex flex-col align-middle justify-center bg-accent-mint-foreground/40 pb-32">
	{#if entry}
		{@const Content = entry.Component}
		{@const hero = entry.metadata.hero as string | undefined}

		<!-- FULL WIDTH HERO -->
		<div class="flex flex-col min-w-full items-center justify-center mx-auto my-auto">
			<div
				class="mx-auto w-full bg-accent-mint bg-[url('/content-assets/bgtexture.png')] bg-blend-multiply"
			>
			{#if hero}
				<img
				src={hero}
				alt=""
				class="max-h-3xl justify-center mx-auto py-8 px-2 object-cover mix-blend-luminosity brightness-75"
				/>
			{:else}
			<img
			src={hero}
			alt=""
			class="max-h-3xl justify-center mx-auto py-8 px-2 object-cover mix-blend-luminosity brightness-75"
			/>
			{/if}
				<h1 class="text-center text-4xl md:text-6xl leading-tight text-accent-mint-foreground w-full pb-16">
					{entry.title}
				</h1>
			</div>
		</div>

	<div class="flex flex-col gap-2 justify-center mx-auto w-full">
	</div>
	<div class="relative mx-auto flex w-full flex-col justify-center md:flex-row">
		<aside class="sticky top-0 z-50 w-full md:top-20 md:z-10 md:w-md md:pl-4">
			<TableOfContents 
			article={articleEl} key={data.slug} />
		</aside>
	
		<article
			bind:this={articleEl}
			class="markdown-body mx-auto md:w-5xl px-8"
		>
			<div class="markdown-body prose-body">
				<Content />
			</div>
		</article>
	</div>
	{/if}
</div>


<style>
	.markdown-body :global(h1) {
		font-size: 2.125rem;
		font-weight: 400;
		margin-bottom: 1rem;
	}
	.markdown-body :global(h2) {
		border-top: 1.5px solid var(--color-primary);
		border-bottom: 1.5px solid var(--color-primary);
		font-size: 1.15rem;
		font-weight: 500;
		text-transform: uppercase;
		padding-top: 1rem;
		padding-bottom: 1rem;
		margin-top: 1.5rem;
		margin-bottom: 2.25rem; 
	}

	.markdown-body :global(h3) {
		font-size: 1.25rem;
		font-weight: 700;
		text-transform: uppercase;
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
	}

	.markdown-body :global(p) {
		margin-bottom: 1.25rem;
		line-height: 1.6;
		font-size: 1.125rem;
		text-wrap: balance;
	}
	.markdown-body :global(ul) {
		list-style: disc;
		padding-left: 2.5rem;
		margin-bottom: 1.25rem;
	}
	.markdown-body :global(li) {
		margin-top: 0.25rem;
		margin-bottom: 0.525rem;
		line-height: 1.6;
		font-size: 1.125rem;
		color: var(--color-secondary-foreground)
	}
	.markdown-body :global(hr) {
		margin: 1.5rem 0;
		border-color: var(--border);
	}
	.markdown-body :global(a) {
		color: var(--primary);
		text-decoration: underline;
	}
	/* On md+ screens, constrain prose to a readable measure so charts and
	   figures (the `figure` children) read wider than the text. */
	@media (min-width: 768px) {
		.prose-body > :global(:is(h1, h2, h3, p, ul, ol, blockquote, hr, table)) {
			max-width: 44rem;
			margin-inline: auto;
		}
	}
	.markdown-body :global(.reveal-text) {
		opacity: 0;
		transform: translateY(8px);
		transition: opacity 600ms ease-out, transform 600ms ease-out;
		will-change: opacity, transform;
	}
	.markdown-body :global(.reveal-text--in) {
		opacity: 1;
		transform: translateY(0);
	}
	@media (prefers-reduced-motion: reduce) {
		.markdown-body :global(.reveal-text) {
			opacity: 1;
			transform: none;
			transition: none;
		}
	}
</style>

<script lang="ts">
import { ChevronDown } from "@lucide/svelte";

	type Item = { id: string; text: string; level: 2 | 3 };

	let {
		article,
		key
	}: {
		article: HTMLElement | null;
		key?: string;
	} = $props();

	let items = $state<Item[]>([]);
	let activeId = $state("");
	let mobileOpen = $state(false);

	function slugify(text: string): string {
		return (
			text
				.toLowerCase()
				.trim()
				.replace(/[^\w\s-]/g, "")
				.replace(/\s+/g, "-") || "heading"
		);
	}

	const activeText = $derived(
		items.find((item) => item.id === activeId)?.text ?? "On this page"
	);

	function closeMobileMenu() {
		mobileOpen = false;
	}

	$effect(() => {
		key;

		if (!article) return;

		const headings = Array.from(article.querySelectorAll("h2, h3")) as HTMLElement[];

		const seen = new Set<string>();
		for (const h of headings) {
			let id = h.id;
			if (!id) {
				const base = slugify(h.textContent ?? "");
				id = base;
				let n = 2;
				while (seen.has(id)) id = `${base}-${n++}`;
				h.id = id;
			}
			seen.add(id);
			h.style.scrollMarginTop = "5rem";
		}

		const nextItems: Item[] = headings.map((h) => ({
			id: h.id,
			text: h.textContent ?? "",
			level: h.tagName === "H3" ? 3 : 2
		}));

		items = nextItems;
		activeId = nextItems[0]?.id ?? "";

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeId = (entry.target as HTMLElement).id;
					}
				}
			},
			{ rootMargin: "0px 0px -75% 0px", threshold: 0 }
		);

		for (const h of headings) observer.observe(h);

		return () => observer.disconnect();
	});
</script>

{#if items.length > 0}
	<!-- Mobile sticky dropdown -->
	<nav class="toc-mobile font-mono text-accent-mint-foreground" aria-label="On this page">
		<button
			type="button"
			class="toc-mobile-trigger"
			aria-expanded={mobileOpen}
			onclick={() => (mobileOpen = !mobileOpen)}
		>
			<span>{activeText}</span>
			{#if mobileOpen}
			<ChevronDown class="toc-chevron.open" />{:else}
			<ChevronDown class="toc-chevron" />
{/if}
		</button>

		{#if mobileOpen}
			<ul class="toc-mobile-menu">
				{#each items as item (item.id)}
					<li class="level-{item.level}">
						<a
							href={`#${item.id}`}
							class:active={activeId === item.id}
							onclick={closeMobileMenu}
						>
							{item.text}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</nav>

	<!-- Desktop sticky TOC -->
	<nav class="toc font-mono text-accent-mint-foreground w-full md:w-xs" aria-label="On this page">
		<ul class="gap-6">
			{#each items as item (item.id)}
				<li class="level-{item.level} pl-1">
					<a href={`#${item.id}`} class:active={activeId === item.id}>
						{item.text}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}

<style>
	/* Mobile dropdown */
	.toc-mobile {
		position: sticky;
		z-index: 50;
		display: block;
		width: 100%;
		background: var(--color-accent-mint);
	}

	.toc-mobile-trigger {
		display: flex;
		width: 100%;
		min-height: 2.75rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0 1.5rem;
		font-size: .825rem;
		font-weight: 600;
		text-align: left;
		background: transparent;
		border: 0;
		color: inherit;
		cursor: pointer;
	}

.toc-chevron {
	width: 1.25rem;
	height: 1.25rem;
	flex-shrink: 0;
	transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
}

.toc-chevron.open {
	transform: rotate(180deg);
}

.toc-mobile-menu {
	list-style: none;
	margin: 0;
	padding: 0.5rem 1.5rem 1rem;
	background: var(--color-accent-mint);
	border-top: 1px solid rgba(255, 255, 255, 0.25);
	animation: toc-dropdown 220ms cubic-bezier(0.4, 0, 0.2, 1);
	transform-origin: top;
}

@keyframes toc-dropdown {
	from {
		opacity: 0;
		transform: translateY(-0.35rem) scaleY(0.96);
	}

	to {
		opacity: 1;
		transform: translateY(0) scaleY(1);
	}
}

	.toc-mobile-menu {
		list-style: none;
		margin: 0;
		padding: 0.5rem 1.5rem 1rem;
		background: var(--color-accent-mint);
		border-top: 1px solid rgba(255, 255, 255, 0.25);
	}

	.toc-mobile-menu li {
		margin: 0;
	}

	.toc-mobile-menu a {
		display: block;
		padding: 0.65rem 0;
		color: inherit;
		text-decoration: none;
		opacity: 0.72;
	}

	.toc-mobile-menu a.active {
		font-weight: 700;
		opacity: 1;
	}

	.toc-mobile-menu .level-3 a {
		padding-left: 1rem;
		font-size: 0.925rem;
	}

	/* Desktop sidebar TOC */
	.toc {
		display: none;
		position: sticky;
		top: 5rem;
		align-self: flex-start;
		font-size: .825rem;
		padding: 0 1rem .5rem .5rem;
		background-color: var(--color-accent-mint-background);
		color: var(--color-accent-mint-foreground);
		line-height: 1.25;
	}

	.toc ul {
		list-style-type: none;
		padding: 1rem 0 2rem .5rem;
		margin: 0;
		display: flex;
		flex-direction: column;
	}

	.toc a {
		color: inherit;
		text-decoration: none;
		font-weight: 400;
		opacity: 0.55;
		transition:
			opacity 0.15s,
			font-weight 0.15s;
		display: block;
	}

	.toc a:hover {
		opacity: 0.85;
	}

	.toc a.active {
		font-weight: 800;
		opacity: 1;
	}

	.toc .level-3 a {
		padding-left: 1rem;
	}

	@media (min-width: 768px) {
		.toc-mobile {
			display: none;
		}

		.toc {
			display: block;
		}
	}
</style>
<script lang="ts">
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

	function slugify(text: string): string {
		return (
			text
				.toLowerCase()
				.trim()
				.replace(/[^\w\s-]/g, "")
				.replace(/\s+/g, "-") || "heading"
		);
	}

	$effect(() => {
		// re-run when the entry changes
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
			// give anchored scroll some clearance below the sticky page header
			h.style.scrollMarginTop = "5rem";
		}

		items = headings.map((h) => ({
			id: h.id,
			text: h.textContent ?? "",
			level: h.tagName === "H3" ? 3 : 2
		}));
		activeId = items[0]?.id ?? "";

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
	<nav class="toc" aria-label="On this page">
		<ul>
			{#each items as item (item.id)}
				<li class="level-{item.level}">
					<a href={`#${item.id}`} class:active={activeId === item.id}>
						{item.text}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}

<style>
	.toc {
		position: sticky;
		top: 5rem;
		align-self: flex-start;
		padding: 0.5rem 0;
		font-size: 0.875rem;
		line-height: 1.45;
	}
	.toc ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
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
		font-weight: 500;
		opacity: 1;
	}
	.toc .level-3 a {
		padding-left: 1rem;
		font-size: 0.8125rem;
	}
</style>

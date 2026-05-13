import type { Component } from 'svelte';

type CompModule = { default: Component; metadata?: Record<string, unknown> };

const raws = import.meta.glob('/src/lib/content/**/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const comps = import.meta.glob('/src/lib/content/**/*.md', {
	eager: true
}) as Record<string, CompModule>;

const folderTitles: Record<string, string> = {
	casestudies: 'Case Studies',
	glossary: 'Glossary',
	markups: 'Markups',
	pxclips: 'PX Clips'
};

function humanize(slug: string): string {
	return (
		folderTitles[slug] ??
		slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
	);
}

function extractH1(raw: string, fallback: string): string {
	const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
	const match = body.match(/^#\s+(.+?)\s*$/m);
	return match ? match[1].trim() : fallback;
}

export type ContentEntry = {
	folder: string;
	slug: string;
	title: string;
	url: string;
	Component: Component;
	metadata: Record<string, unknown>;
	hasFrontmatter: boolean;
};

export type ContentSection = {
	folder: string;
	title: string;
	url: string;
	entries: ContentEntry[];
};

function parsePath(path: string): { folder: string; slug: string } | null {
	const m = path.match(/\/content\/([^/]+)\/([^/]+)\.md$/);
	if (!m) return null;
	return { folder: m[1], slug: m[2] };
}

const entries: ContentEntry[] = Object.entries(raws)
	.map(([path, raw]) => {
		const parsed = parsePath(path);
		if (!parsed) return null;
		const comp = comps[path];
		if (!comp) return null;
		const meta = comp.metadata ?? {};
		const hasFrontmatter = Object.keys(meta).length > 0;
		const title = (meta.title as string | undefined) ?? extractH1(raw, parsed.slug);
		return {
			folder: parsed.folder,
			slug: parsed.slug,
			title,
			url: `/pxreview/${parsed.folder}/${encodeURIComponent(parsed.slug)}`,
			Component: comp.default,
			metadata: meta,
			hasFrontmatter
		} satisfies ContentEntry;
	})
	.filter((x): x is ContentEntry => x !== null);

export const sections: ContentSection[] = (() => {
	const groups = new Map<string, ContentEntry[]>();
	for (const e of entries) {
		if (!groups.has(e.folder)) groups.set(e.folder, []);
		groups.get(e.folder)!.push(e);
	}
	return [...groups.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([folder, items]) => ({
			folder,
			title: humanize(folder),
			url: `/pxreview/${folder}`,
			entries: items.sort((a, b) => a.title.localeCompare(b.title))
		}));
})();

export function findEntry(folder: string, slug: string): ContentEntry | undefined {
	return entries.find((e) => e.folder === folder && e.slug === slug);
}

export function findSection(folder: string): ContentSection | undefined {
	return sections.find((s) => s.folder === folder);
}

export function getSectionTitle(folder: string): string {
	return humanize(folder);
}

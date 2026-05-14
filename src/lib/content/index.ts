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
	markups: 'Markups'
};

const folderDescriptions: Record<string, string> = {
	casestudies: 'In-depth looks at how specific programs map and act on patient experience.',
	glossary: 'Shared vocabulary for talking about patient experience with rigor.',
	markups: 'Annotated examples — what works, what to watch for, and why.'
};

// Controlled tag vocabularies, one set per top-level section.
// Tags outside this list are dropped at load time (logged in dev).
const allowedTags: Record<string, readonly string[]> = {
	casestudies: [
		'duchenne',
		'oncology',
		'car-t',
		'myasthenia-gravis',
		'rare-disease',
		'patient',
		'caregiver',
		'hcp',
		'unbranded',
		'branded',
		'early-engagement',
		'share-of-voice'
	],
	glossary: ['attention', 'decision-making', 'motivation', 'cognitive-bias', 'measurement', 'engagement'],
	markups: ['website', 'social-media', 'email', 'print', 'best-practice', 'anti-pattern']
};

function humanize(slug: string): string {
	return (
		folderTitles[slug] ??
		slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
	);
}

function getDescription(slug: string): string {
	return folderDescriptions[slug] ?? '';
}

function extractH1(raw: string, fallback: string): string {
	const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
	const match = body.match(/^#\s+(.+?)\s*$/m);
	return match ? match[1].trim() : fallback;
}

function normalizeTags(raw: unknown, folder: string, slug: string): string[] {
	if (raw == null) return [];
	if (!Array.isArray(raw)) {
		console.warn(`[content] ${folder}/${slug}: tags must be an array, got ${typeof raw}`);
		return [];
	}
	const allowed = new Set(allowedTags[folder] ?? []);
	const seen = new Set<string>();
	const out: string[] = [];
	for (const t of raw) {
		const tag = String(t).toLowerCase().trim();
		if (!tag || seen.has(tag)) continue;
		seen.add(tag);
		if (allowed.size && !allowed.has(tag)) {
			console.warn(`[content] ${folder}/${slug}: unknown tag "${tag}" — not in vocabulary for ${folder}`);
			continue;
		}
		out.push(tag);
	}
	return out;
}

export type ContentEntry = {
	folder: string;
	subfolder: string;
	slug: string;
	title: string;
	summary: string;
	tags: string[];
	url: string;
	Component: Component;
	metadata: Record<string, unknown>;
	hasFrontmatter: boolean;
};

export type ContentSection = {
	folder: string;
	title: string;
	description: string;
	url: string;
	entries: ContentEntry[];
};

function parsePath(path: string): { folder: string; subfolder: string; slug: string } | null {
	const m = path.match(/\/content\/([^/]+)\/([^/]+)\/([^/]+)\.md$/);
	if (!m) return null;
	return { folder: m[1], subfolder: m[2], slug: m[3] };
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
		const summary = (meta.summary as string | undefined) ?? '';
		const tags = normalizeTags(meta.tags, parsed.folder, parsed.slug);
		return {
			folder: parsed.folder,
			subfolder: parsed.subfolder,
			slug: parsed.slug,
			title,
			summary,
			tags,
			url: `/pxreview/${parsed.folder}/${parsed.subfolder}/${encodeURIComponent(parsed.slug)}`,
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
			description: getDescription(folder),
			url: `/pxreview/${folder}`,
			entries: items.sort((a, b) => a.title.localeCompare(b.title))
		}));
})();

export function findEntry(folder: string, subfolder: string, slug: string): ContentEntry | undefined {
	return entries.find((e) => e.folder === folder && e.subfolder === subfolder && e.slug === slug);
}

export function findSection(folder: string): ContentSection | undefined {
	return sections.find((s) => s.folder === folder);
}

export function getSectionTitle(folder: string): string {
	return humanize(folder);
}

export function getAllowedTags(folder: string): readonly string[] {
	return allowedTags[folder] ?? [];
}

export function getSectionTags(folder: string): string[] {
	const section = findSection(folder);
	if (!section) return [];
	return [...new Set(section.entries.flatMap((e) => e.tags))].sort();
}

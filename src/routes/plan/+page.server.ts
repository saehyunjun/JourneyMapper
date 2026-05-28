import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
import { error } from '@sveltejs/kit';

export const prerender = false;

const DOCS = [
	{ id: 'workbench', file: 'WORKBENCH_PLAN.md', label: 'Workbench plan' },
	{ id: 'backlog', file: 'feature_backlog.md', label: 'Feature backlog' }
] as const;

export async function load() {
	marked.setOptions({ gfm: true, breaks: false });

	const docs: Record<string, { label: string; html: string }> = {};
	for (const d of DOCS) {
		const filePath = path.join(process.cwd(), d.file);
		let raw: string;
		try {
			raw = await fs.readFile(filePath, 'utf-8');
		} catch {
			throw error(404, `${d.file} not found at ${filePath}`);
		}
		docs[d.id] = { label: d.label, html: await marked.parse(raw) };
	}

	return { docs };
}

/**
 * server/protocols.ts
 *
 * Server-only loader for protocol bundles. Each protocol lives in its own
 * directory under src/lib/content/protocols/<protocol_id>/ — adding a new
 * protocol is a single-folder edit, no restart required in dev.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
	LoadedProtocol,
	ProtocolMeta,
	Schedule,
	FootnoteMap
} from '$lib/content/protocols/types';
import type { FrictionRule, FrictionRulesFile } from '$lib/content/protocols/friction-types';

const PROTOCOLS_DIR = resolve(process.cwd(), 'src/lib/content/protocols');

function readProtocol(id: string): LoadedProtocol | null {
	const dir = resolve(PROTOCOLS_DIR, id);
	const metaPath = resolve(dir, 'protocol.json');
	const schedulePath = resolve(dir, 'schedule.json');
	const footnotesPath = resolve(dir, 'footnotes.json');
	const rulesPath = resolve(dir, 'friction_rules.json');
	if (!existsSync(metaPath) || !existsSync(schedulePath)) return null;
	const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as ProtocolMeta;
	const schedule = JSON.parse(readFileSync(schedulePath, 'utf8')) as Schedule;
	const footnotes: FootnoteMap = existsSync(footnotesPath)
		? (JSON.parse(readFileSync(footnotesPath, 'utf8')) as FootnoteMap)
		: {};
	let rules: FrictionRule[] = [];
	if (existsSync(rulesPath)) {
		const raw = JSON.parse(readFileSync(rulesPath, 'utf8')) as FrictionRulesFile;
		rules = raw.rules ?? [];
	}
	return { meta, schedule, footnotes, rules };
}

export function listProtocols(): ProtocolMeta[] {
	if (!existsSync(PROTOCOLS_DIR)) return [];
	return readdirSync(PROTOCOLS_DIR)
		.filter((name) => {
			const full = resolve(PROTOCOLS_DIR, name);
			return statSync(full).isDirectory() && existsSync(resolve(full, 'protocol.json'));
		})
		.map((id) => JSON.parse(readFileSync(resolve(PROTOCOLS_DIR, id, 'protocol.json'), 'utf8')) as ProtocolMeta)
		.sort((a, b) => a.id.localeCompare(b.id));
}

export function loadProtocol(id: string): LoadedProtocol | null {
	return readProtocol(id);
}

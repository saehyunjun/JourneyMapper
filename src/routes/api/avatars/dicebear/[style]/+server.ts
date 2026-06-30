import { error, type RequestHandler } from '@sveltejs/kit';

const DICEBEAR_API_BASE = 'https://api.dicebear.com/10.x';
const STYLES = new Set(['micah', 'glass']);

function hashString(input: string): number {
	let h = 2166136261;
	for (let i = 0; i < input.length; i += 1) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function pick<T>(arr: T[], n: number): T {
	return arr[n % arr.length];
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function colorsFromQuery(url: URL, fallback: string[]): string[] {
	const raw = url.searchParams.get('backgroundColor');
	if (!raw) return fallback;
	const colors = raw
		.split(',')
		.map((c) => c.trim().replace(/^#/, ''))
		.filter((c) => /^[a-fA-F0-9]{6}$/.test(c))
		.map((c) => `#${c}`);
	return colors.length ? colors : fallback;
}

function fallbackMicah(seed: string, url: URL): string {
	const h = hashString(seed);
	const bg = pick(colorsFromQuery(url, ['#f8fafc', '#f1f5f9', '#e7e5e4']), h);
	const skin = pick(['#f1eeeb', '#e5dfd9', '#d6cdc5', '#c8beb6'], h >>> 3);
	const hair = pick(['#1f2937', '#334155', '#44403c', '#57534e'], h >>> 6);
	const shirt = pick(['#475569', '#64748b', '#78716c', '#71717a'], h >>> 9);
	const mouthY = 93 + (h % 5);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="${escapeXml(seed)} avatar">
<rect width="128" height="128" rx="64" fill="${bg}"/>
<path d="M25 128c5-30 25-45 39-45s34 15 39 45H25z" fill="${shirt}"/>
<circle cx="64" cy="61" r="29" fill="${skin}"/>
<path d="M35 59c0-25 16-39 35-39 13 0 24 6 31 17-24-4-42 3-57 20-3 3-6 4-9 2z" fill="${hair}"/>
<circle cx="53" cy="66" r="3" fill="#1f2937"/>
<circle cx="76" cy="66" r="3" fill="#1f2937"/>
<path d="M56 ${mouthY}c6 5 14 5 20 0" fill="none" stroke="#1f2937" stroke-width="4" stroke-linecap="round"/>
</svg>`;
}

function fallbackGlass(seed: string): string {
	const h = hashString(seed);
	const c1 = pick(['#f8fafc', '#f1f5f9', '#e7e5e4', '#e5e7eb'], h);
	const c2 = pick(['#cbd5e1', '#d6d3d1', '#a8a29e', '#94a3b8'], h >>> 5);
	const c3 = pick(['#64748b', '#78716c', '#71717a', '#475569'], h >>> 10);
	const x = 34 + (h % 20);
	const y = 32 + ((h >>> 4) % 26);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="${escapeXml(seed)} avatar">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${c1}"/><stop offset="55%" stop-color="${c2}"/><stop offset="100%" stop-color="${c3}"/>
</linearGradient>
<filter id="blur"><feGaussianBlur stdDeviation="8"/></filter>
</defs>
<rect width="128" height="128" rx="64" fill="url(#g)"/>
<circle cx="${x}" cy="${y}" r="34" fill="#fff" opacity=".32" filter="url(#blur)"/>
<circle cx="86" cy="84" r="36" fill="#fff" opacity=".18" filter="url(#blur)"/>
<path d="M28 93c18-27 48-36 75-42" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" opacity=".26"/>
<circle cx="64" cy="64" r="46" fill="#fff" opacity=".12" stroke="#fff" stroke-opacity=".35"/>
</svg>`;
}

function fallbackSvg(style: string, url: URL): string {
	const seed = url.searchParams.get('seed') ?? `${style}:avatar`;
	return style === 'micah' ? fallbackMicah(seed, url) : fallbackGlass(seed);
}

export const GET: RequestHandler = async ({ params, url }) => {
	const style = params.style ?? '';
	if (!STYLES.has(style)) throw error(404, 'Unknown avatar style.');

	// Preserve comma-separated array options exactly. DiceBear's validator
	// rejects encoded commas (`%2C`) for options like `backgroundColor`.
	const upstream = `${DICEBEAR_API_BASE}/${style}/svg${url.search}`;

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 4000);
		const res = await globalThis.fetch(upstream, {
			signal: controller.signal,
			headers: { accept: 'image/svg+xml' }
		});
		clearTimeout(timeout);
		if (res.ok) {
			return new Response(await res.text(), {
				headers: {
					'content-type': 'image/svg+xml; charset=utf-8',
					'cache-control': 'public, max-age=604800, immutable'
				}
			});
		}
	} catch {
		// Use the local deterministic placeholder below when DiceBear is
		// unreachable from this runtime.
	}

	return new Response(fallbackSvg(style, url), {
		headers: {
			'content-type': 'image/svg+xml; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
};

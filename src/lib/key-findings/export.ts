/**
 * Key Findings — image export.
 *
 * PNG (per-card or full-board) via html-to-image, and animated GIF via repeated
 * rasterisation encoded with gifenc. Everything is dynamically imported so the
 * libraries never run during SSR. Frame delays are measured from the wall clock
 * so the GIF plays back at roughly the real animation speed despite slow
 * per-frame capture.
 */

function triggerDownload(url: string, filename: string) {
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
}

/** Rasterise a node to a high-resolution PNG and download it. */
export async function exportPng(node: HTMLElement, filename: string) {
	const { toPng } = await import('html-to-image');
	const url = await toPng(node, {
		pixelRatio: 2,
		cacheBust: true,
		backgroundColor: '#ffffff'
	});
	triggerDownload(url, filename.endsWith('.png') ? filename : `${filename}.png`);
}

export type GifOptions = {
	/** Total capture window in ms (animations should finish within it). */
	durationMs?: number;
	/** Called once just before capture starts — use it to (re)start animations. */
	onStart?: () => void;
	/** Hard cap on captured frames to keep file size reasonable. */
	maxFrames?: number;
};

/**
 * Capture a node over `durationMs` and encode the frames as a GIF. Capture is
 * slower than real time, so frames are sparse but each carries its true elapsed
 * delay — the resulting GIF runs for about `durationMs`.
 */
export async function exportGif(node: HTMLElement, filename: string, opts: GifOptions = {}) {
	const { durationMs = 2200, onStart, maxFrames = 36 } = opts;
	const [{ toCanvas }, { GIFEncoder, quantize, applyPalette }] = await Promise.all([
		import('html-to-image'),
		import('gifenc')
	]);

	const gif = GIFEncoder();
	onStart?.();
	// Give the restarted animation a beat to begin before the first capture.
	await new Promise((r) => requestAnimationFrame(() => r(null)));

	const start = performance.now();
	let last = start;
	let frames = 0;

	while (performance.now() - start < durationMs && frames < maxFrames) {
		const canvas = await toCanvas(node, { backgroundColor: '#ffffff', pixelRatio: 1 });
		const ctx = canvas.getContext('2d');
		if (!ctx) break;
		const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const palette = quantize(data, 256);
		const index = applyPalette(data, palette);

		const now = performance.now();
		const delay = Math.min(500, Math.max(40, Math.round(now - last)));
		last = now;
		gif.writeFrame(index, width, height, { palette, delay });
		frames += 1;
	}

	gif.finish();
	const blob = new Blob([gif.bytes() as unknown as BlobPart], { type: 'image/gif' });
	const url = URL.createObjectURL(blob);
	triggerDownload(url, filename.endsWith('.gif') ? filename : `${filename}.gif`);
	setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** A filesystem-safe slug for a card/board title. */
export function slug(title: string, fallback = 'key-finding'): string {
	const s = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	return s || fallback;
}

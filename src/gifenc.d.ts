/** Minimal ambient types for gifenc (no bundled declarations). */
declare module 'gifenc' {
	export interface GifFrameOptions {
		palette?: number[][] | null;
		delay?: number;
		repeat?: number;
		transparent?: boolean;
		transparentIndex?: number;
		dispose?: number;
	}
	export interface GifEncoder {
		writeFrame(index: Uint8Array | number[], width: number, height: number, opts?: GifFrameOptions): void;
		finish(): void;
		bytes(): Uint8Array;
		bytesView(): Uint8Array;
		reset(): void;
	}
	export function GIFEncoder(opts?: Record<string, unknown>): GifEncoder;
	export function quantize(
		rgba: Uint8Array | Uint8ClampedArray,
		maxColors: number,
		opts?: Record<string, unknown>
	): number[][];
	export function applyPalette(
		rgba: Uint8Array | Uint8ClampedArray,
		palette: number[][],
		format?: string
	): Uint8Array;
}

/**
 * Ambient types for `d3-cloud`, which ships no `@types` package.
 * Covers the surface used by WordCloud.svelte; extend as needed.
 */
declare module 'd3-cloud' {
	export interface Word {
		text?: string;
		font?: string;
		style?: string;
		weight?: string | number;
		rotate?: number;
		size?: number;
		padding?: number;
		x?: number;
		y?: number;
	}

	export interface Cloud<T extends Word> {
		start(): Cloud<T>;
		stop(): Cloud<T>;
		timeInterval(interval: number): Cloud<T>;
		words(): T[];
		words(words: T[]): Cloud<T>;
		size(): [number, number];
		size(size: [number, number]): Cloud<T>;
		font(font: string | ((d: T, i: number) => string)): Cloud<T>;
		fontStyle(style: string | ((d: T, i: number) => string)): Cloud<T>;
		fontWeight(weight: string | number | ((d: T, i: number) => string | number)): Cloud<T>;
		fontSize(size: number | ((d: T, i: number) => number)): Cloud<T>;
		rotate(rotate: number | ((d: T, i: number) => number)): Cloud<T>;
		text(text: string | ((d: T, i: number) => string)): Cloud<T>;
		spiral(
			spiral:
				| 'archimedean'
				| 'rectangular'
				| ((size: [number, number]) => (t: number) => [number, number])
		): Cloud<T>;
		padding(padding: number | ((d: T, i: number) => number)): Cloud<T>;
		random(random: () => number): Cloud<T>;
		canvas(canvas: () => HTMLCanvasElement): Cloud<T>;
		on(type: 'word', listener: (word: T) => void): Cloud<T>;
		on(type: 'end', listener: (words: T[], bounds: { x: number; y: number }[]) => void): Cloud<T>;
	}

	export default function cloud<T extends Word = Word>(): Cloud<T>;
}

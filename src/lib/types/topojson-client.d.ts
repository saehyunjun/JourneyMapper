/**
 * Ambient types for `topojson-client`. Only the `feature()` function is used in
 * this project (clinical-trials map). Extend as needed.
 */
declare module 'topojson-client' {
	import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson';

	export interface Topology {
		type: 'Topology';
		objects: Record<string, unknown>;
		arcs: number[][][];
		transform?: { scale: [number, number]; translate: [number, number] };
		bbox?: number[];
	}

	export function feature<P = GeoJsonProperties>(
		topology: Topology,
		object: unknown
	): Feature<Geometry, P> | FeatureCollection<Geometry, P>;
}

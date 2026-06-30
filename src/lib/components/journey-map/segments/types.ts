/**
 * Segment primitives for the journey-map "explore" view (?view=explore).
 *
 * The explore view composes a quadrant-based map from a vocabulary of segment
 * shapes. Each shape is a small Svelte component that renders an SVG path
 * (or paths) between explicit anchor points. The compositor positions
 * waypoints over the top — segments draw the connective tissue, waypoints
 * carry the interaction.
 *
 * Segments are stateless renderers. Persona-route state — visited / current /
 * status — comes in as props.
 */

export type Point = { x: number; y: number };

/** Map zone — one of four quadrants on the explore canvas. */
export type MapZone = 'home' | 'diagnosis' | 'treatment' | 'research';

/** Per-stage runtime status — drives stroke style and waypoint badge. */
export type StageStatus =
	| 'completed'
	| 'current'
	| 'delayed'
	| 'decision'
	| 'dead_end'
	| 'dropoff'
	| 'unvisited';

/**
 * A segment in a persona's explore layout. The compositor resolves stage_id
 * anchors to {x, y} points before passing to the segment component.
 *
 * `kind` selects which segment primitive renders the connective path; the
 * extra fields per kind carry shape-specific authoring (curvature, fork
 * destinations, dead-end terminus, etc.).
 */
export type SegmentSpec =
	| {
			kind: 'straight';
			from: string;
			to: string;
			/** Optional bend, -1..1; 0 = straight line, +ve = bulges right of direction. */
			curvature?: number;
			status?: StageStatus;
	  }
	| {
			kind: 'fork';
			from: string;
			/** Branches end at these stages OR at virtual termini (objects with x,y). */
			branches: Array<string | Point>;
			status?: StageStatus;
	  }
	| {
			kind: 'roundabout';
			at: string;
			/** Radius in viewBox units. */
			radius: number;
			/** Optional next stage the route exits to. If absent, route ends at the loop. */
			exitTo?: string;
			status?: StageStatus;
	  }
	| {
			kind: 'dead_end';
			from: string;
			/** Distance the dead-end stub extends past `from`, in viewBox units. */
			length?: number;
			/** Direction (degrees, 0 = right, 90 = down). Defaults to 0. */
			angle?: number;
			status?: StageStatus;
	  };

/**
 * Per-persona explore layout. Keyed by persona_id in explore-layouts.ts.
 * If a persona has no layout, the compositor falls back to a straight chain.
 */
export type ExploreLayout = {
	/** Stage positions in viewBox coords. Stage IDs that appear in segments
	 *  but aren't here are dropped from rendering. */
	stagePositions: Record<string, Point>;
	/** Stage → zone assignment. Drives zone-tinted background. */
	stageZones: Record<string, MapZone>;
	/** Ordered list of segments connecting the stages. */
	segments: SegmentSpec[];
};

/** Zone geometry on the canvas. The four quadrants are fixed; only their
 *  labels and tints vary. */
export type ZoneRect = {
	id: MapZone;
	label: string;
	x: number;
	y: number;
	width: number;
	height: number;
	tint: string;
};

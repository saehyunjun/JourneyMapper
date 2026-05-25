/*
	Shared motion for right-side drawers (RightDrawer, TertiaryDrawer, and any
	future variants). One source of truth so every drawer in the app opens and
	closes with the same refined cadence — slower, decelerating entrance;
	quicker, accelerating exit.

	Why split in/out:
	- Asymmetric drawers feel more deliberate than symmetric ones. The user
	  needs time to register the content arriving (slow in) but doesn't need
	  to watch it leave (fast out).
	- expoOut (matches --ease-smooth in app.css) on entry gives a confident
	  but unhurried settle. cubicIn on exit pulls the panel away with a hint
	  of momentum.

	Consumers import the preset they need and spread it into Svelte's `in:`
	or `out:` transition directive. Don't tweak per-component — adjust here so
	every drawer stays in sync.
*/

import { expoOut, cubicIn, cubicOut } from 'svelte/easing';

/** Distance (px) the panel travels in/out from its anchored side. */
export const DRAWER_TRAVEL_PX = 80;

/** Right-side panel entrance: slow, decelerating settle from off-screen right. */
export const DRAWER_PANEL_IN = {
	x: DRAWER_TRAVEL_PX,
	duration: 380,
	easing: expoOut
} as const;

/** Right-side panel exit: quicker, accelerating pull-off. */
export const DRAWER_PANEL_OUT = {
	x: DRAWER_TRAVEL_PX,
	duration: 240,
	easing: cubicIn
} as const;

/** Backdrop fade-in — lands a beat before the panel does. */
export const DRAWER_BACKDROP_IN = {
	duration: 240,
	easing: cubicOut
} as const;

/** Backdrop fade-out — leaves a beat after the panel starts moving away. */
export const DRAWER_BACKDROP_OUT = {
	duration: 200,
	easing: cubicIn
} as const;

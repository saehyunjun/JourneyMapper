/**
 * Server-side request timing.
 *
 * Wraps every SvelteKit request, measures the full SSR resolve (load +
 * render), and logs a one-line summary. In dev this surfaces slow loaders
 * immediately in the terminal; in prod it lands in the Vercel function logs.
 *
 * Requests with no route id (static assets, dev HMR transport, `/_app/*`)
 * are skipped to keep the output relevant.
 */
import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';

const SLOW_MS = 500;
const VERY_SLOW_MS = 2000;

export const handle: Handle = async ({ event, resolve }) => {
	const routeId = event.route.id;
	if (!routeId) return resolve(event);

	const t0 = performance.now();
	const response = await resolve(event);
	const ms = Math.round(performance.now() - t0);

	const tag = ms >= VERY_SLOW_MS ? 'SSR ⚠⚠' : ms >= SLOW_MS ? 'SSR ⚠ ' : 'SSR   ';
	const env = dev ? 'dev' : 'prod';
	// eslint-disable-next-line no-console
	console.log(`${tag} ${ms.toString().padStart(5)}ms ${response.status} ${event.request.method} ${routeId} [${env}]`);

	return response;
};

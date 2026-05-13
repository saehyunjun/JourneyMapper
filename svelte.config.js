import adapter from '@sveltejs/adapter-auto';
import { mdsvex } from 'mdsvex';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md'],
	preprocess: [
		mdsvex({
			extensions: ['.md'],
			layout: {
				_: join(__dirname, 'src/lib/content/mdsvex-layout.svelte')
			}
		})
	],
	kit: {
		adapter: adapter()
	}
};

export default config;

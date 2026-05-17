import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// The transcript-upload server action writes these data files into the
		// source tree. They are imported by wctglpdemo-data/analysis.ts, so a
		// write would otherwise make Vite broadcast a full-reload to every
		// client — including the upload page itself, discarding the form
		// result before the review view can render. Ignore them in the dev
		// watcher; the analysis pages just need a manual refresh to pick up
		// new uploads.
		watch: {
			ignored: [
				'**/wctglpdemo-data/interviews_structured.json',
				'**/wctglpdemo-data/segments.json',
				'**/wctglpdemo-data/question_map.json',
				'**/wctglpdemo-data/segment_tags.json',
				'**/wctglpdemo-data/highlights.json',
				'**/wctglpdemo-data/uploads/**'
			]
		}
	}
});

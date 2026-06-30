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
				'**/wctglpdemo-data/quote_reviews.json',
				'**/wctglpdemo-data/uploads/**',
				// 260 MB of raw + normalized ClinicalTrials.gov payloads and 12 MB
				// of corpus fragment/annotation/artifact files. Any edit
				// (typically scripted regenerations from the propose-* / autotag
				// / fetch-clinicaltrials pipelines) otherwise flushes the full
				// SSR module graph and stalls dev for tens of seconds. Manifests
				// and small configs at the corpus root are still watched so
				// hand-edits hot-reload normally; pages re-read the bulk files
				// on demand, so a manual refresh after a pipeline run is fine.
				'**/corpora/*/fragments/**',
				'**/corpora/*/annotations/**',
				'**/corpora/*/keyword_tags/**',
				'**/corpora/*/artifacts/**',
				'**/disease-insights/**/clinical_trials/raw_studies.json',
				'**/disease-insights/**/clinical_trials/studies_normalized.json',
				// Claude Code writes tool-permission decisions into this file
				// during a session. Watching it triggers a full SSR module-graph
				// flush mid-request, which can stretch the next page response
				// from milliseconds into tens of seconds.
				'**/.claude/**'
			]
		}
	}
});

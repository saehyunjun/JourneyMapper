/**
 * Corpus autotag jobs — run the AI tagging pipeline (themes, sentiment,
 * stages) for fragments freshly added to a corpus via the UI.
 *
 * Dev-only: spawns the standalone propose-fragment-*.mjs scripts as
 * background processes. The scripts self-target only batches whose
 * fragments lack a themes_generator / sentiment_generator marker, so
 * re-running over a corpus that already has tags only processes the new
 * fragments. Job state lives in an in-process map keyed by corpus id; the
 * upload page reads it via /patientlyiq/upload's load() to render a status
 * banner.
 *
 * Prod is not supported (the parallel inline TS pipeline for fragment
 * proposers doesn't exist yet, and `addToCorpus` itself is dev-only). A
 * future port to inline TS would mirror the autotag-pipeline.ts shape used
 * by the interview side.
 *
 * Requires ANTHROPIC_API_KEY (the scripts auto-load .env).
 */
import { spawn } from 'node:child_process';
import { dev } from '$app/environment';

export type CorpusAutotagState = 'running' | 'done' | 'error';

export type CorpusAutotagJob = {
	corpusId: string;
	state: CorpusAutotagState;
	step: string;
	error?: string;
	startedAt: number;
	finishedAt?: number;
};

// One job per corpus at a time. Restarting while a job is running is a no-op
// (the existing job is returned); the analyst should wait for the current
// chain to finish before kicking off another.
const jobs = new Map<string, CorpusAutotagJob>();

const STEPS: { script: string; label: string }[] = [
	{ script: 'scripts/propose-fragment-themes.mjs', label: 'Proposing themes' },
	{ script: 'scripts/propose-fragment-sentiment.mjs', label: 'Proposing sentiment + emotions' },
	{ script: 'scripts/propose-fragment-stages.mjs', label: 'Proposing journey stages' }
];

function runScript(script: string, args: string[]): Promise<void> {
	return new Promise((res, rej) => {
		const child = spawn(process.execPath, [script, ...args], {
			cwd: process.cwd(),
			env: process.env
		});
		let stderr = '';
		child.stderr?.on('data', (d) => {
			stderr += String(d);
		});
		child.on('error', (err) => {
			rej(new Error(`failed to spawn ${script}: ${err.message}`));
		});
		child.on('close', (code) => {
			if (code === 0) return res();
			const lines = stderr
				.split('\n')
				.map((s) => s.trimEnd())
				.filter(Boolean);
			const tail = lines.slice(-10).join('\n');
			const prefix = `${script} exited with code ${code}`;
			rej(new Error(tail ? `${prefix}\n${tail}` : `${prefix} (no stderr output).`));
		});
	});
}

function withStepContext(label: string, err: unknown): string {
	if (err instanceof Error && err.message) return `[${label}] ${err.message}`;
	if (typeof err === 'string' && err) return `[${label}] ${err}`;
	return `[${label}] Autotagging failed.`;
}

async function runChain(job: CorpusAutotagJob): Promise<void> {
	for (const step of STEPS) {
		job.step = step.label;
		jobs.set(job.corpusId, { ...job });
		try {
			await runScript(step.script, [job.corpusId]);
		} catch (e) {
			job.state = 'error';
			job.error = withStepContext(step.label, e);
			job.finishedAt = Date.now();
			jobs.set(job.corpusId, { ...job });
			return;
		}
	}
	job.state = 'done';
	job.step = 'Done';
	job.finishedAt = Date.now();
	jobs.set(job.corpusId, { ...job });
}

/**
 * Start (or restart) corpus autotagging. Returns the running job
 * immediately. If a job is already in flight for this corpus, the existing
 * job is returned without restarting — the analyst should wait. Fire-and-
 * forget; Node's event loop keeps the dev server alive.
 */
export function startCorpusAutotag(corpusId: string): {
	job: CorpusAutotagJob;
	started: boolean;
} {
	if (!dev) {
		throw new Error(
			'Corpus autotagging is dev-only — the prod path has no inlined TS pipeline yet.'
		);
	}
	const existing = jobs.get(corpusId);
	if (existing && existing.state === 'running') {
		return { job: existing, started: false };
	}
	const job: CorpusAutotagJob = {
		corpusId,
		state: 'running',
		step: 'Starting…',
		startedAt: Date.now()
	};
	jobs.set(corpusId, job);
	void runChain(job).catch(() => {});
	return { job, started: true };
}

export function getCorpusAutotagJob(corpusId: string): CorpusAutotagJob | null {
	return jobs.get(corpusId) ?? null;
}

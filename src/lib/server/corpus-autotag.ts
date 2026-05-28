/**
 * Corpus autotag jobs — themes / sentiment / stages over a corpus's
 * fragments.
 *
 * Two execution paths, mirroring the interview-side autotag.ts:
 *  - Dev: spawn the standalone propose-fragment-*.mjs scripts as background
 *    processes. Job state lives in an in-process map; the upload page polls
 *    /patientlyiq/autotag-corpus until done.
 *  - Prod: call the inlined TypeScript pipeline directly (no child processes
 *    — Vercel serverless can't spawn). Job state lives in Redis so different
 *    function instances handling start / poll requests see the same state.
 *
 * Requires ANTHROPIC_API_KEY. In prod the API key comes from the Vercel
 * project environment; REDIS_URL must also be set so job state persists
 * across function instances.
 */
import { spawn } from 'node:child_process';
import { dev } from '$app/environment';
import { createClient, type RedisClientType } from 'redis';
import { env } from '$env/dynamic/private';
import { runCorpusAutotagChain } from './corpus-autotag-pipeline';

export type CorpusAutotagState = 'running' | 'done' | 'error';

export type CorpusAutotagJob = {
	corpusId: string;
	state: CorpusAutotagState;
	step: string;
	error?: string;
	startedAt: number;
	finishedAt?: number;
};

// --- Job-state persistence ------------------------------------------------

const devJobs = new Map<string, CorpusAutotagJob>();

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;

async function kv(): Promise<RedisClientType | null> {
	const url = env.REDIS_URL;
	if (!url) return null;
	if (client?.isOpen) return client;
	if (connecting) return connecting;
	const c = createClient({ url }) as RedisClientType;
	c.on('error', (err) => console.error('[corpus-autotag:redis] client error:', err));
	connecting = c
		.connect()
		.then(() => {
			client = c;
			return c;
		})
		.catch((err) => {
			connecting = null;
			console.error('[corpus-autotag:redis] connect failed:', err);
			throw err;
		});
	return connecting;
}

const jobKey = (corpusId: string) => `corpus:autotag:job:${corpusId}`;

async function loadJob(corpusId: string): Promise<CorpusAutotagJob | null> {
	if (dev) return devJobs.get(corpusId) ?? null;
	let r: RedisClientType | null;
	try {
		r = await kv();
	} catch {
		return null;
	}
	if (!r) return null;
	try {
		const raw = await r.get(jobKey(corpusId));
		return raw ? (JSON.parse(raw) as CorpusAutotagJob) : null;
	} catch (e) {
		console.error('[corpus-autotag] job read failed:', e);
		return null;
	}
}

async function saveJob(job: CorpusAutotagJob): Promise<void> {
	if (dev) {
		devJobs.set(job.corpusId, { ...job });
		return;
	}
	let r: RedisClientType | null;
	try {
		r = await kv();
	} catch {
		return;
	}
	if (!r) return; // Without Redis the page-load fallback shows no progress.
	try {
		// Keep finished jobs for a day so a late page-load still sees the result.
		await r.set(jobKey(job.corpusId), JSON.stringify(job), { EX: 60 * 60 * 24 });
	} catch (e) {
		console.error('[corpus-autotag] job write failed:', e);
	}
}

// --- Dev: spawn the .mjs chain --------------------------------------------

const DEV_STEPS: { script: string; label: string }[] = [
	{ script: 'scripts/propose-fragment-themes.mjs', label: 'Proposing themes' },
	{
		script: 'scripts/propose-fragment-sentiment.mjs',
		label: 'Proposing sentiment + emotions'
	},
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

async function runDevChain(job: CorpusAutotagJob): Promise<void> {
	for (const step of DEV_STEPS) {
		job.step = step.label;
		await saveJob(job);
		try {
			await runScript(step.script, [job.corpusId]);
		} catch (e) {
			job.state = 'error';
			job.error = withStepContext(step.label, e);
			job.finishedAt = Date.now();
			await saveJob(job);
			return;
		}
	}
	job.state = 'done';
	job.step = 'Done';
	job.finishedAt = Date.now();
	await saveJob(job);
}

// --- Prod: inline TS chain via corpus-autotag-pipeline --------------------

async function runProdChain(job: CorpusAutotagJob): Promise<void> {
	try {
		await runCorpusAutotagChain(job.corpusId, async (label) => {
			job.step = label;
			await saveJob(job);
		});
	} catch (e) {
		job.state = 'error';
		job.error = withStepContext(job.step, e);
		job.finishedAt = Date.now();
		await saveJob(job);
		return;
	}
	job.state = 'done';
	job.step = 'Done';
	job.finishedAt = Date.now();
	await saveJob(job);
}

/** Start (or restart) corpus autotagging.
 *
 * Returns the running job immediately, plus a `completion` promise the caller
 * can await — in prod the POST handler awaits it so the serverless function
 * instance stays alive until the chain finishes (matches the interview
 * upload flow). If a job is already running, the existing job is returned
 * and `completion` resolves immediately. */
export async function startCorpusAutotag(
	corpusId: string
): Promise<{ job: CorpusAutotagJob; started: boolean; completion: Promise<void> }> {
	const existing = await loadJob(corpusId);
	if (existing && existing.state === 'running') {
		return { job: existing, started: false, completion: Promise.resolve() };
	}
	const job: CorpusAutotagJob = {
		corpusId,
		state: 'running',
		step: 'Starting…',
		startedAt: Date.now()
	};
	await saveJob(job);
	const completion = dev ? runDevChain(job) : runProdChain(job);
	if (dev) {
		// Fire-and-forget in dev — Node's event loop keeps the dev server alive.
		void completion.catch(() => {});
	}
	return { job, started: true, completion };
}

export async function getCorpusAutotagJob(
	corpusId: string
): Promise<CorpusAutotagJob | null> {
	return loadJob(corpusId);
}

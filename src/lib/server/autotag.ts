/**
 * Autotag jobs — run the AI tagging pipeline for one freshly uploaded
 * interview.
 *
 * Two execution paths:
 *  - Dev: spawn the standalone .mjs scripts (propose-questions →
 *    propose-segment-tags → build-segment-tags) as background processes. Job
 *    state lives in-memory; the page polls until the chain finishes. This
 *    matches the historical workflow and keeps the CLI scripts as the source
 *    of truth.
 *  - Prod: call the inlined TypeScript pipeline directly (no child processes
 *    — Vercel serverless can't spawn). Job state lives in Upstash Redis so
 *    poll requests on other function instances can read progress.
 *
 * Requires ANTHROPIC_API_KEY. The .env autoload (`process.loadEnvFile`) the
 * scripts use is dev-only; in prod the variable comes from the Vercel project
 * environment.
 */
import { spawn } from 'node:child_process';
import { dev } from '$app/environment';
import { Redis } from '@upstash/redis';
import { env } from '$env/dynamic/private';
import {
	proposeQuestions,
	proposeSegmentTags,
	buildSegmentTags
} from './autotag-pipeline';

export type AutotagState = 'running' | 'done' | 'error';

export type AutotagJob = {
	interviewId: string;
	state: AutotagState;
	/** Human-readable current step, for the upload page's status banner. */
	step: string;
	error?: string;
	startedAt: number;
	finishedAt?: number;
};

// --- Job-state persistence ------------------------------------------------

// Dev uses an in-process map (matches the historical fire-and-forget pattern).
// Prod uses Upstash directly — different serverless function instances handle
// "start" and "poll" requests, so the state must be shared.
const devJobs = new Map<string, AutotagJob>();

let redis: Redis | null = null;
function kv(): Redis | null {
	if (redis) return redis;
	const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
	const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) return null;
	redis = new Redis({ url, token });
	return redis;
}

const jobKey = (interviewId: string) => `wctglpdemo:autotag:job:${interviewId}`;

async function loadJob(interviewId: string): Promise<AutotagJob | null> {
	if (dev) return devJobs.get(interviewId) ?? null;
	const r = kv();
	if (!r) return null;
	return (await r.get<AutotagJob>(jobKey(interviewId))) ?? null;
}

async function saveJob(job: AutotagJob): Promise<void> {
	if (dev) {
		devJobs.set(job.interviewId, job);
		return;
	}
	const r = kv();
	if (!r) return; // Without KV credentials we can't persist; reads will return null.
	// Keep finished jobs for a day so a late page-load still sees the result.
	await r.set(jobKey(job.interviewId), job, { ex: 60 * 60 * 24 });
}

// --- Pipeline execution ---------------------------------------------------

// The judgement pipeline, in order. propose-questions normalizes interviewer
// turns; propose-segment-tags is the AI tagging call; build-segment-tags
// validates the proposal into segment_tags.
const DEV_STEPS: { script: string; label: string; perInterview: boolean }[] = [
	{ script: 'scripts/propose-questions.mjs', label: 'Proposing question mapping', perInterview: true },
	{ script: 'scripts/propose-segment-tags.mjs', label: 'Proposing segment tags', perInterview: true },
	{ script: 'scripts/build-segment-tags.mjs', label: 'Validating tags', perInterview: false }
];

const PROD_STEPS: { label: string; run: (interviewId: string) => Promise<void> }[] = [
	{ label: 'Proposing question mapping', run: (id) => proposeQuestions(id) },
	{ label: 'Proposing segment tags', run: (id) => proposeSegmentTags(id) },
	{ label: 'Validating tags', run: async () => buildSegmentTags() }
];

/** Spawn one pipeline script; resolves on exit 0, rejects with its stderr. */
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
		child.on('error', rej);
		child.on('close', (code) => {
			if (code === 0) res();
			else {
				const tail = stderr.trim().split('\n').slice(-3).join(' ');
				rej(new Error(tail || `${script} exited with code ${code}`));
			}
		});
	});
}

async function runDevChain(job: AutotagJob): Promise<void> {
	try {
		for (const step of DEV_STEPS) {
			job.step = step.label;
			await saveJob(job);
			await runScript(step.script, step.perInterview ? [job.interviewId] : []);
		}
		job.state = 'done';
		job.step = 'Done';
	} catch (e) {
		job.state = 'error';
		job.error = e instanceof Error ? e.message : 'Autotagging failed.';
	}
	job.finishedAt = Date.now();
	await saveJob(job);
}

async function runProdChain(job: AutotagJob): Promise<void> {
	try {
		for (const step of PROD_STEPS) {
			job.step = step.label;
			await saveJob(job);
			await step.run(job.interviewId);
		}
		job.state = 'done';
		job.step = 'Done';
	} catch (e) {
		job.state = 'error';
		job.error = e instanceof Error ? e.message : 'Autotagging failed.';
	}
	job.finishedAt = Date.now();
	await saveJob(job);
}

/**
 * Start (or restart) autotagging for an interview. Returns the running job
 * immediately. In dev the chain runs in the background; in prod the caller
 * should await the returned promise (via the second return value) to keep
 * the serverless function alive until the chain completes — see the upload
 * action for the awaited pattern.
 */
export async function startAutotag(
	interviewId: string
): Promise<{ job: AutotagJob; completion: Promise<void> }> {
	const existing = await loadJob(interviewId);
	if (existing && existing.state === 'running') {
		// A run is already in flight; surface it without restarting.
		return { job: existing, completion: Promise.resolve() };
	}

	const job: AutotagJob = {
		interviewId,
		state: 'running',
		step: 'Starting…',
		startedAt: Date.now()
	};
	await saveJob(job);

	const completion = dev ? runDevChain(job) : runProdChain(job);
	if (dev) {
		// Fire-and-forget — Node's event loop keeps the dev server alive.
		void completion.catch(() => {});
	}
	return { job, completion };
}

/** The latest autotag job for an interview, or null if it was never run. */
export async function getJob(interviewId: string): Promise<AutotagJob | null> {
	return loadJob(interviewId);
}

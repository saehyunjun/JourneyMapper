/**
 * Autotag jobs — run the AI tagging pipeline for one freshly uploaded
 * interview, in the background.
 *
 * When a transcript is uploaded, the deterministic parse/segment steps run
 * synchronously in the upload action; this module then runs the *judgement*
 * steps — question normalization and segment tagging — by spawning the
 * existing pipeline scripts. Those make Claude API calls and take a while, so
 * each runs as a tracked background job the upload page polls.
 *
 * Job state is in-memory: this is a dev/demo tool, the scripts write into the
 * source tree, and a server restart simply drops job tracking (the files the
 * scripts produced are still there). Requires ANTHROPIC_API_KEY in the
 * environment (the scripts also self-load it from JourneyMapper/.env).
 */
import { spawn } from 'node:child_process';

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

// interview_id -> latest job. In-memory by design (see module note).
const jobs = new Map<string, AutotagJob>();

// The judgement pipeline, in order. propose-questions normalizes interviewer
// turns; propose-segment-tags is the AI tagging call; build-segment-tags
// validates the proposal into segment_tags.json.
const STEPS: { script: string; label: string; perInterview: boolean }[] = [
	{ script: 'scripts/propose-questions.mjs', label: 'Proposing question mapping', perInterview: true },
	{ script: 'scripts/propose-segment-tags.mjs', label: 'Proposing segment tags', perInterview: true },
	{ script: 'scripts/build-segment-tags.mjs', label: 'Validating tags', perInterview: false }
];

/** Spawn one pipeline script; resolves on exit 0, rejects with its stderr. */
function runScript(script: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [script, ...args], {
			cwd: process.cwd(),
			env: process.env
		});
		let stderr = '';
		child.stderr?.on('data', (d) => {
			stderr += String(d);
		});
		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) resolve();
			else {
				const tail = stderr.trim().split('\n').slice(-3).join(' ');
				reject(new Error(tail || `${script} exited with code ${code}`));
			}
		});
	});
}

async function runChain(job: AutotagJob): Promise<void> {
	try {
		for (const step of STEPS) {
			job.step = step.label;
			await runScript(step.script, step.perInterview ? [job.interviewId] : []);
		}
		job.state = 'done';
		job.step = 'Done';
	} catch (e) {
		job.state = 'error';
		job.error = e instanceof Error ? e.message : 'Autotagging failed.';
	}
	job.finishedAt = Date.now();
}

/**
 * Start (or restart) autotagging for an interview. Returns immediately with
 * the running job; the pipeline runs in the background. A no-op that returns
 * the existing job if one is already running for this interview.
 */
export function startAutotag(interviewId: string): AutotagJob {
	const existing = jobs.get(interviewId);
	if (existing && existing.state === 'running') return existing;

	const job: AutotagJob = {
		interviewId,
		state: 'running',
		step: 'Starting…',
		startedAt: Date.now()
	};
	jobs.set(interviewId, job);
	void runChain(job);
	return job;
}

/** The latest autotag job for an interview, or null if it was never run. */
export function getJob(interviewId: string): AutotagJob | null {
	return jobs.get(interviewId) ?? null;
}

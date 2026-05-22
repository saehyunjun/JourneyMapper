<!--
	Booth quiz — "How well do you know these patients?"

	A 5-question conference-booth game over the WCT GLP-1 study. Every question
	is a rank-the-barrier: guess which of two options patients raised more, then
	see the live count from the study data. After each answer it shows the
	visitor against seeded conference-goer tallies; this booth session's votes
	are added on top via localStorage, so the room's numbers grow through the
	day. The results page places the visitor on a single-axis scatter of the
	room, hands them a "blind spot" brief of real patient quotes, and closes
	with a programmatic Worldwide Clinical Trials read of their result.
-->
<script lang="ts">
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button/index.js';
	import { quizQuestions, leaderboardSeed, barrierBrief } from '$lib/content/wctglpdemo-data/quiz';
	import ThemeDrawer from '$lib/components/ThemeDrawer.svelte';
	import { Check, X, ArrowRight, RotateCcw, Users, Send, Mail } from '@lucide/svelte';

	type Stage = 'intro' | 'playing' | 'done';
	type Pick = { key: string; correct: boolean };

	const LS_KEY = 'wctglp-quiz-votes';
	const LEADS_KEY = 'wctglp-quiz-leads';
	const N = quizQuestions.length;

	// This booth session's votes, layered on top of the seeded tallies.
	let localVotes = $state<Record<string, Record<string, number>>>({});
	if (browser) {
		try {
			localVotes = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
		} catch {
			localVotes = {};
		}
	}

	let stage = $state<Stage>('intro');
	let index = $state(0);
	let revealed = $state(false);
	let pickedKey = $state<string | null>(null);
	let picks = $state<Pick[]>([]);

	const question = $derived(quizQuestions[index]);
	const score = $derived(picks.filter((p) => p.correct).length);

	/** Seed + this-session tallies for one question, keyed by option. */
	function combined(qid: string): Record<string, number> {
		const seed = leaderboardSeed.votes[qid] ?? {};
		const loc = localVotes[qid] ?? {};
		const out: Record<string, number> = {};
		for (const k of new Set([...Object.keys(seed), ...Object.keys(loc)]))
			out[k] = (seed[k] ?? 0) + (loc[k] ?? 0);
		return out;
	}

	const totalOf = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0) || 1;

	/** Share of conference-goers who answered a question correctly. */
	function confAccuracy(q: (typeof quizQuestions)[number]): number {
		const v = combined(q.id);
		return (v[q.correctKey] ?? 0) / totalOf(v);
	}

	// Expected score of a typical conference-goer, out of the question count.
	const confScore = $derived(quizQuestions.reduce((n, q) => n + confAccuracy(q), 0));

	function recordVote(qid: string, key: string) {
		const q = { ...(localVotes[qid] ?? {}) };
		q[key] = (q[key] ?? 0) + 1;
		localVotes = { ...localVotes, [qid]: q };
		if (browser) localStorage.setItem(LS_KEY, JSON.stringify(localVotes));
	}

	function answer(key: string, correct: boolean) {
		if (revealed) return;
		pickedKey = key;
		revealed = true;
		picks = [...picks, { key, correct }];
		recordVote(question.id, key);
	}

	function next() {
		if (index < N - 1) {
			index += 1;
			revealed = false;
			pickedKey = null;
		} else {
			stage = 'done';
		}
	}

	function start() {
		index = 0;
		revealed = false;
		pickedKey = null;
		picks = [];
		email = '';
		briefSent = false;
		stage = 'playing';
	}

	const pct = (n: number, total: number) => Math.round((n / total) * 100);

	// ── Results: single-axis scatter of the room ──────────────────────
	/** Share of the seeded room that answered a question correctly. */
	function seedAccuracy(q: (typeof quizQuestions)[number]): number {
		const v = leaderboardSeed.votes[q.id] ?? {};
		return (v[q.correctKey] ?? 0) / (Object.values(v).reduce((a, b) => a + b, 0) || 1);
	}

	// Small deterministic PRNG so the synthetic cloud is stable across renders.
	function mulberry32(seed: number) {
		return () => {
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	type RoomPoint = { score: number; jx: number; jy: number };

	// 180 synthetic players, each scored by sampling the seeded accuracies.
	const room: RoomPoint[] = (() => {
		const rnd = mulberry32(20260519);
		const pts: RoomPoint[] = [];
		for (let i = 0; i < 180; i++) {
			let s = 0;
			for (const q of quizQuestions) if (rnd() < seedAccuracy(q)) s++;
			pts.push({ score: s, jx: (rnd() - 0.5) * 0.34, jy: rnd() });
		}
		return pts;
	})();

	const percentile = $derived(
		Math.round((room.filter((p) => p.score < score).length / room.length) * 100)
	);

	// Scatter geometry — a light single-axis inline SVG, no chart dependency.
	const SVG = { w: 320, h: 132, l: 16, r: 16, t: 16, b: 30 };
	const plotW = SVG.w - SVG.l - SVG.r;
	const bandTop = SVG.t + 8;
	const bandH = SVG.h - SVG.b - bandTop - 4;
	const axisY = SVG.h - SVG.b;
	const sx = (v: number) => SVG.l + (Math.max(0, Math.min(N, v)) / N) * plotW;
	const scoreTicks = Array.from({ length: N + 1 }, (_, i) => i);

	// ── Results: "Your trial blind spot" ──────────────────────────────
	// Theme-backed questions answered wrong — the barriers the visitor underrated.
	const blindSpots = $derived(
		quizQuestions.flatMap((q, i) => {
			if (!picks[i] || picks[i].correct) return [];
			const correct = q.options.find((o) => o.key === q.correctKey);
			return correct && correct.themeIds.length ? [correct] : [];
		})
	);
	// "its side effects and the support offered" — the underrated barriers, joined.
	const blindSpotText = $derived(
		blindSpots.map((o) => o.label.toLowerCase()).join(blindSpots.length === 2 ? ' and ' : ', ')
	);
	// Every barrier's correct theme — the fallback pack for a clean sweep.
	const allBarrierThemes = $derived(
		quizQuestions.flatMap((q) => q.options.find((o) => o.key === q.correctKey)?.themeIds ?? [])
	);
	const briefThemeIds = $derived(
		blindSpots.length ? blindSpots.flatMap((o) => o.themeIds) : allBarrierThemes
	);
	const brief = $derived(barrierBrief(briefThemeIds));

	let email = $state('');
	let briefSent = $state(false);

	function sendBrief() {
		if (!/^\S+@\S+\.\S+$/.test(email.trim())) return;
		if (browser) {
			let leads: unknown[] = [];
			try {
				leads = JSON.parse(localStorage.getItem(LEADS_KEY) ?? '[]');
			} catch {
				leads = [];
			}
			leads.push({ email: email.trim(), themes: briefThemeIds, score, ts: new Date().toISOString() });
			localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
		}
		briefSent = true;
	}

	// ── Results: the Worldwide Clinical Trials "so-what" ───────────────
	// Each question maps to a competency domain; missed ones become the gaps
	// WCT can close, answered ones the strengths it can build on.
	const missedDomains = $derived(
		quizQuestions.filter((_, i) => picks[i] && !picks[i].correct).map((q) => q.domain)
	);
	const nailedDomains = $derived(
		quizQuestions.filter((_, i) => picks[i] && picks[i].correct).map((q) => q.domain)
	);

	/** "a, b, and c" — a readable list, capped so the sentence stays tight. */
	function joinLabels(items: string[]): string {
		const list = items.slice(0, 3);
		if (list.length <= 1) return list[0] ?? '';
		if (list.length === 2) return `${list[0]} and ${list[1]}`;
		return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
	}

	// ── Theme drawer — open the coded segments behind a blind-spot barrier ──
	let themeDrawerOpen = $state(false);
	let drawerThemeId = $state<string | null>(null);

	function openTheme(themeId: string) {
		drawerThemeId = themeId;
		themeDrawerOpen = true;
	}
</script>

<div class="flex flex-1 flex-col items-center px-6 pb-28 pt-12">
	<div class="w-full max-w-2xl">
		{#if stage === 'intro'}
			<!-- ── Title card ─────────────────────────────────────────── -->
			<div class="flex flex-col items-center text-center">
				<span class="mb-3 text-sm font-medium uppercase tracking-widest text-accent-mint"
					>GLP-1 Insights · Booth quiz</span
				>
				<h1 class="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
					How well do you know these patients?
				</h1>
				<p class="mt-4 max-w-md text-balance text-muted-foreground">
					{N} quick questions drawn from real GLP-1 interviews. Guess what patients said — then see how
					you stack up against the room.
				</p>
				<Button class="mt-8" size="lg" onclick={start}>
					Start the quiz
					<ArrowRight />
				</Button>
				<p class="mt-4 text-xs text-muted-foreground">
					{leaderboardSeed.seed_players.toLocaleString()} people have played so far.
				</p>
			</div>
		{:else if stage === 'playing'}
			<!-- ── Progress ──────────────────────────────────────────── -->
			<div class="mb-8 flex items-center justify-between">
				<div class="flex gap-1.5">
					{#each quizQuestions as _, i (i)}
						<span
							class="h-1.5 w-8 rounded-full transition-colors {i < index
								? 'bg-accent-mint'
								: i === index
									? 'bg-foreground'
									: 'bg-border'}"
						></span>
					{/each}
				</div>
				<span class="text-sm text-muted-foreground">{index + 1} / {N}</span>
			</div>

			<p class="mb-1 text-sm font-medium uppercase tracking-widest text-accent-mint">
				{question.kicker}
			</p>
			<h2 class="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
				{question.prompt}
			</h2>

			{@const maxCount = Math.max(...question.options.map((o) => o.count))}
			{@const roomVotes = combined(question.id)}
			{@const roomTotal = totalOf(roomVotes)}
			<div class="mt-6 grid gap-3 sm:grid-cols-2">
				{#each question.options as opt (opt.key)}
					{@const isCorrect = opt.key === question.correctKey}
					{@const isPicked = opt.key === pickedKey}
					<button
						type="button"
						disabled={revealed}
						onclick={() => answer(opt.key, isCorrect)}
						class=" border-2 p-4 text-left transition-all
							{revealed && isCorrect ? 'border-accent-mint bg-accent-mint-foreground' : ''}
							{revealed && isPicked && !isCorrect ? 'border-destructive bg-destructive/5' : ''}
							{revealed && !isPicked && !isCorrect ? 'border-border opacity-60' : ''}
							{!revealed
							? 'border-border hover:border-accent-mint hover:bg-accent-mint-foreground hover:-translate-y-0.5 hover:cursor-pointer'
							: ''}"
					>
						<div class="flex items-start justify-between gap-2">
							<span class="text-lg font-semibold">{opt.label}</span>
							{#if revealed && isCorrect}
								<Check class="size-5 shrink-0 text-accent-mint" />
							{:else if revealed && isPicked}
								<X class="size-5 shrink-0 text-destructive" />
							{/if}
						</div>
						<p class="mt-0.5 text-sm text-muted-foreground">{opt.sublabel}</p>
						{#if revealed}
							<div class="mt-4">
								<div class="h-2.5 overflow-hidden rounded-full bg-border">
									<div
										class="h-full rounded-full {isCorrect
											? 'bg-accent-mint'
											: 'bg-muted-foreground/50'}"
										style="width: {pct(opt.count, maxCount)}%"
									></div>
								</div>
								<p class="mt-1.5 text-sm">
									<span class="font-semibold">{opt.count}</span>
									<span class="text-muted-foreground"> mentions across the interviews</span>
								</p>
							</div>
						{/if}
					</button>
				{/each}
			</div>

			{#if revealed}
				{@const myPick = picks[index]}
				<div class="mt-6 space-y-4">
					<div class=" border border-border p-4">
						<div class="flex items-center gap-2 text-sm font-medium">
							<Users class="size-4 text-accent-mint" />
							You vs. the room
						</div>
						<div class="mt-3 space-y-2">
							{#each question.options as opt (opt.key)}
								{@const v = pct(roomVotes[opt.key] ?? 0, roomTotal)}
								<div class="flex items-center gap-3 text-sm">
									<span class="w-28 shrink-0 truncate text-muted-foreground">{opt.label}</span>
									<div class="h-2 flex-1 overflow-hidden rounded-full bg-border">
										<div class="h-full rounded-full bg-foreground/70" style="width: {v}%"></div>
									</div>
									<span class="w-9 shrink-0 text-right font-medium">{v}%</span>
								</div>
							{/each}
						</div>
						<p class="mt-3 text-sm text-muted-foreground">
							{#if myPick.correct}
								You picked the answer
								<span class="font-medium text-foreground"
									>{confAccuracy(question) < 0.5
										? 'most of the room missed'
										: 'the room got right'}.</span
								>
							{:else}
								You're in good company — {pct(roomVotes[myPick.key] ?? 0, roomTotal)}% of the room
								picked the same.
							{/if}
						</p>
					</div>
					<p class="bg-accent-mint-foreground/60 p-4 text-sm text-accent-mint-background">
						{question.takeaway}
					</p>
				</div>

				<Button class="mt-6 w-full" size="lg" onclick={next}>
					{index < N - 1 ? 'Next question' : 'See your results'}
					<ArrowRight />
				</Button>
			{/if}
		{:else}
			<!-- ── Results ───────────────────────────────────────────── -->
			<div class="flex flex-col items-center text-center">
				<span class="mb-3 text-sm font-medium uppercase tracking-widest text-accent-mint"
					>Your results</span
				>
				<p class="text-6xl font-semibold tracking-tight">
					{score}<span class="text-3xl text-muted-foreground">/{N}</span>
				</p>
				<h2 class="mt-3 text-balance text-2xl font-semibold tracking-tight">
					{#if score === N}
						You read these patients perfectly.
					{:else if score > confScore}
						You know these patients better than the room.
					{:else if score >= confScore - 0.5}
						Right about as well as the average visitor.
					{:else}
						The patients surprised you — and most visitors too.
					{/if}
				</h2>
				<p class="mt-3 text-muted-foreground">
					The average of {(
						leaderboardSeed.seed_players + (localVotes[quizQuestions[0].id] ? 1 : 0)
					).toLocaleString()} players scores
					<span class="font-semibold text-foreground">{confScore.toFixed(1)}</span> / {N}.
				</p>

				<!-- ── Where you landed — single-axis scatter of the room ──── -->
				<div class="mt-8 w-full  border border-border p-5 text-left">
					<div class="flex items-baseline justify-between gap-3">
						<h3 class="font-semibold">Where you landed</h3>
						<span class="shrink-0 text-sm text-accent-mint">Ahead of {percentile}% of the room</span>
					</div>
					<p class="mt-1 text-sm text-muted-foreground">
						Each dot is a player, placed by quiz score. You're the mint one.
					</p>
					<svg
						viewBox="0 0 {SVG.w} {SVG.h}"
						class="mt-2 w-full"
						role="img"
						aria-label="Scatter of your score against {room.length} other players"
					>
						<!-- user score guide line -->
						<line
							x1={sx(score)}
							y1={bandTop - 4}
							x2={sx(score)}
							y2={axisY}
							class="stroke-accent-mint"
							stroke-width="1"
							stroke-dasharray="3 3"
							opacity="0.5"
						/>
						<!-- room dots -->
						{#each room as p, i (i)}
							<circle
								cx={sx(p.score + p.jx)}
								cy={bandTop + p.jy * bandH}
								r="3"
								class="fill-muted-foreground"
								opacity="0.3"
							/>
						{/each}
						<!-- you -->
						<circle cx={sx(score)} cy={bandTop + bandH / 2} r="11" class="fill-accent-mint" opacity="0.18" />
						<circle cx={sx(score)} cy={bandTop + bandH / 2} r="6" class="fill-accent-mint" />
						<text
							x={sx(score)}
							y={bandTop - 6}
							text-anchor="middle"
							font-size="11"
							font-weight="600"
							class="fill-foreground">You</text
						>
						<!-- score axis -->
						<line
							x1={SVG.l}
							y1={axisY}
							x2={SVG.w - SVG.r}
							y2={axisY}
							class="stroke-border"
							stroke-width="1"
						/>
						{#each scoreTicks as t (t)}
							<text
								x={sx(t)}
								y={axisY + 14}
								text-anchor="middle"
								font-size="10"
								class="fill-muted-foreground">{t}</text
							>
						{/each}
						<text
							x={SVG.l + plotW / 2}
							y={SVG.h - 2}
							text-anchor="middle"
							font-size="9"
							class="fill-muted-foreground">questions correct →</text
						>
					</svg>
				</div>

				<div class="mt-6 w-full space-y-2 text-left">
					{#each quizQuestions as q, i (q.id)}
						<div class="flex items-center gap-3  border border-border px-4 py-3">
							{#if picks[i]?.correct}
								<Check class="size-4 shrink-0 text-accent-mint" />
							{:else}
								<X class="size-4 shrink-0 text-destructive" />
							{/if}
							<span class="flex-1 truncate text-sm">{q.prompt}</span>
							<span class="shrink-0 text-xs text-muted-foreground"
								>{pct(confAccuracy(q) * totalOf(combined(q.id)), totalOf(combined(q.id)))}% got it</span
							>
						</div>
					{/each}
				</div>

				<!-- ── Your trial blind spot — brief + light lead capture ──── -->
				<div
					class="mt-6 w-full border-2 border-accent-mint/40 bg-accent-mint-foreground/50 p-4 text-left"
				>
					<p class="text-sm font-medium uppercase tracking-widest text-accent-mint">
						Your trial blind spot
					</p>
					{#if blindSpots.length}
						<h3 class="mt-1 text-xl font-semibold">
							You underrated <span class="text-accent-mint-background">{blindSpotText}</span>.
						</h3>
						<p class="mt-1 text-sm text-muted-foreground">
							These came up more often than most people guess. Here's a sample of what patients
							actually said — your one-page brief pulls every quote.
						</p>
					{:else}
						<h3 class="mt-1 text-xl font-semibold">Strong read on the barriers.</h3>
						<p class="mt-1 text-sm text-muted-foreground">
							You read every barrier right. Want the receipts? The brief gathers the strongest
							patient quotes behind each one.
						</p>
					{/if}

					<div class="mt-4 space-y-3">
						{#each brief as b (b.themeId)}
							<button
								type="button"
								onclick={() => openTheme(b.themeId)}
								class="block w-full bg-background/70 p-3 text-left transition-colors hover:bg-background hover:cursor-pointer"
							>
								<span class="flex items-baseline justify-between gap-3">
									<span class="text-sm font-semibold">{b.label}</span>
									<span class="shrink-0 text-xs text-muted-foreground"
										>{b.mentions} patient mentions</span
									>
								</span>
								{#if b.quotes[0]}
									<span class="mt-1.5 block text-sm leading-snug">“{b.quotes[0].text}”</span>
									<span class="mt-1 block text-xs text-muted-foreground">
										— {b.quotes[0].attribution}{b.quotes.length > 1
											? ` · +${b.quotes.length - 1} more in the brief`
											: ''}
									</span>
								{/if}
								<span
									class="mt-2 flex items-center gap-1 text-xs font-medium text-accent-mint-background"
								>
									See every coded segment <ArrowRight class="size-3" />
								</span>
							</button>
						{/each}
					</div>

					{#if briefSent}
						<div
							class="mt-4 flex items-center gap-2  bg-accent-mint px-4 py-3 text-sm font-medium text-primary"
						>
							<Check class="size-4 shrink-0" />
							Your brief is on its way to {email.trim()}.
						</div>
					{:else}
						<form
							class="mt-4 flex flex-col gap-2 sm:flex-row"
							onsubmit={(e) => {
								e.preventDefault();
								sendBrief();
							}}
						>
							<div
								class="flex flex-1 items-center gap-2 rounded-full border border-border bg-background px-4"
							>
								<Mail class="size-4 shrink-0 text-muted-foreground" />
								<input
									type="email"
									required
									bind:value={email}
									placeholder="you@company.com"
									class="h-10 w-full bg-transparent text-sm outline-none"
								/>
							</div>
							<Button type="submit" size="lg">
								Email me the brief
								<Send />
							</Button>
						</form>
						<p class="mt-2 text-xs text-muted-foreground">
							One email with the quotes — no list, no follow-up spam.
						</p>
					{/if}
				</div>

				<!-- ── The Worldwide Clinical Trials read — programmatic so-what ── -->
				<div class="mt-6 w-full p-4 text-left text-primary">
					<p class="text-sm font-medium uppercase tracking-widest text-accent-mint-background">
						Our Read
					</p>
					{#if missedDomains.length}
						<p class="mt-2 text-sm leading-relaxed">
							Your softest reads were around
							<span class="font-medium text-secondary-foreground"
								>{joinLabels(missedDomains.map((d) => d.label))}</span
							>. That's where our team does its sharpest work: Pairing {joinLabels([
								...new Set(missedDomains.map((d) => d.wctEdge))
							])} with the operational muscle to carry it into a live protocol.
						</p>
					{/if}
					{#if nailedDomains.length}
						<p class="mt-2 text-sm leading-relaxed">
							You already have a strong instinct for
							<span class="font-medium text-secondary-foreground"
								>{joinLabels(nailedDomains.map((d) => d.label))}</span
							>. We can build on that and turn a good hunch into design decisions that hold
							up across sites and patients.
						</p>
					{/if}
				</div>

				<Button class="mt-6" size="lg" variant="outline" onclick={start}>
					<RotateCcw />
					Play again
				</Button>
			</div>
		{/if}
	</div>
</div>

<!-- Theme drawer — the coded segments behind a tapped blind-spot barrier -->
<ThemeDrawer bind:open={themeDrawerOpen} themeId={drawerThemeId} />

/**
 * StoryAssembler — turns the Executive Summary data into a slide sequence.
 *
 * Each slide carries one focal data point. Deeper evidence (driver clusters,
 * sub-themes, tagged quotes) is packed into the slide's `detail` payload —
 * the slide itself surfaces an inline link-button on the numeric phrase
 * inside its body and a "view details" CTA, both of which open the side
 * drawer rendered by the host.
 */
import type { ClusterBar, Finding } from '$lib/content/wctglpdemo-data/executive-summary';
import type {
	BubbleSpec,
	CorpusVizSpec,
	DetailSection,
	Driver,
	HeroSupport,
	SentimentBucket,
	Slide,
	SlideDetail,
	SlideTone,
	StoryInput
} from './types';

const CORPUS_UNIFORM_COLOR = '#CC6324';

/**
 * Per-tone Tailwind shade ramp for the bubbles inside a constellation.
 * Index 0 = largest/rank-leading bubble (deepest shade); subsequent ranks
 * step lighter. All values are dark enough to take white value labels.
 *   positive  → green-800 / green-700 / green-600
 *   negative  → red-800   / red-700   / red-600
 *   divisive  → same red ramp as negative (kept for symmetry with toneForFinding)
 *   neutral   → gray-800  / gray-700  / gray-600
 */
const BUBBLE_TONE_SHADES: Record<SlideTone, string[]> = {
	positive: ['#166534', '#15803d', '#16a34a'],
	negative: ['#991b1b', '#b91c1c', '#dc2626'],
	divisive: ['#991b1b', '#b91c1c', '#dc2626'],
	neutral: ['#1f2937', '#374151', '#4b5563']
};
const BUBBLE_CLUSTER_MAX = 3;

function toneForFinding(tone: SlideTone): SlideTone {
	return tone === 'divisive' ? 'negative' : tone;
}

function clusterToDriver(c: ClusterBar): Driver {
	return {
		label: c.label,
		positive: c.positive,
		neutral: c.neutral,
		negative: c.negative
	};
}

function blocksToDriver(label: string, blocks: { sentiment: number }[]): Driver {
	let positive = 0;
	let neutral = 0;
	let negative = 0;
	for (const b of blocks) {
		if (b.sentiment > 0) positive++;
		else if (b.sentiment < 0) negative++;
		else neutral++;
	}
	return { label, positive, neutral, negative };
}

/**
 * Build a constellation's bubbles from a finding's driver clusters.
 * Picks the top-K clusters by the tone-relevant count (positive count for
 * positive findings, negative for negative). Each surviving cluster
 * becomes one colored bubble; the surrounding ring (drawn by the
 * BubbleConstellation) reads as the denominator (total mentions).
 */
function buildBubbleClusterFromClusters(clusters: ClusterBar[], tone: SlideTone): BubbleSpec[] {
	const tonePick = tone === 'negative' || tone === 'divisive' ? 'negative' : 'positive';
	const ramp = BUBBLE_TONE_SHADES[tone] ?? BUBBLE_TONE_SHADES.neutral;
	return [...clusters]
		.sort((a, b) => b[tonePick] - a[tonePick])
		.slice(0, BUBBLE_CLUSTER_MAX)
		.map((c, i) => ({
			id: c.id,
			label: c.label,
			value: Math.max(1, c[tonePick]),
			color: ramp[Math.min(i, ramp.length - 1)],
			primary: i === 0
		}));
}

function supportForFinding(
	stat: { value: string; caption: string },
	distribution: { positive: number; neutral: number; negative: number },
	tone: SlideTone,
	clusters: ClusterBar[] = []
): HeroSupport {
	const total = distribution.positive + distribution.neutral + distribution.negative;
	if (total <= 0) return { kind: 'none' };

	const numericStat = parseInt(stat.value, 10);
	if (
		Number.isFinite(numericStat) &&
		numericStat <= 12 &&
		stat.caption.toLowerCase().includes('barrier')
	) {
		const denomMatch = stat.caption.match(/of\s+(\d+)/i);
		const denom = denomMatch ? parseInt(denomMatch[1], 10) : 10;
		return { kind: 'waffle', value: numericStat, total: Math.max(numericStat, denom), tone };
	}

	// Editorial constellation — for positive/negative driver findings with
	// at least two clusters, replace the ring with an outlined container
	// circle (= total) holding the top driver bubbles inside. Falls back
	// to the standard ring when the finding has only one driver.
	if (tone === 'positive' || tone === 'negative' || tone === 'divisive') {
		const driverBubbles = buildBubbleClusterFromClusters(clusters, tone);
		if (driverBubbles.length >= 2) {
			return { kind: 'bubble-cluster', total, tone, bubbles: driverBubbles };
		}
	}

	if (tone === 'positive') return { kind: 'ring', value: distribution.positive, total, tone };
	if (tone === 'negative') return { kind: 'ring', value: distribution.negative, total, tone };
	return { kind: 'ring', value: distribution.neutral, total, tone };
}

/**
 * Bucket the corpus blocks into the 5-band sentiment scale (-2..+2). The
 * theme.blocks array carries raw sentiment scores — fall back to the
 * 3-band sentimentLean totals (treating non-zero as ±1) when the corpus
 * data only has signs, not magnitudes.
 */
function bucketSentiments(input: StoryInput): Record<SentimentBucket, number> {
	const buckets: Record<SentimentBucket, number> = { '-2': 0, '-1': 0, '0': 0, '1': 0, '2': 0 };
	let any = false;
	const seen = new Set<unknown>();
	for (const t of input.themes) {
		for (const b of t.blocks) {
			any = true;
			const k = String(Math.max(-2, Math.min(2, Math.round(b.sentiment)))) as SentimentBucket;
			buckets[k] = (buckets[k] ?? 0) + 1;
			seen.add(b);
		}
	}
	if (!any) {
		buckets['-1'] = input.sentimentLean.negative;
		buckets['0'] = input.sentimentLean.neutral;
		buckets['1'] = input.sentimentLean.positive;
	}
	return buckets;
}

type SubthemeLean = {
	themeLabel: string;
	subthemeLabel: string;
	total: number;
	positive: number;
	negative: number;
	share: number;
	direction: 'positive' | 'negative';
};

/**
 * Pick the single sub-theme with the strongest sentiment lean above a
 * minimum volume threshold — the recolor slide's specific insight.
 *
 * Skew metric: |positive - negative| / total, conditioned on `total >=
 * MIN_VOLUME` so we don't lift a 2-of-3 sub-theme over a 14-of-20 one.
 */
function pickTopLeanSubtheme(input: StoryInput, minVolume = 5): SubthemeLean | null {
	let best: SubthemeLean | null = null;
	for (const t of input.themes) {
		for (const s of t.subthemes ?? []) {
			const total = s.blocks.length;
			if (total < minVolume) continue;
			let positive = 0;
			let negative = 0;
			for (const b of s.blocks) {
				if (b.sentiment > 0) positive++;
				else if (b.sentiment < 0) negative++;
			}
			const lean = positive - negative;
			if (lean === 0) continue;
			const share = Math.abs(lean) / total;
			const candidate: SubthemeLean = {
				themeLabel: t.label,
				subthemeLabel: s.label,
				total,
				positive,
				negative,
				share,
				direction: lean > 0 ? 'positive' : 'negative'
			};
			if (!best || candidate.share > best.share) best = candidate;
		}
	}
	return best;
}

function leanCopy(lean: 'positive' | 'negative' | 'mixed', total: number): string {
	if (lean === 'positive')
		return `Across ${total} tagged moments, the corpus tips positive — patients spoke in praise more often than in complaint. The specific reasons sit a click away.`;
	if (lean === 'negative')
		return `Across ${total} tagged moments, frustration outweighs satisfaction. The specific friction points sit a click away.`;
	return `Across ${total} tagged moments, praise and complaint sit close to even. The reasons clustered tightly into a small set of topics — a click away.`;
}

function pickScopeStat(input: StoryInput): { value: number; label: string } | null {
	const quotes = input.stats.find((s) => s.label.toLowerCase().includes('quote'));
	if (quotes) return quotes;
	const interviews = input.stats.find((s) => s.label.toLowerCase().includes('interview'));
	return interviews ?? input.stats[0] ?? null;
}

/** Pull the top-K clusters for a given tone across all findings. */
function topDriversFor(findings: Finding[], tone: 'positive' | 'negative', k = 5): Driver[] {
	const matching = findings.filter((f) => f.tone === tone);
	if (!matching.length) return [];
	const allClusters: ClusterBar[] = matching.flatMap((f) => f.clusters);
	const sortKey =
		tone === 'positive' ? (c: ClusterBar) => -c.positive : (c: ClusterBar) => -c.negative;
	return [...allClusters].sort((a, b) => sortKey(a) - sortKey(b)).slice(0, k).map(clusterToDriver);
}

/** Find the substring within `body` that most cleanly highlights the focal number. */
function pickHighlight(body: string, candidates: (string | number)[]): string | undefined {
	for (const c of candidates) {
		const s = String(c);
		if (!s) continue;
		// Match the number with a noun phrase that follows it (up to 3 words).
		const re = new RegExp(`\\b${s.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s+(?:[a-z][a-z-]*\\s*){1,3}\\b`, 'i');
		const m = body.match(re);
		if (m) return m[0].trim();
	}
	return undefined;
}

export function assembleStory(input: StoryInput): Slide[] {
	const slides: Slide[] = [];

	// 1. Cover. Derive the generative poster from the same telemetry the
	//    dashboard view feeds its IndicationPoster — same inputs, same
	//    composition, just animated and full-bleed on the slide.
	const themeSizes = input.themes.map((t) => t.blocks.length);
	const sentimentTimeline = input.themes.flatMap((t) =>
		t.blocks.map((b) => b.sentiment)
	);
	slides.push({
		kind: 'opening',
		eyebrow: 'Executive Summary',
		title: input.title,
		body: input.summaryText,
		poster: {
			totalQuotes: input.sentimentLean.total,
			posPct: input.sentimentLean.posPct,
			negPct: input.sentimentLean.negPct,
			neutralPct: input.sentimentLean.neutralPct,
			themeSizes,
			interviewAnchors: input.posterAnchors ?? [],
			sentimentTimeline,
			seed: input.posterSeed ?? 1,
			variant: input.posterVariant ?? 'default'
		}
	});

	// 2. Scope-setter. Declares its viz so the persistent corpus grid takes
	//    over the visual region for this slide (and morphs into the next one).
	const scope = pickScopeStat(input);
	if (scope) {
		slides.push({
			kind: 'scope',
			eyebrow: 'The corpus',
			headline: `The read sits on ${scope.value.toLocaleString()} ${scope.label}.`,
			value: scope.value,
			label: scope.label,
			body: 'Each slide that follows surfaces a single insight. Click the inline numbers — or use the "view drivers" button — to drill into the evidence behind it.',
			viz: { mode: 'uniform', color: CORPUS_UNIFORM_COLOR }
		});
	}

	// 3. Sentiment recolor — same dots, now colored by the 5-band sentiment
	//    scale. Headline is sub-theme-level (corpus-wide "lean positive" is
	//    too broad to read as an insight). Drawer still carries the
	//    pulls-positive / pulls-negative driver clusters.
	if (input.sentimentLean.total > 0 && scope) {
		const counts = bucketSentiments(input);
		const top = pickTopLeanSubtheme(input);
		const headline = top
			? top.direction === 'positive'
				? `"${top.subthemeLabel}" reads ${Math.round((top.positive / top.total) * 100)}% positive.`
				: `"${top.subthemeLabel}" reads ${Math.round((top.negative / top.total) * 100)}% negative.`
			: 'Sentiment, recolored across the corpus.';
		const body = top
			? `Out of ${top.total} moments tagged "${top.subthemeLabel}" under ${top.themeLabel.toLowerCase()}, ${top.direction === 'positive' ? top.positive : top.negative} ran ${top.direction}. The corpus-wide split sits at ${input.sentimentLean.posPct}% positive against ${input.sentimentLean.negPct}% negative — the pull is in the sub-themes.`
			: `Across ${input.sentimentLean.total} tagged moments, the corpus split ${input.sentimentLean.posPct}% positive against ${input.sentimentLean.negPct}% negative. The reasons sit in the sub-themes.`;

		const posDrivers = topDriversFor(input.findings, 'positive');
		const negDrivers = topDriversFor(input.findings, 'negative');
		const sections: DetailSection[] = [];
		if (posDrivers.length)
			sections.push({ label: 'Pulling positive', tone: 'positive', drivers: posDrivers });
		if (negDrivers.length)
			sections.push({ label: 'Pulling negative', tone: 'negative', drivers: negDrivers });

		const viz: CorpusVizSpec = { mode: 'sentiment', counts };

		slides.push({
			kind: 'recolor',
			eyebrow: 'Sentiment, in color',
			headline,
			body,
			bodyHighlight: top
				? pickHighlight(body, [top.total, top.positive, top.negative])
				: pickHighlight(body, [input.sentimentLean.total]),
			total: scope.value,
			viz,
			caption: 'each circle, now colored by sentiment',
			detail: sections.length
				? {
						eyebrow: 'Sentiment, in color',
						headline: 'What pulls the corpus in each direction',
						summary: `${input.sentimentLean.total} tagged moments, ${input.sentimentLean.posPct}% positive against ${input.sentimentLean.negPct}% negative.`,
						sections
					}
				: undefined
		});
	}

	// 4. Top theme — single editorial percent + drawer with sub-themes.
	if (input.themes.length) {
		const ranked = [...input.themes].sort((a, b) => b.blocks.length - a.blocks.length);
		const top = ranked[0];
		const allBlocks = input.themes.reduce((s, t) => s + t.blocks.length, 0);
		if (top && allBlocks > 0) {
			const share = Math.round((top.blocks.length / allBlocks) * 100);
			const subDrivers = (top.subthemes ?? [])
				.slice()
				.sort((a, b) => b.blocks.length - a.blocks.length)
				.slice(0, 6)
				.map((s) => blocksToDriver(s.label, s.blocks));
			const body = `Of ${allBlocks} tagged moments across the corpus, ${top.blocks.length} touched on ${top.label.toLowerCase()} — the single largest concentration of any theme.`;
			slides.push({
				kind: 'hero-stat',
				eyebrow: 'What patients talked about',
				stat: { value: `${share}%`, caption: `of coded moments touched ${top.label.toLowerCase()}` },
				headline: `${top.label} dominated the conversation.`,
				body,
				bodyHighlight: pickHighlight(body, [allBlocks, top.blocks.length]),
				tone: 'neutral',
				support: { kind: 'sphere-ring', value: share },
				detail: subDrivers.length
					? {
						eyebrow: top.label,
						headline: `Inside the "${top.label}" theme`,
						summary: `${top.blocks.length} tagged moments across ${subDrivers.length} sub-themes.`,
						sections: [{ label: 'Sub-themes', drivers: subDrivers }]
					}
					: undefined
			});
		}
	}

	// 5. Findings — each becomes one hero-stat slide; a supporting quote
	//    earns a follow-on patient-voice slide. The drawer carries cluster
	//    drivers plus the finding's tagged quotes.
	for (const f of input.findings) {
		const total = f.distribution.positive + f.distribution.neutral + f.distribution.negative;
		const clusterDrivers = f.clusters.slice(0, 6).map(clusterToDriver);
		slides.push({
			kind: 'hero-stat',
			eyebrow: f.eyebrow,
			stat: f.stat,
			headline: f.headline,
			body: f.detail,
			bodyHighlight: pickHighlight(f.detail, [total, f.distribution.negative, f.distribution.positive, f.clusters.length]),
			tone: f.tone,
			support: supportForFinding(f.stat, f.distribution, toneForFinding(f.tone), f.clusters),
			detail: {
				eyebrow: f.eyebrow,
				headline: f.headline,
				summary: f.detail,
				sections: clusterDrivers.length
					? [{ label: 'Driver clusters', tone: toneForFinding(f.tone), drivers: clusterDrivers }]
					: [],
				fragments: f.fragments
			}
		});
		if (f.quote) {
			slides.push({
				kind: 'quote',
				eyebrow: f.eyebrow,
				quote: f.quote
			});
		}
	}

	// 6. Closing CTA.
	if (input.explore.length) {
		slides.push({
			kind: 'closing',
			eyebrow: 'Go deeper',
			headline: 'Read the corpus from a different angle.',
			body: 'Three read-only views over the same dataset — built from the same coded segments behind every slide above.',
			links: input.explore
		});
	}

	return slides;
}

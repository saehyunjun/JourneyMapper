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
	DetailSection,
	Driver,
	HeroSupport,
	Slide,
	SlideDetail,
	SlideTone,
	StoryInput
} from './types';

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

function supportForFinding(
	stat: { value: string; caption: string },
	distribution: { positive: number; neutral: number; negative: number },
	tone: SlideTone
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

	if (tone === 'positive') return { kind: 'ring', value: distribution.positive, total, tone };
	if (tone === 'negative') return { kind: 'ring', value: distribution.negative, total, tone };
	return { kind: 'ring', value: distribution.neutral, total, tone };
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

	// 1. Cover.
	slides.push({
		kind: 'opening',
		eyebrow: 'Executive Summary',
		title: input.title,
		body: input.summaryText
	});

	// 2. Scope-setter.
	const scope = pickScopeStat(input);
	if (scope) {
		slides.push({
			kind: 'scope',
			eyebrow: 'The corpus',
			headline: `The read sits on ${scope.value.toLocaleString()} ${scope.label}.`,
			value: scope.value,
			label: scope.label,
			body: 'Each slide that follows surfaces a single insight. Click the inline numbers — or use the "view drivers" button — to drill into the evidence behind it.'
		});
	}

	// 3. Overall sentiment lean — focal % + drawer carrying the driver clusters
	//    for both directions.
	if (input.sentimentLean.total > 0) {
		const dominant =
			input.sentimentLean.lean === 'positive'
				? input.sentimentLean.posPct
				: input.sentimentLean.lean === 'negative'
					? input.sentimentLean.negPct
					: Math.max(input.sentimentLean.posPct, input.sentimentLean.negPct);
		const tone: SlideTone =
			input.sentimentLean.lean === 'positive'
				? 'positive'
				: input.sentimentLean.lean === 'negative'
					? 'negative'
					: 'neutral';
		const body = leanCopy(input.sentimentLean.lean, input.sentimentLean.total);
		const posDrivers = topDriversFor(input.findings, 'positive');
		const negDrivers = topDriversFor(input.findings, 'negative');
		const sections: DetailSection[] = [];
		if (posDrivers.length)
			sections.push({ label: 'Pulling positive', tone: 'positive', drivers: posDrivers });
		if (negDrivers.length)
			sections.push({ label: 'Pulling negative', tone: 'negative', drivers: negDrivers });
		slides.push({
			kind: 'lean',
			eyebrow: 'Sentiment at a glance',
			headline:
				input.sentimentLean.lean === 'mixed'
					? 'The corpus runs mixed.'
					: input.sentimentLean.lean === 'positive'
						? 'Patients lean positive.'
						: 'Patients lean negative.',
			body,
			bodyHighlight: pickHighlight(body, [input.sentimentLean.total]),
			value: dominant,
			tone,
			total: input.sentimentLean.total,
			detail: sections.length
				? {
					eyebrow: 'Sentiment at a glance',
					headline:
						input.sentimentLean.lean === 'mixed'
							? 'What pulls the corpus in each direction'
							: input.sentimentLean.lean === 'positive'
								? 'What pulls the corpus positive'
								: 'What pulls the corpus negative',
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
			support: supportForFinding(f.stat, f.distribution, toneForFinding(f.tone)),
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

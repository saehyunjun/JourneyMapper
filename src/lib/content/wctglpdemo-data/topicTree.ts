/**
 * topicTree.ts
 *
 * Builds the hierarchy behind the radial topic tree at /wctglpdemo/topic-tree:
 *
 *     theme (codebook top-level)  ->  subtheme  ->  keyword
 *
 * Themes and subthemes come from the codebook taxonomy via segment_tags.json.
 * The keyword leaves are the deterministic keyword_lexicon matches found in the
 * text of the segments carrying that (sub)theme — so the outer ring is the
 * actual vocabulary participants used while talking inside each theme.
 *
 * buildTopicTree() takes an annotation predicate, so the same tree can be
 * scoped to one interview question or one interviewee without changes here.
 */
import {
	annotations,
	segments,
	themeTags,
	subthemeParent,
	titleCase,
	type Annotation
} from './analysis';
import { keywordCounts } from './keywords';

export type TopicTreeKind = 'root' | 'theme' | 'subtheme' | 'keyword';

export type TopicTreeNode = {
	id: string;
	name: string;
	kind: TopicTreeKind;
	/** Tagged segments for theme/subtheme nodes; keyword mentions for keyword nodes. */
	count: number;
	/** Owning top-level theme id — drives the node's colour. */
	themeId: string;
	children?: TopicTreeNode[];
};

export type TopicFilter = (a: Annotation) => boolean;

const textBySegment = new Map(segments.map((s) => [s.segment_id, s.text]));

/** Keyword leaves: the lexicon keywords found in the given annotations' text. */
function keywordChildren(rows: Annotation[], themeId: string): TopicTreeNode[] {
	const texts = rows.map((a) => textBySegment.get(a.segment_id) ?? '').filter(Boolean);
	return keywordCounts(texts).map((k) => ({
		id: `kw:${themeId}:${k.keywordId}`,
		name: k.keywordLabel,
		kind: 'keyword' as const,
		count: k.count,
		themeId
	}));
}

/**
 * The full radial-tree hierarchy for the annotations passing `filter`.
 * Themes with no applied subthemes get their keyword leaves directly; themes
 * with subthemes also get a "General" bucket for theme-only segments so no
 * coded segment is dropped from the count.
 */
export function buildTopicTree(filter: TopicFilter = () => true): TopicTreeNode {
	const rows = annotations.filter(
		(a) => a.review_status !== 'discarded' && a.themes.length > 0 && filter(a)
	);

	const themeNodes: TopicTreeNode[] = [];

	for (const theme of themeTags) {
		const themeRows = rows.filter((a) => a.themes.includes(theme.id));
		if (!themeRows.length) continue;

		const subNodes: TopicTreeNode[] = [];
		for (const sub of theme.subthemes ?? []) {
			const subRows = themeRows.filter((a) => a.subthemes.includes(sub.id));
			if (!subRows.length) continue;
			subNodes.push({
				id: `sub:${sub.id}`,
				name: titleCase(sub.id),
				kind: 'subtheme',
				count: subRows.length,
				themeId: theme.id,
				children: keywordChildren(subRows, theme.id)
			});
		}

		// Segments carrying the theme but none of its subthemes.
		const generalRows = themeRows.filter(
			(a) => !a.subthemes.some((s) => subthemeParent.get(s) === theme.id)
		);

		let children: TopicTreeNode[];
		if (subNodes.length) {
			children = subNodes;
			if (generalRows.length) {
				children = [
					...subNodes,
					{
						id: `sub:${theme.id}:general`,
						name: 'General',
						kind: 'subtheme',
						count: generalRows.length,
						themeId: theme.id,
						children: keywordChildren(generalRows, theme.id)
					}
				];
			}
		} else {
			// Flat theme — keyword leaves hang directly off the theme node.
			children = keywordChildren(themeRows, theme.id);
		}

		themeNodes.push({
			id: `theme:${theme.id}`,
			name: titleCase(theme.id),
			kind: 'theme',
			count: themeRows.length,
			themeId: theme.id,
			children
		});
	}

	themeNodes.sort((a, b) => b.count - a.count);

	return {
		id: 'root',
		name: 'Themes',
		kind: 'root',
		count: rows.length,
		themeId: 'root',
		children: themeNodes
	};
}

/** Stable colour per top-level theme, assigned in codebook order. */
export const themePalette: Record<string, string> = (() => {
	const palette = [
		'#7DBFA7', '#CC6324', '#446079', '#3E1631', '#599077',
		'#90553A', '#6a99c2', '#FF8341', '#294457', '#9A8C5C',
		'#B5485E', '#4C7A8C', '#A06A2C', '#5B6C8F', '#7E6BA8', '#3F7D6A'
	];
	const out: Record<string, string> = {};
	themeTags.forEach((t, i) => (out[t.id] = palette[i % palette.length]));
	return out;
})();

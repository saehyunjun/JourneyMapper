/**
 * Keyword cluster lexicon — shared read/write helpers.
 *
 * Backs the segment tag drawer's "Tag as keyword…" flow. The lexicon's
 * `clusters[]` is a flat list; each cluster declares parent_theme +
 * parent_subtheme as FKs into the codebook. Variants are SUGGESTION FUEL —
 * they rank cluster suggestions in the drawer, they do NOT auto-tag any
 * occurrence (per-instance tags live in keyword_tags.json).
 *
 * Themes/subthemes are fixed in codebook 2.0 — there is no user-creatable
 * theme. The old `addThemeTerm` / `createTheme` flows are gone.
 *
 * Backed by the local source files in dev and the KV store in prod.
 */
import bundledLexicon from '$lib/content/wctglpdemo-data/keyword_lexicon.json';
import bundledCodebook from '$lib/content/wctglpdemo-data/codebook.json';
import { loadDoc, saveDoc } from './kv-store';
import {
	indications as registryIndications,
	therapeuticAreas as registryTherapeuticAreas
} from './registries';
import type { Indication, TherapeuticArea } from './registries';

const DATA_DIR = 'src/lib/content/wctglpdemo-data';
const LEXICON_PATH = `${DATA_DIR}/keyword_lexicon.json`;
const CODEBOOK_PATH = `${DATA_DIR}/codebook.json`;
const LEXICON_KEY = 'wctglpdemo:keyword_lexicon';
const CODEBOOK_KEY = 'wctglpdemo:codebook';

export type Cluster = {
	id: string;
	label: string;
	description: string;
	/** Lexicon 3.2: string[] FK → registries/indications.json items[].id (since
	 *  3.3 the registry lives there, not in this lexicon's meta). Empty array
	 *  = cross-cutting (visible under every indication toggle). Optional on
	 *  reads so legacy 3.1 rows with a singular `indication` field still
	 *  parse (see clusterIndications below). */
	indications?: string[];
	/** Lexicon 3.4: string[] FK → registries/burden_categories.json items[].id.
	 *  Empty array = unclassified. Multi-element arrays let one cluster carry
	 *  multiple burden facets. Optional on reads for pre-3.4 rows. */
	burden_category_ids?: string[];
	/** Lexicon 3.5: optional FK → registries/drugs.json items[].id. Set only
	 *  on clusters that map 1:1 to a specific drug entity (not classes like
	 *  glp_1 or non-drug concepts like iv_infusion). The drug entity carries
	 *  MOA, sponsor, stage, and indications — resolve via getDrug(). */
	drug_id?: string;
	parent_theme: string;
	parent_subtheme: string;
	variants: string[];
};

/** Indication + TherapeuticArea types re-exported from the registry module so
 *  existing import sites in components keep working. The lexicon file no
 *  longer carries these — they live in src/lib/content/registries/. */
export type { Indication, TherapeuticArea };

type LexiconMeta = { schema_version?: string; [k: string]: unknown };
type LexiconFile = { clusters: Cluster[]; meta?: LexiconMeta; [k: string]: unknown };

export type Subtheme = { id: string; label?: string; description?: string };
export type Theme = {
	id: string;
	label?: string;
	description?: string;
	subthemes?: Subtheme[];
};
type CodebookFile = { themes: Theme[]; [k: string]: unknown };

const readLexicon = () =>
	loadDoc<LexiconFile>(LEXICON_KEY, LEXICON_PATH, bundledLexicon as unknown as LexiconFile);
const readCodebook = () =>
	loadDoc<CodebookFile>(CODEBOOK_KEY, CODEBOOK_PATH, bundledCodebook as unknown as CodebookFile);

/** The lists the drawer renders — returned after every edit so it can refresh. */
export type LexiconState = { clusters: Cluster[]; themes: Theme[] };

const MAX_LEN = 80;

function cleanText(raw: unknown): string {
	const t = String(raw ?? '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!t) throw new Error('Nothing is selected.');
	if (t.length > MAX_LEN) throw new Error(`Selection is too long (max ${MAX_LEN} characters).`);
	if (!/[a-z0-9]/i.test(t)) throw new Error('Selection has no usable text.');
	return t;
}

const normalize = (t: string) => cleanText(t).toLowerCase();
const titleCase = (t: string) => t.replace(/\b\w/g, (c) => c.toUpperCase());

function slugify(t: string): string {
	return t
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 40);
}

function uniqueId(base: string, taken: Set<string>): string {
	const root = base || 'cluster';
	let id = root;
	let n = 2;
	while (taken.has(id)) id = `${root}_${n++}`;
	return id;
}

/** Verify that the (theme, subtheme) pair exists in the codebook. */
function assertPair(codebook: CodebookFile, parentTheme: string, parentSubtheme: string): void {
	const theme = codebook.themes.find((t) => t.id === parentTheme);
	if (!theme) throw new Error(`Unknown theme "${parentTheme}".`);
	const sub = theme.subthemes?.find((s) => s.id === parentSubtheme);
	if (!sub) throw new Error(`Subtheme "${parentSubtheme}" not under theme "${parentTheme}".`);
}

async function snapshot(): Promise<LexiconState> {
	const [lex, codebook] = await Promise.all([readLexicon(), readCodebook()]);
	return { clusters: lex.clusters, themes: codebook.themes };
}

/** What the /api/lexicon endpoint returns — a slice scoped to one indication
 *  plus the registries the toggle UI needs. `clusters` contains the active
 *  indication's clusters AND every "general" cluster (cross-cutting concepts
 *  that surface under every indication). Codebook themes are bundled so
 *  consumers can resolve parent_subtheme → display label without a second
 *  fetch. */
export type LexiconSlice = {
	active_indication: string;
	therapeutic_areas: TherapeuticArea[];
	indications: Indication[];
	clusters: Cluster[];
	themes: Theme[];
};

/** Normalize a cluster's indications field across 3.1 and 3.2 shapes.
 *  3.2 stores `indications: string[]` (empty = cross-cutting). 3.1 stored
 *  `indication: string` with `"general"` as the cross-cutting sentinel. */
function clusterIndications(c: Cluster & { indication?: string }): string[] {
	if (Array.isArray(c.indications)) return c.indications;
	const legacy = c.indication;
	if (!legacy || legacy === 'general') return [];
	return [legacy];
}

/** Return a lexicon slice for the named indication.
 *
 *  Falls back to the first registered indication if the requested id is
 *  missing or unknown. Indications + therapeutic areas come from the
 *  registries module — keyword_lexicon.json no longer carries them.
 *
 *  Clusters with `indications: []` (cross-cutting) surface under every
 *  indication. Legacy 3.1 rows with `indication: 'general'` are treated as
 *  cross-cutting too. */
export async function getLexiconSlice(requested?: string): Promise<LexiconSlice> {
	const [lex, codebook] = await Promise.all([readLexicon(), readCodebook()]);
	if (!registryIndications.length)
		throw new Error('registries/indications.json is empty — registry is required.');

	const known = new Set<string>(registryIndications.map((i) => i.id));
	const fallback: string = registryIndications[0].id;
	const active = requested && known.has(requested) ? requested : fallback;

	const clusters = lex.clusters.filter((c) => {
		const inds = clusterIndications(c);
		return inds.length === 0 || inds.includes(active);
	});

	return {
		active_indication: active,
		therapeutic_areas: registryTherapeuticAreas,
		indications: registryIndications,
		clusters,
		themes: codebook.themes
	};
}

/** Add a highlighted phrase as a new variant of an existing cluster. */
export async function addKeywordVariant(
	clusterId: string,
	rawText: string
): Promise<LexiconState> {
	const variant = normalize(rawText);
	const lex = await readLexicon();
	const cluster = lex.clusters.find((c) => c.id === clusterId);
	if (!cluster) throw new Error(`Unknown cluster "${clusterId}".`);
	if (!cluster.variants.some((v) => v.toLowerCase() === variant)) {
		cluster.variants.push(variant);
		await saveDoc(LEXICON_KEY, LEXICON_PATH, lex);
	}
	return snapshot();
}

/** Build the lookup regex used by keywords.ts: case-insensitive whole-token
 *  match where space/hyphen runs are flexible (so "out of pocket" matches
 *  "out-of-pocket"). Used to locate which stored variant matches a surface. */
function variantMatchesSurface(variant: string, surface: string): boolean {
	const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]+');
	return new RegExp(`^(?:${escaped})$`, 'i').test(surface);
}

/** Remove the variant matching `rawText` from the cluster. Throws if no such
 *  variant exists — surfaced to the analyst so a stale right-click on a span
 *  that no longer bolds doesn't silently no-op. */
export async function removeKeywordVariant(
	clusterId: string,
	rawText: string
): Promise<LexiconState> {
	const surface = cleanText(rawText);
	const lex = await readLexicon();
	const cluster = lex.clusters.find((c) => c.id === clusterId);
	if (!cluster) throw new Error(`Unknown cluster "${clusterId}".`);
	const idx = cluster.variants.findIndex((v) => variantMatchesSurface(v, surface));
	if (idx < 0) {
		throw new Error(`"${surface}" is no longer a variant of "${cluster.label}".`);
	}
	cluster.variants.splice(idx, 1);
	await saveDoc(LEXICON_KEY, LEXICON_PATH, lex);
	return snapshot();
}

/** Move the variant matching `rawText` from one cluster to another, atomically.
 *  If the same surface is already a variant of the target, only the removal is
 *  applied. Throws if either cluster is unknown or no source variant matches. */
export async function moveKeywordVariant(
	fromClusterId: string,
	toClusterId: string,
	rawText: string
): Promise<LexiconState> {
	const surface = cleanText(rawText);
	if (fromClusterId === toClusterId) return snapshot();
	const lex = await readLexicon();
	const fromCluster = lex.clusters.find((c) => c.id === fromClusterId);
	const toCluster = lex.clusters.find((c) => c.id === toClusterId);
	if (!fromCluster) throw new Error(`Unknown source cluster "${fromClusterId}".`);
	if (!toCluster) throw new Error(`Unknown target cluster "${toClusterId}".`);
	const idx = fromCluster.variants.findIndex((v) => variantMatchesSurface(v, surface));
	if (idx < 0) {
		throw new Error(`"${surface}" is no longer a variant of "${fromCluster.label}".`);
	}
	fromCluster.variants.splice(idx, 1);
	const targetVariant = surface.toLowerCase();
	if (!toCluster.variants.some((v) => v.toLowerCase() === targetVariant)) {
		toCluster.variants.push(targetVariant);
	}
	await saveDoc(LEXICON_KEY, LEXICON_PATH, lex);
	return snapshot();
}

/**
 * Create a new cluster under the given (parent_theme, parent_subtheme),
 * seeded from the highlighted phrase as its first variant. `labelInput` names
 * the concept (e.g. "Trial duration"); when omitted, the label falls back to
 * a title-cased copy of the phrase. Returns the updated state plus the new
 * cluster id so callers can chain a tag-creation against it.
 */
export async function createCluster(
	parentTheme: string,
	parentSubtheme: string,
	rawText: string,
	labelInput?: string,
	descriptionInput?: string
): Promise<LexiconState & { createdId: string }> {
	const text = cleanText(rawText);
	const [lex, codebook] = await Promise.all([readLexicon(), readCodebook()]);
	assertPair(codebook, parentTheme, parentSubtheme);
	const labelRaw = (labelInput ?? '').replace(/\s+/g, ' ').trim();
	const label = labelRaw || titleCase(text);
	if (label.length > MAX_LEN)
		throw new Error(`Keyword name is too long (max ${MAX_LEN} characters).`);
	const description = (descriptionInput ?? '').replace(/\s+/g, ' ').trim();
	const taken = new Set<string>(lex.clusters.map((c) => c.id));
	const id = uniqueId(slugify(label), taken);
	lex.clusters.push({
		id,
		label,
		description,
		// Drawer-created clusters have no active-condition signal yet; an empty
		// indications[] keeps them visible under every indication toggle.
		// Reclassify by editing the lexicon JSON when the cluster belongs to
		// one or more specific indications.
		indications: [],
		parent_theme: parentTheme,
		parent_subtheme: parentSubtheme,
		variants: [text.toLowerCase()]
	});
	await saveDoc(LEXICON_KEY, LEXICON_PATH, lex);
	return { clusters: lex.clusters, themes: codebook.themes, createdId: id };
}

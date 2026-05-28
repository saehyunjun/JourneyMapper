/**
 * Clinical-trials explorer — server loader.
 *
 * Pulls `studies_normalized.json` for the active indication and projects it
 * down to a compact per-trial row suitable for client-side filtering and
 * country-aggregated bubble rendering. The full normalized file can be ~24 MB
 * (MS); the projection lands at ~300 KB by dropping eligibility text, raw
 * location records, dates, etc.
 *
 * Country names are normalized to the world-atlas 110m topojson canonical
 * spellings so the page can map each trial's countries[] straight to bubble
 * positions without further lookup. CT.gov names absent from the 110m atlas
 * (Hong Kong, Singapore, Martinique, etc.) are dropped from countries[] but
 * the trial itself is kept — its other countries still place it on the map.
 */
import {
	getDiseaseInsightManifestById,
	type DiseaseInsightManifest
} from '$lib/content/disease-insights';
import { getDatasetPayload } from '$lib/content/disease-insights/datasets';
import type { PageServerLoad } from './$types';

export type TrialSite = {
	/** Canonical (topojson-aligned) country name; may be null if the country wasn't on the 110m atlas. */
	country: string | null;
	city: string | null;
	facility: string | null;
	lat: number;
	lon: number;
};

export type TrialRow = {
	id: string;
	title: string | null;
	status: string | null;
	phases: string[];
	study_type: string | null;
	sponsor_name: string | null;
	sponsor_class: string | null;
	intervention_types: string[];
	intervention_names: string[];
	enrollment: number | null;
	countries: string[];
	/** Geocoded sites — used when the map zooms into a single country. */
	sites: TrialSite[];
};

export type ClinicalTrialsPayload = {
	indication: {
		id: string;
		label: string;
	} | null;
	generated_at: string | null;
	source_fetched_at: string | null;
	activity_filter: {
		rule: string;
		kept: number;
		source_total: number;
		recent_cutoff: string;
	} | null;
	trials: TrialRow[];
	stats: {
		total: number;
		with_country: number;
		dropped_country_names: string[];
	};
	facets: {
		phases: string[];
		statuses: string[];
		study_types: string[];
		intervention_types: string[];
		sponsor_classes: string[];
		countries: string[];
		/** Top-N most common intervention names (across the filtered corpus), for autocomplete chips. */
		top_interventions: { name: string; count: number }[];
		/** Top-N most common lead sponsor names, for autocomplete chips. */
		top_sponsors: { name: string; count: number }[];
	};
};

/** CT.gov country name → world-atlas-110m canonical name. Drop value = territory absent at 110m. */
const COUNTRY_ALIASES: Record<string, string | null> = {
	'United States': 'United States of America',
	'Turkey (Türkiye)': 'Turkey',
	'Bosnia and Herzegovina': 'Bosnia and Herz.',
	'North Macedonia': 'Macedonia',
	'Dominican Republic': 'Dominican Rep.',
	'Republic of Korea': 'South Korea',
	'Korea, Republic of': 'South Korea',
	"Korea, Democratic People's Republic of": 'North Korea',
	'Russian Federation': 'Russia',
	'Czech Republic': 'Czechia',
	'Iran, Islamic Republic of': 'Iran',
	'Syrian Arab Republic': 'Syria',
	"Lao People's Democratic Republic": 'Laos',
	'Viet Nam': 'Vietnam',
	'Tanzania, United Republic of': 'Tanzania',
	'Congo, The Democratic Republic of the': 'Dem. Rep. Congo',
	'Congo, Democratic Republic of the': 'Dem. Rep. Congo',
	"Cote d'Ivoire": "Côte d'Ivoire",
	// Territories/city-states absent from 110m — drop the country tag but keep the trial.
	'Hong Kong': null,
	'Singapore': null,
	Macao: null,
	Martinique: null,
	'French Polynesia': null,
	'Saint Martin': null,
	'Saint Barthélemy': null,
	Guadeloupe: null,
	Réunion: null,
	Bermuda: null,
	Gibraltar: null,
	'Faroe Islands': null,
	'Antigua and Barbuda': null,
	'Saint Lucia': null,
	'Saint Kitts and Nevis': null,
	Dominica: null,
	Grenada: null,
	Maldives: null,
	'Cayman Islands': null,
	Aruba: null,
	'Curaçao': null,
	Bahrain: null,
	Comoros: null,
	'Cabo Verde': null,
	'Cape Verde': null,
	Liechtenstein: null,
	Andorra: null,
	'San Marino': null,
	Monaco: null,
	Malta: null,
	Mauritius: null,
	Seychelles: null
};

function normalizeCountry(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;
	if (Object.prototype.hasOwnProperty.call(COUNTRY_ALIASES, trimmed)) {
		return COUNTRY_ALIASES[trimmed];
	}
	return trimmed;
}

type NormalizedStudy = {
	nct_id: string;
	brief_title: string | null;
	overall_status: string | null;
	phases: string[];
	study_type: string | null;
	lead_sponsor: { name: string; class: string | null } | null;
	interventions: { name: string; type: string | null }[];
	enrollment: { count: number | null } | null;
	locations: {
		facility: string | null;
		city: string | null;
		country: string | null;
		lat: number | null;
		lon: number | null;
	}[];
};

type NormalizedFile = {
	generated_at?: string;
	source_fetched_at?: string;
	activity_filter?: {
		rule: string;
		kept: number;
		source_total: number;
		recent_cutoff: string;
	} | null;
	studies: NormalizedStudy[];
};

function projectStudy(s: NormalizedStudy, droppedCountrySet: Set<string>): TrialRow {
	const seenCountries = new Set<string>();
	const countries: string[] = [];
	const sites: TrialSite[] = [];
	for (const loc of s.locations) {
		const canon = loc.country ? normalizeCountry(loc.country) : null;
		if (loc.country && canon === null) droppedCountrySet.add(loc.country);
		if (canon && !seenCountries.has(canon)) {
			seenCountries.add(canon);
			countries.push(canon);
		}
		// Only ship sites with usable coordinates — points without lat/lon can't be drawn.
		if (typeof loc.lat === 'number' && typeof loc.lon === 'number') {
			sites.push({
				country: canon,
				city: loc.city ?? null,
				facility: loc.facility ?? null,
				lat: loc.lat,
				lon: loc.lon
			});
		}
	}

	const seenIvTypes = new Set<string>();
	const intervention_types: string[] = [];
	const intervention_names: string[] = [];
	for (const iv of s.interventions) {
		if (iv.type && !seenIvTypes.has(iv.type)) {
			seenIvTypes.add(iv.type);
			intervention_types.push(iv.type);
		}
		if (iv.name && intervention_names.length < 6) {
			intervention_names.push(iv.name);
		}
	}

	const title = s.brief_title ? (s.brief_title.length > 140 ? s.brief_title.slice(0, 137) + '…' : s.brief_title) : null;

	return {
		id: s.nct_id,
		title,
		status: s.overall_status,
		phases: Array.isArray(s.phases) ? s.phases : [],
		study_type: s.study_type,
		sponsor_name: s.lead_sponsor?.name ?? null,
		sponsor_class: s.lead_sponsor?.class ?? null,
		intervention_types,
		intervention_names,
		enrollment: s.enrollment?.count ?? null,
		countries,
		sites
	};
}

function buildFacets(rows: TrialRow[]): ClinicalTrialsPayload['facets'] {
	const phases = new Set<string>();
	const statuses = new Set<string>();
	const studyTypes = new Set<string>();
	const ivTypes = new Set<string>();
	const sponsorClasses = new Set<string>();
	const countries = new Set<string>();
	// Case-collapsed intervention name → original casing + occurrence count.
	const ivNameCounts = new Map<string, { name: string; count: number }>();
	const sponsorNameCounts = new Map<string, { name: string; count: number }>();
	for (const r of rows) {
		if (r.status) statuses.add(r.status);
		if (r.study_type) studyTypes.add(r.study_type);
		if (r.sponsor_class) sponsorClasses.add(r.sponsor_class);
		for (const p of r.phases) phases.add(p);
		for (const t of r.intervention_types) ivTypes.add(t);
		for (const c of r.countries) countries.add(c);
		for (const n of r.intervention_names) {
			const key = n.toLowerCase();
			const existing = ivNameCounts.get(key);
			if (existing) existing.count += 1;
			else ivNameCounts.set(key, { name: n, count: 1 });
		}
		if (r.sponsor_name) {
			const key = r.sponsor_name.toLowerCase();
			const existing = sponsorNameCounts.get(key);
			if (existing) existing.count += 1;
			else sponsorNameCounts.set(key, { name: r.sponsor_name, count: 1 });
		}
	}
	const top_interventions = [...ivNameCounts.values()]
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
		.slice(0, 24);
	const top_sponsors = [...sponsorNameCounts.values()]
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
		.slice(0, 30);
	return {
		phases: [...phases].sort(phaseSortCmp),
		statuses: [...statuses].sort(),
		study_types: [...studyTypes].sort(),
		intervention_types: [...ivTypes].sort(),
		sponsor_classes: [...sponsorClasses].sort(),
		countries: [...countries].sort(),
		top_interventions,
		top_sponsors
	};
}

function phaseSortCmp(a: string, b: string): number {
	const order = ['EARLY_PHASE1', 'PHASE1', 'PHASE2', 'PHASE3', 'PHASE4', 'NA'];
	const ia = order.indexOf(a);
	const ib = order.indexOf(b);
	if (ia !== -1 && ib !== -1) return ia - ib;
	if (ia !== -1) return -1;
	if (ib !== -1) return 1;
	return a.localeCompare(b);
}

export const load: PageServerLoad = async ({ parent }) => {
	const { slice } = await parent();
	const manifest: DiseaseInsightManifest | null = getDiseaseInsightManifestById(slice.active_indication) ?? null;

	if (!manifest) {
		const payload: ClinicalTrialsPayload = {
			indication: null,
			generated_at: null,
			source_fetched_at: null,
			activity_filter: null,
			trials: [],
			stats: { total: 0, with_country: 0, dropped_country_names: [] },
			facets: {
				phases: [],
				statuses: [],
				study_types: [],
				intervention_types: [],
				sponsor_classes: [],
				countries: [],
				top_interventions: [],
				top_sponsors: []
			}
		};
		return payload;
	}

	const normalizedRef = manifest.datasets.find((d) => d.type === 'clinical_trials_normalized');
	if (!normalizedRef) {
		const payload: ClinicalTrialsPayload = {
			indication: { id: manifest.id, label: manifest.label },
			generated_at: null,
			source_fetched_at: null,
			activity_filter: null,
			trials: [],
			stats: { total: 0, with_country: 0, dropped_country_names: [] },
			facets: {
				phases: [],
				statuses: [],
				study_types: [],
				intervention_types: [],
				sponsor_classes: [],
				countries: [],
				top_interventions: [],
				top_sponsors: []
			}
		};
		return payload;
	}

	const file = getDatasetPayload(manifest.slug, normalizedRef.path) as NormalizedFile | undefined;
	if (!file?.studies) {
		const payload: ClinicalTrialsPayload = {
			indication: { id: manifest.id, label: manifest.label },
			generated_at: null,
			source_fetched_at: null,
			activity_filter: null,
			trials: [],
			stats: { total: 0, with_country: 0, dropped_country_names: [] },
			facets: {
				phases: [],
				statuses: [],
				study_types: [],
				intervention_types: [],
				sponsor_classes: [],
				countries: [],
				top_interventions: [],
				top_sponsors: []
			}
		};
		return payload;
	}

	const droppedCountrySet = new Set<string>();
	const trials = file.studies.map((s) => projectStudy(s, droppedCountrySet));
	const withCountry = trials.filter((t) => t.countries.length > 0).length;

	const payload: ClinicalTrialsPayload = {
		indication: { id: manifest.id, label: manifest.label },
		generated_at: file.generated_at ?? null,
		source_fetched_at: file.source_fetched_at ?? null,
		activity_filter: file.activity_filter ?? null,
		trials,
		stats: {
			total: trials.length,
			with_country: withCountry,
			dropped_country_names: [...droppedCountrySet].sort()
		},
		facets: buildFacets(trials)
	};
	return payload;
};

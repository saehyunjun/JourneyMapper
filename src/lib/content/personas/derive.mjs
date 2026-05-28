/**
 * persona-deriver.mjs
 *
 * Shared, pure helpers for turning a set of authors into a persona profile +
 * filter. Used by both:
 *   - scripts/propose-persona-suggestions.mjs (cluster-then-derive)
 *   - scripts/derive-persona-from-authors.mjs (manual author selection)
 *
 * No file I/O, no process.exit, no module-level state. The caller supplies
 * fragments + annotations + options; the helpers return values. A future
 * SvelteKit endpoint can wrap these the same way the scripts do.
 *
 * Vector layout: themes ++ subthemes ++ stages ++ steps. Dim weights tilt the
 * cosine distance toward finer axes (subtheme/step) without ignoring coarser
 * ones (theme/stage). Emotions + sentiment + role are descriptive only — they
 * are NOT in the distance metric (rationale: don't lump "angry caregivers"
 * with "angry patients" just because the affect matches).
 */

// === Author profiles ========================================================

const DEFAULT_ROLE_THRESHOLD = 0.6;

/**
 * Build a single author's profile from their fragments + the corpus annotations.
 * `annotations` is the merged FragmentId → FragmentAnnotation map.
 */
export function buildAuthorProfile(authorHash, authorFragments, annotations, opts = {}) {
	const roleThreshold = opts.roleThreshold ?? DEFAULT_ROLE_THRESHOLD;

	const themes = new Map();
	const subthemes = new Map();
	const stages = new Map();
	const steps = new Map();
	const emotions = new Map();
	const roles = new Map();
	const sentiments = [];
	let rolesStatedCount = 0;

	const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);

	for (const f of authorFragments) {
		const ann = annotations[f.id];
		if (ann?.segment_tags) {
			for (const t of ann.segment_tags.themes ?? []) bump(themes, t);
			for (const s of ann.segment_tags.subthemes ?? []) bump(subthemes, s);
			for (const e of ann.segment_tags.emotions ?? []) bump(emotions, e);
			if (typeof ann.segment_tags.sentiment_score === 'number') {
				sentiments.push(ann.segment_tags.sentiment_score);
			}
		}
		if (ann?.stages?.values) {
			for (const v of ann.stages.values) {
				bump(stages, v.stage_id);
				if (v.step_id) bump(steps, v.step_id);
			}
		}
		const r = f.speaker_attrs?.role;
		if (r?.value != null && (r.evidence === 'stated' || r.evidence === 'inferred')) {
			bump(roles, r.value);
			rolesStatedCount += 1;
		}
	}

	const toShareMap = (m) => {
		const out = {};
		const denom = authorFragments.length;
		for (const [k, v] of m) out[k] = v / denom;
		return out;
	};

	const sentMean = sentiments.length
		? sentiments.reduce((a, b) => a + b, 0) / sentiments.length
		: null;
	const sentVar = sentiments.length > 1
		? sentiments.reduce((a, b) => a + (b - sentMean) ** 2, 0) / sentiments.length
		: null;

	const modalRole = roles.size > 0
		? [...roles.entries()].sort((a, b) => b[1] - a[1])[0][0]
		: null;
	const modalRoleShare = modalRole ? roles.get(modalRole) / authorFragments.length : 0;

	return {
		author_handle_hash: authorHash,
		fragment_ids: authorFragments.map((f) => f.id),
		fragment_count: authorFragments.length,
		features: {
			role: modalRoleShare >= roleThreshold ? modalRole : null,
			role_stated_count: rolesStatedCount,
			themes: toShareMap(themes),
			subthemes: toShareMap(subthemes),
			stages: toShareMap(stages),
			steps: toShareMap(steps),
			emotions: toShareMap(emotions),
			sentiment_mean: sentMean,
			sentiment_var: sentVar
		}
	};
}

// === Feature vocabulary + vectorization =====================================

export function vocabFrom(profiles) {
	const vocab = { themes: new Set(), subthemes: new Set(), stages: new Set(), steps: new Set() };
	for (const p of profiles) {
		for (const k of Object.keys(p.features.themes)) vocab.themes.add(k);
		for (const k of Object.keys(p.features.subthemes)) vocab.subthemes.add(k);
		for (const k of Object.keys(p.features.stages)) vocab.stages.add(k);
		for (const k of Object.keys(p.features.steps)) vocab.steps.add(k);
	}
	return {
		themes: [...vocab.themes].sort(),
		subthemes: [...vocab.subthemes].sort(),
		stages: [...vocab.stages].sort(),
		steps: [...vocab.steps].sort()
	};
}

export const DEFAULT_DIM_WEIGHTS = { themes: 1, subthemes: 1.5, stages: 1, steps: 1.25 };

export function vectorize(profile, vocab, weights = DEFAULT_DIM_WEIGHTS) {
	const vec = [];
	for (const dim of ['themes', 'subthemes', 'stages', 'steps']) {
		// sqrt so the weight squared shows up correctly under cosine
		const w = Math.sqrt(weights[dim]);
		for (const k of vocab[dim]) vec.push((profile.features[dim][k] ?? 0) * w);
	}
	return vec;
}

export function cosineDistance(a, b) {
	let dot = 0, na = 0, nb = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		na += a[i] * a[i];
		nb += b[i] * b[i];
	}
	if (na === 0 || nb === 0) return 1;
	return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// === Cluster-level aggregations =============================================

export function topShares(profiles, key, threshold) {
	const sums = new Map();
	for (const p of profiles) {
		for (const [k, v] of Object.entries(p.features[key])) {
			sums.set(k, (sums.get(k) ?? 0) + v);
		}
	}
	const out = [];
	for (const [k, v] of sums) {
		const share = v / profiles.length;
		if (share >= threshold) out.push({ id: k, share: Number(share.toFixed(3)) });
	}
	out.sort((a, b) => b.share - a.share);
	return out;
}

export function topSharesAll(profiles, key, limit = 5) {
	const sums = new Map();
	for (const p of profiles) {
		for (const [k, v] of Object.entries(p.features[key])) {
			sums.set(k, (sums.get(k) ?? 0) + v);
		}
	}
	return [...sums.entries()]
		.map(([k, v]) => ({ id: k, share: Number((v / profiles.length).toFixed(3)) }))
		.sort((a, b) => b.share - a.share)
		.slice(0, limit);
}

// === Persona filter derivation ==============================================

const DEFAULT_SHARE_THRESHOLD = 0.4;

/**
 * Derive a PersonaFilter from a group of author profiles. Subthemes / stages
 * with mean per-author share ≥ shareThreshold become annotation predicates.
 * Modal role becomes a speaker_attrs clause only when ≥ roleThreshold of the
 * group's profiles agree on it.
 *
 * `fragmentsById` is needed only to read `content_source` off each fragment
 * id in the profiles. Pass any Map<id, fragment>-shaped lookup.
 */
export function deriveFilter(profiles, opts) {
	const shareThreshold = opts.shareThreshold ?? DEFAULT_SHARE_THRESHOLD;
	const roleThreshold = opts.roleThreshold ?? DEFAULT_ROLE_THRESHOLD;
	const { fragmentsById, indications } = opts;

	const subFilter = topShares(profiles, 'subthemes', shareThreshold).map((x) => x.id);
	const stageFilter = topShares(profiles, 'stages', shareThreshold).map((x) => x.id);

	const roleCounts = new Map();
	for (const p of profiles) {
		if (p.features.role) {
			roleCounts.set(p.features.role, (roleCounts.get(p.features.role) ?? 0) + 1);
		}
	}
	const modalRole = roleCounts.size > 0
		? [...roleCounts.entries()].sort((a, b) => b[1] - a[1])[0]
		: null;
	const includeRole = modalRole && modalRole[1] / profiles.length >= roleThreshold;

	const sourcesSeen = new Set();
	for (const p of profiles) {
		for (const fid of p.fragment_ids) {
			const f = fragmentsById.get(fid);
			if (f?.content_source) sourcesSeen.add(f.content_source);
		}
	}

	const filter = {
		content_source: [...sourcesSeen].sort(),
		indications: [...indications]
	};
	if (includeRole) filter.speaker_attrs = { role: { in: [modalRole[0]] } };
	const ann = {};
	if (subFilter.length > 0) ann.has_subtheme = subFilter;
	if (stageFilter.length > 0) ann.has_stage = stageFilter;
	if (Object.keys(ann).length > 0) filter.annotations = ann;
	return filter;
}

// === Minimal filter evaluator (Node-side mirror of evaluate.ts) =============

/**
 * Mirrors src/lib/content/personas/evaluate.ts for the subset of clauses we
 * actually emit here. Used by the manual-merge script to preview how many
 * corpus fragments a derived filter would match. If evaluate.ts grows new
 * clauses, sync them here.
 */
export function matchesFilter(fragment, filter, annotations) {
	if (filter.content_source && !filter.content_source.includes(fragment.content_source)) {
		return false;
	}
	if (filter.indications && !fragment.indications.some((i) => filter.indications.includes(i))) {
		return false;
	}
	if (filter.speaker_attrs) {
		for (const [name, m] of Object.entries(filter.speaker_attrs)) {
			const attr = fragment.speaker_attrs?.[name];
			const allowInferred = m.allow_inferred ?? true;
			const allowUnknown = m.allow_unknown ?? false;
			if (!attr) {
				if (!allowUnknown) return false;
				continue;
			}
			if (attr.evidence === 'unknown' || attr.value == null) {
				if (!allowUnknown) return false;
				continue;
			}
			if (attr.evidence === 'inferred' && !allowInferred) return false;
			if (!m.in.includes(attr.value)) return false;
		}
	}
	if (filter.annotations) {
		const ann = annotations[fragment.id];
		if (!ann) return false;
		const m = filter.annotations;
		if (m.has_stage) {
			const stages = ann.stages?.values ?? [];
			if (!stages.some((s) => m.has_stage.includes(s.stage_id))) return false;
		}
		if (m.has_step) {
			const stages = ann.stages?.values ?? [];
			if (!stages.some((s) => s.step_id != null && m.has_step.includes(s.step_id))) return false;
		}
		if (m.has_theme) {
			const th = ann.segment_tags?.themes ?? [];
			if (!th.some((t) => m.has_theme.includes(t))) return false;
		}
		if (m.has_subtheme) {
			const sub = ann.segment_tags?.subthemes ?? [];
			if (!sub.some((s) => m.has_subtheme.includes(s))) return false;
		}
		if (m.has_emotion) {
			const emo = ann.segment_tags?.emotions ?? [];
			if (!emo.some((e) => m.has_emotion.includes(e))) return false;
		}
		if (m.sentiment) {
			const s = ann.segment_tags?.sentiment_score;
			if (typeof s !== 'number') return false;
			if (m.sentiment.min !== undefined && s < m.sentiment.min) return false;
			if (m.sentiment.max !== undefined && s > m.sentiment.max) return false;
		}
	}
	return true;
}

// === Overlap detection ======================================================

export function jaccard(a, b) {
	if (a.length === 0 && b.length === 0) return 1;
	const A = new Set(a), B = new Set(b);
	let inter = 0;
	for (const x of A) if (B.has(x)) inter += 1;
	return inter / (A.size + B.size - inter);
}

/**
 * Score one derived filter against existing personas by Jaccard similarity of
 * annotation predicates. Returns matches with score ≥ 0.5, sorted desc.
 */
export function overlapsExisting(filter, existingPersonas) {
	const subs = filter.annotations?.has_subtheme ?? [];
	const stages = filter.annotations?.has_stage ?? [];
	const out = [];
	for (const p of existingPersonas) {
		const pSubs = p.filter.annotations?.has_subtheme ?? [];
		const pStages = p.filter.annotations?.has_stage ?? [];
		// Skip personas with no annotation predicates — Jaccard'd hit 1.0 on empty/empty.
		if (pSubs.length === 0 && pStages.length === 0) continue;
		const subJ = subs.length || pSubs.length ? jaccard(subs, pSubs) : 0;
		const stageJ = stages.length || pStages.length ? jaccard(stages, pStages) : 0;
		const score = Math.max(subJ, stageJ);
		if (score >= 0.5) out.push({ persona_id: p.id, jaccard: Number(score.toFixed(2)) });
	}
	return out.sort((a, b) => b.jaccard - a.jaccard);
}

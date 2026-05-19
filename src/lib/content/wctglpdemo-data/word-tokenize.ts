/**
 * word-tokenize.ts — runtime word tokeniser, matching build-word-usage.mjs.
 *
 * Same lowercase + curly-apostrophe normalisation + stoplist rules the
 * deterministic word_usage.json build uses, so word counts computed live on
 * screen agree with that file. Reusable: `countWords(texts)` gives ranked
 * { word, count } for any slice of participant speech.
 */

// Standard English function-word stoplist (~NLTK), common contractions, and
// pure speech fillers — verbatim from scripts/build-word-usage.mjs.
const STOPWORDS = new Set(
	`a an the and but or nor so if then than that this these those of to in on at for
	with as by from up out off over under into about above below again further once
	it its they them their theirs he she his her him hers we us our ours you your yours
	i me my mine is am are was were be been being do does did doing have has had having
	will would can could shall should may might must not no here there when where why how
	what which who whom whose all any both each few more most other some such only own
	same very too s t d ll m re o just now also because while during before after
	between against through above below
	dont doesnt didnt isnt arent wasnt werent havent hasnt hadnt wont wouldnt cant
	couldnt shouldnt im ive id ill youre youve youd youll were weve wed well theyre
	theyve theyd thats theres whats lets gonna wanna
	yeah yea okay ok oh um uh umm uhh hmm mm mmm mhm huh`
		.split(/\s+/)
		.filter(Boolean)
);

// Extended stoplist: high-frequency conversational/discourse filler and vague
// words. Domain terms (weight, medication, injection, doctor…) are NOT here.
const FILLER_WORDS = new Set(
	`know knows knew knowing think thinks thinking thought mean means meant
	one ones even get gets getting got gotten go goes going went gone
	definitely maybe actually really basically honestly probably literally
	obviously absolutely kind kinda sort sorta lot lots like liked likes
	thing things something anything everything nothing someone anyone everyone
	somebody anybody everybody way ways said say says saying tell tells telling
	told want wants wanted wanting much many good great guess guessed
	gonna wanna gotta come comes coming came make makes making made put puts
	putting let lets letting look looks looking looked right sure stuff bit
	pretty anyway anyways still able yes yep yup nope nah`
		.split(/\s+/)
		.filter(Boolean)
);

/** Final stoplist applied during tokenization. */
const STOPLIST = new Set([...STOPWORDS, ...FILLER_WORDS]);

/** Lowercase, normalise curly apostrophes, split into content word tokens. */
export function tokenize(text: string): string[] {
	const cleaned = text.toLowerCase().replace(/[‘’]/g, "'");
	const raw = cleaned.match(/[a-z0-9]+(?:['-][a-z0-9]+)*/g) || [];
	return raw
		.map((tok) => tok.replace(/^'+|'+$/g, ''))
		.filter((tok) => {
			if (tok.length < 2) return false; // drop single chars
			if (!/[a-z]/.test(tok)) return false; // drop pure-number tokens
			if (STOPLIST.has(tok.replace(/'/g, ''))) return false; // contraction-safe
			return true;
		});
}

/** Ranked { word, count } across a set of texts — count desc, then word asc. */
export function countWords(texts: string[]): { word: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const text of texts) {
		for (const tok of tokenize(text)) counts.set(tok, (counts.get(tok) ?? 0) + 1);
	}
	return [...counts]
		.map(([word, count]) => ({ word, count }))
		.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

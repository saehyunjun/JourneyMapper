# Interview Analysis System Plan

## Project Synopsis

This project will create a repeatable system for turning raw interview transcripts into structured, analysis-ready datasets. The system should allow users to upload raw text, DOCX, or similar transcript files, then automatically parse the interviews, identify common questions, segment participant responses, tag the content, extract high-value quotes, and generate JSON/CSV outputs for wordclouds, charts, journey maps, persona development, and strategic reporting.

The core goal is to move from transcript-centric review to a structured quote- and segment-level knowledge base. Each participant response should become searchable, sortable, and analyzable by question, participant, theme, emotion, sentiment, semantic meaning, and quote quality. The outputs should support both rigorous qualitative analysis and fast visual storytelling.

## Project Goals

1. Create a consistent pipeline for uploading and processing raw interview transcripts.
2. Convert unstructured interviews into structured question-response datasets.
3. Normalize similar interviewer questions into shared canonical question IDs.
4. Segment long responses into quote-sized analytical units.
5. Tag each segment for theme, emotion, sentiment, semantic meaning, and strategic relevance.
6. Extract and score key quotes for reporting and presentations.
7. Generate aggregate datasets for wordclouds, frequency charts, co-occurrence maps, journey maps, and persona summaries.
8. Include a human review layer so analysts can approve, edit, reject, or refine AI-generated tags and quotes.
9. Maintain an editable codebook that improves consistency across studies.
10. Produce reusable JSON and CSV exports for downstream visualization and synthesis.

---

# Process Outline: Raw Interview Text → Tagged Quote Datasets

## 1. Define the target outputs first

Decide what files the system should generate every time text files are uploaded.

Recommended outputs:

| File | Purpose |
|---|---|
| `interviews_structured.json` | Clean transcript parsed by participant, speaker, question, response |
| `quote_bank.json` | Extracted pull quotes with tags and scores |
| `theme_frequency.json` | Theme counts by participant/question |
| `emotion_frequency.json` | Emotion counts by participant/question |
| `sentiment_by_question.json` | Sentiment scores by question, participant, and theme |
| `semantic_clusters.json` | Groups of related ideas/quotes |
| `word_usage.json` | Word counts for wordclouds and charts |
| `co_occurrence.json` | Theme/emotion/semantic tag relationships |
| `analysis_summary.md` | Human-readable synthesis |

---

## 2. Standardize the upload format

Create a folder structure:

```txt
/uploads
  participant_01.txt
  participant_02.txt
  participant_03.txt

/outputs
  interviews_structured.json
  quote_bank.json
  theme_frequency.json
  emotion_frequency.json
  sentiment_by_question.json
  semantic_clusters.json
  word_usage.json
  co_occurrence.json
```

Each transcript should ideally include:

```txt
Participant: 01
Interviewer: ...
Participant: ...
Interviewer: ...
Participant: ...
```

If possible, include metadata at the top:

```yaml
participant_id: participant_01
condition: GLP-1 weight maintenance
date: 2026-05-17
segment: patient
```

---

## 3. Build a canonical schema

Create one source-of-truth JSON structure.

```json
{
  "interview_id": "participant_01",
  "participant_metadata": {
    "age": null,
    "gender": null,
    "condition": "GLP-1 weight maintenance"
  },
  "sections": [
    {
      "question_id": "placebo_concerns",
      "question": "How would you feel about a placebo-controlled study?",
      "response": "I would be afraid of gaining the weight back...",
      "response_segments": [
        {
          "segment_id": "p01_q03_s01",
          "text": "I would be afraid of gaining the weight back.",
          "themes": [],
          "emotions": [],
          "sentiment": null,
          "semantic_tags": [],
          "quote_candidates": []
        }
      ]
    }
  ]
}
```

Everything else should be derived from this.

---

## 4. Create a codebook

The system needs a reusable tagging taxonomy.

Recommended categories:

```json
{
  "theme_tags": [
    "cost_access",
    "insurance_barrier",
    "side_effect_concern",
    "fear_of_weight_regain",
    "placebo_concern",
    "travel_burden",
    "schedule_burden",
    "home_visit_preference",
    "telehealth_preference",
    "trial_motivation",
    "research_altruism",
    "medication_access",
    "education_need",
    "nutrition_support",
    "injection_fatigue",
    "oral_medication_interest"
  ],
  "emotion_tags": [
    "fear",
    "relief",
    "hope",
    "frustration",
    "confidence",
    "uncertainty",
    "gratitude",
    "empowerment",
    "anxiety",
    "skepticism"
  ],
  "sentiment_scale": {
    "-2": "strongly negative",
    "-1": "negative",
    "0": "neutral",
    "1": "positive",
    "2": "strongly positive"
  },
  "semantic_tags": [
    "access_logic",
    "risk_calculation",
    "treatment_dependency",
    "maintenance_strategy",
    "convenience_tradeoff",
    "clinical_trial_friction",
    "self_advocacy",
    "information_seeking",
    "health_transformation"
  ]
}
```

This should be editable over time.

---

## 5. Parse transcripts into question-response blocks

First processing pass:

- Identify speakers
- Extract interviewer questions
- Attach participant answers to the relevant question
- Normalize similar questions into shared `question_id`s

Example:

```json
{
  "question_id": "stopping_glp1",
  "canonical_question": "Why would you consider stopping a GLP-1 medication?",
  "question_variants": [
    "Why would you stop taking a GLP-1 medication?",
    "What might make you consider stopping taking a GLP-1?",
    "Would you consider stopping GLP-1s?"
  ]
}
```

This enables comparison across interviews.

---

## 6. Segment long answers into smaller units

Do not tag entire paragraphs only.

Break participant responses into quote-sized segments:

- 1 sentence
- 2–3 sentence idea unit
- answer subsection
- emotionally meaningful phrase

Example:

```json
{
  "segment_id": "p06_stopping_glp1_01",
  "text": "The only thing that would make me stop taking a GLP-1 medication would be if it's cost prohibitive.",
  "question_id": "stopping_glp1"
}
```

This makes tagging and quote extraction much cleaner.

---

## 7. Run automated tagging

For each segment, assign:

- Theme tags
- Emotion tags
- Sentiment score
- Semantic tags
- Participant relevance
- Quote quality score

Example output:

```json
{
  "segment_id": "p06_stopping_glp1_01",
  "text": "The only thing that would make me stop taking a GLP-1 medication would be if it's cost prohibitive.",
  "question_id": "stopping_glp1",
  "themes": ["cost_access", "insurance_barrier"],
  "emotions": ["anxiety"],
  "sentiment": -1,
  "semantic_tags": ["access_logic", "treatment_dependency"],
  "quote_score": {
    "clarity": 4,
    "emotional_intensity": 3,
    "strategic_value": 5,
    "specificity": 4,
    "overall": 4.0
  }
}
```

---

## 8. Extract key quotes

Define selection criteria.

A quote should be pulled if it has:

- High emotional intensity
- Clear theme signal
- Memorable phrasing
- Strategic usefulness
- Specificity
- Relevance to trial design, burden, access, behavior, or unmet need

Quote bank schema:

```json
{
  "quote_id": "q_p06_001",
  "participant_id": "participant_06",
  "question_id": "stopping_glp1",
  "quote": "The only thing that would make me stop taking a GLP-1 medication would be if it's cost prohibitive.",
  "themes": ["cost_access", "insurance_barrier"],
  "emotions": ["anxiety"],
  "sentiment": -1,
  "semantic_tags": ["access_logic", "treatment_dependency"],
  "quote_score": 4.0,
  "recommended_uses": [
    "access barriers",
    "trial recruitment strategy",
    "patient journey map"
  ]
}
```

---

## 9. Generate aggregate datasets

From the tagged segment file, automatically create the following outputs.

### Theme frequency

```json
{
  "theme": "fear_of_weight_regain",
  "count": 18,
  "participants": ["participant_06", "participant_07"],
  "questions": ["placebo_concerns", "trial_barriers"]
}
```

### Emotion frequency

```json
{
  "emotion": "fear",
  "count": 24,
  "top_questions": ["placebo_concerns", "stopping_glp1"]
}
```

### Co-occurrence

```json
{
  "tag_a": "placebo_concern",
  "tag_b": "fear_of_weight_regain",
  "count": 12
}
```

### Word usage

```json
{
  "question_id": "placebo_concerns",
  "words": [
    { "word": "weight", "count": 14 },
    { "word": "risk", "count": 9 },
    { "word": "scary", "count": 7 }
  ]
}
```

---

## 10. Add a review layer

The first version should not be fully automated.

Recommended review workflow:

1. AI generates structured outputs.
2. Human reviews quote bank.
3. Human approves/rejects quote candidates.
4. Human edits or merges tags.
5. Approved tags update the codebook.
6. Future runs improve consistency.

Add fields like:

```json
{
  "review_status": "pending",
  "reviewer_notes": "",
  "approved_for_reporting": false
}
```

---

## 11. Build a simple interface

Minimum useful interface:

- Upload `.txt`, `.docx`, or `.csv`
- Choose study/project
- Choose codebook
- Run analysis
- Review quotes
- Filter by participant, question, theme, emotion, sentiment, and quote score
- Export JSON/CSV

---

## 12. Suggested technical pipeline

```txt
Upload files
   ↓
Clean transcript text
   ↓
Parse speakers + question/answer blocks
   ↓
Normalize questions to question IDs
   ↓
Segment participant responses
   ↓
Apply tagging codebook
   ↓
Score quote candidates
   ↓
Generate quote bank
   ↓
Generate aggregate datasets
   ↓
Human review
   ↓
Export final JSON/CSV files
```

---

## Best MVP Scope

For the first version, build only these five outputs:

1. `interviews_structured.json`
2. `tagged_segments.json`
3. `quote_bank.json`
4. `theme_frequency.json`
5. `word_usage.json`

That is enough to support:

- Quote libraries
- Wordclouds
- Theme charts
- Persona development
- Journey mapping
- Report writing
- Trial design recommendations

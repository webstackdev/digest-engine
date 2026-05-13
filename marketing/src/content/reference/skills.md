# Skills

A "Skill" represents one discrete prompt-and-extract operation run by an LLM in our system.

## Skills Runtime
Skills are invoked dynamically. `core/llm.py` loads the prompt text directly from `skills/<skill_name>/SKILL.md`. This allows prompt-tuning to happen independently of Python application logic, inside markdown files that AI assistants (like Copilot) can natively parse format-wise.

## Skill Catalog

### Content Classification
* **Purpose**: Assign a general topic bucket for filtering (e.g., tutorial, opinion, news, release).
* **Inputs**: Candidate text.
* **Outputs**: A mapped category.
* **Prompt Location**: `skills/content-classification/SKILL.md`.
* **Failure Mode**: Item is categorized as `Unknown`.

### Relevance Scoring
* **Purpose**: Act as tie-breaker for items sitting in the ambiguous cosine-similarity band (`0.50 - 0.85`).
* **Inputs**: The project's topic description, precomputed reference similarity score, candidate title, candidate text (trimmed to 5000 chars).
* **Outputs**: A JSON payload containing a `relevance_score` and `explanation`.
* **Prompt Location**: `skills/relevance-scoring/SKILL.md`.
* **Failure Mode**: Aborts and relies purely on the Cosine Similarity score.

### Deduplication
* **Purpose**: Determine if a new post is functionally identical (or a direct repost) to one already stored recently.
* **Inputs**: Candidate text and closest-distance match.
* **Outputs**: Boolean flag suppressing the clone.
* **Prompt Location**: `skills/deduplication/SKILL.md`.

### Summarization
* **Purpose**: Condense an input article into a fast 2-3 sentence overview that editors read on the dashboard.
* **Inputs**: Candidate text.
* **Outputs**: Short paragraph saved to `Content.summary_text`.
* **Prompt Location**: `skills/summarization/SKILL.md`.
* **Failure Mode**: Retries; if fatal, leaves UI text empty requiring manual skim.

### Newsletter Email Extraction
* **Purpose**: Parse raw forwarded HTML emails to decouple multiple article links from the sender's flavor-text wrapping.
* **Inputs**: HTML email body.
* **Outputs**: A list of extracted URLs and parsed titles.
* **Prompt Location**: `skills/newsletter-extraction/SKILL.md`.

### Entity Extraction
* **Purpose**: Find proper nouns (people, vendors, technologies) referenced in the item so we can track their authority and mention-velocity.
* **Inputs**: Candidate text.
* **Outputs**: Unresolved `EntityCandidate` names.
* **Prompt Location**: `skills/entity-extraction/SKILL.md`.

### Theme Detection
* **Purpose**: Turn clustered articles into human-readable newsletter draft sections.
* **Inputs**: Groupings of high-velocity related content.
* **Outputs**: Proposed newsletter headings and a contextual summary for the grouping.
* **Prompt Location**: `skills/theme-detection/SKILL.md`.

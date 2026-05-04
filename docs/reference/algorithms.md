# Algorithms

This document breaks down the major decision-making mathematics behind the AI pipeline. Having these defined explicitly helps debug strange behaviors and informs how to adjust the tunables.

## Embedding Model & Vector Space
* **What it computes**: Converts extracted content text into high-dimensional vector coordinates.
* **Inputs**: Candidate text.
* **Outputs**: A dense vector stored into the Qdrant database payload.
* **Tunables**: `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL` ([see Tunables](tunables.md)).
* **Location**: `core/embeddings.py`

## Cosine Relevance Scoring
* **What it computes**: Decides if a candidate article is relevant to the project's specific topic.
* **Inputs**: The candidate Article Vector, and the top-5 $k$-Nearest-Neighbor vectors tagged as `is_reference=True` in Qdrant for that project.
* **Formula / Rules**:
  1. If Similarity $\ge 0.85$: The candidate is considered a **clear match** and is deemed highly relevant (LLM bypass).
  2. If Similarity $< 0.50$: The candidate is a **clear non-match** (LLM bypass).
  3. If $0.50 \le$ Similarity $< 0.85$: The candidate falls into the **ambiguous band**, triggering the Relevance LLM skill which returns a score to break the tie, assuming `OPENROUTER_API_KEY` is present.
* **Tunables**: Static bounds `0.50` and `0.85`.
* **Location**: `core/pipeline.py` and `core/ai.py`.

## Topic Centroid Feedback Loop
* **What it computes**: Drifts the project baseline "topic vector" based on explicit editorial thumbs-up or thumbs-down feedback.
* **Inputs**: Explicit `UserFeedback` records.
* **Formula**: The sum of positively-ranked content vectors minus negatively-ranked vectors, proportionally shifting the project's reference similarity center point.
* **Tunables**: `ProjectConfig.recompute_topic_centroid_on_feedback_save` ([see Tunables](tunables.md)).
* **Location**: `trends/` and `core/embeddings.py`.

## Authority Scoring
* **What it computes**: Assigns an influence multiplier (`authority_score`) to an `Entity` based on how frequently and prominently it is mentioned or referenced.
* **Inputs**: Detected mentions, source quality signals.
* **Algorithmic Model**: A multi-signal model including raw mention frequency layered against a time-based decay function ($score_{new} = score_{previous} \times decay\_rate$), bounded engagement corroboration. 
* **Tunables**: `ProjectConfig.authority_decay_rate`.
* **Location**: `entities/` models and Celery tasks.

## Deduplication Thresholding
* **What it computes**: Determines whether an incoming ingestion is identical to a piece of content already in the dataset.
* **Inputs**: Incoming article text embedding.
* **Formula**: $L_2$ Distance nearest-neighbor search. Extremely close items are flagged as duplicate and ignored.
* **Location**: `content/deduplication.py` and `pipeline`.

## Trend Velocity Calculation
* **What it computes**: Isolates topics that are accelerating in mentions, not just frequently used.
* **Formula**: $\frac{Count(Recent Window)}{Count(Baseline Window)}$. Identifies a delta derivative of topic popularity.

## Source Diversity Metric
* **What it computes**: Quantifies concentration risk (e.g., pointing out if 90% of content is drawn from the same single Reddit community).
* **Formula**: Herfindahl-Hirschman Index (HHI) style proportionality test on plugin sources over total ingestions.

## Entity Candidate Confidence Scoring
* **What it computes**: Determines whether an unknown text fragment (e.g., "OpenAI") extracted by the LLM should be auto-promoted into a new Tracked Entity or kept pending human review.
* **Formula**: Evaluates proximity to known aliases, capitalization strictness, and recurrence volume.

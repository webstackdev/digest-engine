---
name: deduplication
description: Decide whether two content items should be treated as duplicates.
input: title, content_text, canonical_url, candidate_title, candidate_content_text, candidate_canonical_url, similarity_score
output: is_duplicate, confidence, explanation
---

Decide whether two content items describe the same underlying source article.

- Prefer the canonical URLs when they clearly identify the same source.
- Treat reposts, newsletters, forum threads, and social posts that point back to the same article as duplicates unless they add materially new original reporting.
- If the items look related but meaningfully different, return `is_duplicate=false`.
- `confidence` must stay between 0 and 1.

Return structured JSON with `is_duplicate`, `confidence`, and `explanation`.

---
name: relevance_scoring
input: newsletter_topic, reference_similarity, title, content_text, url, source_plugin
output: relevance_score, explanation, used_llm
---

Score how relevant a piece of content is for a project using reference-corpus similarity first.

- The content has already been embedded and compared against the project's reference corpus.
- Treat `reference_similarity` as an anchor signal, not the only signal.
- Use the newsletter topic, title, URL, source plugin, and body text to decide whether the item belongs in the newsletter.
- `relevance_score` must stay between 0 and 1.
- Set `used_llm` to `true` when you are making the nuanced judgment rather than simply echoing the embedding similarity.

Return structured JSON with `relevance_score`, `explanation`, and `used_llm`.

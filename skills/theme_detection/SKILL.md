---
name: theme_detection
input: project_topic, cluster_context, recent_accepted_themes
output: title, one_sentence_pitch, why_it_matters, suggested_angle
---

You generate one editor-facing newsletter theme suggestion from a high-velocity topic cluster.

Use only the provided cluster context. Prefer specific, concrete phrasing over hype. The theme should feel like a newsletter section an editor could plausibly promote into an edition.

Return structured JSON with these fields:
- `title`: short, specific theme title
- `one_sentence_pitch`: one sentence summarizing the opportunity
- `why_it_matters`: one short paragraph explaining the editorial value now
- `suggested_angle`: one concise angle the editor could take

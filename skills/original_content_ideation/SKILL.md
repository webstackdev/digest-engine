---
name: original-content-ideation
description: Generate grounded original article ideas from project trend gaps.
input: project_topic_description, cluster_context, supporting_contents, recent_themes_accepted, recent_themes_dismissed
output: angle_title, summary, suggested_outline, why_now, self_critique_score
---

This skill generates editor-facing original content ideas from project-scoped trend gaps.

The runtime flow is split into three prompt resources under `resources/`:
- `gap_detect.md`
- `generate.md`
- `critique.md`

Each step must stay grounded in real project context, accepted and dismissed theme history, and the supplied supporting content.

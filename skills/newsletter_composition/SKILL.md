---
name: newsletter-composition
description: Compose editor-ready newsletter drafts from accepted themes, ideas, and recent supporting content.
input: project_topic_description, themes, supporting_contents, original_pieces, style_examples, fallback_payload
output: title, intro, outro, section_title, lede, items, suggestions
---

This skill composes project-scoped newsletter drafts from already accepted editorial inputs.

The runtime flow uses three prompt resources under `resources/`:
- `section_composer.md`
- `intro_outro_composer.md`
- `coherence_pass.md`

Each step must stay grounded in real `ThemeSuggestion`, `OriginalContentIdea`, and `Content` rows. Never invent linked items or rewrite the draft from scratch when a lighter-touch edit suggestion is sufficient.

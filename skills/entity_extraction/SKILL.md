---
name: entity_extraction
input: title, content_text, project_id, tracked_entities
output: mentions, candidate_entities, explanation
---

Extract tracked-entity mentions from newsletter content and propose new entity candidates.

- Use `tracked_entities` as the only list of already-known entities.
- Return `mentions` as objects with `entity_name`, `span`, `sentiment`, `role`, and optional `confidence`.
- `role` must be one of `author`, `subject`, `quoted`, or `mentioned`.
- `sentiment` must be one of `positive`, `neutral`, or `negative`.
- Return unknown people, vendors, or organizations in `candidate_entities` as objects with `name` and `suggested_type`.
- `suggested_type` must be one of `individual`, `vendor`, or `organization`.

Return structured JSON only.
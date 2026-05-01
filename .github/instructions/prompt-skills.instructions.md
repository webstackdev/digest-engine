---
name: "Prompt Skill Markdown Guidelines"
description: "Use when editing application prompt skills in skills/**/SKILL.md. Covers custom frontmatter, runtime lookup behavior, and keeping VS Code's skill validator quiet."
applyTo:
  - "skills/**/SKILL.md"
---

# Prompt Skill Markdown Guidelines

- Files under `skills/**/SKILL.md` are application prompt specs loaded by `core/llm.py`, not Copilot repo skills under `.github/skills/`.
- The runtime skill key is the folder name, so keep folder names and code constants aligned with the app's expected key.
- Always include a short frontmatter `description` to avoid VS Code skill-schema warnings.
- If a frontmatter `name` is present, prefer lowercase letters, numbers, and hyphens so the Copilot validator stays quiet, even when the runtime key elsewhere in the app uses underscores.
- Preserve the repo's `input` and `output` frontmatter fields because `core/llm.py` reads them to build prompts.
- Keep the body concise and instruction-focused. Return-shape requirements should stay explicit in the markdown body.

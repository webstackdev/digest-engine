---
name: docstring-enforcer
description: "Use when adding or revising documentation for Python modules, classes, functions, Django admin or API code, or exported TypeScript and React utilities. Trigger phrases include docstring, JSDoc, document this file, improve docs, admindoc, and explain intent in code."
---

# Docstring Enforcer Skill

Use this skill for meaningful documentation work, not blanket boilerplate.

## Rules

- **Python:** Use Google-style docstrings and PEP 257 conventions.
- Add module docstrings for important runtime modules.
- Document public classes, public functions, and non-obvious helpers.
- Use `Args:`, `Returns:`, and `Raises:` only when they actually apply. Do not invent empty sections.
- Favor intent and workflow context over repeating the function name.
- Trivial dunder methods, obvious properties, and mechanical accessors may use a one-line docstring or no docstring when the code is already self-explanatory.
- **TypeScript/React:** Use JSDoc for exported utilities, hooks, route handlers, and non-trivial components when behavior is not obvious from types alone.
- Keep docs aligned with actual runtime behavior and field names.

## References

- Good backend examples live in `core/models.py`, `core/pipeline.py`, `core/tasks.py`, and `core/newsletters.py`.
- Use `docs/DEVELOPER_GUIDE.md` to understand where a file sits in the overall workflow before documenting it.
- Update nearby docs in `docs/` when the code change also changes architecture or workflow behavior.

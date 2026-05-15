# Contributing

## Branch Naming

Standard `feature/`, `bugfix/`, or `chore/` prefixes.

## Commit-Time Validation

You are expected to pass formatting and linting locally. Run:

```bash
just lint
```

This runs `ruff`, `pyright`, `eslint`, and typechecks via `tsc`.

## Instruction Files

This repository uses contextual instruction files to guide AI code generation natively in VS Code. If you are changing a core pattern, update the relevant file in `.github/instructions/`.

## Skills System

We maintain discrete prompt-files for LLM features under `skills/`.
If you are modifying how an AI feature works, edit the `SKILL.md` file rather than burying prompt text in Python strings. See `docs/reference/skills.md` for more info.

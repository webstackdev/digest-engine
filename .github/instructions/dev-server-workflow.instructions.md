---
name: "Local Dev Server Workflow"
description: "Use for all tasks. Covers local development server handling: do not start dev servers yourself by default, because the user usually has one running already. Ask the user to start the relevant server or confirm that none is running unless they explicitly request that you start it."
applyTo:
  - "**/*"
---

# Local Dev Server Workflow

- Do not start local development servers by default.
- Assume the user usually already has the relevant dev server running.
- Before running commands such as `pnpm dev`, `next dev`, `vite`, `npm run dev`, `just <app>-dev`, or similar long-lived local servers, ask the user to start the server or confirm that no server is already running.
- Only start a dev server yourself when the user explicitly asks you to do that.
- When you need runtime verification and no server is available, prefer asking the user to start the correct app server instead of launching one on their behalf.

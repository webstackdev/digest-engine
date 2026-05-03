---
name: newsletter_extraction
description: Extract ordered article candidates from a forwarded newsletter email.
input: subject, raw_html, raw_text
output: items
---

Extract the editorial article candidates from one forwarded newsletter email.

Return only JSON with an `items` array. Each item must contain:

- `url`: the canonical article URL
- `title`: a concise article title
- `excerpt`: a short excerpt or why-it-matters style summary from the newsletter body

Rules:

- Keep the original newsletter order.
- Ignore unsubscribe links, privacy links, share links, logo links, and obvious navigation links.
- Prefer article destinations over tracking or redirect wrappers when the destination is visible in the email body.
- Use the newsletter subject only when no better title is available.
- Return an empty `items` array when the email contains no article candidates.
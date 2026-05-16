# Home Page Copy

## Integration Section

**Section headline candidates:**

- Plug into the feeds you already trust.
- Six sources today. Plugin architecture for the rest.

**Lede:**

> Each source plugin implements a common interface (`fetch_new_content`, `get_entity_profile`, `health_check`) and handles its own auth and rate limiting. The core system just calls the interface — which means adding a new source is a contained piece of work, not a refactor.

**Today's integrations (grid of logos / cards):**

| Source | What it does for you |
| --- | --- |
| **RSS** | Tracks blogs and sites of every entity you follow. Still the backbone of the open web. |
| **Reddit** | Trend detection and community sentiment across subreddits you choose. |
| **Resend Inbound (Email)** | Newsletter ingestion. Forward peer newsletters to a project address, get authority signals back. |
| **Bluesky** | Entity content tracking via the open AT Protocol. |
| **Mastodon** | Entity content tracking via ActivityPub. |
| **LinkedIn** | Entity enrichment and article discovery. |

**On the roadmap / "ask us":**

- GitHub (releases, trending repos, individual maintainer activity)
- YouTube (channel monitoring, transcripts)
- Substack / Beehiiv direct ingestion
- Conference talk feeds (papers, slides, recordings)
- arXiv and academic preprint servers
- Your custom internal source (write a plugin in an afternoon)

**Tech stack badges (for footer-of-section credibility row):**

Django · DRF · Celery · Redis · PostgreSQL · Qdrant · LangGraph · Next.js · TanStack Query · Tailwind · shadcn/ui · Ollama · OpenRouter · Docker · Kubernetes · Helm · ArgoCD

---

## FAQ Section

**Section headline candidates:**

- Real questions from real editors.
- The honest FAQ.

---

**Q: Is this just ChatGPT wrapped in a UI?**
No. The core curation logic is deterministic vector similarity against your project's reference corpus. LLMs are only used to break ties in an explicit confidence band, to summarize, to extract entities, and to detect themes — each as a swappable, model-agnostic skill. If every LLM API went dark tomorrow, you'd still get ranked shortlists.

---

**Q: How is this different from Feedly / UpContent / ContentStudio?**
Three things they don't do:

1. **Authority scoring from peer newsletters.** We ingest other newsletters as a first-class source and build a trust graph from who real editors link to.
2. **Per-project taste training via explicit feedback.** Your thumbs-up/thumbs-down drifts a per-project reference centroid. Your shortlist genuinely changes over time. Theirs doesn't.
3. **A unified entity model.** One person, all their channels, one profile, one authority score.

We also retain content indefinitely for long-term trend analysis, where most tools time out after a week.

---

**Q: Do I need to know what a vector database is?**
No. You connect sources, flag reference articles, thumbs-up things you like. The vector database, the embedding pipeline, and the LangGraph orchestration are implementation details. The UI is built for editors, not ML engineers.

---

**Q: What about hallucinations?**
Summarization is grounded in the article text and the article text only. Relevance scoring is deterministic vector math, with LLMs only used in an explicit ambiguity band — and every score traces back to specific reference articles you flagged. Entity extraction surfaces low-confidence matches to a human review queue rather than silently writing bad data. Every skill invocation is logged with model, latency, and confidence.

---

**Q: Which LLM do you use?**
Whichever you want. Skills are model-agnostic and tested across Claude, GPT, Qwen, Llama, DeepSeek, Gemma, and Command R+. We recommend specific models per skill based on quality and cost (e.g., Qwen for structured extraction, Gemma for clean prose, DeepSeek for cross-document reasoning, Command R+ for production RAG scoring), but you can override per skill. In production you can run everything locally via Ollama for zero marginal LLM cost.

---

**Q: Can I self-host?**
Yes. Docker Compose for the MVP path, Kubernetes-ready (Helm + ArgoCD) for scale. The license is AGPLv3.

---

**Q: How much does it cost to run in development?**
If you use OpenRouter as a unified gateway across the recommended dev models, you'll spend roughly $2.30/month for a single active project. Self-hosted with Ollama, the marginal LLM cost is $0.

---

**Q: Does my content get sent to OpenAI / Anthropic / etc.?**
Only if you configure it to. The default development setup uses OpenRouter. The default production-recommended setup uses Ollama on your own infrastructure. No data flows to a third party unless you point a skill at a third-party model.

---

**Q: I don't run a newsletter. I just want to curate a Slack channel / internal digest / research feed. Does this work?**
Yes. A "newsletter project" is just a project-scoped curation pipeline. The draft assembly step is optional. You can use Digest Engine as a pure ranked-shortlist tool and ignore the email side entirely.

---

**Q: How does this handle paywalled or private content?**
Source plugins handle their own auth, including authenticated RSS, OAuth flows (Bluesky, LinkedIn, Mastodon), and email-based ingestion (newsletters). Anything you can read, the system can read on your behalf. Anything you can't, it can't.

---

**Q: How do I add a new source?**
Implement three methods on the source plugin interface: `fetch_new_content`, `get_entity_profile`, `health_check`. The core system handles scheduling, retry, error routing, and Qdrant writes. Adding a source is bounded work, not a refactor.

---

**Q: What if a skill fails mid-pipeline?**
The pipeline is a LangGraph state machine with checkpoints. A failed step records its failure status, the graph either gracefully degrades (e.g., falling back to baseline cosine score if the relevance LLM times out) or routes the item to the review queue. Nothing silently corrupts. Re-runs resume from the failed checkpoint.

---

**Q: Is there a hosted version?**
[Soon / waitlist / TBD — fill in based on launch plan.]

---

**Q: License?**
GNU AGPLv3 or later. Source is on GitHub.

---

## Closing CTA

**Headline candidates:**

- Your readers don't need another aggregator. They need *you*, on time, with the right stories.
- Spend the next four hours writing, not scrolling.
- Curate like the editors you respect.
- Bring your taste. We brought the infrastructure.

**Body copy options:**

- *Short:* Spin up a project in under an hour. Plug in your sources, flag a starter set of articles, and watch the first ranked shortlist land in your review queue.
- *Medium:* Digest Engine is open source under AGPLv3. Self-host it, run it against your own models, and own your curation stack end to end. Or join the hosted waitlist and we'll do the ops part for you.
- *Long:* You already have the taste. You already have the audience. The thing you don't have is six hours every week to read the entire internet. Digest Engine is that six hours, automated — ranked against your editorial judgment, not somebody else's trending algorithm. Start a project, point it at your sources, and let the next issue research itself.

**Primary CTA candidates:**

- Start your first project
- Self-host it now (GitHub)
- Join the hosted waitlist
- Talk to the team

**Secondary CTA candidates:**

- Read the docs
- See the architecture
- View the source on GitHub

**Reassurance microcopy (under the CTA):**

- Open source. Self-hostable. AGPLv3.
- Bring your own models. Bring your own taste.
- No credit card. No data leaves your stack unless you point it somewhere.

---

## Misc. raw material (pull quotes, taglines, footer copy, social cards)

**One-line elevator pitches:**

- "An AI research desk for the editor of a technical newsletter."
- "Curation tooling that knows the difference between trending and credible."
- "Project-scoped content intelligence for newsletters that need to be right."
- "We ingest the firehose. You ship the issue."

**Pull-quote candidates (for testimonial slots, once we have testimonials):**

- "I stopped opening my feed reader. The shortlist is just better."
- "Authority scoring is the feature I didn't know I needed until I had it."
- "It learned my taste in two weeks. I haven't dragged a link into a Notion doc since."

**Social/OG card lines:**

- "Digest Engine — the research desk for your newsletter."
- "Stop scrolling. Start shipping."
- "Curation, scored against your taste."

**Footer copy / sub-hero credibility row:**

- Open source · AGPLv3 · Self-hostable · Bring your own models · Built for editors, not ML engineers

**Numbers / proof points to lean on once we have them:**

- "Ingests N sources per project on a configurable schedule."
- "Embedded, scored, deduped, summarized, and ranked in under N seconds per item."
- "Used to curate N newsletters covering [domain list]."
- "$2.30/month average dev-time LLM cost via OpenRouter."

**Glossary cheat-sheet for marketing site footer / docs links:**

- **Project:** A single newsletter or curation workspace, with its own sources, entities, and taste model.
- **Entity:** A person or organization the project tracks across every channel they post on.
- **Authority Score:** A decay-weighted measure of how often a trusted source links to or mentions an entity.
- **Reference Article:** A piece of content you flagged as "this is the kind of thing we cover." Used to score every new candidate.
- **Skill:** A standalone, model-agnostic AI capability (e.g., Summarization, Relevance Scoring) with a defined input/output contract.
- **Review Queue:** Where the system parks low-confidence decisions for human resolution.
- **Theme:** A cluster of related, accelerating content proposed as a newsletter section.

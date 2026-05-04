# Data Model

This document outlines the core domain entities mapping to the database, ensuring developers understand the relational boundaries and project-scoping invariants.

## Model Diagram
*(Future: Add Mermaid ER diagram for visual reference)*

## Per-App Model List

| App | Model | Description |
| --- | --- | --- |
| **`users`** | `AppUser` | The project's custom user model, with profile fields and avatar metadata layered onto Django's historical auth tables. |
| `users` | `MembershipInvitation` | Invite one email address into a project with a predefined role and one-time redemption token. |
| **`projects`** | `Project` | Top-level workspace for one newsletter topic, scoped through project memberships rather than a legacy Django group. |
| `projects` | `ProjectMembership` | Join table assigning one user a per-project role such as admin, member, or reader. |
| `projects` | `ProjectConfig` | Per-project tuning values for authority weighting, decay, and topic-centroid recomputation. |
| `projects` | `SourceConfig` | Per-project configuration for each ingestion plugin (RSS, Reddit), including activation state and fetch configuration. |
| `projects` | `BlueskyCredentials` | Stored account credentials and verification state for a single project's Bluesky plugin. |
| **`content`** | `Content` | The canonical record for ingested articles or posts, including source metadata, extracted text, relevance scoring, embeddings, and entity association. |
| `content` | `UserFeedback` | Explicit upvote or downvote feedback on a content item, used to capture editorial preference signals. |
| **`ingestion`** | `IngestionRun` | Audit/log record for an ingestion execution, tracking plugin, timing, item counts, status, and failure messages. |
| **`entities`** | `Entity` | A person, vendor, or organization tracked within a project to associate content with a known source or subject. |
| `entities` | `EntityAuthoritySnapshot` | One persisted authority-score recomputation for a tracked entity. |
| `entities` | `EntityMention` | A detected mention of a tracked entity inside one content item, including role and sentiment metadata. |
| `entities` | `EntityCandidate` | An extracted named entity awaiting acceptance, rejection, or merge into an existing tracked entity. |
| **`newsletters`** | `IntakeAllowlist` | Approved sender list for project newsletter intake; confirming who can submit inbound newsletter emails. |
| `newsletters` | `NewsletterIntake` | Raw inbound newsletter email captured before and after extraction, holding subject, body, status, and errors. |
| **`pipeline`** | `PipelineRun` | Audit model for an execution round through LangGraph. |
| `pipeline` | `SkillResult` | Output record for an enrichment skill run, storing status, payload, confidence, latency, and model metadata. |
| `pipeline` | `ReviewQueue` | Human review item created for content needing manual judgment (e.g., borderline relevance). |
| **`trends`** | `ThemeSuggestion` | Clustered topic trends presented to human editors for newsletter inclusion. |
| `trends` | `TopicCentroidSnapshot` | One snapshot of the project's feedback-weighted topic centroid and its drift metrics. |
| `trends` | `OriginalContentIdea` | Auto-generated suggestions for topics the editor should write original content about. |

## Project-Scoping Invariants

By architectural rule, almost every model (except `AppUser`) belongs securely to a specific `Project` (e.g., via `project_id`). This scoping is heavily enforced at the API layer (refer to `developer-guide/backend-conventions.md`).

- Never execute unbounded or unscoped wide queries out of the API.
- All relationships crossing between `content`, `entities`, `newsletters`, and `pipeline` models must enforce that the foreign keys belong to the *same* `Project`.

## Key Indexes

- `project_id` scoping indexes exist uniformly.
- **Qdrant Vector Index**: Content embeddings are maintained synchronously alongside Postgres data, identified by string UUIDs linking `Content.id` into the Qdrant document payload. Project ID is routinely attached to vector payloads to allow tenant-safe cosine similarity searches.

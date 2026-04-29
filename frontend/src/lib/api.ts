import "server-only"

import { getServerSession } from "next-auth"
import { cache } from "react"

import { authOptions } from "@/lib/auth"
import type {
  BlueskyCredentials,
  Content,
  ContentSkillName,
  Entity,
  EntityAuthoritySnapshot,
  EntityCandidate,
  IngestionRun,
  IntakeAllowlistEntry,
  NewsletterIntake,
  Project,
  ProjectBlueskyVerification,
  ReviewQueueItem,
  SkillResult,
  SourceConfig,
  TopicCentroidObservabilitySummary,
  TopicCentroidSnapshot,
  UserFeedback,
} from "@/lib/types"

const API_BASE_URL =
  process.env.NEWSLETTER_API_BASE_URL ?? "http://127.0.0.1:8080"

type SessionWithBackendAuth = {
  backendAuth?: {
    access?: string
    key?: string
  }
}

/**
 * Build the fallback Basic auth header used outside authenticated editor sessions.
 *
 * The frontend uses this path for local or service-account style access when the
 * current NextAuth session does not expose backend API credentials.
 *
 * @returns A fully formed Basic auth header.
 * @throws If the frontend username or password environment variables are missing.
 * @example
 * ```ts
 * const header = getBasicAuthHeader()
 * ```
 */
function getBasicAuthHeader() {
  const username = process.env.NEWSLETTER_API_USERNAME
  const password = process.env.NEWSLETTER_API_PASSWORD

  if (!username || !password) {
    throw new Error(
      "NEWSLETTER_API_USERNAME and NEWSLETTER_API_PASSWORD must be set for the frontend. Copy frontend/.env.example to frontend/.env.local when running Next.js outside Docker.",
    )
  }

  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
}

/**
 * Resolve a relative API path against the configured backend base URL.
 *
 * @param path - Relative backend path such as `/api/v1/projects/`.
 * @returns An absolute backend URL.
 */
function buildUrl(path: string) {
  return new URL(path, API_BASE_URL).toString()
}

/**
 * Choose the best available backend authorization mechanism for the request.
 *
 * The preference order is token auth, then bearer auth, then fallback Basic auth.
 * This keeps editor sessions aligned with backend auth while still supporting
 * local development outside the full auth flow.
 *
 * @returns An Authorization header value accepted by the Django API.
 * @example
 * ```ts
 * const authorization = await getAuthorizationHeader()
 * ```
 */
async function getAuthorizationHeader() {
  const session = (await getServerSession(authOptions)) as SessionWithBackendAuth | null

  if (session?.backendAuth?.key) {
    return `Token ${session.backendAuth.key}`
  }

  if (session?.backendAuth?.access) {
    return `Bearer ${session.backendAuth.access}`
  }

  return getBasicAuthHeader()
}

/**
 * Normalize a raw response body for inclusion in thrown error messages.
 *
 * Empty strings stay empty after trimming. Long or multi-line bodies are collapsed
 * to a short single-line preview so fetch errors stay readable in logs and UI.
 *
 * @param text - Raw response body text. Empty strings are allowed.
 * @returns A compact single-line preview string.
 */
function previewResponseBody(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 240)
}

/**
 * Perform an authenticated request against the Django API and normalize responses.
 *
 * `204 No Content` and successful empty bodies resolve to `undefined`. Successful
 * non-JSON responses and invalid JSON payloads throw explicit errors because the
 * rest of the frontend expects JSON from this shared transport layer.
 *
 * @typeParam T - Expected JSON response shape.
 * @param path - Relative backend path such as `/api/v1/projects/`.
 * @param init - Optional fetch configuration. Custom headers are merged with the
 * default authorization and JSON content type headers.
 * @returns The parsed JSON payload, or `undefined` for empty successful responses.
 * @throws If auth configuration is missing, the backend returns a non-OK response,
 * or the successful response is not valid JSON.
 * @example
 * ```ts
 * const projects = await apiFetch<Project[]>("/api/v1/projects/")
 * ```
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const authorization = await getAuthorizationHeader()

  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  })

  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get("content-type") ?? ""
  const text = await response.text()
  if (!response.ok) {
    throw new Error(
      `API request failed (${response.status}) from ${buildUrl(path)} with ${contentType || "unknown content type"}: ${previewResponseBody(text)}`,
    )
  }

  if (!text) {
    return undefined as T
  }

  if (!contentType.includes("json")) {
    throw new Error(
      `API request to ${buildUrl(path)} returned ${contentType || "unknown content type"} instead of JSON: ${previewResponseBody(text)}`,
    )
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(
      `API request to ${buildUrl(path)} returned invalid JSON: ${previewResponseBody(text)}`,
    )
  }
}

/**
 * Fetch the list of projects visible to the current frontend user.
 *
 * @returns All accessible projects for the authenticated or fallback API user.
 * @example
 * ```ts
 * const projects = await getProjects()
 * ```
 */
export const getProjects = cache(
  async (): Promise<Project[]> => apiFetch<Project[]>("/api/v1/projects/"),
)

/**
 * Partially update one project record.
 *
 * This helper is currently used for project-level intake settings surfaced in the
 * custom admin UI. The payload shape stays aligned with the backend project
 * serializer so future project settings can reuse the same transport.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @param payload - Partial project fields accepted by the backend serializer.
 * @returns The updated project record.
 * @example
 * ```ts
 * await updateProject(4, { intake_enabled: true })
 * ```
 */
export async function updateProject(
  projectId: number,
  payload: Partial<
    Pick<
      Project,
      "name" | "group" | "topic_description" | "content_retention_days" | "intake_enabled"
    >
  >,
): Promise<Project> {
  return apiFetch<Project>(`/api/v1/projects/${projectId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

/**
 * Rotate the newsletter intake token for one project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @returns The updated project payload containing the new intake token.
 */
export async function rotateProjectIntakeToken(
  projectId: number,
): Promise<Project> {
  return apiFetch<Project>(`/api/v1/projects/${projectId}/rotate-intake-token/`, {
    method: "POST",
  })
}

/**
 * Verify the stored Bluesky credentials for one project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @returns Verification status details for the stored Bluesky account.
 * @example
 * ```ts
 * const result = await verifyProjectBlueskyCredentials(4)
 * ```
 */
export async function verifyProjectBlueskyCredentials(
  projectId: number,
): Promise<ProjectBlueskyVerification> {
  return apiFetch<ProjectBlueskyVerification>(
    `/api/v1/projects/${projectId}/verify-bluesky-credentials/`,
    {
      method: "POST",
    },
  )
}

/**
 * Fetch stored Bluesky credentials for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @returns Zero or one stored Bluesky credential rows for the project.
 */
export async function getProjectBlueskyCredentials(
  projectId: number,
): Promise<BlueskyCredentials[]> {
  return apiFetch<BlueskyCredentials[]>(
    `/api/v1/projects/${projectId}/bluesky-credentials/`,
  )
}

/**
 * Create Bluesky credentials for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @param payload - Credential fields accepted by the backend serializer.
 * @returns The created Bluesky credentials row.
 */
export async function createProjectBlueskyCredentials(
  projectId: number,
  payload: {
    handle: string
    pds_url: string
    is_active: boolean
    app_password: string
  },
): Promise<BlueskyCredentials> {
  return apiFetch<BlueskyCredentials>(
    `/api/v1/projects/${projectId}/bluesky-credentials/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  )
}

/**
 * Update stored Bluesky credentials for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @param credentialId - Numeric credential identifier inside the project.
 * @param payload - Partial credential fields accepted by the backend serializer.
 * @returns The updated Bluesky credentials row.
 */
export async function updateProjectBlueskyCredentials(
  projectId: number,
  credentialId: number,
  payload: Partial<{
    handle: string
    pds_url: string
    is_active: boolean
    app_password: string
  }>,
): Promise<BlueskyCredentials> {
  return apiFetch<BlueskyCredentials>(
    `/api/v1/projects/${projectId}/bluesky-credentials/${credentialId}/`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  )
}

/**
 * Fetch all content rows for a project dashboard.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @returns The project's content list. Empty projects return an empty array.
 * @example
 * ```ts
 * const contents = await getProjectContents(4)
 * ```
 */
export async function getProjectContents(projectId: number): Promise<Content[]> {
  return apiFetch<Content[]>(`/api/v1/projects/${projectId}/contents/`)
}

/**
 * Fetch a single content row for the content detail page.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @param contentId - Numeric content identifier inside the project.
 * @returns The requested content record.
 * @example
 * ```ts
 * const content = await getProjectContent(4, 12)
 * ```
 */
export async function getProjectContent(
  projectId: number,
  contentId: number,
): Promise<Content> {
  return apiFetch<Content>(`/api/v1/projects/${projectId}/contents/${contentId}/`)
}

/**
 * Fetch tracked entities for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @returns The project's tracked entities. Empty projects return an empty array.
 * @example
 * ```ts
 * const entities = await getProjectEntities(4)
 * ```
 */
export async function getProjectEntities(projectId: number): Promise<Entity[]> {
  return apiFetch<Entity[]>(
    `/api/v1/projects/${projectId}/entities/?ordering=-authority_score`,
  )
}

/**
 * Fetch a single tracked entity for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @param entityId - Numeric entity identifier inside the project.
 * @returns The requested entity record.
 * @example
 * ```ts
 * const entity = await getProjectEntity(4, 9)
 * ```
 */
export async function getProjectEntity(
  projectId: number,
  entityId: number,
): Promise<Entity> {
  return apiFetch<Entity>(`/api/v1/projects/${projectId}/entities/${entityId}/`)
}

/**
 * Fetch the extracted mention history for one tracked entity.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @param entityId - Numeric entity identifier inside the project.
 * @returns The extracted mention history for the requested entity.
 * @example
 * ```ts
 * const mentions = await getProjectEntityMentions(4, 9)
 * ```
 */
export async function getProjectEntityMentions(
  projectId: number,
  entityId: number,
) {
  return apiFetch<Entity["latest_mentions"]>(
    `/api/v1/projects/${projectId}/entities/${entityId}/mentions/`,
  )
}

/**
 * Fetch persisted authority-score history for one tracked entity.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @param entityId - Numeric entity identifier inside the project.
 * @param limit - Maximum number of recent snapshots to fetch.
 * @returns Recent authority snapshots for the requested entity.
 * @example
 * ```ts
 * const history = await getProjectEntityAuthorityHistory(4, 9, 12)
 * ```
 */
export async function getProjectEntityAuthorityHistory(
  projectId: number,
  entityId: number,
  limit = 12,
): Promise<EntityAuthoritySnapshot[]> {
  return apiFetch<EntityAuthoritySnapshot[]>(
    `/api/v1/projects/${projectId}/entities/${entityId}/authority_history/?limit=${limit}`,
  )
}

/**
 * Fetch entity candidates awaiting review for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @returns Pending and resolved entity candidates visible for the project.
 * @example
 * ```ts
 * const candidates = await getProjectEntityCandidates(4)
 * ```
 */
export async function getProjectEntityCandidates(
  projectId: number,
): Promise<EntityCandidate[]> {
  return apiFetch<EntityCandidate[]>(
    `/api/v1/projects/${projectId}/entity-candidates/`,
  )
}

/**
 * Fetch persisted AI skill results for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @returns All skill results currently visible for the project.
 * @example
 * ```ts
 * const results = await getProjectSkillResults(4)
 * ```
 */
export async function getProjectSkillResults(
  projectId: number,
): Promise<SkillResult[]> {
  return apiFetch<SkillResult[]>(`/api/v1/projects/${projectId}/skill-results/`)
}

/**
 * Fetch skill results and keep only those attached to one content item.
 *
 * If the project has no matching skill results for the content item, this returns
 * an empty array rather than throwing.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @param contentId - Numeric content identifier used to filter the project results.
 * @returns Skill results whose `content` field matches the requested content item.
 * @example
 * ```ts
 * const results = await getContentSkillResults(4, 12)
 * ```
 */
export async function getContentSkillResults(
  projectId: number,
  contentId: number,
): Promise<SkillResult[]> {
  const skillResults = await getProjectSkillResults(projectId)
  return skillResults.filter((skillResult) => skillResult.content === contentId)
}

/**
 * Fetch the review queue for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @returns Review items awaiting or recording manual decisions.
 * @example
 * ```ts
 * const reviewQueue = await getProjectReviewQueue(4)
 * ```
 */
export async function getProjectReviewQueue(
  projectId: number,
): Promise<ReviewQueueItem[]> {
  return apiFetch<ReviewQueueItem[]>(
    `/api/v1/projects/${projectId}/review-queue/`,
  )
}

/**
 * Fetch ingestion-run history for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @returns Ingestion audit rows for the project.
 * @example
 * ```ts
 * const runs = await getProjectIngestionRuns(4)
 * ```
 */
export async function getProjectIngestionRuns(
  projectId: number,
): Promise<IngestionRun[]> {
  return apiFetch<IngestionRun[]>(`/api/v1/projects/${projectId}/ingestion-runs/`)
}

/**
 * Fetch newsletter sender allowlist entries for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @returns Allowlist rows for the selected project's intake workflow.
 */
export async function getProjectIntakeAllowlist(
  projectId: number,
): Promise<IntakeAllowlistEntry[]> {
  return apiFetch<IntakeAllowlistEntry[]>(
    `/api/v1/projects/${projectId}/intake-allowlist/`,
  )
}

/**
 * Create a newsletter sender allowlist entry for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @param senderEmail - Sender email address to allowlist.
 * @returns The created allowlist entry.
 */
export async function createProjectIntakeAllowlistEntry(
  projectId: number,
  senderEmail: string,
): Promise<IntakeAllowlistEntry> {
  return apiFetch<IntakeAllowlistEntry>(
    `/api/v1/projects/${projectId}/intake-allowlist/`,
    {
      method: "POST",
      body: JSON.stringify({ sender_email: senderEmail }),
    },
  )
}

/**
 * Delete a newsletter sender allowlist entry from a project.
 *
 * @param allowlistId - Numeric allowlist identifier to remove.
 * @param projectId - Numeric project identifier from the Django API.
 * @returns `undefined` when the deletion succeeds.
 */
export async function deleteProjectIntakeAllowlistEntry(
  allowlistId: number,
  projectId: number,
) {
  return apiFetch(
    `/api/v1/projects/${projectId}/intake-allowlist/${allowlistId}/`,
    {
      method: "DELETE",
    },
  )
}

/**
 * Fetch recent newsletter intake rows for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @returns Inbound newsletter rows already captured for the project.
 */
export async function getProjectNewsletterIntakes(
  projectId: number,
): Promise<NewsletterIntake[]> {
  return apiFetch<NewsletterIntake[]>(
    `/api/v1/projects/${projectId}/newsletter-intakes/`,
  )
}

/**
 * Fetch source-plugin configurations for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @returns Saved source configs for the project.
 * @example
 * ```ts
 * const sources = await getProjectSourceConfigs(4)
 * ```
 */
export async function getProjectSourceConfigs(
  projectId: number,
): Promise<SourceConfig[]> {
  return apiFetch<SourceConfig[]>(`/api/v1/projects/${projectId}/source-configs/`)
}

/**
 * Fetch project-level centroid observability metrics for the admin health page.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @returns Aggregate centroid drift metrics plus the latest persisted snapshot.
 * @example
 * ```ts
 * const summary = await getProjectTopicCentroidSummary(4)
 * ```
 */
export async function getProjectTopicCentroidSummary(
  projectId: number,
): Promise<TopicCentroidObservabilitySummary> {
  return apiFetch<TopicCentroidObservabilitySummary>(
    `/api/v1/projects/${projectId}/topic-centroid-snapshots/summary/`,
  )
}

/**
 * Fetch persisted topic centroid snapshots for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @returns Persisted centroid snapshots for the project.
 * @example
 * ```ts
 * const snapshots = await getProjectTopicCentroidSnapshots(4)
 * ```
 */
export async function getProjectTopicCentroidSnapshots(
  projectId: number,
): Promise<TopicCentroidSnapshot[]> {
  return apiFetch<TopicCentroidSnapshot[]>(
    `/api/v1/projects/${projectId}/topic-centroid-snapshots/`,
  )
}

/**
 * Fetch feedback rows recorded for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @returns Existing user feedback rows for the project.
 * @example
 * ```ts
 * const feedback = await getProjectFeedback(4)
 * ```
 */
export async function getProjectFeedback(
  projectId: number,
): Promise<UserFeedback[]> {
  return apiFetch<UserFeedback[]>(`/api/v1/projects/${projectId}/feedback/`)
}

/**
 * Create a feedback signal for one content item.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @param contentId - Numeric content identifier receiving the feedback.
 * @param feedbackType - Direction of the editorial signal.
 * @returns The created feedback payload from the backend.
 * @example
 * ```ts
 * await createFeedback(4, 12, "upvote")
 * ```
 */
export async function createFeedback(
  projectId: number,
  contentId: number,
  feedbackType: "upvote" | "downvote",
) {
  return apiFetch(`/api/v1/projects/${projectId}/feedback/`, {
    method: "POST",
    body: JSON.stringify({ content: contentId, feedback_type: feedbackType }),
  })
}

/**
 * Create a tracked entity inside a project.
 *
 * Empty optional profile fields should be passed as empty strings so the payload
 * matches the Django serializer's current shape.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @param payload - Entity fields expected by the backend serializer.
 * @returns The created entity payload from the backend.
 * @example
 * ```ts
 * await createEntity(4, {
 *   name: "Example Vendor",
 *   type: "vendor",
 *   description: "",
 *   website_url: "https://example.com",
 *   github_url: "",
 *   linkedin_url: "",
 *   bluesky_handle: "",
 *   mastodon_handle: "",
 *   twitter_handle: "",
 * })
 * ```
 */
export async function createEntity(
  projectId: number,
  payload: {
    name: string
    type: string
    description: string
    website_url: string
    github_url: string
    linkedin_url: string
    bluesky_handle: string
    mastodon_handle: string
    twitter_handle: string
  },
) {
  return apiFetch(`/api/v1/projects/${projectId}/entities/`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

/**
 * Partially update an entity record within a project.
 *
 * @param entityId - Numeric entity identifier to update.
 * @param projectId - Numeric project identifier from the Django API.
 * @param payload - Partial serializer payload. Empty objects are allowed but have
 * no practical effect.
 * @returns The updated entity payload from the backend.
 * @example
 * ```ts
 * await updateEntity(9, 4, { description: "Updated description" })
 * ```
 */
export async function updateEntity(
  entityId: number,
  projectId: number,
  payload: Record<string, unknown>,
) {
  return apiFetch(`/api/v1/projects/${projectId}/entities/${entityId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

/**
 * Delete an entity from a project.
 *
 * The backend currently answers deletes with `204 No Content`, so this resolves to
 * `undefined` on success.
 *
 * @param entityId - Numeric entity identifier to delete.
 * @param projectId - Numeric project identifier from the Django API.
 * @returns `undefined` when the deletion succeeds.
 * @example
 * ```ts
 * await deleteEntity(9, 4)
 * ```
 */
export async function deleteEntity(entityId: number, projectId: number) {
  return apiFetch(`/api/v1/projects/${projectId}/entities/${entityId}/`, {
    method: "DELETE",
  })
}

/**
 * Accept an extracted entity candidate for a project.
 *
 * @param candidateId - Numeric candidate identifier to accept.
 * @param projectId - Numeric project identifier from the Django API.
 * @returns The updated entity-candidate payload.
 */
export async function acceptEntityCandidate(
  candidateId: number,
  projectId: number,
) {
  return apiFetch<EntityCandidate>(
    `/api/v1/projects/${projectId}/entity-candidates/${candidateId}/accept/`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  )
}

/**
 * Reject an extracted entity candidate for a project.
 *
 * @param candidateId - Numeric candidate identifier to reject.
 * @param projectId - Numeric project identifier from the Django API.
 * @returns The updated entity-candidate payload.
 */
export async function rejectEntityCandidate(
  candidateId: number,
  projectId: number,
) {
  return apiFetch<EntityCandidate>(
    `/api/v1/projects/${projectId}/entity-candidates/${candidateId}/reject/`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  )
}

/**
 * Merge an extracted entity candidate into an existing tracked entity.
 *
 * @param candidateId - Numeric candidate identifier to merge.
 * @param projectId - Numeric project identifier from the Django API.
 * @param mergedInto - Numeric tracked-entity identifier that will absorb the candidate.
 * @returns The updated entity-candidate payload.
 */
export async function mergeEntityCandidate(
  candidateId: number,
  projectId: number,
  mergedInto: number,
) {
  return apiFetch<EntityCandidate>(
    `/api/v1/projects/${projectId}/entity-candidates/${candidateId}/merge/`,
    {
      method: "POST",
      body: JSON.stringify({ merged_into: mergedInto }),
    },
  )
}

/**
 * Create a source-plugin configuration for a project.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @param payload - Source configuration fields expected by the backend serializer.
 * @returns The created source-config payload from the backend.
 * @example
 * ```ts
 * await createSourceConfig(4, {
 *   plugin_name: "rss",
 *   config: { feed_url: "https://example.com/feed.xml" },
 *   is_active: true,
 * })
 * ```
 */
export async function createSourceConfig(
  projectId: number,
  payload: {
    plugin_name: string
    config: Record<string, unknown>
    is_active: boolean
  },
) {
  return apiFetch(`/api/v1/projects/${projectId}/source-configs/`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

/**
 * Partially update a source-plugin configuration.
 *
 * @param sourceConfigId - Numeric source-config identifier to update.
 * @param projectId - Numeric project identifier from the Django API.
 * @param payload - Partial serializer payload for the source config.
 * @returns The updated source-config payload from the backend.
 * @example
 * ```ts
 * await updateSourceConfig(5, 4, { is_active: false })
 * ```
 */
export async function updateSourceConfig(
  sourceConfigId: number,
  projectId: number,
  payload: Record<string, unknown>,
) {
  return apiFetch(
    `/api/v1/projects/${projectId}/source-configs/${sourceConfigId}/`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  )
}

/**
 * Partially update a review-queue item.
 *
 * @param reviewId - Numeric review-queue identifier to update.
 * @param projectId - Numeric project identifier from the Django API.
 * @param payload - Partial review-queue payload, such as resolution fields.
 * @returns The updated review-queue payload from the backend.
 * @example
 * ```ts
 * await updateReviewQueueItem(7, 4, { resolved: true, resolution: "human_approved" })
 * ```
 */
export async function updateReviewQueueItem(
  reviewId: number,
  projectId: number,
  payload: Record<string, unknown>,
) {
  return apiFetch(`/api/v1/projects/${projectId}/review-queue/${reviewId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

/**
 * Trigger one ad hoc content skill for a content item.
 *
 * The backend may execute some skills immediately and queue others, but the shared
 * frontend caller always receives a `SkillResult` payload.
 *
 * @param projectId - Numeric project identifier from the Django API.
 * @param contentId - Numeric content identifier receiving the skill run.
 * @param skillName - Supported backend skill name.
 * @returns The resulting skill record returned by the backend.
 * @example
 * ```ts
 * await runContentSkill(4, 12, "summarization")
 * ```
 */
export async function runContentSkill(
  projectId: number,
  contentId: number,
  skillName: ContentSkillName,
) {
  return apiFetch<SkillResult>(
    `/api/v1/projects/${projectId}/contents/${contentId}/skills/${skillName}/`,
    {
      method: "POST",
    },
  )
}

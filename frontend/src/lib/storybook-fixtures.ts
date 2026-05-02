import type {
  Content,
  IngestionRun,
  OriginalContentIdea,
  Project,
  SourceConfig,
  SourceDiversityObservabilitySummary,
  SourceDiversitySnapshot,
  ThemeSuggestion,
  TopicCentroidObservabilitySummary,
  TopicCentroidSnapshot,
  TopicCluster,
  TopicClusterDetail,
  TopicVelocitySnapshot,
} from "@/lib/types"

/**
 * Build a representative project fixture for Storybook stories.
 *
 * @param overrides - Partial project fields to override.
 * @returns A backend-shaped project payload.
 */
export function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: "AI Weekly",
    topic_description: "AI news",
    content_retention_days: 30,
    user_role: "admin",
    created_at: "2026-04-01T00:00:00Z",
    ...overrides,
  }
}

/**
 * Build a representative content fixture for Storybook stories.
 *
 * @param overrides - Partial content fields to override.
 * @returns A backend-shaped content payload.
 */
export function createContent(overrides: Partial<Content> = {}): Content {
  return {
    id: 41,
    project: 1,
    url: "https://example.com/post",
    title: "Useful AI briefing",
    author: "Ada",
    entity: null,
    source_plugin: "rss",
    content_type: "article",
    canonical_url: "https://example.com/post",
    published_date: "2026-04-28T09:00:00Z",
    ingested_at: "2026-04-28T10:00:00Z",
    content_text: "A long article body for the dashboard preview.",
    relevance_score: 0.84,
    authority_adjusted_score: 0.88,
    embedding_id: "embed-1",
    duplicate_of: null,
    duplicate_signal_count: 0,
    is_reference: false,
    is_active: true,
    newsletter_promotion_at: null,
    newsletter_promotion_by: null,
    newsletter_promotion_theme: null,
    ...overrides,
  }
}

/**
 * Build a topic velocity snapshot fixture for Storybook stories.
 *
 * @param overrides - Partial velocity snapshot fields to override.
 * @returns A backend-shaped topic velocity snapshot.
 */
export function createTopicVelocitySnapshot(
  overrides: Partial<TopicVelocitySnapshot> = {},
): TopicVelocitySnapshot {
  return {
    id: 11,
    cluster: 5,
    project: 1,
    computed_at: "2026-04-28T08:00:00Z",
    window_count: 4,
    trailing_mean: 1.8,
    trailing_stddev: 0.9,
    z_score: 1.7,
    velocity_score: 0.81,
    ...overrides,
  }
}

/**
 * Build a topic cluster fixture for Storybook stories.
 *
 * @param overrides - Partial topic cluster fields to override.
 * @returns A backend-shaped topic cluster payload.
 */
export function createTopicCluster(
  overrides: Partial<TopicCluster> = {},
): TopicCluster {
  return {
    id: 5,
    project: 1,
    centroid_vector_id: "cluster-1",
    label: "Platform Signals",
    first_seen_at: "2026-04-26T08:00:00Z",
    last_seen_at: "2026-04-28T08:00:00Z",
    is_active: true,
    member_count: 3,
    dominant_entity: {
      id: 3,
      name: "OpenAI",
      type: "vendor",
    },
    velocity_score: 0.81,
    z_score: 1.7,
    window_count: 4,
    velocity_computed_at: "2026-04-28T08:00:00Z",
    ...overrides,
  }
}

/**
 * Build a topic cluster detail fixture for Storybook stories.
 *
 * @param overrides - Partial topic cluster detail fields to override.
 * @returns A backend-shaped topic cluster detail payload.
 */
export function createTopicClusterDetail(
  overrides: Partial<TopicClusterDetail> = {},
): TopicClusterDetail {
  const baseContent = createContent()

  return {
    ...createTopicCluster(),
    memberships: [
      {
        id: 10,
        content: {
          id: baseContent.id,
          url: baseContent.url,
          title: baseContent.title,
          published_date: baseContent.published_date,
          source_plugin: baseContent.source_plugin,
        },
        similarity: 0.92,
        assigned_at: "2026-04-28T10:00:00Z",
      },
    ],
    velocity_history: [
      createTopicVelocitySnapshot({
        id: 11,
        computed_at: "2026-04-25T08:00:00Z",
        velocity_score: 0.32,
      }),
      createTopicVelocitySnapshot({
        id: 12,
        computed_at: "2026-04-26T08:00:00Z",
        velocity_score: 0.48,
      }),
      createTopicVelocitySnapshot({
        id: 13,
        computed_at: "2026-04-27T08:00:00Z",
        velocity_score: 0.64,
      }),
      createTopicVelocitySnapshot(),
    ],
    ...overrides,
  }
}

/**
 * Build a theme suggestion fixture for Storybook stories.
 *
 * @param overrides - Partial theme suggestion fields to override.
 * @returns A backend-shaped theme suggestion payload.
 */
export function createThemeSuggestion(
  overrides: Partial<ThemeSuggestion> = {},
): ThemeSuggestion {
  return {
    id: 7,
    project: 1,
    cluster: {
      id: 5,
      label: "Platform Signals",
      member_count: 3,
      velocity_score: 0.81,
    },
    title: "Track the platform agent shift",
    pitch: "Editors should cover how vendors are reshaping platform work with agent runtimes.",
    why_it_matters: "The cluster is accelerating across multiple source plugins and now includes authority-weighted content from core project entities.",
    suggested_angle: "Compare the operational promises with the teams now absorbing integration complexity.",
    velocity_at_creation: 0.81,
    novelty_score: 0.74,
    status: "pending",
    dismissal_reason: "",
    created_at: "2026-04-28T11:00:00Z",
    decided_at: null,
    decided_by: null,
    decided_by_username: null,
    promoted_contents: [],
    ...overrides,
  }
}

/**
 * Build an original-content idea fixture for Storybook stories.
 *
 * @param overrides - Partial idea fields to override.
 * @returns A backend-shaped original-content idea payload.
 */
export function createOriginalContentIdea(
  overrides: Partial<OriginalContentIdea> = {},
): OriginalContentIdea {
  const baseContent = createContent()

  return {
    id: 9,
    project: 1,
    angle_title: "Explain the operator gap",
    summary: "Show where platform promises are outpacing the teams expected to maintain them.",
    suggested_outline: "1. Why this cluster is accelerating\n2. What operators are being asked to absorb\n3. Where editors can add distinct reporting",
    why_now: "The idea is tied to a rising cluster with low coverage from the project’s most authoritative entities.",
    supporting_contents: [
      {
        id: baseContent.id,
        url: baseContent.url,
        title: baseContent.title,
        published_date: baseContent.published_date,
        source_plugin: baseContent.source_plugin,
      },
    ],
    related_cluster: {
      id: 5,
      label: "Platform Signals",
      member_count: 3,
    },
    generated_by_model: "deepseek-v3",
    self_critique_score: 0.78,
    status: "pending",
    dismissal_reason: "",
    created_at: "2026-04-28T12:00:00Z",
    decided_at: null,
    decided_by: null,
    decided_by_username: null,
    ...overrides,
  }
}

/**
 * Build a topic centroid snapshot fixture for Storybook stories.
 *
 * @param overrides - Partial centroid snapshot fields to override.
 * @returns A backend-shaped topic centroid snapshot.
 */
export function createTopicCentroidSnapshot(
  overrides: Partial<TopicCentroidSnapshot> = {},
): TopicCentroidSnapshot {
  return {
    id: 5,
    project: 1,
    computed_at: "2026-04-28T08:00:00Z",
    centroid_active: true,
    feedback_count: 12,
    upvote_count: 10,
    downvote_count: 2,
    drift_from_previous: 0.1,
    drift_from_week_ago: 0.2,
    ...overrides,
  }
}

/**
 * Build a centroid summary fixture for Storybook stories.
 *
 * @param overrides - Partial centroid summary fields to override.
 * @returns A backend-shaped centroid observability summary.
 */
export function createTopicCentroidSummary(
  overrides: Partial<TopicCentroidObservabilitySummary> = {},
): TopicCentroidObservabilitySummary {
  return {
    project: 1,
    snapshot_count: 4,
    active_snapshot_count: 4,
    avg_drift_from_previous: 0.12,
    avg_drift_from_week_ago: 0.19,
    latest_snapshot: createTopicCentroidSnapshot(),
    ...overrides,
  }
}

/**
 * Build a source-diversity snapshot fixture for Storybook stories.
 *
 * @param overrides - Partial source-diversity snapshot fields to override.
 * @returns A backend-shaped source-diversity snapshot.
 */
export function createSourceDiversitySnapshot(
  overrides: Partial<SourceDiversitySnapshot> = {},
): SourceDiversitySnapshot {
  return {
    id: 3,
    project: 1,
    computed_at: "2026-04-28T08:00:00Z",
    window_days: 14,
    plugin_entropy: 0.65,
    source_entropy: 0.72,
    author_entropy: 0.48,
    cluster_entropy: 0.58,
    top_plugin_share: 0.62,
    top_source_share: 0.44,
    breakdown: {
      total_content_count: 12,
      plugin_counts: [
        { key: "rss", label: "RSS", count: 7, share: 0.58 },
        { key: "reddit", label: "Reddit", count: 3, share: 0.25 },
      ],
      source_counts: [
        { key: "feed:1", label: "Example Feed", count: 5, share: 0.42 },
        { key: "subreddit:ml", label: "r/MachineLearning", count: 3, share: 0.25 },
      ],
      author_counts: [
        { key: "author:ada", label: "Ada", count: 4, share: 0.33 },
      ],
      cluster_counts: [
        { key: "cluster:5", label: "Platform Signals", count: 4, share: 0.33 },
      ],
      alerts: [],
    },
    ...overrides,
  }
}

/**
 * Build a source-diversity summary fixture for Storybook stories.
 *
 * @param overrides - Partial source-diversity summary fields to override.
 * @returns A backend-shaped source-diversity observability summary.
 */
export function createSourceDiversitySummary(
  overrides: Partial<SourceDiversityObservabilitySummary> = {},
): SourceDiversityObservabilitySummary {
  return {
    project: 1,
    snapshot_count: 4,
    latest_snapshot: createSourceDiversitySnapshot(),
    ...overrides,
  }
}

/**
 * Build a source configuration fixture for Storybook stories.
 *
 * @param overrides - Partial source configuration fields to override.
 * @returns A backend-shaped source config payload.
 */
export function createSourceConfig(
  overrides: Partial<SourceConfig> = {},
): SourceConfig {
  return {
    id: 7,
    project: 1,
    plugin_name: "rss",
    config: { feed_url: "https://example.com/feed.xml" },
    is_active: true,
    last_fetched_at: "2026-04-28T08:00:00Z",
    ...overrides,
  }
}

/**
 * Build an ingestion-run fixture for Storybook stories.
 *
 * @param overrides - Partial ingestion-run fields to override.
 * @returns A backend-shaped ingestion run payload.
 */
export function createIngestionRun(
  overrides: Partial<IngestionRun> = {},
): IngestionRun {
  return {
    id: 22,
    project: 1,
    plugin_name: "rss",
    started_at: "2026-04-28T09:00:00Z",
    completed_at: "2026-04-28T09:03:00Z",
    status: "success",
    items_fetched: 12,
    items_ingested: 9,
    error_message: "",
    ...overrides,
  }
}

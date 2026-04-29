export type Project = {
  id: number
  name: string
  group: number
  topic_description: string
  content_retention_days: number
  created_at: string
}

export type Entity = {
  id: number
  project: number
  name: string
  type: "individual" | "vendor" | "organization"
  description: string
  authority_score: number
  website_url: string
  github_url: string
  linkedin_url: string
  bluesky_handle: string
  mastodon_handle: string
  twitter_handle: string
  mention_count: number
  latest_mentions: EntityMentionSummary[]
  created_at: string
}

export type EntityAuthoritySnapshot = {
  id: number
  entity: number
  project: number
  computed_at: string
  mention_component: number
  feedback_component: number
  duplicate_component: number
  decayed_prior: number
  final_score: number
}

export type TopicCentroidSnapshot = {
  id: number
  project: number
  computed_at: string
  centroid_active: boolean
  feedback_count: number
  upvote_count: number
  downvote_count: number
  drift_from_previous: number | null
  drift_from_week_ago: number | null
}

export type TopicCentroidObservabilitySummary = {
  project: number
  snapshot_count: number
  active_snapshot_count: number
  avg_drift_from_previous: number | null
  avg_drift_from_week_ago: number | null
  latest_snapshot: TopicCentroidSnapshot | null
}

export type EntityMentionSummary = {
  id: number
  content_id: number
  content_title: string
  role: "author" | "subject" | "quoted" | "mentioned"
  sentiment: "positive" | "neutral" | "negative" | ""
  span: string
  confidence: number
  created_at: string
}

export type EntityCandidate = {
  id: number
  project: number
  name: string
  suggested_type: "individual" | "vendor" | "organization"
  first_seen_in: number | null
  first_seen_title: string
  occurrence_count: number
  status: "pending" | "accepted" | "rejected" | "merged"
  merged_into: number | null
  merged_into_name: string
  created_at: string
  updated_at: string
}

export type Content = {
  id: number
  project: number
  url: string
  title: string
  author: string
  entity: number | null
  source_plugin: string
  content_type: string
  canonical_url: string
  published_date: string
  ingested_at: string
  content_text: string
  relevance_score: number | null
  authority_adjusted_score: number | null
  embedding_id: string
  duplicate_of: number | null
  duplicate_signal_count: number
  is_reference: boolean
  is_active: boolean
}

export type SkillResult = {
  id: number
  content: number
  project: number
  skill_name: string
  status: "pending" | "running" | "completed" | "failed"
  result_data: Record<string, unknown> | null
  error_message: string
  model_used: string
  latency_ms: number | null
  confidence: number | null
  created_at: string
  superseded_by: number | null
}

export type ReviewQueueItem = {
  id: number
  project: number
  content: number
  reason: "low_confidence_classification" | "borderline_relevance"
  confidence: number
  created_at: string
  resolved: boolean
  resolution: "human_approved" | "human_rejected" | ""
}

export type IngestionRun = {
  id: number
  project: number
  plugin_name: string
  started_at: string
  completed_at: string | null
  status: "running" | "success" | "failed"
  items_fetched: number
  items_ingested: number
  error_message: string
}

export type SourceConfig = {
  id: number
  project: number
  plugin_name: "rss" | "reddit"
  config: Record<string, unknown>
  is_active: boolean
  last_fetched_at: string | null
}

export type UserFeedback = {
  id: number
  content: number
  project: number
  user: number
  feedback_type: "upvote" | "downvote"
  created_at: string
}

export type HealthStatus = "healthy" | "degraded" | "failing" | "idle"

export type ContentSkillName =
  | "content_classification"
  | "relevance_scoring"
  | "summarization"
  | "find_related"

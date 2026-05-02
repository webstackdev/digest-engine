export type ProjectRole = "admin" | "member" | "reader"

export type Project = {
  id: number
  name: string
  topic_description: string
  content_retention_days: number
  intake_token?: string
  intake_enabled?: boolean
  user_role: ProjectRole | null
  has_bluesky_credentials?: boolean
  bluesky_handle?: string
  bluesky_is_active?: boolean
  bluesky_last_verified_at?: string | null
  bluesky_last_error?: string
  created_at: string
}

export type UserProfile = {
  id: number
  username: string
  email: string
  display_name: string
  avatar_url: string | null
  avatar_thumbnail_url: string | null
  bio: string
  timezone: string
  first_name: string
  last_name: string
}

export type ProjectMembership = {
  id: number
  project: number
  user: number
  username: string
  email: string
  display_name: string
  role: ProjectRole
  invited_by: number | null
  joined_at: string
}

export type MembershipInvitation = {
  id: number
  project: number
  email: string
  role: ProjectRole
  token: string
  invited_by: number | null
  invited_by_email: string
  invite_url: string
  created_at: string
  accepted_at: string | null
  revoked_at: string | null
}

export type PublicMembershipInvitation = {
  token: string
  project_id: number
  project_name: string
  email: string
  role: ProjectRole
  status: "pending" | "accepted" | "revoked"
  accepted_at: string | null
  revoked_at: string | null
}

export type ProjectBlueskyVerification = {
  status: "verified"
  handle: string
  last_verified_at: string | null
  last_error: string
}

export type ProjectMastodonVerification = {
  status: "verified"
  account_acct: string
  instance_url: string
  last_verified_at: string | null
  last_error: string
}

export type BlueskyCredentials = {
  id: number
  project: number
  handle: string
  pds_url: string
  is_active: boolean
  has_stored_credential: boolean
  last_verified_at: string | null
  last_error: string
  created_at: string
  updated_at: string
}

export type MastodonCredentials = {
  id: number
  project: number
  instance_url: string
  account_acct: string
  is_active: boolean
  has_stored_credential: boolean
  last_verified_at: string | null
  last_error: string
  created_at: string
  updated_at: string
}

export type IntakeAllowlistEntry = {
  id: number
  project: number
  sender_email: string
  is_confirmed: boolean
  confirmed_at: string | null
  confirmation_token: string
  created_at: string
}

export type NewsletterExtractionItem = {
  url: string
  title: string
  excerpt: string
  position: number
}

export type NewsletterIntakeExtractionResult = {
  method: string
  items: NewsletterExtractionItem[]
}

export type NewsletterIntake = {
  id: number
  project: number
  sender_email: string
  subject: string
  received_at: string
  raw_html: string
  raw_text: string
  message_id: string
  status: "pending" | "extracted" | "failed"
  extraction_result: NewsletterIntakeExtractionResult | null
  error_message: string
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
  newsletter_promotion_at?: string | null
  newsletter_promotion_by?: number | null
  newsletter_promotion_theme?: number | null
}

export type TopicClusterEntity = {
  id: number
  name: string
  type: string
}

export type TopicClusterContentSummary = {
  id: number
  url: string
  title: string
  published_date: string
  source_plugin: string
}

export type ContentClusterMembership = {
  id: number
  content: TopicClusterContentSummary
  similarity: number
  assigned_at: string
}

export type TopicVelocitySnapshot = {
  id: number
  cluster: number
  project: number
  computed_at: string
  window_count: number
  trailing_mean: number
  trailing_stddev: number
  z_score: number
  velocity_score: number
}

export type TopicCluster = {
  id: number
  project: number
  centroid_vector_id: string | null
  label: string
  first_seen_at: string
  last_seen_at: string
  is_active: boolean
  member_count: number
  dominant_entity: TopicClusterEntity | null
  velocity_score: number | null
  z_score: number | null
  window_count: number | null
  velocity_computed_at: string | null
}

export type TopicClusterDetail = TopicCluster & {
  memberships: ContentClusterMembership[]
  velocity_history: TopicVelocitySnapshot[]
}

export type ThemeSuggestionClusterSummary = {
  id: number
  label: string
  member_count: number
  velocity_score: number | null
}

export type ThemeSuggestionPromotedContent = {
  id: number
  url: string
  title: string
  published_date: string
  source_plugin: string
  newsletter_promotion_at: string | null
}

export type ThemeSuggestion = {
  id: number
  project: number
  cluster: ThemeSuggestionClusterSummary | null
  title: string
  pitch: string
  why_it_matters: string
  suggested_angle: string
  velocity_at_creation: number
  novelty_score: number
  status: "pending" | "accepted" | "dismissed" | "used"
  dismissal_reason: string
  created_at: string
  decided_at: string | null
  decided_by: number | null
  decided_by_username: string | null
  promoted_contents: ThemeSuggestionPromotedContent[]
}

export type OriginalContentIdeaClusterSummary = {
  id: number
  label: string
  member_count: number
}

export type OriginalContentIdeaSupportingContent = {
  id: number
  url: string
  title: string
  published_date: string
  source_plugin: string
}

export type OriginalContentIdea = {
  id: number
  project: number
  angle_title: string
  summary: string
  suggested_outline: string
  why_now: string
  supporting_contents: OriginalContentIdeaSupportingContent[]
  related_cluster: OriginalContentIdeaClusterSummary | null
  generated_by_model: string
  self_critique_score: number
  status: "pending" | "accepted" | "dismissed" | "written"
  dismissal_reason: string
  created_at: string
  decided_at: string | null
  decided_by: number | null
  decided_by_username: string | null
}

export type OriginalContentIdeaGenerationResult = {
  project_id: number
  clusters_considered: number
  created: number
  skipped: number
}

export type OriginalContentIdeaGenerationQueuedResponse = {
  status: "queued"
  project_id: number
}

export type OriginalContentIdeaGenerationCompletedResponse = {
  status: "completed"
  project_id: number
  result: OriginalContentIdeaGenerationResult
}

export type OriginalContentIdeaGenerationResponse =
  | OriginalContentIdeaGenerationQueuedResponse
  | OriginalContentIdeaGenerationCompletedResponse

export type SourceDiversityBreakdownCount = {
  key: string
  label: string
  count: number
  share: number
}

export type SourceDiversityAlert = {
  code: string
  severity: string
  message: string
}

export type SourceDiversityBreakdown = {
  total_content_count: number
  plugin_counts: SourceDiversityBreakdownCount[]
  source_counts: SourceDiversityBreakdownCount[]
  author_counts: SourceDiversityBreakdownCount[]
  cluster_counts: SourceDiversityBreakdownCount[]
  alerts: SourceDiversityAlert[]
}

export type SourceDiversitySnapshot = {
  id: number
  project: number
  computed_at: string
  window_days: number
  plugin_entropy: number
  source_entropy: number
  author_entropy: number
  cluster_entropy: number
  top_plugin_share: number
  top_source_share: number
  breakdown: SourceDiversityBreakdown
}

export type SourceDiversityObservabilitySummary = {
  project: number
  snapshot_count: number
  latest_snapshot: SourceDiversitySnapshot | null
}

export type TrendTaskRun = {
  id: number
  project: number
  task_name: string
  task_run_id: string
  status: "started" | "completed" | "skipped" | "failed"
  started_at: string
  finished_at: string | null
  latency_ms: number | null
  error_message: string
  summary: Record<string, unknown>
}

export type TrendTaskRunObservabilitySummary = {
  project: number
  run_count: number
  failed_run_count: number
  latest_runs: TrendTaskRun[]
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
  plugin_name: "rss" | "reddit" | "bluesky" | "mastodon"
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

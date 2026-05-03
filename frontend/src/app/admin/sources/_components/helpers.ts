import { getProjectIngestionRuns } from "@/lib/api"
import type {
  LinkedInCredentials,
  MastodonCredentials,
  NewsletterIntake,
  Project,
} from "@/lib/types"

export type VerificationState = {
  label: string
  tone: "positive" | "warning" | "negative" | "neutral"
}

/** Build the documented inbound intake address pattern for one project token. */
export function buildIntakeAddressTemplate(intakeToken: string) {
  return `intake+${intakeToken || "<project-token>"}@inbox.example.com`
}

/** Derive the current Bluesky verification badge state for the selected project. */
export function deriveBlueskyVerificationState(
  project: Project,
): VerificationState {
  if (!project.has_bluesky_credentials) {
    return { label: "not configured", tone: "neutral" }
  }

  if (project.bluesky_last_error) {
    return { label: "verification failed", tone: "negative" }
  }

  if (project.bluesky_last_verified_at) {
    return { label: "verified", tone: "positive" }
  }

  return { label: "needs verification", tone: "warning" }
}

/** Derive the current Mastodon verification badge state for stored credentials. */
export function deriveMastodonVerificationState(
  credentials: MastodonCredentials | null,
): VerificationState {
  if (!credentials) {
    return { label: "not configured", tone: "neutral" }
  }

  if (credentials.last_error) {
    return { label: "verification failed", tone: "negative" }
  }

  if (credentials.last_verified_at) {
    return { label: "verified", tone: "positive" }
  }

  return { label: "needs verification", tone: "warning" }
}

/** Derive the current LinkedIn verification badge state for stored credentials. */
export function deriveLinkedInVerificationState(
  credentials: LinkedInCredentials | null,
): VerificationState {
  if (!credentials) {
    return { label: "not configured", tone: "neutral" }
  }

  if (!credentials.is_active) {
    return { label: "disabled", tone: "neutral" }
  }

  if (
    credentials.expires_at &&
    new Date(credentials.expires_at).getTime() <= Date.now()
  ) {
    return { label: "expired", tone: "negative" }
  }

  if (credentials.last_error) {
    return { label: "verification failed", tone: "negative" }
  }

  if (credentials.last_verified_at) {
    return { label: "verified", tone: "positive" }
  }

  return { label: "needs verification", tone: "warning" }
}

/** Build a per-plugin lookup of the newest ingestion run records. */
export function buildLatestRunByPlugin(
  ingestionRuns: Awaited<ReturnType<typeof getProjectIngestionRuns>>,
) {
  const latestRunByPlugin = new Map<string, (typeof ingestionRuns)[number]>()
  for (const ingestionRun of ingestionRuns) {
    if (!latestRunByPlugin.has(ingestionRun.plugin_name)) {
      latestRunByPlugin.set(ingestionRun.plugin_name, ingestionRun)
    }
  }
  return latestRunByPlugin
}

/** Build a concise preview from persisted newsletter extraction data. */
export function buildNewsletterIntakePreview(intake: NewsletterIntake) {
  const extractedItems = intake.extraction_result?.items ?? []
  if (extractedItems.length > 0) {
    return extractedItems
      .slice(0, 2)
      .map((item) => item.title || item.url)
      .join("; ")
  }

  if (intake.error_message) {
    return intake.error_message
  }

  return intake.raw_text.slice(0, 160) || "No preview available yet."
}

/** Filter newsletter intake rows using URL-driven sender and status criteria. */
export function filterNewsletterIntakes(
  newsletterIntakes: NewsletterIntake[],
  filters: { status: string; sender: string },
) {
  const normalizedSender = filters.sender.trim().toLowerCase()

  return newsletterIntakes.filter((intake) => {
    if (filters.status && intake.status !== filters.status) {
      return false
    }
    if (
      normalizedSender &&
      !intake.sender_email.toLowerCase().includes(normalizedSender)
    ) {
      return false
    }
    return true
  })
}
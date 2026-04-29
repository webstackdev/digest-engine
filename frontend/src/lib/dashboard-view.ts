import type { Content, ReviewQueueItem, UserFeedback } from "@/lib/types"
import { getSearchParam, type SearchParams } from "@/lib/view-helpers"

/**
 * Supported dashboard tabs derived from the `view` search param.
 *
 * Unknown or missing values are normalized to `"content"` by `buildDashboardView`.
 *
 * @example
 * ```ts
 * const view: DashboardView = "review"
 * ```
 */
export type DashboardView = "content" | "review"
export type DuplicateStateFilter = "" | "duplicate_related"

type BuildDashboardViewArgs = {
  contents: Content[]
  reviewQueue: ReviewQueueItem[]
  feedback: UserFeedback[]
  searchParams: SearchParams
  now?: Date
}

/**
 * Build the derived dashboard state used by the project home page.
 *
 * This helper keeps filtering, sorting, and summary-count logic in one place so the
 * page layer can render a stable view model from API payloads and URL search params.
 * Missing or invalid search params fall back to safe defaults: unknown views become
 * `"content"`, missing or invalid day filters become `30`, and empty filters do not
 * exclude any content.
 *
 * @param args - Dashboard source data and URL search params.
 * @param args.contents - Project content rows. Inactive content is excluded from the
 * returned filters and lists.
 * @param args.reviewQueue - Review queue rows used to compute unresolved review items.
 * @param args.feedback - Feedback rows used for positive and negative count summaries.
 * @param args.searchParams - App Router search params. `null`, `undefined`, or unknown
 * values are normalized through `getSearchParam` and the helper defaults.
 * @param args.now - Reference date for the rolling `days` filter. Omit to use the
 * current time.
 * @returns A dashboard-ready view model with filtered content, lookup maps, available
 * filter options, and summary counts.
 * @example
 * ```ts
 * const dashboardView = buildDashboardView({
 *   contents,
 *   reviewQueue,
 *   feedback,
 *   searchParams: { view: "review", days: "7" },
 * })
 * ```
 */
export function buildDashboardView({
  contents,
  reviewQueue,
  feedback,
  searchParams,
  now = new Date(),
}: BuildDashboardViewArgs) {
  const requestedView = getSearchParam(searchParams, "view")
  const view: DashboardView = requestedView === "review" ? "review" : "content"
  const contentTypeFilter = getSearchParam(searchParams, "contentType")
  const sourceFilter = getSearchParam(searchParams, "source")
  const requestedDuplicateState = getSearchParam(searchParams, "duplicateState")
  const duplicateStateFilter: DuplicateStateFilter =
    requestedDuplicateState === "duplicate_related" ? "duplicate_related" : ""
  const parsedDaysFilter = Number.parseInt(
    getSearchParam(searchParams, "days") || "30",
    10,
  )
  const daysFilter = Number.isNaN(parsedDaysFilter) ? 30 : parsedDaysFilter

  const activeContents = contents.filter((content) => content.is_active)
  const thresholdDate = new Date(now)
  thresholdDate.setDate(thresholdDate.getDate() - daysFilter)

  const matchesContentFilters = (content: Content) => {
    if (contentTypeFilter && content.content_type !== contentTypeFilter) {
      return false
    }
    if (sourceFilter && content.source_plugin !== sourceFilter) {
      return false
    }
    if (
      duplicateStateFilter === "duplicate_related" &&
      content.duplicate_signal_count <= 0 &&
      content.duplicate_of === null
    ) {
      return false
    }
    return new Date(content.published_date) >= thresholdDate
  }

  const filteredContents = activeContents
    .filter((content) => matchesContentFilters(content))
    .sort((left, right) => {
      const adjustedDelta =
        (right.authority_adjusted_score ?? right.relevance_score ?? -1) -
        (left.authority_adjusted_score ?? left.relevance_score ?? -1)

      if (adjustedDelta !== 0) {
        return adjustedDelta
      }

      return (
        new Date(right.published_date).getTime() -
        new Date(left.published_date).getTime()
      )
    })

  const contentMap = new Map(contents.map((content) => [content.id, content]))
  const pendingReviewItems = reviewQueue.filter((item) => {
    if (item.resolved) {
      return false
    }
    const content = contentMap.get(item.content)
    if (!content) {
      return (
        !contentTypeFilter &&
        !sourceFilter &&
        duplicateStateFilter === "" &&
        daysFilter === 30
      )
    }
    return matchesContentFilters(content)
  })
  const contentTypes = Array.from(
    new Set(
      activeContents.map((content) => content.content_type).filter(Boolean),
    ),
  ).sort()
  const sources = Array.from(
    new Set(activeContents.map((content) => content.source_plugin)),
  ).sort()
  const positiveFeedback = feedback.filter(
    (item) => item.feedback_type === "upvote",
  ).length
  const negativeFeedback = feedback.filter(
    (item) => item.feedback_type === "downvote",
  ).length

  return {
    contentMap,
    contentTypeFilter,
    contentTypes,
    daysFilter,
    duplicateStateFilter,
    filteredContents,
    negativeFeedback,
    pendingReviewItems,
    positiveFeedback,
    sourceFilter,
    sources,
    view,
  }
}

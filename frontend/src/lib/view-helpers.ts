import type { HealthStatus, Project } from "@/lib/types"

/**
 * App Router search-param shape used by shared view helpers.
 *
 * Values may be missing, repeated, or already normalized to a single string.
 * Individual helpers in this module convert those cases into stable UI defaults.
 *
 * @example
 * ```ts
 * const searchParams: SearchParams = { project: "2", view: ["review"] }
 * ```
 */
export type SearchParams = Record<string, string | string[] | undefined>

/**
 * Read one search-param value as a single string.
 *
 * Repeated parameters use the first value. Missing params and empty arrays normalize
 * to an empty string so callers can apply simple defaulting logic without extra null
 * checks.
 *
 * @param searchParams - App Router search params object.
 * @param key - Parameter name to read.
 * @returns The first matching string value, or an empty string when missing.
 * @example
 * ```ts
 * const projectId = getSearchParam({ project: ["2", "1"] }, "project")
 * ```
 */
export function getSearchParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key]
  if (Array.isArray(value)) {
    return value[0] ?? ""
  }
  return value ?? ""
}

/**
 * Pick the currently selected project from the URL state.
 *
 * When the query string is missing, invalid, or points at a project that is not in
 * the current list, this falls back to the first available project. Empty project
 * lists return `null` so page code can render an empty state explicitly.
 *
 * @param projects - Available projects for the current user.
 * @param searchParams - App Router search params containing an optional `project` id.
 * @returns The selected project, the first project as a fallback, or `null`.
 * @example
 * ```ts
 * const project = selectProject(projects, { project: "2" })
 * ```
 */
export function selectProject(projects: Project[], searchParams: SearchParams) {
  if (projects.length === 0) {
    return null
  }

  const requestedProjectId = Number.parseInt(
    getSearchParam(searchParams, "project"),
    10,
  )
  const selectedProject = projects.find(
    (project) => project.id === requestedProjectId,
  )
  return selectedProject ?? projects[0]
}

/**
 * Format a timestamp for dashboard and admin-style views.
 *
 * `null`, `undefined`, and empty-string values are treated as missing data and return
 * `"Never"` so callers do not need separate placeholder handling.
 *
 * @param value - ISO timestamp string, or a falsey value when no timestamp exists.
 * @returns A localized date-time label or `"Never"` when the timestamp is absent.
 * @example
 * ```ts
 * const label = formatDate("2026-04-27T12:30:00Z")
 * ```
 */
export function formatDate(value: string | null) {
  if (!value) {
    return "Never"
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

/**
 * Format a relevance or confidence score for compact UI display.
 *
 * Missing scores return `"n/a"` instead of `0.00` so the UI does not imply a real
 * measured value.
 *
 * @param value - Numeric score, or `null`/`undefined` when unavailable.
 * @returns A two-decimal string or `"n/a"` for missing scores.
 * @example
 * ```ts
 * const label = formatScore(0.825)
 * ```
 */
export function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "n/a"
  }
  return value.toFixed(2)
}

/**
 * Shorten long content previews without leaving trailing whitespace before ellipses.
 *
 * Strings at or below the maximum length are returned unchanged.
 *
 * @param value - Source text to display.
 * @param maxLength - Maximum visible character count before truncation.
 * @returns The original text or a trimmed ellipsis-suffixed preview.
 * @example
 * ```ts
 * const preview = truncateText(article.content_text, 140)
 * ```
 */
export function truncateText(value: string, maxLength = 220) {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength).trimEnd()}...`
}

/**
 * Map backend health states to the badge tone names used by the frontend UI.
 *
 * Unknown states fall back to `"neutral"` so unexpected backend values do not break
 * rendering.
 *
 * @param status - Backend health state.
 * @returns UI badge tone for the given status.
 * @example
 * ```ts
 * const tone = healthTone("degraded")
 * ```
 */
export function healthTone(status: HealthStatus) {
  switch (status) {
    case "healthy":
      return "positive" as const
    case "degraded":
      return "warning" as const
    case "failing":
      return "negative" as const
    default:
      return "neutral" as const
  }
}

/**
 * Read the current error flash message from the URL.
 *
 * Missing values resolve to an empty string.
 *
 * @param searchParams - App Router search params.
 * @returns Error message string or an empty string.
 * @example
 * ```ts
 * const error = getErrorMessage(searchParams)
 * ```
 */
export function getErrorMessage(searchParams: SearchParams) {
  return getSearchParam(searchParams, "error")
}

/**
 * Read the current success flash message from the URL.
 *
 * Missing values resolve to an empty string.
 *
 * @param searchParams - App Router search params.
 * @returns Success message string or an empty string.
 * @example
 * ```ts
 * const message = getSuccessMessage(searchParams)
 * ```
 */
export function getSuccessMessage(searchParams: SearchParams) {
  return getSearchParam(searchParams, "message")
}

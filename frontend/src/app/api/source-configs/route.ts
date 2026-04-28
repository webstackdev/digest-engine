import { NextResponse } from "next/server"

import { createSourceConfig } from "@/lib/api"

/**
 * Build a redirect target for the source-config creation handler.
 *
 * The route uses this helper to send users back to the source-config UI with a single
 * flash message encoded in the query string. Relative redirects are resolved against
 * the incoming request URL.
 *
 * @param request - Incoming request used as the base URL for relative redirects.
 * @param redirectTo - Caller-provided redirect target, or a fallback path.
 * @param params - Query params to append to the redirect target.
 * @returns A redirect URL with the provided flash-message params.
 */
function buildRedirectUrl(
  request: Request,
  redirectTo: string,
  params: Record<string, string>,
) {
  const url = new URL(redirectTo || "/admin/sources", request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

/**
 * Parse the free-form source-config JSON payload from a form submission.
 *
 * Empty values default to an empty object so callers can create a config entry before
 * adding provider-specific settings.
 *
 * @param rawValue - Raw `config_json` form value.
 * @returns Parsed config object.
 */
function parseConfigJson(rawValue: FormDataEntryValue | null) {
  const value = String(rawValue || "{}").trim()
  return JSON.parse(value) as Record<string, unknown>
}

/**
 * Handle source-config creation form submissions.
 *
 * The admin UI posts `FormData` here so it can reuse the shared backend API helper
 * while keeping backend credentials server-side. The handler parses the JSON config
 * blob, normalizes the active flag to a boolean, and redirects back to the requested
 * UI location with a success or error flash message.
 *
 * @param request - Incoming form submission request.
 * @returns A redirect response pointing back to the source-config UI.
 * @example
 * ```ts
 * const response = await POST(request)
 * ```
 */
export async function POST(request: Request) {
  const formData = await request.formData()
  const redirectTo = String(formData.get("redirectTo") || "/admin/sources")

  try {
    const projectId = Number.parseInt(
      String(formData.get("projectId") || "0"),
      10,
    )
    await createSourceConfig(projectId, {
      plugin_name: String(formData.get("plugin_name") || "rss"),
      config: parseConfigJson(formData.get("config_json")),
      is_active: String(formData.get("is_active") || "true") === "true",
    })
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { message: "Source created." }),
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to create source configuration."
    return NextResponse.redirect(
      buildRedirectUrl(request, redirectTo, { error: message }),
    )
  }
}

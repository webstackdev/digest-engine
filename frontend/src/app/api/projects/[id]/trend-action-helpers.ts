/**
 * Build a redirect target for project-scoped trend workflow handlers.
 *
 * Relative redirects are resolved against the incoming request URL so route handlers can
 * safely accept short page paths like `/ideas?project=4` from form submissions.
 *
 * @param request - Incoming request used as the base URL for relative redirects.
 * @param redirectTo - Caller-provided redirect target, or a fallback page path.
 * @param params - Query params to append to the redirect target.
 * @returns A redirect URL with the requested flash-message params appended.
 */
export function buildTrendRedirectUrl(
  request: Request,
  redirectTo: string,
  params: Record<string, string>,
) {
  const url = new URL(redirectTo, request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

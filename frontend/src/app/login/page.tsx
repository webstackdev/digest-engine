import LoginForm from "@/components/auth/login-form"

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Normalize the callback URL passed through the login page query string.
 *
 * App Router search params may arrive as a single string, an array of repeated values,
 * or be entirely absent. The login flow only needs one redirect target, so this helper
 * uses the first provided value and falls back to the dashboard root when missing.
 *
 * @param value - Raw `callbackUrl` search-param value.
 * @returns The first callback URL value or `/` when no value is present.
 */
export function resolveCallbackUrl(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "/"
  }

  return value || "/"
}

/**
 * Render the login page and forward the normalized callback URL to the login form.
 *
 * This server component keeps query-string parsing out of the client login form so the
 * form can focus solely on the authentication UI and submission behavior.
 *
 * @param props - Async server component props from the App Router.
 * @param props.searchParams - Search params promise containing the optional `callbackUrl` value.
 * @returns The centered login page wrapper and configured login form.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams
  const callbackUrl = resolveCallbackUrl(resolvedSearchParams.callbackUrl)

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <LoginForm callbackUrl={callbackUrl} />
    </div>
  )
}

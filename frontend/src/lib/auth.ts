import "server-only"

import type { NextAuthOptions, User } from "next-auth"
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GithubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"

/**
 * Backend authentication fields returned by the Django auth endpoints.
 *
 * Missing fields are expected when a provider only returns part of the token pair
 * or when an error response only includes `detail` or `non_field_errors`.
 */
type BackendAuthPayload = {
  access?: string
  detail?: string
  key?: string
  non_field_errors?: string[]
  refresh?: string
  user?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * NextAuth user object extended with the backend auth payload used by the app API.
 */
type AuthenticatedUser = User & {
  backendAuth?: BackendAuthPayload
}

function getApiBaseUrl() {
  return (
    process.env.NEWSLETTER_API_INTERNAL_URL ??
    process.env.NEWSLETTER_API_BASE_URL ??
    "http://127.0.0.1:8080"
  )
}

/**
 * Parse a backend authentication response when it contains JSON.
 *
 * Empty bodies, invalid JSON, and non-JSON content types all resolve to `null` so
 * callers can fall back to the module's generic auth error handling.
 *
 * @param response - Fetch response returned by a Django auth endpoint.
 * @returns Parsed backend auth payload, or `null` when the body is empty or unusable.
 * @example
 * ```ts
 * const payload = await parseBackendResponse(response)
 * ```
 */
async function parseBackendResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? ""
  const text = await response.text()

  if (!text) {
    return null
  }

  if (contentType.includes("json")) {
    try {
      return JSON.parse(text) as BackendAuthPayload
    } catch {
      return null
    }
  }

  return null
}

/**
 * Exchange frontend login or social-provider credentials for Django auth data.
 *
 * This is the bridge between NextAuth and the backend API. It normalizes backend
 * error responses so credential and social sign-in flows surface consistent error
 * messages even when the response body is empty or malformed.
 *
 * @param path - Relative Django auth endpoint path such as `/api/auth/login/`.
 * @param body - JSON payload expected by the backend auth endpoint.
 * @returns Parsed backend auth payload. Successful empty JSON bodies resolve to `{}`.
 * @throws When the backend auth service cannot be reached or rejects the request.
 * @example
 * ```ts
 * const backendAuth = await postBackendAuth("/api/auth/login/", {
 *   username: "alice@example.com",
 *   password: "secret",
 * })
 * ```
 */
async function postBackendAuth(
  path: string,
  body: Record<string, unknown>,
): Promise<BackendAuthPayload> {
  let response: Response

  try {
    response = await fetch(new URL(path, getApiBaseUrl()).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("Unable to reach the authentication service.")
  }

  const payload = await parseBackendResponse(response)

  if (!response.ok) {
    const message =
      typeof payload?.detail === "string"
        ? payload.detail
        : typeof payload?.non_field_errors?.[0] === "string"
          ? payload.non_field_errors[0]
          : "Authentication failed."
    throw new Error(message)
  }

  return payload ?? {}
}

const providers = []

providers.push(
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      username: { label: "Username or email", type: "text" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const username = credentials?.username?.trim()
      const password = credentials?.password

      if (!username || !password) {
        throw new Error("Enter both username and password.")
      }

      const backendAuth = await postBackendAuth("/api/auth/login/", {
        username,
        password,
      })

      return {
        id: username,
        name: username,
        backendAuth,
      } satisfies AuthenticatedUser
    },
  }),
)

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GithubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  )
}

if (process.env.GOOGLE_ID && process.env.GOOGLE_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
    }),
  )
}

/**
 * Shared NextAuth configuration for credential and optional social-provider sign-in.
 *
 * Credential logins always authenticate against the Django backend. Social logins are
 * only registered when their provider environment variables are present, and they are
 * enriched with backend auth so the rest of the app can keep using the same API token
 * contract. When no backend auth is available, the session is left unchanged.
 *
 * @example
 * ```ts
 * import { authOptions } from "@/lib/auth"
 *
 * const providers = authOptions.providers
 * ```
 */
export const authOptions: NextAuthOptions = {
  providers,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!account) {
        return false
      }

      if (account.provider === "credentials") {
        return true
      }

      try {
        if (typeof account.access_token !== "string") {
          return false
        }

        ;(user as AuthenticatedUser).backendAuth = await postBackendAuth(
          `/api/auth/${account.provider}/`,
          { access_token: account.access_token },
        )

        return true
      } catch {
        return false
      }
    },
    async jwt({ token, user }) {
      if (user && "backendAuth" in user) {
        token.backendAuth = (user as AuthenticatedUser).backendAuth
      }

      return token
    },
    async session({ session, token }) {
      const enrichedSession = session as typeof session & {
        backendAuth?: BackendAuthPayload
      }

      if (token.backendAuth) {
        enrichedSession.backendAuth = token.backendAuth as BackendAuthPayload
      }

      return enrichedSession
    },
  },
}

/**
 * NextAuth route handler reused by the App Router auth endpoint.
 *
 * @example
 * ```ts
 * export { handler as GET, handler as POST } from "@/lib/auth"
 * ```
 */
const handler = NextAuth(authOptions)

export default handler
export { handler }

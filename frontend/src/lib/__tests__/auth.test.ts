import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const {
  credentialsProviderMock,
  githubProviderMock,
  googleProviderMock,
  nextAuthMock,
} = vi.hoisted(() => ({
  credentialsProviderMock: vi.fn((config: Record<string, unknown>) => ({
    id: "credentials",
    ...config,
  })),
  githubProviderMock: vi.fn((config: Record<string, unknown>) => ({
    id: "github",
    ...config,
  })),
  googleProviderMock: vi.fn((config: Record<string, unknown>) => ({
    id: "google",
    ...config,
  })),
  nextAuthMock: vi.fn(() => "next-auth-handler"),
}))

vi.mock("next-auth", () => ({
  default: nextAuthMock,
}))

vi.mock("next-auth/providers/credentials", () => ({
  default: credentialsProviderMock,
}))

vi.mock("next-auth/providers/github", () => ({
  default: githubProviderMock,
}))

vi.mock("next-auth/providers/google", () => ({
  default: googleProviderMock,
}))

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

function textResponse(body: string, init?: ResponseInit) {
  return new Response(body, init)
}

type CredentialsAuthorize = (
  credentials: Record<string, string> | undefined,
  request: unknown,
) => Promise<unknown>

async function loadAuthModule() {
  return import("@/lib/auth")
}

function getCredentialsAuthorize(authOptions: {
  providers: Array<{ id?: string }>
}): CredentialsAuthorize {
  const provider = authOptions.providers.find(
    (candidate) => candidate.id === "credentials",
  )

  expect(provider).toBeDefined()

  return (provider as unknown as { authorize: CredentialsAuthorize }).authorize
}

describe("authOptions", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv("NEWSLETTER_API_INTERNAL_URL", "https://api.example.com")
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://public.example.com")
    credentialsProviderMock.mockClear()
    githubProviderMock.mockClear()
    googleProviderMock.mockClear()
    nextAuthMock.mockClear()
  })

  it("authorizes credentials against the backend auth endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ key: "abc123", access: "jwt" }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { authOptions } = await loadAuthModule()
    const authorize = getCredentialsAuthorize(authOptions)

    const user = await authorize(
      {
        username: "  alice@example.com ",
        password: "secret",
      },
      {},
    )

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/auth/login/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          username: "alice@example.com",
          password: "secret",
        }),
      }),
    )
    expect(user).toEqual({
      id: "alice@example.com",
      name: "alice@example.com",
      backendAuth: { key: "abc123", access: "jwt" },
    })
  })

  it("rejects missing credentials before calling the backend", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { authOptions } = await loadAuthModule()
    const authorize = getCredentialsAuthorize(authOptions)

    await expect(authorize({ username: "", password: "" }, {})).rejects.toThrow(
      "Enter both username and password.",
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("surfaces backend detail errors for failed credential sign-in", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ detail: "Bad credentials." }, { status: 400 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { authOptions } = await loadAuthModule()
    const authorize = getCredentialsAuthorize(authOptions)

    await expect(
      authorize({ username: "alice@example.com", password: "wrong" }, {}),
    ).rejects.toThrow("Bad credentials.")
  })

  it("falls back to non-field backend errors for failed credential sign-in", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { non_field_errors: ["Account is disabled."] },
        { status: 400 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { authOptions } = await loadAuthModule()
    const authorize = getCredentialsAuthorize(authOptions)

    await expect(
      authorize({ username: "alice@example.com", password: "wrong" }, {}),
    ).rejects.toThrow("Account is disabled.")
  })

  it("uses a default message when the backend error body is empty or non-json", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      textResponse("backend unavailable", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { authOptions } = await loadAuthModule()
    const authorize = getCredentialsAuthorize(authOptions)

    await expect(
      authorize({ username: "alice@example.com", password: "wrong" }, {}),
    ).rejects.toThrow("Authentication failed.")
  })

  it("prefers the server-side backend base URL for credential auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ key: "abc123" }))
    vi.stubGlobal("fetch", fetchMock)

    const { authOptions } = await loadAuthModule()
    const authorize = getCredentialsAuthorize(authOptions)

    await authorize({ username: "alice@example.com", password: "secret" }, {})

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/auth/login/",
      expect.any(Object),
    )
  })

  it("falls back to the local backend default when the server-side backend URL is absent", async () => {
    vi.unstubAllEnvs()
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ key: "abc123" }))
    vi.stubGlobal("fetch", fetchMock)

    const { authOptions } = await loadAuthModule()
    const authorize = getCredentialsAuthorize(authOptions)

    await authorize({ username: "alice@example.com", password: "secret" }, {})

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/api/auth/login/",
      expect.any(Object),
    )
  })

  it("normalizes backend network failures for credential sign-in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")))

    const { authOptions } = await loadAuthModule()
    const authorize = getCredentialsAuthorize(authOptions)

    await expect(
      authorize({ username: "alice@example.com", password: "secret" }, {}),
    ).rejects.toThrow("Unable to reach the authentication service.")
  })

  it("enriches social sign-in users with backend auth when access tokens are present", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ key: "social-key" }))
    vi.stubGlobal("fetch", fetchMock)

    const { authOptions } = await loadAuthModule()
    const user: Record<string, unknown> = { id: "1" }

    const result = await authOptions.callbacks?.signIn?.({
      user: user as never,
      account: { provider: "github", access_token: "provider-token" } as never,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    })

    expect(result).toBe(true)
    expect(user.backendAuth).toEqual({ key: "social-key" })
  })

  it("returns false when social sign-in has no account", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { authOptions } = await loadAuthModule()

    const result = await authOptions.callbacks?.signIn?.({
      user: { id: "1" } as never,
      account: null,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    })

    expect(result).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns true for credential provider sign-in without another backend call", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { authOptions } = await loadAuthModule()

    const result = await authOptions.callbacks?.signIn?.({
      user: { id: "1" } as never,
      account: { provider: "credentials" } as never,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    })

    expect(result).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns false when social sign-in has no access token", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { authOptions } = await loadAuthModule()

    const result = await authOptions.callbacks?.signIn?.({
      user: { id: "1" } as never,
      account: { provider: "github" } as never,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    })

    expect(result).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns false when social backend enrichment fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ detail: "Provider rejected token." }, { status: 400 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { authOptions } = await loadAuthModule()
    const user: Record<string, unknown> = { id: "1" }

    const result = await authOptions.callbacks?.signIn?.({
      user: user as never,
      account: { provider: "github", access_token: "bad-token" } as never,
      profile: undefined,
      email: undefined,
      credentials: undefined,
    })

    expect(result).toBe(false)
    expect(user.backendAuth).toBeUndefined()
  })

  it("copies backendAuth through jwt and session callbacks", async () => {
    const { authOptions } = await loadAuthModule()

    const token = await authOptions.callbacks?.jwt?.({
      token: {},
      user: { backendAuth: { key: "persisted-key" } } as never,
      account: null,
      profile: undefined,
      trigger: "signIn",
      isNewUser: false,
      session: undefined,
    })

    const session = await authOptions.callbacks?.session?.({
      session: { user: {} } as never,
      token: token as never,
      user: {} as never,
      newSession: undefined,
      trigger: "update",
    })

    expect(token).toEqual({ backendAuth: { key: "persisted-key" } })
    expect(session).toMatchObject({ backendAuth: { key: "persisted-key" } })
  })

  it("leaves jwt and session unchanged when no backend auth is present", async () => {
    const { authOptions } = await loadAuthModule()

    const token = await authOptions.callbacks?.jwt?.({
      token: { sub: "123" },
      user: {} as never,
      account: null,
      profile: undefined,
      trigger: "update",
      isNewUser: false,
      session: undefined,
    })

    const session = await authOptions.callbacks?.session?.({
      session: { user: {} } as never,
      token: token as never,
      user: {} as never,
      newSession: undefined,
      trigger: "update",
    })

    expect(token).toEqual({ sub: "123" })
    expect(session).toEqual({ user: {} })
  })

  it("registers optional social providers only when their env vars are configured", async () => {
    vi.stubEnv("GITHUB_ID", "github-id")
    vi.stubEnv("GITHUB_SECRET", "github-secret")
    vi.stubEnv("GOOGLE_ID", "google-id")
    vi.stubEnv("GOOGLE_SECRET", "google-secret")

    const { authOptions } = await loadAuthModule()

    expect(githubProviderMock).toHaveBeenCalledWith({
      clientId: "github-id",
      clientSecret: "github-secret",
    })
    expect(googleProviderMock).toHaveBeenCalledWith({
      clientId: "google-id",
      clientSecret: "google-secret",
    })
    expect(authOptions.providers.map((provider) => provider.id)).toEqual([
      "credentials",
      "github",
      "google",
    ])
  })
})

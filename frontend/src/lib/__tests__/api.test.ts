import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { getServerSessionMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
}))

vi.mock("server-only", () => ({}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react")

  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  }
})

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

function textResponse(body: string, init?: ResponseInit) {
  return new Response(body, init)
}

function getExpectedBasicAuthHeader() {
  const username = process.env.NEWSLETTER_API_USERNAME
  const password = process.env.NEWSLETTER_API_PASSWORD

  if (!username || !password) {
    throw new Error("Expected NEWSLETTER_API_USERNAME and NEWSLETTER_API_PASSWORD in test")
  }

  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
}

describe("api helpers", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv("NEWSLETTER_API_BASE_URL", "https://api.example.com")
    vi.stubEnv("NEWSLETTER_API_USERNAME", "frontend-user")
    vi.stubEnv("NEWSLETTER_API_PASSWORD", "frontend-pass")
    getServerSessionMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("prefers the backend token key for authenticated API requests", async () => {
    getServerSessionMock.mockResolvedValue({ backendAuth: { key: "abc123" } })
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    const { apiFetch } = await import("@/lib/api")
    await apiFetch("/api/v1/projects/")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/projects/",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Token abc123" }),
      }),
    )
  })

  it("falls back to basic auth when the session has no backend credentials", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    const { apiFetch } = await import("@/lib/api")
    await apiFetch("/api/v1/projects/")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/projects/",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: getExpectedBasicAuthHeader(),
        }),
      }),
    )
  })

  it("uses a bearer token when the session provides backend access credentials", async () => {
    getServerSessionMock.mockResolvedValue({ backendAuth: { access: "jwt-token" } })
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal("fetch", fetchMock)

    const { apiFetch } = await import("@/lib/api")
    await apiFetch("/api/v1/projects/")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/projects/",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer jwt-token" }),
      }),
    )
  })

  it("surfaces a normalized error preview for failed requests", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response("bad    request\n\nbody", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        }),
      )
    vi.stubGlobal("fetch", fetchMock)

    const { apiFetch } = await import("@/lib/api")

    await expect(apiFetch("/api/v1/projects/")).rejects.toThrow(
      "API request failed (500) from https://api.example.com/api/v1/projects/ with text/plain: bad request body",
    )
  })

  it("returns undefined for no-content responses", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { deleteEntity } = await import("@/lib/api")
    const result = await deleteEntity(7, 4)

    expect(result).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/projects/4/entities/7/",
      expect.objectContaining({
        method: "DELETE",
      }),
    )
  })

  it("returns undefined for successful responses with an empty body", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const fetchMock = vi.fn().mockResolvedValue(
      textResponse("", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { apiFetch } = await import("@/lib/api")
    const result = await apiFetch("/api/v1/projects/")

    expect(result).toBeUndefined()
  })

  it("throws when a successful response is not JSON", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const fetchMock = vi.fn().mockResolvedValue(
      textResponse("ok", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { apiFetch } = await import("@/lib/api")

    await expect(apiFetch("/api/v1/projects/")).rejects.toThrow(
      "API request to https://api.example.com/api/v1/projects/ returned text/plain instead of JSON: ok",
    )
  })

  it("throws when a successful JSON response cannot be parsed", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const fetchMock = vi.fn().mockResolvedValue(
      textResponse("{", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { apiFetch } = await import("@/lib/api")

    await expect(apiFetch("/api/v1/projects/")).rejects.toThrow(
      "API request to https://api.example.com/api/v1/projects/ returned invalid JSON: {",
    )
  })

  it("sends the expected payload for createFeedback", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 3 }))
    vi.stubGlobal("fetch", fetchMock)

    const { createFeedback } = await import("@/lib/api")
    await createFeedback(4, 9, "upvote")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/projects/4/feedback/",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: 9, feedback_type: "upvote" }),
      }),
    )
  })

  it("sends the expected payload for updateEntity", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 9 }))
    vi.stubGlobal("fetch", fetchMock)

    const { updateEntity } = await import("@/lib/api")
    await updateEntity(9, 4, { description: "Updated" })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/projects/4/entities/9/",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ description: "Updated" }),
      }),
    )
  })

  it("filters content skill results for the requested content item", async () => {
    getServerSessionMock.mockResolvedValue({ backendAuth: { access: "jwt-token" } })
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        { id: 1, content: 9, skill_name: "summarization" },
        { id: 2, content: 2, skill_name: "relevance_scoring" },
      ]),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { getContentSkillResults } = await import("@/lib/api")
    const skillResults = await getContentSkillResults(4, 9)

    expect(skillResults).toEqual([{ id: 1, content: 9, skill_name: "summarization" }])
  })

  it("requests project entities ordered by authority score descending", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal("fetch", fetchMock)

    const { getProjectEntities } = await import("@/lib/api")
    await getProjectEntities(4)

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/projects/4/entities/?ordering=-authority_score",
      expect.anything(),
    )
  })

  it("requests authority history with the requested snapshot limit", async () => {
    getServerSessionMock.mockResolvedValue(null)
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal("fetch", fetchMock)

    const { getProjectEntityAuthorityHistory } = await import("@/lib/api")
    await getProjectEntityAuthorityHistory(4, 9, 8)

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/projects/4/entities/9/authority_history/?limit=8",
      expect.anything(),
    )
  })
})

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const { loginFormMock } = vi.hoisted(() => ({
  loginFormMock: vi.fn(({ callbackUrl }: { callbackUrl: string }) => (
    <div data-testid="login-page-content" data-callback-url={callbackUrl} />
  )),
}))

vi.mock("@/app/login/_components/LoginPageContent", () => ({
  default: loginFormMock,
}))

async function loadLoginPageModule() {
  return import("./page")
}

async function renderLoginPage(
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  const { default: LoginPage } = await loadLoginPageModule()

  return render(
    await LoginPage({
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("resolveCallbackUrl", () => {
  it("returns the callback URL string when a single value is provided", async () => {
    const { resolveCallbackUrl } = await loadLoginPageModule()

    expect(resolveCallbackUrl("/content/4?project=2")).toBe(
      "/content/4?project=2",
    )
  })

  it("returns the first callback URL when repeated values are provided", async () => {
    const { resolveCallbackUrl } = await loadLoginPageModule()

    expect(resolveCallbackUrl(["/entities?project=2", "/admin/health"])).toBe(
      "/entities?project=2",
    )
  })

  it("falls back to the dashboard root when the callback URL is missing", async () => {
    const { resolveCallbackUrl } = await loadLoginPageModule()

    expect(resolveCallbackUrl(undefined)).toBe("/")
  })

  it("falls back to the dashboard root when the callback URL array is empty", async () => {
    const { resolveCallbackUrl } = await loadLoginPageModule()

    expect(resolveCallbackUrl([])).toBe("/")
  })
})

describe("LoginPage", () => {
  it("passes the normalized callback URL to LoginPageContent", async () => {
    await renderLoginPage({ callbackUrl: "/content/9?project=3" })

    expect(loginFormMock).toHaveBeenCalledWith(
      { callbackUrl: "/content/9?project=3" },
      undefined,
    )
    expect(screen.getByTestId("login-page-content")).toHaveAttribute(
      "data-callback-url",
      "/content/9?project=3",
    )
  })

  it("uses the default callback URL when none is provided", async () => {
    await renderLoginPage({})

    expect(screen.getByTestId("login-page-content")).toHaveAttribute(
      "data-callback-url",
      "/",
    )
  })
})

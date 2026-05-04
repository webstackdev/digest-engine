import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const { loginFormMock, socialAuthButtonsMock } = vi.hoisted(() => ({
  loginFormMock: vi.fn(({ callbackUrl }: { callbackUrl: string }) => (
    <div data-callback-url={callbackUrl} data-testid="login-form" />
  )),
  socialAuthButtonsMock: vi.fn(({ callbackUrl }: { callbackUrl: string }) => (
    <div data-callback-url={callbackUrl} data-testid="social-auth-buttons" />
  )),
}))

vi.mock("@/app/login/_components/LoginForm", () => ({
  default: loginFormMock,
}))

vi.mock("@/app/login/_components/SocialAuthButtons", () => ({
  default: socialAuthButtonsMock,
}))

import LoginPageContent from "."

describe("LoginPageContent", () => {
  it("renders the login shell and forwards callbackUrl to both auth entry points", () => {
    render(<LoginPageContent callbackUrl="/content/4?project=2" />)

    expect(screen.getByText("Welcome back")).toBeInTheDocument()
    expect(
      screen.getByText("Sign in with your project account or continue with an enabled social provider."),
    ).toHaveClass("text-muted-foreground")
    expect(screen.getByTestId("social-auth-buttons")).toHaveAttribute(
      "data-callback-url",
      "/content/4?project=2",
    )
    expect(screen.getByTestId("login-form")).toHaveAttribute(
      "data-callback-url",
      "/content/4?project=2",
    )
    expect(screen.getByRole("link", { name: "Django admin" })).toHaveAttribute(
      "href",
      "/admin/",
    )
  })
})

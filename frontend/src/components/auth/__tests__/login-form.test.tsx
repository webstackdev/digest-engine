import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { pushMock, refreshMock, signInMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  signInMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    refresh: refreshMock,
  }),
}))

vi.mock("next-auth/react", () => ({
  signIn: signInMock,
}))

import LoginForm from "@/components/auth/login-form"

describe("LoginForm", () => {
  beforeEach(() => {
    pushMock.mockReset()
    refreshMock.mockReset()
    signInMock.mockReset()
  })

  it("submits credentials and navigates to the returned URL on success", async () => {
    signInMock.mockResolvedValue({ url: "/entities?project=2" })

    render(<LoginForm callbackUrl="/content/4?project=2" />)

    fireEvent.change(screen.getByLabelText("Username or email"), {
      target: { value: "  alice@example.com  " },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse-battery-staple" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith("credentials", {
        username: "alice@example.com",
        password: "correct-horse-battery-staple",
        callbackUrl: "/content/4?project=2",
        redirect: false,
      })
    })

    expect(pushMock).toHaveBeenCalledWith("/entities?project=2")
    expect(refreshMock).toHaveBeenCalled()
  })

  it("renders an authentication error returned by next-auth", async () => {
    signInMock.mockResolvedValue({ error: "Invalid credentials" })

    render(<LoginForm callbackUrl="/" />)

    fireEvent.change(screen.getByLabelText("Username or email"), {
      target: { value: "alice" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    expect(
      await screen.findByText("Invalid credentials"),
    ).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("shows a fallback error when signIn returns no response", async () => {
    signInMock.mockResolvedValue(null)

    render(<LoginForm callbackUrl="/" />)

    fireEvent.change(screen.getByLabelText("Username or email"), {
      target: { value: "alice" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    expect(
      await screen.findByText("Unable to sign in right now."),
    ).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })
})

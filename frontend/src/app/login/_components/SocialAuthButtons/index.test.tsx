import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { signInMock } = vi.hoisted(() => ({
  signInMock: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  signIn: signInMock,
}))

import SocialAuthButtons from "."

describe("SocialAuthButtons", () => {
  beforeEach(() => {
    signInMock.mockReset()
  })

  it("starts GitHub and Google sign-in flows with the provided callbackUrl", () => {
    render(<SocialAuthButtons callbackUrl="/content/4?project=2" />)

    fireEvent.click(screen.getByRole("button", { name: /Continue with GitHub/i }))
    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/i }))

    expect(signInMock).toHaveBeenNthCalledWith(1, "github", {
      callbackUrl: "/content/4?project=2",
    })
    expect(signInMock).toHaveBeenNthCalledWith(2, "google", {
      callbackUrl: "/content/4?project=2",
    })
  })
})

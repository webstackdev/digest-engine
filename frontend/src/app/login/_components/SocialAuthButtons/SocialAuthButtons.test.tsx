import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { signInMock } = vi.hoisted(() => ({
  signInMock: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  signIn: signInMock,
}))

import SocialAuthButtons from "@/app/login/_components/SocialAuthButtons"

describe("SocialAuthButtons", () => {
  beforeEach(() => {
    signInMock.mockReset()
  })

  it("starts GitHub and Google sign-in flows", () => {
    render(<SocialAuthButtons />)

    fireEvent.click(screen.getByRole("button", { name: /Continue with GitHub/i }))
    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/i }))

    expect(signInMock).toHaveBeenNthCalledWith(1, "github")
    expect(signInMock).toHaveBeenNthCalledWith(2, "google")
  })
})

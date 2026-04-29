import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { UserMenu } from "@/components/user-menu"

const { getSessionMock, signOutMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  signOutMock: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  getSession: getSessionMock,
  signOut: signOutMock,
}))

describe("UserMenu", () => {
  beforeEach(() => {
    getSessionMock.mockReset()
    signOutMock.mockReset()
  })

  it("renders initials from the current session and toggles the dropdown", async () => {
    getSessionMock.mockResolvedValue({
      user: {
        name: "Taylor Swift",
        email: "taylor@example.com",
      },
    })

    render(<UserMenu />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open user menu" })).toHaveTextContent("TS")
    })

    fireEvent.click(screen.getByRole("button", { name: "Open user menu" }))

    expect(screen.getByRole("menu")).toBeInTheDocument()
    expect(screen.getByText("Taylor Swift")).toBeInTheDocument()
    expect(screen.getByText("taylor@example.com")).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument()
  })

  it("logs out to the login page from the dropdown", async () => {
    getSessionMock.mockResolvedValue({
      user: {
        name: "Morgan Lee",
        email: "morgan@example.com",
      },
    })

    render(<UserMenu />)

    fireEvent.click(screen.getByRole("button", { name: "Open user menu" }))

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }))

    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/login" })
  })
})
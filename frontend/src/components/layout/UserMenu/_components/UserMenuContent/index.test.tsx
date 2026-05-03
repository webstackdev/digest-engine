import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

import { UserMenuContent } from "."

const { signOutMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  signOut: signOutMock,
}))

function renderMenuContent(props: ComponentProps<typeof UserMenuContent>) {
  render(
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Open user menu">Open</DropdownMenuTrigger>
      <UserMenuContent {...props} />
    </DropdownMenu>,
  )

  fireEvent.click(screen.getByRole("button", { name: "Open user menu" }))
}

describe("UserMenuContent", () => {
  it("renders account details and the authenticated actions", () => {
    renderMenuContent({
      accountEmail: "taylor@example.com",
      accountName: "Taylor Swift",
      avatarUrl: null,
      isAuthenticated: true,
    })

    expect(screen.getByText("Taylor Swift")).toBeInTheDocument()
    expect(screen.getByText("taylor@example.com")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View profile" })).toHaveAttribute(
      "href",
      "/profile",
    )
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument()
  })

  it("logs out to the login page and shows the guest fallback copy", () => {
    renderMenuContent({
      accountEmail: "",
      accountName: "Guest user",
      avatarUrl: null,
      isAuthenticated: false,
    })

    expect(
      screen.getByText("No active NextAuth session was found for this browser."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Log out" })).not.toBeInTheDocument()
  })

  it("logs out to the login page for authenticated accounts", () => {
    signOutMock.mockClear()

    renderMenuContent({
      accountEmail: "morgan@example.com",
      accountName: "Morgan Lee",
      avatarUrl: null,
      isAuthenticated: true,
    })

    fireEvent.click(screen.getByRole("button", { name: "Log out" }))

    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/login" })
  })
})
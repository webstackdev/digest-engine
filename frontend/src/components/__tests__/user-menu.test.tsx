import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { QueryProvider } from "@/components/query-provider"
import { UserMenu } from "@/components/user-menu"

const { fetchProfileMock, signOutMock } = vi.hoisted(() => ({
  fetchProfileMock: vi.fn(),
  signOutMock: vi.fn(),
}))

vi.mock("@/lib/profile", () => ({
  PROFILE_QUERY_KEY: ["profile"],
  fetchProfile: fetchProfileMock,
}))

vi.mock("next-auth/react", () => ({
  signOut: signOutMock,
}))

function renderMenu() {
  return render(
    <QueryProvider>
      <UserMenu />
    </QueryProvider>,
  )
}

describe("UserMenu", () => {
  beforeEach(() => {
    fetchProfileMock.mockReset()
    signOutMock.mockReset()
  })

  it("renders profile data from the shared profile query and toggles the dropdown", async () => {
    fetchProfileMock.mockResolvedValue({
      id: 7,
      username: "taylor",
      email: "taylor@example.com",
      display_name: "Taylor Swift",
      avatar_url: null,
      avatar_thumbnail_url: null,
      bio: "Editor",
      timezone: "UTC",
      first_name: "Taylor",
      last_name: "Swift",
    })

    renderMenu()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open user menu" })).toHaveTextContent("TS")
    })

    fireEvent.click(screen.getByRole("button", { name: "Open user menu" }))

    expect(screen.getByRole("menu")).toBeInTheDocument()
    expect(screen.getByText("Taylor Swift")).toBeInTheDocument()
    expect(screen.getByText("taylor@example.com")).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "View profile" })).toHaveAttribute(
      "href",
      "/profile",
    )
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument()
  })

  it("logs out to the login page from the dropdown", async () => {
    fetchProfileMock.mockResolvedValue({
      id: 8,
      username: "morgan",
      email: "morgan@example.com",
      display_name: "Morgan Lee",
      avatar_url: null,
      avatar_thumbnail_url: null,
      bio: "Editor",
      timezone: "UTC",
      first_name: "Morgan",
      last_name: "Lee",
    })

    renderMenu()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open user menu" })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Open user menu" }))

    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }))

    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: "/login" })
  })
})

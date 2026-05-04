import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AppShellHeader } from "."

const { notificationMenuMock } = vi.hoisted(() => ({
  notificationMenuMock: vi.fn(() => <div>Notification menu</div>),
}))

vi.mock("@/components/elements/ThemeToggle", () => ({
  ThemeToggle: () => <div>Theme toggle</div>,
}))

vi.mock("@/components/layout/NotificationMenu", () => ({
  NotificationMenu: notificationMenuMock,
}))

vi.mock("@/components/layout/UserMenu", () => ({
  UserMenu: () => <div>User menu</div>,
}))

describe("AppShellHeader", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    notificationMenuMock.mockClear()
  })

  it("renders the page title, description, and shared controls", () => {
    vi.stubEnv("NEWSLETTER_API_INTERNAL_URL", "https://api.example.com")

    render(
      <AppShellHeader
        eyebrow="AI Weekly Dashboard"
        description="A test description"
        messagesHref="/messages?project=7"
        title="Dashboard"
      />,
    )

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument()
    expect(screen.getByText("AI Weekly Dashboard")).toBeInTheDocument()
    expect(screen.getByText("A test description")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Start a new message" })).toHaveAttribute(
      "href",
      "/messages?project=7",
    )
    expect(screen.getByText("Notification menu")).toBeInTheDocument()
    expect(screen.getByText("Theme toggle")).toBeInTheDocument()
    expect(screen.getByText("User menu")).toBeInTheDocument()
    expect(notificationMenuMock).toHaveBeenCalledWith(
      expect.objectContaining({ websocketUrl: "wss://api.example.com/ws/notifications/" }),
      undefined,
    )
  })
})

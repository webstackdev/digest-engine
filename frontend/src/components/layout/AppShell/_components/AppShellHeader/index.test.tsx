import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppShellHeader } from "."

vi.mock("@/components/elements/ThemeToggle", () => ({
  ThemeToggle: () => <div>Theme toggle</div>,
}))

vi.mock("@/components/layout/NotificationMenu", () => ({
  NotificationMenu: () => <div>Notification menu</div>,
}))

vi.mock("@/components/layout/UserMenu", () => ({
  UserMenu: () => <div>User menu</div>,
}))

describe("AppShellHeader", () => {
  it("renders the page title, description, and shared controls", () => {
    render(
      <AppShellHeader
        description="A test description"
        messagesHref="/messages?project=7"
        title="Dashboard"
      />,
    )

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument()
    expect(screen.getByText("Minimal dashboard")).toBeInTheDocument()
    expect(screen.getByText("A test description")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Start a new message" })).toHaveAttribute(
      "href",
      "/messages?project=7",
    )
    expect(screen.getByText("Notification menu")).toBeInTheDocument()
    expect(screen.getByText("Theme toggle")).toBeInTheDocument()
    expect(screen.getByText("User menu")).toBeInTheDocument()
  })
})

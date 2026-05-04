import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AppShell } from "@/components/layout/AppShell"
import type { Project } from "@/lib/types"

const { getMessageThreadsMock } = vi.hoisted(() => ({
  getMessageThreadsMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  getMessageThreads: getMessageThreadsMock,
}))

vi.mock("@/components/layout/AppShell/_components/AppShellHeader", () => ({
  AppShellHeader: ({
    eyebrow,
    description,
    messagesHref,
    title,
  }: {
    eyebrow: string
    description: string
    messagesHref: string
    title: string
  }) => (
    <div data-eyebrow={eyebrow} data-messages-href={messagesHref} data-testid="app-shell-header">
      <span>{title}</span>
      <span>{description}</span>
    </div>
  ),
}))

vi.mock("@/components/layout/AppShell/_components/AppShellSidebar", () => ({
  AppShellSidebar: ({
    canManageMembers,
    initialMessageThreads,
    projectQuery,
    projects,
    selectedProjectId,
  }: {
    canManageMembers: boolean
    initialMessageThreads: Array<{ id: number; has_unread: boolean }>
    projectQuery: string
    projects: Project[]
    selectedProjectId: number | null
  }) => (
    <div
      data-can-manage-members={canManageMembers ? "true" : "false"}
      data-message-thread-count={initialMessageThreads.length}
      data-project-query={projectQuery}
      data-projects={projects.length}
      data-selected-project-id={selectedProjectId ?? "none"}
      data-testid="app-shell-sidebar"
      data-unread-message-thread-count={initialMessageThreads.filter((thread) => thread.has_unread).length}
    />
  ),
}))

const projects: Project[] = [
  {
    id: 1,
    name: "AI Weekly",
    topic_description: "Applied AI",
    content_retention_days: 30,
    user_role: "admin",
    created_at: "2026-04-27T00:00:00Z",
  },
  {
    id: 2,
    name: "Platform Weekly",
    topic_description: "Platform engineering",
    content_retention_days: 30,
    user_role: "member",
    created_at: "2026-04-27T00:00:00Z",
  },
]

describe("AppShell", () => {
  beforeEach(() => {
    getMessageThreadsMock.mockReset()
    getMessageThreadsMock.mockResolvedValue([
      { id: 1, has_unread: true },
      { id: 2, has_unread: false },
      { id: 3, has_unread: true },
    ])
  })

  it("renders the extracted shell regions, child content, and message summary", async () => {
    render(
      await AppShell({
        title: "Dashboard",
        description: "A test description",
        projects,
        selectedProjectId: 1,
        children: <div>Child content</div>,
      }),
    )

    expect(screen.getByTestId("app-shell-sidebar")).toHaveAttribute(
      "data-project-query",
      "?project=1",
    )
    expect(screen.getByTestId("app-shell-sidebar")).toHaveAttribute(
      "data-can-manage-members",
      "true",
    )
    expect(screen.getByTestId("app-shell-sidebar")).toHaveAttribute(
      "data-message-thread-count",
      "3",
    )
    expect(screen.getByTestId("app-shell-sidebar")).toHaveAttribute(
      "data-unread-message-thread-count",
      "2",
    )
    expect(screen.getByTestId("app-shell-header")).toHaveTextContent("Dashboard")
    expect(screen.getByTestId("app-shell-header")).toHaveTextContent("A test description")
    expect(screen.getByTestId("app-shell-header")).toHaveAttribute(
      "data-eyebrow",
      "AI Weekly Dashboard",
    )
    expect(screen.getByTestId("app-shell-header")).toHaveAttribute(
      "data-messages-href",
      "/messages?project=1",
    )
    expect(screen.getByText("Child content")).toBeInTheDocument()
  })

  it("falls back to an empty message summary when the fetch fails", async () => {
    getMessageThreadsMock.mockRejectedValue(new Error("boom"))

    render(
      await AppShell({
        title: "Dashboard",
        description: "A test description",
        projects,
        selectedProjectId: 2,
        children: <div>Child content</div>,
      }),
    )

    expect(screen.getByTestId("app-shell-sidebar")).toHaveAttribute(
      "data-project-query",
      "?project=2",
    )
    expect(screen.getByTestId("app-shell-sidebar")).toHaveAttribute(
      "data-can-manage-members",
      "false",
    )
    expect(screen.getByTestId("app-shell-sidebar")).toHaveAttribute(
      "data-message-thread-count",
      "0",
    )
    expect(screen.getByTestId("app-shell-sidebar")).toHaveAttribute(
      "data-unread-message-thread-count",
      "0",
    )
    expect(screen.getByTestId("app-shell-header")).toHaveAttribute(
      "data-eyebrow",
      "Platform Weekly Dashboard",
    )
    expect(screen.getByTestId("app-shell-header")).toHaveAttribute(
      "data-messages-href",
      "/messages?project=2",
    )
  })
})

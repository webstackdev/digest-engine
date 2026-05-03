import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { Project } from "@/lib/types"

import { AppShellSidebar } from "."

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

describe("AppShellSidebar", () => {
  it("adds the selected project query string to navigation links and marks the active project", () => {
    render(
      <AppShellSidebar
        canManageMembers={false}
        projectQuery="?project=2"
        projects={projects}
        selectedProjectId={2}
      />,
    )

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/?project=2",
    )
    expect(screen.getByRole("link", { name: "Trends" })).toHaveAttribute(
      "href",
      "/trends?project=2",
    )
    expect(screen.getByRole("link", { name: "Themes" })).toHaveAttribute(
      "href",
      "/themes?project=2",
    )
    expect(screen.getByRole("link", { name: "Ideas" })).toHaveAttribute(
      "href",
      "/ideas?project=2",
    )
    expect(screen.getByRole("link", { name: "Drafts" })).toHaveAttribute(
      "href",
      "/drafts?project=2",
    )
    expect(screen.getByRole("link", { name: "Entities" })).toHaveAttribute(
      "href",
      "/entities?project=2",
    )
    expect(
      screen.getByRole("link", { name: "Ingestion health" }),
    ).toHaveAttribute("href", "/admin/health?project=2")
    expect(
      screen.getByRole("link", { name: "Source configs" }),
    ).toHaveAttribute("href", "/admin/sources?project=2")
    expect(screen.getByRole("link", { name: "New project" })).toHaveAttribute(
      "href",
      "/admin/projects/new",
    )
    expect(screen.queryByRole("link", { name: "Members" })).not.toBeInTheDocument()

    const activeProject = screen.getByRole("link", { name: /Platform Weekly/i })
    const inactiveProject = screen.getByRole("link", { name: /AI Weekly/i })

    expect(activeProject).toHaveAttribute("data-active", "true")
    expect(inactiveProject).toHaveAttribute("data-active", "false")
  })

  it("shows the members link when the selected project role is admin", () => {
    render(
      <AppShellSidebar
        canManageMembers
        projectQuery="?project=1"
        projects={projects}
        selectedProjectId={1}
      />,
    )

    expect(screen.getByRole("link", { name: "Members" })).toHaveAttribute(
      "href",
      "/projects/1/members?project=1",
    )
  })
})
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Project } from "@/lib/types"

const { getProjectsMock, inviteMemberPageContentMock } = vi.hoisted(() => ({
  getProjectsMock: vi.fn(),
  inviteMemberPageContentMock: vi.fn(() => <div data-testid="invite-member-page-content" />),
}))

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({
    children,
    description,
    selectedProjectId,
    title,
  }: {
    children: ReactNode
    description: string
    selectedProjectId: number | null
    title: string
  }) => (
    <div data-selected-project-id={selectedProjectId ?? "null"} data-testid="app-shell">
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
}))

vi.mock("@/app/projects/[id]/members/invite/_components/InviteMemberPageContent", () => ({
  InviteMemberPageContent: inviteMemberPageContentMock,
}))

vi.mock("@/lib/api", () => ({
  getProjects: getProjectsMock,
}))

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: "AI Weekly",
    topic_description: "AI news",
    content_retention_days: 30,
    user_role: "admin",
    created_at: "2026-04-01T00:00:00Z",
    ...overrides,
  }
}

async function renderInviteMemberPage(
  searchParams: Record<string, string | string[] | undefined> = { project: "1" },
) {
  const { default: InviteMemberPage } = await import("./page")

  return render(
    await InviteMemberPage({
      params: Promise.resolve({ id: "1" }),
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("InviteMemberPage", () => {
  beforeEach(() => {
    getProjectsMock.mockReset()
    inviteMemberPageContentMock.mockClear()
    getProjectsMock.mockResolvedValue([createProject()])
  })

  it("renders the non-admin guard for visible projects without admin rights", async () => {
    getProjectsMock.mockResolvedValue([createProject({ user_role: "member" })])

    await renderInviteMemberPage()

    expect(screen.getByText("You need the admin role on this project to invite new members.")).toBeInTheDocument()
  })

  it("renders the missing-project guard when the project is unavailable", async () => {
    getProjectsMock.mockResolvedValue([])

    await renderInviteMemberPage()

    expect(screen.getByText("Select a visible project first.")).toBeInTheDocument()
    expect(screen.getByTestId("app-shell")).toHaveAttribute("data-selected-project-id", "null")
  })

  it("loads InviteMemberPageContent with flash messages", async () => {
    const project = createProject()

    getProjectsMock.mockResolvedValue([project])

    await renderInviteMemberPage({ project: "1", message: "Invitation sent." })

    expect(inviteMemberPageContentMock).toHaveBeenCalled()
    const props = (inviteMemberPageContentMock.mock.calls[0] as unknown[] | undefined)?.[0]

    expect(props).toEqual({
      projects: [project],
      selectedProject: project,
      errorMessage: "",
      successMessage: "Invitation sent.",
    })
    expect(screen.getByTestId("invite-member-page-content")).toBeInTheDocument()
  })
})
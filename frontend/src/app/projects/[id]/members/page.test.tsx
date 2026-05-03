import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Project } from "@/lib/types"

const {
  getCurrentUserProfileMock,
  getProjectInvitationsMock,
  getProjectMembershipsMock,
  getProjectsMock,
  membersPageContentMock,
} = vi.hoisted(() => ({
  getCurrentUserProfileMock: vi.fn(),
  getProjectInvitationsMock: vi.fn(),
  getProjectMembershipsMock: vi.fn(),
  getProjectsMock: vi.fn(),
  membersPageContentMock: vi.fn(() => <div data-testid="members-page-content" />),
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

vi.mock("@/app/projects/[id]/members/_components/MembersPageContent", () => ({
  MembersPageContent: membersPageContentMock,
}))

vi.mock("@/lib/api", () => ({
  getCurrentUserProfile: getCurrentUserProfileMock,
  getProjectInvitations: getProjectInvitationsMock,
  getProjectMemberships: getProjectMembershipsMock,
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

async function renderMembersPage(
  searchParams: Record<string, string | string[] | undefined> = { project: "1" },
) {
  const { default: MembersPage } = await import("./page")

  return render(
    await MembersPage({
      params: Promise.resolve({ id: "1" }),
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("MembersPage", () => {
  beforeEach(() => {
    getCurrentUserProfileMock.mockReset()
    getProjectsMock.mockReset()
    getProjectMembershipsMock.mockReset()
    getProjectInvitationsMock.mockReset()
    membersPageContentMock.mockClear()

    getCurrentUserProfileMock.mockResolvedValue({ id: 99 })
    getProjectsMock.mockResolvedValue([createProject()])
    getProjectMembershipsMock.mockResolvedValue([])
    getProjectInvitationsMock.mockResolvedValue([])
  })

  it("renders the non-admin guard for visible projects without admin rights", async () => {
    getProjectsMock.mockResolvedValue([createProject({ user_role: "member" })])

    await renderMembersPage()

    expect(screen.getByText("You need the admin role on this project to manage members.")).toBeInTheDocument()
    expect(getProjectMembershipsMock).not.toHaveBeenCalled()
  })

  it("renders the missing-project guard when the project is unavailable", async () => {
    getProjectsMock.mockResolvedValue([])

    await renderMembersPage()

    expect(screen.getByText("Select a visible project first.")).toBeInTheDocument()
    expect(screen.getByTestId("app-shell")).toHaveAttribute("data-selected-project-id", "null")
  })

  it("loads memberships and invitations into MembersPageContent", async () => {
    const project = createProject()
    const memberships = [{ id: 4 }]
    const invitations = [{ id: 9 }]

    getProjectsMock.mockResolvedValue([project])
    getProjectMembershipsMock.mockResolvedValue(memberships)
    getProjectInvitationsMock.mockResolvedValue(invitations)

    await renderMembersPage({ project: "1", message: "Invitation revoked." })

    expect(membersPageContentMock).toHaveBeenCalled()
    const props = (membersPageContentMock.mock.calls[0] as unknown[] | undefined)?.[0]

    expect(props).toEqual({
      currentUserId: 99,
      projects: [project],
      selectedProject: project,
      memberships,
      invitations,
      errorMessage: "",
      successMessage: "Invitation revoked.",
    })
    expect(screen.getByTestId("members-page-content")).toBeInTheDocument()
  })
})

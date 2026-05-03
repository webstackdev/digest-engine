import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  DirectMessage,
  MessageThread,
  Project,
  ProjectMembership,
  UserProfile,
} from "@/lib/types"

const {
  getCurrentUserProfileMock,
  getMessageThreadsMock,
  getProjectMembershipsMock,
  getProjectsMock,
  getThreadMessagesMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  getCurrentUserProfileMock: vi.fn(),
  getMessageThreadsMock: vi.fn(),
  getProjectMembershipsMock: vi.fn(),
  getProjectsMock: vi.fn(),
  getThreadMessagesMock: vi.fn(),
  selectProjectMock: vi.fn(),
}))

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({
    children,
    description,
    title,
  }: {
    children: ReactNode
    description: string
    title: string
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
}))

vi.mock("@/app/messages/_components/MessagesPageContent", () => ({
  MessagesPageContent: ({
    availableRecipients,
    initialRecipientUserId,
    initialSelectedThreadId,
  }: {
    availableRecipients: ProjectMembership[]
    initialRecipientUserId: number | null
    initialSelectedThreadId: number | null
  }) => (
    <div>
      Messages content {initialSelectedThreadId}
      <span>Recipients {availableRecipients.length}</span>
      <span>Recipient {initialRecipientUserId ?? "none"}</span>
    </div>
  ),
}))

vi.mock("@/lib/api", () => ({
  getCurrentUserProfile: getCurrentUserProfileMock,
  getMessageThreads: getMessageThreadsMock,
  getProjectMemberships: getProjectMembershipsMock,
  getProjects: getProjectsMock,
  getThreadMessages: getThreadMessagesMock,
}))

vi.mock("@/lib/view-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/view-helpers")>(
    "@/lib/view-helpers",
  )

  return {
    ...actual,
    selectProject: selectProjectMock,
  }
})

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

function createThread(overrides: Partial<MessageThread> = {}): MessageThread {
  return {
    id: 7,
    counterpart: {
      id: 8,
      username: "maya",
      display_name: "Maya",
      avatar_url: null,
      avatar_thumbnail_url: null,
    },
    has_unread: true,
    last_message_preview: "Can you review this draft?",
    last_message_at: "2026-05-03T10:00:00Z",
    last_read_at: null,
    created_at: "2026-05-01T10:00:00Z",
    ...overrides,
  }
}

function createMessage(overrides: Partial<DirectMessage> = {}): DirectMessage {
  return {
    id: 11,
    thread: 7,
    sender: 8,
    sender_username: "maya",
    sender_display_name: "Maya",
    body: "Can you review this draft?",
    created_at: "2026-05-03T10:00:00Z",
    edited_at: null,
    ...overrides,
  }
}

function createCurrentUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 4,
    username: "editor",
    email: "editor@example.com",
    display_name: "Editor",
    avatar_url: null,
    avatar_thumbnail_url: null,
    bio: "",
    timezone: "UTC",
    first_name: "Edit",
    last_name: "Or",
    ...overrides,
  }
}

function createMembership(overrides: Partial<ProjectMembership> = {}): ProjectMembership {
  return {
    id: 3,
    project: 1,
    user: 8,
    username: "maya",
    email: "maya@example.com",
    display_name: "Maya",
    role: "member",
    invited_by: 4,
    joined_at: "2026-05-01T10:00:00Z",
    ...overrides,
  }
}

async function renderMessagesPage(searchParams: Record<string, string> = {}) {
  const { default: MessagesPage } = await import("./page")

  return render(
    await MessagesPage({
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("MessagesPage", () => {
  beforeEach(() => {
    const project = createProject()

    getProjectsMock.mockReset()
    getCurrentUserProfileMock.mockReset()
    getMessageThreadsMock.mockReset()
    getProjectMembershipsMock.mockReset()
    getThreadMessagesMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([project])
    getCurrentUserProfileMock.mockResolvedValue(createCurrentUser())
    getMessageThreadsMock.mockResolvedValue([createThread()])
    getProjectMembershipsMock.mockResolvedValue([
      createMembership(),
      createMembership({
        id: 4,
        user: 4,
        username: "editor",
        email: "editor@example.com",
        display_name: "Editor",
        role: "admin",
      }),
    ])
    getThreadMessagesMock.mockResolvedValue([createMessage()])
    selectProjectMock.mockReturnValue(project)
  })

  it("renders the messages workspace with the selected thread history", async () => {
    await renderMessagesPage({ project: "1", thread: "7" })

    expect(getProjectMembershipsMock).toHaveBeenCalledWith(1)
    expect(getThreadMessagesMock).toHaveBeenCalledWith(7)
    expect(screen.getByText("Messages content 7")).toBeInTheDocument()
    expect(screen.getByText("Recipients 1")).toBeInTheDocument()
    expect(screen.getByText("Recipient none")).toBeInTheDocument()
  })

  it("selects the matching thread when navigated from a recipient context", async () => {
    await renderMessagesPage({ project: "1", recipient: "8" })

    expect(getThreadMessagesMock).toHaveBeenCalledWith(7)
    expect(screen.getByText("Messages content 7")).toBeInTheDocument()
    expect(screen.getByText("Recipient 8")).toBeInTheDocument()
  })

  it("renders the empty project state when no project is available", async () => {
    getProjectsMock.mockResolvedValue([])
    selectProjectMock.mockReturnValue(null)

    await renderMessagesPage()

    expect(screen.getByText("Messages")).toBeInTheDocument()
    expect(screen.getByText("Create a project first in Django admin.")).toBeInTheDocument()
  })
})
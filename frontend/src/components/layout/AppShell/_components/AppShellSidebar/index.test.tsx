import { useQueryClient } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { useEffect } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { fetchMessageThreads, MESSAGE_THREADS_QUERY_KEY } from "@/lib/messages"
import type { Project } from "@/lib/types"
import { QueryProvider } from "@/providers/QueryProvider"

import { AppShellSidebar } from "."

vi.mock("@/lib/messages", () => ({
  MESSAGE_THREADS_QUERY_KEY: ["message-threads"],
  fetchMessageThreads: vi.fn(),
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

function renderSidebar(
  props: Partial<React.ComponentProps<typeof AppShellSidebar>> = {},
) {
  return render(
    <QueryProvider>
      <AppShellSidebar
        canManageMembers={false}
        initialMessageThreads={[]}
        projectQuery="?project=2"
        projects={projects}
        selectedProjectId={2}
        {...props}
      />
    </QueryProvider>,
  )
}

function CacheUpdater({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  useEffect(() => {
    queryClient.setQueryData(MESSAGE_THREADS_QUERY_KEY, [
      {
        id: 1,
        counterpart: null,
        has_unread: true,
        last_message_preview: "Draft ready",
        last_message_at: "2026-05-03T10:00:00Z",
        last_read_at: null,
        created_at: "2026-05-01T10:00:00Z",
      },
      {
        id: 2,
        counterpart: null,
        has_unread: false,
        last_message_preview: "On it.",
        last_message_at: "2026-05-03T10:01:00Z",
        last_read_at: "2026-05-03T10:01:00Z",
        created_at: "2026-05-01T10:00:00Z",
      },
    ])
  }, [queryClient])

  return <>{children}</>
}

describe("AppShellSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchMessageThreads).mockResolvedValue([])
  })

  it("adds the selected project query string to navigation links and marks the active project", () => {
    renderSidebar()

    expect(screen.getByText("Current project")).toBeInTheDocument()
    expect(screen.getAllByText("Platform Weekly").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Platform engineering").length).toBeGreaterThan(0)
    expect(screen.getByText("Switch project")).toBeInTheDocument()
    expect(screen.queryByText("Digest Engine")).not.toBeInTheDocument()
    expect(screen.queryByText("Editor cockpit")).not.toBeInTheDocument()

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/?project=2",
    )
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "href",
      "/messages?project=2",
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
    renderSidebar({
      canManageMembers: true,
      projectQuery: "?project=1",
      selectedProjectId: 1,
    })

    expect(screen.getByRole("link", { name: "Members" })).toHaveAttribute(
      "href",
      "/projects/1/members?project=1",
    )
  })

  it("shows total and unread message badges on the messages link", () => {
    vi.mocked(fetchMessageThreads).mockResolvedValue([
      {
        id: 1,
        counterpart: null,
        has_unread: true,
        last_message_preview: "Can you review this draft?",
        last_message_at: "2026-05-03T10:00:00Z",
        last_read_at: null,
        created_at: "2026-05-01T10:00:00Z",
      },
      {
        id: 2,
        counterpart: null,
        has_unread: true,
        last_message_preview: "Second thread",
        last_message_at: "2026-05-03T10:03:00Z",
        last_read_at: null,
        created_at: "2026-05-01T10:00:00Z",
      },
      {
        id: 3,
        counterpart: null,
        has_unread: false,
        last_message_preview: "Third thread",
        last_message_at: "2026-05-03T10:02:00Z",
        last_read_at: "2026-05-03T10:02:00Z",
        created_at: "2026-05-01T10:00:00Z",
      },
    ])

    renderSidebar({
      initialMessageThreads: [
        {
          id: 1,
          counterpart: null,
          has_unread: true,
          last_message_preview: "Can you review this draft?",
          last_message_at: "2026-05-03T10:00:00Z",
          last_read_at: null,
          created_at: "2026-05-01T10:00:00Z",
        },
        {
          id: 2,
          counterpart: null,
          has_unread: true,
          last_message_preview: "Second thread",
          last_message_at: "2026-05-03T10:03:00Z",
          last_read_at: null,
          created_at: "2026-05-01T10:00:00Z",
        },
        {
          id: 3,
          counterpart: null,
          has_unread: false,
          last_message_preview: "Third thread",
          last_message_at: "2026-05-03T10:02:00Z",
          last_read_at: "2026-05-03T10:02:00Z",
          created_at: "2026-05-01T10:00:00Z",
        },
      ],
    })

    expect(screen.getByRole("link", { name: /Messages/i })).toHaveAttribute(
      "href",
      "/messages?project=2",
    )
    expect(
      screen.getByRole("link", { name: "Open latest unread message thread" }),
    ).toHaveAttribute("href", "/messages?project=2&thread=2")
    expect(screen.getAllByText("3")).toHaveLength(1)
    expect(screen.getAllByText("2")).toHaveLength(1)
  })

  it("updates the message badges when the shared query cache changes", async () => {
    vi.mocked(fetchMessageThreads).mockImplementation(
      () => new Promise(() => {}),
    )

    render(
      <QueryProvider>
        <CacheUpdater>
          <AppShellSidebar
            canManageMembers={false}
            initialMessageThreads={[]}
            projectQuery="?project=2"
            projects={projects}
            selectedProjectId={2}
          />
        </CacheUpdater>
      </QueryProvider>,
    )

    expect(await screen.findByText("2")).toBeInTheDocument()
    expect(screen.getAllByText("1")).toHaveLength(1)
    expect(
      screen.getByRole("link", { name: "Open latest unread message thread" }),
    ).toHaveAttribute("href", "/messages?project=2&thread=1")
  })
})

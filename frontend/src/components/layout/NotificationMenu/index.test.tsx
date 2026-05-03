import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { NotificationMenu } from "@/components/layout/NotificationMenu"
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications"
import { QueryProvider } from "@/providers/QueryProvider"

const pushMock = vi.fn()
const sockets: FakeWebSocket[] = []

class FakeWebSocket {
  onmessage: ((event: { data: string }) => void) | null = null
  close = vi.fn()

  constructor(public readonly url: string) {
    sockets.push(this)
  }

  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: ReactNode
    onClick?: () => void
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock("@/lib/notifications", () => ({
  NOTIFICATIONS_QUERY_KEY: ["notifications"],
  fetchNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}))

function renderNotificationMenu(websocketUrl = "") {
  return render(
    <QueryProvider>
      <NotificationMenu websocketUrl={websocketUrl} />
    </QueryProvider>,
  )
}

describe("NotificationMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sockets.length = 0
    vi.stubGlobal("WebSocket", FakeWebSocket)
    vi.mocked(fetchNotifications).mockResolvedValue([
      {
        id: 1,
        project: 4,
        level: "info",
        body: "Draft ready",
        link_path: "/drafts",
        metadata: {},
        created_at: "2026-05-03T10:00:00Z",
        read_at: null,
        is_read: false,
      },
      {
        id: 2,
        project: 4,
        level: "success",
        body: "Source quality refreshed",
        link_path: "",
        metadata: {},
        created_at: "2026-05-03T09:00:00Z",
        read_at: "2026-05-03T09:05:00Z",
        is_read: true,
      },
    ])
    vi.mocked(markAllNotificationsRead).mockResolvedValue({ updated_count: 1 })
    vi.mocked(markNotificationRead).mockImplementation(async (notificationId) => ({
      id: notificationId,
      project: 4,
      level: "info",
      body: "Draft ready",
      link_path: "/drafts",
      metadata: {},
      created_at: "2026-05-03T10:00:00Z",
      read_at: "2026-05-03T10:02:00Z",
      is_read: true,
    }))
  })

  it("renders unread count and marks all notifications as read", async () => {
    const user = userEvent.setup()

    renderNotificationMenu()

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument()
    })

    expect(screen.getByText("Notification inbox")).toBeInTheDocument()
    expect(screen.getByText("Draft ready")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Mark all read" }))

    await waitFor(() => {
      expect(markAllNotificationsRead).toHaveBeenCalled()
    })
    expect(screen.queryByText("1")).not.toBeInTheDocument()
  })

  it("applies incoming websocket notifications to the query cache", async () => {
    renderNotificationMenu("ws://api.example.com/ws/notifications/")

    await waitFor(() => {
      expect(sockets).toHaveLength(1)
    })

    act(() => {
      sockets[0].emit({
        type: "notification.created",
        notification: {
          id: 9,
          project: null,
          level: "error",
          body: "Ingestion failed.",
          link_path: "/sources",
          metadata: { source_config_id: 8 },
          created_at: "2026-05-03T11:00:00Z",
          read_at: null,
          is_read: false,
        },
      })
    })

    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument()
    })

    expect(screen.getByText("Ingestion failed.")).toBeInTheDocument()
  })
})
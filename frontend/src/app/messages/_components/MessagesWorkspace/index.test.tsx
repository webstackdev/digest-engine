import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MessagesWorkspace } from "@/app/messages/_components/MessagesWorkspace"
import {
  fetchMessageThreads,
  fetchThreadMessages,
  markMessageThreadRead,
  openMessageThread,
  sendThreadMessage,
} from "@/lib/messages"
import { QueryProvider } from "@/providers/QueryProvider"

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

vi.mock("@/lib/messages", () => ({
  MESSAGE_THREADS_QUERY_KEY: ["message-threads"],
  fetchMessageThreads: vi.fn(),
  fetchThreadMessages: vi.fn(),
  markMessageThreadRead: vi.fn(),
  openMessageThread: vi.fn(),
  sendThreadMessage: vi.fn(),
  threadMessagesQueryKey: (threadId: number) => ["thread-messages", threadId],
}))

function renderWorkspace(overrides: Partial<React.ComponentProps<typeof MessagesWorkspace>> = {}) {
  return render(
    <QueryProvider>
      <MessagesWorkspace
        apiBaseUrl="https://api.example.com"
        availableRecipients={[
          {
            id: 5,
            project: 1,
            user: 8,
            username: "maya",
            email: "maya@example.com",
            display_name: "Maya",
            role: "member",
            invited_by: 4,
            joined_at: "2026-05-01T10:00:00Z",
          },
        ]}
        currentUserId={4}
        initialMessages={[
          {
            id: 11,
            thread: 7,
            sender: 8,
            sender_username: "maya",
            sender_display_name: "Maya",
            body: "Can you review this draft?",
            created_at: "2026-05-03T10:00:00Z",
            edited_at: null,
          },
        ]}
        initialRecipientUserId={null}
        initialSelectedThreadId={7}
        initialThreads={[
          {
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
          },
        ]}
        {...overrides}
      />
    </QueryProvider>,
  )
}

describe("MessagesWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sockets.length = 0
    vi.stubGlobal("WebSocket", FakeWebSocket)
    vi.mocked(fetchMessageThreads).mockResolvedValue([
      {
        id: 7,
        counterpart: {
          id: 8,
          username: "maya",
          display_name: "Maya",
          avatar_url: null,
          avatar_thumbnail_url: null,
        },
        has_unread: false,
        last_message_preview: "Can you review this draft?",
        last_message_at: "2026-05-03T10:00:00Z",
        last_read_at: "2026-05-03T10:00:00Z",
        created_at: "2026-05-01T10:00:00Z",
      },
    ])
    vi.mocked(fetchThreadMessages).mockResolvedValue([
      {
        id: 11,
        thread: 7,
        sender: 8,
        sender_username: "maya",
        sender_display_name: "Maya",
        body: "Can you review this draft?",
        created_at: "2026-05-03T10:00:00Z",
        edited_at: null,
      },
    ])
    vi.mocked(markMessageThreadRead).mockResolvedValue({
      thread_id: 7,
      last_read_at: "2026-05-03T10:00:00Z",
    })
    vi.mocked(openMessageThread).mockResolvedValue({
      id: 9,
      counterpart: {
        id: 8,
        username: "maya",
        display_name: "Maya",
        avatar_url: null,
        avatar_thumbnail_url: null,
      },
      has_unread: false,
      last_message_preview: "Starting thread",
      last_message_at: "2026-05-03T10:05:00Z",
      last_read_at: "2026-05-03T10:05:00Z",
      created_at: "2026-05-03T10:05:00Z",
    })
    vi.mocked(sendThreadMessage).mockImplementation(async (_threadId, body) => ({
      id: 12,
      thread: 7,
      sender: 4,
      sender_username: "editor",
      sender_display_name: "Editor",
      body,
      created_at: "2026-05-03T10:05:00Z",
      edited_at: null,
    }))
  })

  it("applies incoming websocket messages to the selected thread", async () => {
    renderWorkspace()

    await waitFor(() => {
      expect(sockets).toHaveLength(1)
    })

    act(() => {
      sockets[0].emit({
        type: "message.created",
        message: {
          id: 13,
          thread: 7,
          sender: 8,
          sender_username: "maya",
          sender_display_name: "Maya",
          body: "I also added notes inline.",
          created_at: "2026-05-03T10:06:00Z",
          edited_at: null,
        },
      })
    })

    await waitFor(() => {
      expect(screen.getAllByText("I also added notes inline.")).toHaveLength(2)
    })
  })

  it("sends a new reply through the internal route helper", async () => {
    const user = userEvent.setup()

    renderWorkspace()

  await user.type(screen.getByRole("textbox", { name: "Message body" }), "On it.")
    await user.click(screen.getByRole("button", { name: "Send message" }))

    await waitFor(() => {
      expect(sendThreadMessage).toHaveBeenCalledWith(7, "On it.")
    })
    expect(screen.getAllByText("On it.")).toHaveLength(2)
  })

  it("starts a new conversation with a selected collaborator", async () => {
    const user = userEvent.setup()

    vi.mocked(fetchThreadMessages).mockImplementation(async (threadId) => {
      if (threadId === 9) {
        return [
          {
            id: 20,
            thread: 9,
            sender: 4,
            sender_username: "editor",
            sender_display_name: "Editor",
            body: "Starting thread",
            created_at: "2026-05-03T10:05:00Z",
            edited_at: null,
          },
        ]
      }

      return [
        {
          id: 11,
          thread: 7,
          sender: 8,
          sender_username: "maya",
          sender_display_name: "Maya",
          body: "Can you review this draft?",
          created_at: "2026-05-03T10:00:00Z",
          edited_at: null,
        },
      ]
    })

    renderWorkspace({
      initialMessages: [],
      initialRecipientUserId: 8,
      initialSelectedThreadId: null,
      initialThreads: [],
    })

    await user.type(
      screen.getByRole("textbox", { name: "Opening message" }),
      "Starting thread",
    )
    await user.click(screen.getByRole("button", { name: "Start conversation" }))

    await waitFor(() => {
      expect(openMessageThread).toHaveBeenCalledWith({
        recipient_user_id: 8,
        opening_message: "Starting thread",
      })
    })
    expect(screen.getAllByText("Starting thread")).toHaveLength(2)
  })
})
import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MessagesPageContent } from "."

const { appShellMock, messagesWorkspaceMock } = vi.hoisted(() => ({
  appShellMock: vi.fn(({ children }: { children: React.ReactNode }) => <div>{children}</div>),
  messagesWorkspaceMock: vi.fn(() => <div>Messages workspace</div>),
}))

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: appShellMock,
}))

vi.mock("@/app/messages/_components/MessagesWorkspace", () => ({
  MessagesWorkspace: messagesWorkspaceMock,
}))

describe("MessagesPageContent", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    appShellMock.mockClear()
    messagesWorkspaceMock.mockClear()
  })

  it("passes the configured internal API base URL to the messages workspace", () => {
    vi.stubEnv("NEWSLETTER_API_INTERNAL_URL", "https://api.example.com")

    render(
      <MessagesPageContent
        availableRecipients={[]}
        currentUserId={7}
        initialMessages={[]}
        initialRecipientUserId={null}
        initialSelectedThreadId={null}
        initialThreads={[]}
        projects={[]}
        selectedProject={{ id: 3 } as never}
      />,
    )

    expect(messagesWorkspaceMock).toHaveBeenCalledWith(
      expect.objectContaining({ apiBaseUrl: "https://api.example.com" }),
      undefined,
    )
  })
})

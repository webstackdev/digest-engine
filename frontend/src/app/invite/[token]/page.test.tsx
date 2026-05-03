import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createPublicMembershipInvitation } from "@/lib/storybook-fixtures"

const { getMembershipInvitationMock, getServerSessionMock } = vi.hoisted(() => ({
  getMembershipInvitationMock: vi.fn(),
  getServerSessionMock: vi.fn(),
}))

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/api", () => ({
  getMembershipInvitation: getMembershipInvitationMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

async function renderInvitePage(
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  const { default: InvitePage } = await import("./page")

  return render(
    await InvitePage({
      params: Promise.resolve({ token: "invite-token" }),
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("InvitePage", () => {
  beforeEach(() => {
    getMembershipInvitationMock.mockReset()
    getServerSessionMock.mockReset()

    getMembershipInvitationMock.mockResolvedValue(createPublicMembershipInvitation())
    getServerSessionMock.mockResolvedValue(null)
  })

  it("renders the sign-in flow for signed-out visitors", async () => {
    await renderInvitePage()

    expect(screen.getByText("Project invitation")).toBeInTheDocument()
    expect(screen.getByText("Invited Project")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Sign in to continue" })).toHaveAttribute(
      "href",
      "/login?callbackUrl=%2Finvite%2Finvite-token",
    )
  })

  it("renders the accept button for authenticated users", async () => {
    getServerSessionMock.mockResolvedValue({ user: { email: "invitee@example.com" } })

    const { container } = await renderInvitePage()

    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeInTheDocument()
    expect(container.querySelector('input[name="redirectTo"]')).toHaveValue(
      "/invite/invite-token",
    )
  })

  it("renders invitation loading errors from the public API call", async () => {
    getMembershipInvitationMock.mockRejectedValue(new Error("Invitation lookup failed"))

    await renderInvitePage({ error: "Session expired" })

    expect(screen.getByText("Session expired")).toBeInTheDocument()
    expect(screen.getByText("Invitation lookup failed")).toBeInTheDocument()
    expect(screen.queryByText("Invited Project")).not.toBeInTheDocument()
  })
})

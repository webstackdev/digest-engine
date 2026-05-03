import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { createMembershipInvitation } from "@/lib/storybook-fixtures"

vi.mock("@/components/elements/CopyButton", () => ({
  CopyButton: ({ label }: { label: string }) => <button type="button">{label}</button>,
}))

import { InvitationsCard } from "."

describe("InvitationsCard", () => {
  it("renders an empty state when no invitations exist", () => {
    render(
      <InvitationsCard
        invitations={[]}
        projectId={7}
        redirectTarget="/projects/7/members?project=7"
      />,
    )

    expect(screen.getByText("No active or historical invitations yet.")).toBeInTheDocument()
  })

  it("renders invitation metadata and revoke action for pending invites", () => {
    const invitation = createMembershipInvitation()

    const { container } = render(
      <InvitationsCard
        invitations={[invitation]}
        projectId={7}
        redirectTarget="/projects/7/members?project=7"
      />,
    )

    expect(screen.getByText("invitee@example.com")).toBeInTheDocument()
    expect(screen.getByText("Invited by owner@example.com")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copy invite link" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument()
    expect(container.querySelector('input[name="redirectTo"]')).toHaveValue(
      "/projects/7/members?project=7",
    )
  })
})
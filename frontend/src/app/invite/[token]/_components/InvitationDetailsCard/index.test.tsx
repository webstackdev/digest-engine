import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createPublicMembershipInvitation } from "@/lib/storybook-fixtures"

import { InvitationDetailsCard } from "."

describe("InvitationDetailsCard", () => {
  it("renders the sign-in CTA for pending invitations when signed out", () => {
    render(
      <InvitationDetailsCard
        invitation={createPublicMembershipInvitation()}
        isAuthenticated={false}
        token="invite-token"
      />,
    )

    expect(screen.getByText("Invited Project")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Sign in to continue" })).toHaveAttribute(
      "href",
      "/login?callbackUrl=%2Finvite%2Finvite-token",
    )
  })

  it("renders the accept form for signed-in users", () => {
    const { container } = render(
      <InvitationDetailsCard
        invitation={createPublicMembershipInvitation()}
        isAuthenticated={true}
        token="invite-token"
      />,
    )

    expect(screen.getByRole("button", { name: "Accept invitation" })).toBeInTheDocument()
    expect(container.querySelector('input[name="redirectTo"]')).toHaveValue(
      "/invite/invite-token",
    )
  })

  it("renders resolved invitation states", () => {
    const { rerender } = render(
      <InvitationDetailsCard
        invitation={createPublicMembershipInvitation({ status: "accepted" })}
        isAuthenticated={true}
        token="invite-token"
      />,
    )

    expect(screen.getByText("This invitation has already been accepted.")).toBeInTheDocument()

    rerender(
      <InvitationDetailsCard
        invitation={createPublicMembershipInvitation({ status: "revoked" })}
        isAuthenticated={false}
        token="invite-token"
      />,
    )

    expect(screen.getByText("This invitation has been revoked.")).toBeInTheDocument()
  })
})
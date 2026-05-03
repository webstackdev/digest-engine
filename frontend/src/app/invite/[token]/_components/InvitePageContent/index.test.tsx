import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createPublicMembershipInvitation } from "@/lib/storybook-fixtures"

import { InvitePageContent } from "."

describe("InvitePageContent", () => {
  it("renders flash messages and the invitation card", () => {
    render(
      <InvitePageContent
        errorMessage="Invitation error"
        invitation={createPublicMembershipInvitation()}
        isAuthenticated={false}
        successMessage="Invitation loaded"
        token="invite-token"
      />,
    )

    expect(screen.getByText("Project invitation")).toBeInTheDocument()
    expect(screen.getByText("Invitation error")).toBeInTheDocument()
    expect(screen.getByText("Invitation loaded")).toBeInTheDocument()
    expect(screen.getByText("Invited Project")).toBeInTheDocument()
  })

  it("renders fetch failures without the invitation card", () => {
    render(
      <InvitePageContent
        invitation={null}
        invitationError="Unable to load invitation."
        isAuthenticated={false}
        token="invite-token"
      />,
    )

    expect(screen.getByText("Unable to load invitation.")).toBeInTheDocument()
    expect(screen.queryByText("Invited Project")).not.toBeInTheDocument()
  })
})

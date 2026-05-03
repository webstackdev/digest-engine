import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { InviteMemberFormCard } from "."

describe("InviteMemberFormCard", () => {
  it("renders the invite form fields and actions", () => {
    const { container } = render(
      <InviteMemberFormCard
        backHref="/projects/1/members?project=1"
        projectId={1}
        redirectTarget="/projects/1/members/invite?project=1"
      />,
    )

    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send invitation" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to members" })).toHaveAttribute(
      "href",
      "/projects/1/members?project=1",
    )
    expect(container.querySelector('input[name="redirectTo"]')).toHaveValue(
      "/projects/1/members/invite?project=1",
    )
    expect(container.querySelector('input[name="role"]')).toHaveValue("member")
  })
})
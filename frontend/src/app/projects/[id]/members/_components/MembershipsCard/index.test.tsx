import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createProjectMembership } from "@/lib/storybook-fixtures"

import { MembershipsCard } from "."

describe("MembershipsCard", () => {
  it("renders roster details and member actions", () => {
    const { container } = render(
      <MembershipsCard
        currentUserId={99}
        memberships={[createProjectMembership()]}
        projectId={7}
        redirectTarget="/projects/7/members?project=7"
      />,
    )

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument()
    expect(screen.getByText("ada@example.com")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Message" })).toHaveAttribute(
      "href",
      "/messages?project=7&recipient=2",
    )
    expect(screen.getByRole("button", { name: "Update role" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument()
    expect(container.querySelector('input[name="intent"][value="update-role"]')).toBeTruthy()
    expect(container.querySelector('input[name="intent"][value="remove"]')).toBeTruthy()
    expect(container.querySelector('input[name="role"]')).toHaveValue("admin")
  })

  it("hides the message action for the current user", () => {
    render(
      <MembershipsCard
        currentUserId={2}
        memberships={[createProjectMembership()]}
        projectId={7}
        redirectTarget="/projects/7/members?project=7"
      />,
    )

    expect(screen.queryByRole("link", { name: "Message" })).not.toBeInTheDocument()
  })
})

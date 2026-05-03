import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createProjectMembership } from "@/lib/storybook-fixtures"

import { MembershipsCard } from "."

describe("MembershipsCard", () => {
  it("renders roster details and member actions", () => {
    const { container } = render(
      <MembershipsCard
        memberships={[createProjectMembership()]}
        projectId={7}
        redirectTarget="/projects/7/members?project=7"
      />,
    )

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument()
    expect(screen.getByText("ada@example.com")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Update role" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument()
    expect(container.querySelector('input[name="intent"][value="update-role"]')).toBeTruthy()
    expect(container.querySelector('input[name="intent"][value="remove"]')).toBeTruthy()
    expect(container.querySelector('input[name="role"]')).toHaveValue("admin")
  })
})
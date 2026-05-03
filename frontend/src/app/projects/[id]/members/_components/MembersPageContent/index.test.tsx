import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import {
  createMembershipInvitation,
  createProject,
  createProjectMembership,
} from "@/lib/storybook-fixtures"

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children, title }: { children: ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}))

import { MembersPageContent } from "."

describe("MembersPageContent", () => {
  it("renders flash messages and the section entry points", () => {
    render(
      <MembersPageContent
        currentUserId={99}
        errorMessage="Unable to update member."
        invitations={[createMembershipInvitation()]}
        memberships={[createProjectMembership()]}
        projects={[createProject()]}
        selectedProject={createProject()}
        successMessage="Member updated."
      />,
    )

    expect(screen.getByText("Members")).toBeInTheDocument()
    expect(screen.getByText("Unable to update member.")).toBeInTheDocument()
    expect(screen.getByText("Member updated.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Invite member" })).toHaveAttribute(
      "href",
      "/projects/1/members/invite?project=1",
    )
  })
})

import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { createProject } from "@/lib/storybook-fixtures"

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children, title }: { children: ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}))

import { InviteMemberPageContent } from "."

describe("InviteMemberPageContent", () => {
  it("renders flash messages and the invite form shell", () => {
    render(
      <InviteMemberPageContent
        errorMessage="Unable to send invitation."
        projects={[createProject()]}
        selectedProject={createProject()}
        successMessage="Invitation sent."
      />,
    )

    expect(screen.getByText("Invite member")).toBeInTheDocument()
    expect(screen.getByText("Unable to send invitation.")).toBeInTheDocument()
    expect(screen.getByText("Invitation sent.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send invitation" })).toBeInTheDocument()
  })
})

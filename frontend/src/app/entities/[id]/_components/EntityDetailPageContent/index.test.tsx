import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import {
  createEntity,
  createEntityAuthoritySnapshot,
  createEntityMentionSummary,
  createProject,
  createProjectConfig,
} from "@/lib/storybook-fixtures"

import { EntityDetailPageContent } from "."

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({
    children,
    description,
    title,
  }: {
    children: ReactNode
    description: string
    title: string
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
}))

vi.mock("@/app/entities/[id]/_components/AuthorityWeightControls", () => ({
  AuthorityWeightControls: ({ projectId }: { projectId: number }) => (
    <div data-testid="authority-weight-controls">Authority weight controls for project {projectId}</div>
  ),
}))

describe("EntityDetailPageContent", () => {
  it("renders flash notices and extracted route sections", () => {
    const selectedProject = createProject({ id: 3, name: "Data Signals" })

    render(
      <EntityDetailPageContent
        authorityComponents={createEntityAuthoritySnapshot({ entity: 11, project: 3 })}
        authorityHistory={[createEntityAuthoritySnapshot({ entity: 11, project: 3 })]}
        entity={createEntity({ id: 11, name: "Anthropic", project: 3 })}
        errorMessage="Could not save entity"
        mentions={[createEntityMentionSummary()]}
        projectConfig={createProjectConfig({ project: 3 })}
        projects={[selectedProject]}
        selectedProject={selectedProject}
        siblingEntities={[createEntity({ id: 12, name: "OpenAI", project: 3 })]}
        successMessage="Entity updated"
      />
    )

    expect(screen.getByRole("heading", { name: "Entity detail" })).toBeInTheDocument()
    expect(screen.getByText("Could not save entity")).toBeInTheDocument()
    expect(screen.getByText("Entity updated")).toBeInTheDocument()
    expect(screen.getByText("Tracked entity")).toBeInTheDocument()
    expect(screen.getByText("Current score and history")).toBeInTheDocument()
    expect(screen.getByText("Extracted mentions linked to this entity")).toBeInTheDocument()
    expect(screen.getByText("Same-project entities")).toBeInTheDocument()
    expect(screen.getByTestId("authority-weight-controls")).toHaveTextContent(
      "Authority weight controls for project 3"
    )
  })
})
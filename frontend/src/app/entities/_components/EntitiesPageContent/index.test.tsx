import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import {
  createEntity,
  createEntityCandidate,
  createProject,
} from "@/lib/storybook-fixtures"

import { EntitiesPageContent } from "."

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

describe("EntitiesPageContent", () => {
  it("renders page-level flash notices and empty states", () => {
    render(
      <EntitiesPageContent
        entities={[]}
        entityCandidates={[]}
        errorMessage="Could not save entity"
        projects={[createProject()]}
        selectedProjectId={1}
        successMessage="Entity saved"
      />
    )

    expect(screen.getByRole("heading", { name: "Entity management" })).toBeInTheDocument()
    expect(screen.getByText("Could not save entity")).toBeInTheDocument()
    expect(screen.getByText("Entity saved")).toBeInTheDocument()
    expect(screen.getByText("No entities exist for this project yet.")).toBeInTheDocument()
    expect(screen.getByText("No pending entity candidates right now.")).toBeInTheDocument()
  })

  it("renders the extracted route sections with populated data", () => {
    render(
      <EntitiesPageContent
        entities={[createEntity({ id: 11, name: "Anthropic", project: 3 })]}
        entityCandidates={[createEntityCandidate({ project: 3 })]}
        projects={[createProject({ id: 3, name: "Data Signals" })]}
        selectedProjectId={3}
      />
    )

    expect(screen.getByText("Add a tracked person or organization")).toBeInTheDocument()
    expect(screen.getByText("River Labs")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Anthropic" })).toBeInTheDocument()
  })
})
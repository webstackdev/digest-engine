import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import {
  createProject,
  createThemeSuggestion,
  createTopicCluster,
  createTopicClusterDetail,
} from "@/lib/storybook-fixtures"

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children, title }: { children: ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}))

import { ThemesPageContent } from "."

describe("ThemesPageContent", () => {
  it("renders flash messages and the filtered theme queue", () => {
    const project = createProject()
    const theme = createThemeSuggestion()

    render(
      <ThemesPageContent
        clusterDetails={[createTopicClusterDetail()]}
        clusters={[createTopicCluster()]}
        errorMessage="Unable to update theme."
        projects={[project]}
        selectedProject={project}
        selectedThemeId={theme.id}
        statusFilter="pending"
        successMessage="Theme updated."
        themes={[theme]}
      />,
    )

    expect(screen.getByText("Theme queue")).toBeInTheDocument()
    expect(screen.getByText("Unable to update theme.")).toBeInTheDocument()
    expect(screen.getByText("Theme updated.")).toBeInTheDocument()
    expect(screen.getByText(theme.title)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Apply filter" })).toBeInTheDocument()
  })
})
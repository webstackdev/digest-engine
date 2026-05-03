import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import {
  createContent,
  createProject,
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

import { TrendsPageContent } from "."

describe("TrendsPageContent", () => {
  it("renders flash messages and cluster content", () => {
    const project = createProject()
    const cluster = createTopicClusterDetail()
    const content = createContent()

    render(
      <TrendsPageContent
        availableSources={["rss"]}
        averageVelocityScore={0.61}
        contentMap={new Map([[content.id, content]])}
        daysFilter={14}
        errorMessage="Unable to refresh trends."
        filteredClusterDetails={[cluster]}
        projects={[project]}
        selectedCluster={cluster}
        selectedProject={project}
        sourceFilter=""
        successMessage="Trends updated."
      />,
    )

    expect(screen.getByText("Trend analysis")).toBeInTheDocument()
    expect(screen.getByText("Unable to refresh trends.")).toBeInTheDocument()
    expect(screen.getByText("Trends updated.")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: cluster.label ?? "" }),
    ).toBeInTheDocument()
  })
})
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import {
  createContent,
  createEntity,
  createProject,
  createSourceConfig,
} from "@/lib/storybook-fixtures"
import type { ReviewQueueItem } from "@/lib/types"

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children, title }: { children: ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}))

import { HomePageContent } from "."

const content = createContent()
const reviewItem: ReviewQueueItem = {
  id: 7,
  project: 1,
  content: content.id,
  reason: "borderline_relevance",
  confidence: 0.61,
  created_at: "2026-04-28T12:00:00Z",
  resolved: false,
  resolution: "",
}

describe("HomePageContent", () => {
  it("renders flash messages and the content view", () => {
    const project = createProject()

    render(
      <HomePageContent
        contentClusterLookup={new Map()}
        contentMap={new Map([[content.id, content]])}
        contentTypeFilter=""
        contentTypes={["article"]}
        daysFilter={30}
        duplicateStateFilter=""
        entities={[createEntity()]}
        errorMessage="Filter failed"
        filteredContents={[content]}
        negativeFeedback={1}
        pendingReviewItems={[reviewItem]}
        positiveFeedback={1}
        projects={[project]}
        selectedProject={project}
        sourceConfigs={[createSourceConfig()]}
        sourceFilter=""
        sources={["rss"]}
        successMessage="Filters applied"
        view="content"
      />,
    )

    expect(screen.getByText("AI Weekly dashboard")).toBeInTheDocument()
    expect(screen.getByText("Filter failed")).toBeInTheDocument()
    expect(screen.getByText("Filters applied")).toBeInTheDocument()
    expect(screen.getByText(content.title)).toBeInTheDocument()
  })

  it("renders the review view when selected", () => {
    const project = createProject()

    render(
      <HomePageContent
        contentClusterLookup={new Map()}
        contentMap={new Map([[content.id, content]])}
        contentTypeFilter=""
        contentTypes={["article"]}
        daysFilter={30}
        duplicateStateFilter=""
        entities={[createEntity()]}
        filteredContents={[content]}
        negativeFeedback={0}
        pendingReviewItems={[reviewItem]}
        positiveFeedback={1}
        projects={[project]}
        selectedProject={project}
        sourceConfigs={[createSourceConfig()]}
        sourceFilter=""
        sources={["rss"]}
        view="review"
      />,
    )

    expect(screen.getByText("borderline_relevance")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument()
  })
})
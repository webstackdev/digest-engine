import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { createEntityMentionSummary } from "@/lib/storybook-fixtures"

import { EntityMentionsPanel } from "."

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

describe("EntityMentionsPanel", () => {
  it("renders linked mention history", () => {
    render(
      <EntityMentionsPanel
        mentions={[
          createEntityMentionSummary(),
          createEntityMentionSummary({
            id: 32,
            content_id: 23,
            content_title: "Platform teams discuss Anthropic",
            role: "mentioned",
            sentiment: "neutral",
            confidence: 0.76,
          }),
        ]}
        projectId={3}
      />
    )

    expect(screen.getByText("Extracted mentions linked to this entity")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Anthropic ships a safety update" })).toHaveAttribute(
      "href",
      "/content/22?project=3"
    )
    expect(screen.getByText("94% confidence")).toBeInTheDocument()
    expect(screen.getAllByText("Anthropic")).toHaveLength(2)
  })

  it("renders the empty mentions state", () => {
    render(<EntityMentionsPanel mentions={[]} projectId={1} />)

    expect(screen.getByText("No extracted mentions exist for this entity yet.")).toBeInTheDocument()
  })
})
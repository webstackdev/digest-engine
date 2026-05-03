import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createEntity } from "@/lib/storybook-fixtures"

import { EntityCard } from "."

describe("EntityCard", () => {
  it("renders the entity summary, mentions, and edit forms", () => {
    render(
      <EntityCard
        entity={createEntity({
          id: 11,
          authority_score: 0.91,
          mention_count: 2,
          name: "Anthropic",
          project: 3,
          type: "organization",
        })}
        projectId={3}
      />
    )

    expect(screen.getByRole("link", { name: "Anthropic" })).toHaveAttribute(
      "href",
      "/entities/11?project=3"
    )
    expect(screen.getByText("Authority 0.91")).toBeInTheDocument()
    expect(screen.getByText("2 mentions")).toBeInTheDocument()
    expect(screen.getByText("OpenAI ships a new agent runtime")).toBeInTheDocument()
    expect(screen.getByText("94% confidence")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete entity" })).toBeInTheDocument()

    const saveForm = screen.getByRole("button", { name: "Save changes" }).closest("form")
    expect(saveForm).toHaveAttribute("action", "/api/entities/11")
    expect(saveForm).toHaveAttribute("method", "POST")
  })

  it("renders the no-mentions state when none are available", () => {
    render(
      <EntityCard
        entity={createEntity({ id: 12, latest_mentions: [], mention_count: 0 })}
        projectId={1}
      />
    )

    expect(screen.getByText("No extracted mentions for this entity yet.")).toBeInTheDocument()
  })
})

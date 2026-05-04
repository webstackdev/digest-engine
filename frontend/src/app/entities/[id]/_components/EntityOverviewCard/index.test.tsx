import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createEntity } from "@/lib/storybook-fixtures"

import { EntityOverviewCard } from "."

describe("EntityOverviewCard", () => {
  it("renders entity metadata and identity links", () => {
    render(
      <EntityOverviewCard
        entity={createEntity({
          name: "Anthropic",
          type: "organization",
          authority_score: 0.91,
          description: "Safety-focused AI company",
          website_url: "https://anthropic.com",
          twitter_handle: "anthropicai",
          mention_count: 2,
        })}
      />
    )

    expect(screen.getByRole("heading", { name: "Anthropic" })).toBeInTheDocument()
    expect(screen.getByText("Authority 91%")).toBeInTheDocument()
    expect(screen.getByText("2 mentions")).toBeInTheDocument()
    expect(screen.getByText("2 mentions").parentElement).toHaveClass("text-muted-foreground")
    expect(screen.getByText("Safety-focused AI company")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute(
      "href",
      "https://anthropic.com"
    )
    expect(screen.getByText("Twitter anthropicai")).toBeInTheDocument()
  })

  it("renders fallbacks when no description or links are set", () => {
    render(
      <EntityOverviewCard
        entity={createEntity({
          description: "",
          website_url: "",
          github_url: "",
          linkedin_url: "",
          bluesky_handle: "",
          mastodon_handle: "",
          twitter_handle: "",
        })}
      />
    )

    expect(screen.getByText("No description is set for this entity yet.")).toBeInTheDocument()
    expect(screen.getByText("No external identity links are set yet.")).toBeInTheDocument()
  })
})

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { buildDraftDetailHref, DraftViewSwitcher } from "."

describe("buildDraftDetailHref", () => {
  it("omits the view param for the editor view", () => {
    expect(buildDraftDetailHref(1, 8, "editor")).toBe("/drafts/8?project=1")
    expect(buildDraftDetailHref(1, 8, "markdown")).toBe(
      "/drafts/8?project=1&view=markdown",
    )
  })
})

describe("DraftViewSwitcher", () => {
  it("renders the draft detail navigation links", () => {
    render(<DraftViewSwitcher currentView="editor" draftId={8} selectedProjectId={1} />)

    expect(screen.getByRole("link", { name: "Editor view" })).toHaveAttribute(
      "href",
      "/drafts/8?project=1",
    )
    expect(screen.getByRole("link", { name: "Markdown export" })).toHaveAttribute(
      "href",
      "/drafts/8?project=1&view=markdown",
    )
    expect(screen.getByRole("link", { name: "HTML export" })).toHaveAttribute(
      "href",
      "/drafts/8?project=1&view=html",
    )
    expect(screen.getByRole("link", { name: "Back to drafts" })).toHaveAttribute(
      "href",
      "/drafts?project=1",
    )
  })
})

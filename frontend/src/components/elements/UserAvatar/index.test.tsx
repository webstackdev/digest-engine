import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { UserAvatar } from "."

describe("UserAvatar", () => {
  it("renders initials when no avatar image is available", () => {
    render(<UserAvatar name="Ada Lovelace" />)

    expect(screen.getByText("AL")).toBeInTheDocument()
  })

  it("renders the provided avatar image", () => {
    render(
      <UserAvatar
        avatarUrl="https://example.com/avatar-thumb.png"
        name="Ada Lovelace"
      />,
    )

    expect(screen.getByRole("img", { name: "Ada Lovelace avatar" })).toHaveAttribute(
      "src",
      "https://example.com/avatar-thumb.png",
    )
  })
})

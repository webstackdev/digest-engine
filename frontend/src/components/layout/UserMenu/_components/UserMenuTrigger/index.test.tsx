import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DropdownMenu } from "@/components/ui/dropdown-menu"

import { UserMenuTrigger } from "."

describe("UserMenuTrigger", () => {
  it("renders initials inside the trigger when no avatar exists", () => {
    render(
      <DropdownMenu>
        <UserMenuTrigger accountName="Taylor Swift" />
      </DropdownMenu>,
    )

    expect(screen.getByRole("button", { name: "Open user menu" })).toHaveTextContent("TS")
  })

  it("renders the avatar image when available", () => {
    render(
      <DropdownMenu>
        <UserMenuTrigger
          accountName="Taylor Swift"
          avatarUrl="https://example.com/avatar-thumb.png"
        />
      </DropdownMenu>,
    )

    expect(screen.getByRole("img", { name: "Taylor Swift avatar" })).toHaveAttribute(
      "src",
      "https://example.com/avatar-thumb.png",
    )
  })
})

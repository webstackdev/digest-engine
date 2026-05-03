import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { createUserProfile } from "@/lib/storybook-fixtures"

import { AvatarPreview } from "."

describe("AvatarPreview", () => {
  it("renders initials when the profile has no avatar", () => {
    render(
      <AvatarPreview
        isRemoving={false}
        onRemove={() => {}}
        profile={createUserProfile({ avatar_url: null, avatar_thumbnail_url: null })}
      />,
    )

    expect(screen.getByText("AL")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remove avatar" })).not.toBeInTheDocument()
  })

  it("renders the current avatar and remove action", () => {
    const onRemove = vi.fn()

    render(
      <AvatarPreview
        isRemoving={false}
        onRemove={onRemove}
        profile={createUserProfile({
          avatar_url: "https://example.com/avatar.png",
          avatar_thumbnail_url: "https://example.com/avatar-thumb.png",
        })}
      />,
    )

    expect(screen.getByText("Profile image")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Remove avatar" }))
    expect(onRemove).toHaveBeenCalled()
  })
})
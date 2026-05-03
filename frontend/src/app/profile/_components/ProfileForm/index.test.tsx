import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { createUserProfile } from "@/lib/storybook-fixtures"

import { ProfileForm } from "."

describe("ProfileForm", () => {
  it("submits trimmed profile fields", () => {
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <ProfileForm isSaving={false} onSave={onSave} profile={createUserProfile()} />,
    )

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "  Ada L.  " },
    })
    fireEvent.change(screen.getByLabelText("Bio"), {
      target: { value: "  Updated bio.  " },
    })
    fireEvent.change(screen.getByLabelText("Timezone"), {
      target: { value: "  Europe/London  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }))

    expect(onSave).toHaveBeenCalledWith({
      display_name: "Ada L.",
      bio: "Updated bio.",
      timezone: "Europe/London",
    })
  })

  it("disables the save button while saving", () => {
    render(
      <ProfileForm isSaving={true} onSave={async () => {}} profile={createUserProfile()} />,
    )

    expect(screen.getByRole("button", { name: "Saving profile..." })).toBeDisabled()
  })
})
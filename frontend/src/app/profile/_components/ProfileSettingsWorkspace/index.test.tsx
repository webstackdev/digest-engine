import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { createUserProfile } from "@/lib/storybook-fixtures"

import { ProfileSettingsWorkspace } from "."

describe("ProfileSettingsWorkspace", () => {
  it("renders the profile settings sections and notice", () => {
    render(
      <ProfileSettingsWorkspace
        isRemoving={false}
        isSaving={false}
        isUploading={false}
        notice={{ message: "Profile saved.", tone: "success" }}
        onRemove={() => {}}
        onSave={async () => {}}
        onUpload={async () => {}}
        profile={createUserProfile()}
      />,
    )

    expect(screen.getByText("Profile saved.")).toBeInTheDocument()
    expect(screen.getByText("Profile image")).toBeInTheDocument()
    expect(screen.getByText("Drag, drop, or browse")).toBeInTheDocument()
    expect(screen.getByText("Profile details")).toBeInTheDocument()
  })
})

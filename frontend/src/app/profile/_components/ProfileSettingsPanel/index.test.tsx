import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createUserProfile } from "@/lib/storybook-fixtures"
import type { UserProfile } from "@/lib/types"

const {
  fetchProfileMock,
  removeProfileAvatarMock,
  saveProfileMock,
  uploadProfileAvatarMock,
} = vi.hoisted(() => ({
  fetchProfileMock: vi.fn(),
  removeProfileAvatarMock: vi.fn(),
  saveProfileMock: vi.fn(),
  uploadProfileAvatarMock: vi.fn(),
}))

vi.mock("@/lib/profile", () => ({
  PROFILE_QUERY_KEY: ["profile"],
  fetchProfile: fetchProfileMock,
  saveProfile: saveProfileMock,
  uploadProfileAvatar: uploadProfileAvatarMock,
  removeProfileAvatar: removeProfileAvatarMock,
}))

vi.mock("@/app/profile/_components/ProfileSettingsWorkspace", () => ({
  ProfileSettingsWorkspace: ({
    notice,
    onRemove,
    onSave,
    onUpload,
    profile,
  }: {
    notice: { message: string; tone: "error" | "success" } | null
    onRemove: () => void
    onSave: (payload: { display_name: string; bio: string; timezone: string }) => Promise<void>
    onUpload: (file: File) => Promise<void>
    profile: { display_name: string }
  }) => (
    <div>
      <span>{profile.display_name}</span>
      {notice ? <span>{notice.message}</span> : null}
      <button onClick={() => void onSave({ display_name: "Updated Ada", bio: "Updated", timezone: "UTC" })} type="button">
        Save
      </button>
      <button onClick={() => void onUpload(new File(["avatar"], "avatar.png", { type: "image/png" }))} type="button">
        Upload
      </button>
      <button onClick={onRemove} type="button">
        Remove
      </button>
    </div>
  ),
}))

import { ProfileSettingsPanel } from "."

function renderWithQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ProfileSettingsPanel />
    </QueryClientProvider>,
  )
}

describe("ProfileSettingsPanel", () => {
  beforeEach(() => {
    fetchProfileMock.mockReset()
    saveProfileMock.mockReset()
    uploadProfileAvatarMock.mockReset()
    removeProfileAvatarMock.mockReset()
  })

  it("renders a loading state while the profile query is pending", () => {
    fetchProfileMock.mockImplementation(
      () => new Promise<UserProfile>(() => {}),
    )

    renderWithQueryClient()

    expect(screen.getByText("Loading profile...")).toBeInTheDocument()
  })

  it("renders an error state when the profile query fails", async () => {
    fetchProfileMock.mockRejectedValue(new Error("Profile unavailable"))

    renderWithQueryClient()

    expect(await screen.findByText("Profile unavailable")).toBeInTheDocument()
  })

  it("shows a success notice after saving the profile", async () => {
    fetchProfileMock.mockResolvedValue(createUserProfile())
    saveProfileMock.mockResolvedValue(
      createUserProfile({ display_name: "Updated Ada" }),
    )

    renderWithQueryClient()

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(saveProfileMock).toHaveBeenNthCalledWith(
        1,
        {
          display_name: "Updated Ada",
          bio: "Updated",
          timezone: "UTC",
        },
        expect.any(Object),
      )
    })

    expect(await screen.findByText("Profile saved.")).toBeInTheDocument()
    expect(await screen.findByText("Updated Ada")).toBeInTheDocument()
  })
})

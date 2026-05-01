"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { AvatarDropzone } from "@/components/profile/avatar-dropzone"
import { AvatarPreview } from "@/components/profile/avatar-preview"
import { ProfileForm } from "@/components/profile/profile-form"
import {
  fetchProfile,
  PROFILE_QUERY_KEY,
  removeProfileAvatar,
  saveProfile,
  uploadProfileAvatar,
} from "@/lib/profile"
import type { UserProfile } from "@/lib/types"

type Notice = {
  message: string
  tone: "success" | "error"
}

/**
 * Render the current-user profile settings workspace.
 *
 * @returns The client-side profile settings panel.
 */
export function ProfileSettingsPanel() {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<Notice | null>(null)
  const profileQuery = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfile,
    retry: false,
  })

  const syncProfile = (profile: UserProfile) => {
    queryClient.setQueryData(PROFILE_QUERY_KEY, profile)
  }

  const saveMutation = useMutation({
    mutationFn: saveProfile,
    onSuccess: (profile) => {
      syncProfile(profile)
      setNotice({ message: "Profile saved.", tone: "success" })
    },
    onError: (error) => {
      setNotice({
        message: error instanceof Error ? error.message : "Unable to save profile.",
        tone: "error",
      })
    },
  })

  const uploadMutation = useMutation({
    mutationFn: uploadProfileAvatar,
    onSuccess: (profile) => {
      syncProfile(profile)
      setNotice({ message: "Avatar updated.", tone: "success" })
    },
    onError: (error) => {
      setNotice({
        message: error instanceof Error ? error.message : "Unable to upload avatar.",
        tone: "error",
      })
    },
  })

  const removeMutation = useMutation({
    mutationFn: removeProfileAvatar,
    onSuccess: (profile) => {
      syncProfile(profile)
      setNotice({ message: "Avatar removed.", tone: "success" })
    },
    onError: (error) => {
      setNotice({
        message: error instanceof Error ? error.message : "Unable to remove avatar.",
        tone: "error",
      })
    },
  })

  if (profileQuery.isLoading) {
    return (
      <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
        Loading profile...
      </div>
    )
  }

  if (profileQuery.isError || !profileQuery.data) {
    const message =
      profileQuery.error instanceof Error
        ? profileQuery.error.message
        : "Unable to load profile."

    return (
      <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">
        {message}
      </div>
    )
  }

  return (
    <section className="space-y-4">
      {notice ? (
        <div
          className={`rounded-panel px-4 py-4 text-sm leading-6 ${
            notice.tone === "success"
              ? "bg-muted/60 text-muted"
              : "bg-destructive/14 text-destructive"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <AvatarPreview
            isRemoving={removeMutation.isPending}
            onRemove={() => void removeMutation.mutateAsync()}
            profile={profileQuery.data}
          />
          <AvatarDropzone
            isUploading={uploadMutation.isPending}
            onUpload={async (file) => {
              await uploadMutation.mutateAsync(file)
            }}
          />
        </div>
        <ProfileForm
          isSaving={saveMutation.isPending}
          key={[
            profileQuery.data.id,
            profileQuery.data.display_name,
            profileQuery.data.bio,
            profileQuery.data.timezone,
          ].join(":")}
          onSave={async (payload) => {
            await saveMutation.mutateAsync(payload)
          }}
          profile={profileQuery.data}
        />
      </div>
    </section>
  )
}

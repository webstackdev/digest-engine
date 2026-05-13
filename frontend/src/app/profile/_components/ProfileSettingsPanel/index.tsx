"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { type ProfileNotice, ProfileSettingsWorkspace } from "@/app/profile/_components/ProfileSettingsWorkspace"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  fetchProfile,
  PROFILE_QUERY_KEY,
  removeProfileAvatar,
  saveProfile,
  uploadProfileAvatar,
} from "@/lib/profile"
import type { UserProfile } from "@/lib/types"

/** Render the current-user profile settings controller. */
export function ProfileSettingsPanel() {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState<ProfileNotice | null>(null)
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
      <Alert className="rounded-3xl border-trim-offset bg-muted">
        <AlertDescription>Loading profile...</AlertDescription>
      </Alert>
    )
  }

  if (profileQuery.isError || !profileQuery.data) {
    const message =
      profileQuery.error instanceof Error
        ? profileQuery.error.message
        : "Unable to load profile."

    return (
      <Alert className="rounded-3xl border-destructive bg-destructive" variant="destructive">
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <ProfileSettingsWorkspace
      isRemoving={removeMutation.isPending}
      isSaving={saveMutation.isPending}
      isUploading={uploadMutation.isPending}
      notice={notice}
      onRemove={() => {
        void removeMutation.mutateAsync()
      }}
      onSave={async (payload) => {
        await saveMutation.mutateAsync(payload)
      }}
      onUpload={async (file) => {
        await uploadMutation.mutateAsync(file)
      }}
      profile={profileQuery.data}
    />
  )
}

"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { UserProfile } from "@/lib/types"

type ProfileFormProps = {
  /** Whether the profile save request is currently in flight. */
  isSaving: boolean
  /** Callback that persists profile updates. */
  onSave: (payload: {
    display_name: string
    bio: string
    timezone: string
  }) => Promise<void>
  /** Current profile values used to seed the form. */
  profile: UserProfile
}

/** Render editable profile fields for the current user. */
export function ProfileForm({
  isSaving,
  onSave,
  profile,
}: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [bio, setBio] = useState(profile.bio)
  const [timezone, setTimezone] = useState(profile.timezone)

  return (
    <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-1">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Identity</p>
          <h2 className="m-0 font-display text-title-sm font-bold text-content-active">
            Profile details
          </h2>
        </div>

        <div className="grid gap-2 rounded-2xl border border-trim-offset bg-page-offset px-4 py-4 text-sm text-content-offset sm:grid-cols-2">
          <div>
            <span className="block text-xs uppercase tracking-eyebrow opacity-70">Username</span>
            <span>{profile.username}</span>
          </div>
          <div>
            <span className="block text-xs uppercase tracking-eyebrow opacity-70">Email</span>
            <span>{profile.email}</span>
          </div>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void onSave({
              display_name: displayName.trim(),
              bio: bio.trim(),
              timezone: timezone.trim(),
            })
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="profile-display-name">Display name</Label>
            <Input
              className="min-h-11 rounded-2xl border-trim-offset bg-page-offset px-4 py-3 text-content-active"
              id="profile-display-name"
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-bio">Bio</Label>
            <Textarea
              className="min-h-32 rounded-2xl border-trim-offset bg-page-offset px-4 py-3 text-content-active"
              id="profile-bio"
              onChange={(event) => setBio(event.target.value)}
              value={bio}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-timezone">Timezone</Label>
            <Input
              className="min-h-11 rounded-2xl border-trim-offset bg-page-offset px-4 py-3 text-content-active"
              id="profile-timezone"
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="UTC"
              value={timezone}
            />
          </div>
          <Button
            className="min-h-11 rounded-full px-4 py-3"
            disabled={isSaving}
            size="lg"
            type="submit"
          >
            {isSaving ? "Saving profile..." : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

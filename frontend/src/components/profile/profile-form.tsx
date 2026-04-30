"use client"

import { useState } from "react"

import type { UserProfile } from "@/lib/types"

type ProfileFormProps = {
  isSaving: boolean
  onSave: (payload: {
    display_name: string
    bio: string
    timezone: string
  }) => Promise<void>
  profile: UserProfile
}

/**
 * Render editable profile fields for the current user.
 *
 * @param props - Form props.
 * @returns The editable profile form.
 */
export function ProfileForm({
  isSaving,
  onSave,
  profile,
}: ProfileFormProps) {
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [bio, setBio] = useState(profile.bio)
  const [timezone, setTimezone] = useState(profile.timezone)

  return (
    <article className="space-y-4 rounded-3xl border border-ink/12 bg-surface/85 p-5 shadow-panel backdrop-blur-xl">
      <div className="space-y-1">
        <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Identity</p>
        <h2 className="m-0 font-display text-title-sm font-bold text-ink">
          Profile details
        </h2>
      </div>

      <div className="grid gap-2 rounded-2xl border border-ink/10 bg-surface-strong/45 px-4 py-4 text-sm text-muted sm:grid-cols-2">
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
        <label className="grid gap-2">
          <span className="text-sm font-medium text-ink">Display name</span>
          <input
            className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            onChange={(event) => setDisplayName(event.target.value)}
            value={displayName}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-ink">Bio</span>
          <textarea
            className="min-h-32 w-full resize-y rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            onChange={(event) => setBio(event.target.value)}
            value={bio}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-ink">Timezone</span>
          <input
            className="w-full rounded-2xl border border-ink/12 bg-surface-strong/70 px-4 py-3 text-ink outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            onChange={(event) => setTimezone(event.target.value)}
            placeholder="UTC"
            value={timezone}
          />
        </label>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-strong px-4 py-3 text-sm font-medium text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Saving profile..." : "Save profile"}
        </button>
      </form>
    </article>
  )
}
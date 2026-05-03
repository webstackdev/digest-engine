import { AvatarDropzone } from "@/app/profile/_components/AvatarDropzone"
import { AvatarPreview } from "@/app/profile/_components/AvatarPreview"
import { ProfileForm } from "@/app/profile/_components/ProfileForm"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { UserProfile } from "@/lib/types"

export type ProfileNotice = {
  message: string
  tone: "success" | "error"
}

type ProfileSettingsWorkspaceProps = {
  notice: ProfileNotice | null
  profile: UserProfile
  isSaving: boolean
  isUploading: boolean
  isRemoving: boolean
  onSave: (payload: {
    display_name: string
    bio: string
    timezone: string
  }) => Promise<void>
  onUpload: (file: File) => Promise<void>
  onRemove: () => void
}

/** Render the loaded profile settings workspace for the current user. */
export function ProfileSettingsWorkspace({
  notice,
  profile,
  isSaving,
  isUploading,
  isRemoving,
  onSave,
  onUpload,
  onRemove,
}: ProfileSettingsWorkspaceProps) {
  return (
    <section className="space-y-4">
      {notice ? (
        <Alert
          className={
            notice.tone === "success"
              ? "rounded-panel border-border/10 bg-muted/60"
              : "rounded-panel border-destructive/20 bg-destructive/10"
          }
          variant={notice.tone === "success" ? "default" : "destructive"}
        >
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.4fr)]">
        <div className="space-y-4">
          <AvatarPreview
            isRemoving={isRemoving}
            onRemove={onRemove}
            profile={profile}
          />
          <AvatarDropzone isUploading={isUploading} onUpload={onUpload} />
        </div>
        <ProfileForm isSaving={isSaving} onSave={onSave} profile={profile} />
      </div>
    </section>
  )
}

import { AppShell } from "@/components/app-shell"
import { ProfileSettingsPanel } from "@/components/profile/profile-settings-panel"
import { getProjects } from "@/lib/api"
import { selectProject } from "@/lib/view-helpers"

type ProfilePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the current-user profile page inside the shared app shell.
 *
 * @param props - Async server component props from the App Router.
 * @param props.searchParams - Search params promise containing the optional `project` id.
 * @returns The current-user profile workspace.
 */
export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  return (
    <AppShell
      title="Profile"
      description="Update your editor identity, upload an avatar, and keep the shared header profile surface in sync."
      projects={projects}
      selectedProjectId={selectedProject?.id ?? null}
    >
      <ProfileSettingsPanel />
    </AppShell>
  )
}

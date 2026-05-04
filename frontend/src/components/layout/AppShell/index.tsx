import type { ReactNode } from "react"

import { getMessageThreads } from "@/lib/api"
import type { MessageThread, Project } from "@/lib/types"

import { AppShellHeader } from "./_components/AppShellHeader"
import { AppShellSidebar } from "./_components/AppShellSidebar"

type AppShellProps = {
  eyebrow?: string | null
  title: string
  description: string
  projects: Project[]
  selectedProjectId: number | null
  children: ReactNode
}

export async function AppShell({
  eyebrow,
  title,
  description,
  projects,
  selectedProjectId,
  children,
}: AppShellProps) {
  const projectQuery = selectedProjectId ? `?project=${selectedProjectId}` : ""
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null
  const canManageMembers = selectedProject?.user_role === "admin"
  const headerEyebrow =
    eyebrow === undefined
      ? selectedProject
        ? `${selectedProject.name} Dashboard`
        : "Dashboard"
      : eyebrow
  const initialMessageThreads: MessageThread[] = await getMessageThreads().catch(
    () => [],
  )

  return (
    <div className="min-h-screen md:grid md:grid-cols-[320px_minmax(0,1fr)]">
      <AppShellSidebar
        canManageMembers={canManageMembers}
        initialMessageThreads={initialMessageThreads}
        projectQuery={projectQuery}
        projects={projects}
        selectedProjectId={selectedProjectId}
      />

      <main className="p-5 md:p-8">
        <AppShellHeader
          eyebrow={headerEyebrow}
          description={description}
          messagesHref={`/messages${projectQuery}`}
          title={title}
        />
        {children}
      </main>
    </div>
  )
}

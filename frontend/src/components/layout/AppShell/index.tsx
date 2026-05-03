import type { ReactNode } from "react"

import type { Project } from "@/lib/types"

import { AppShellHeader } from "./_components/AppShellHeader"
import { AppShellSidebar } from "./_components/AppShellSidebar"

type AppShellProps = {
  title: string
  description: string
  projects: Project[]
  selectedProjectId: number | null
  children: ReactNode
}

export function AppShell({
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

  return (
    <div className="min-h-screen md:grid md:grid-cols-[320px_minmax(0,1fr)]">
      <AppShellSidebar
        canManageMembers={canManageMembers}
        projectQuery={projectQuery}
        projects={projects}
        selectedProjectId={selectedProjectId}
      />

      <main className="p-5 md:p-8">
        <AppShellHeader description={description} title={title} />
        {children}
      </main>
    </div>
  )
}

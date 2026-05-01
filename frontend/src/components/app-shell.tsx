import Link from "next/link"
import type { ReactNode } from "react"

import { UserMenu } from "@/components/user-menu"
import type { Project } from "@/lib/types"

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
      <aside className="flex flex-col gap-8 bg-sidebar/95 p-5 text-sidebar-ink md:p-8">
        <div>
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">
            Newsletter Maker
          </p>
          <h1 className="mt-1 font-display text-display-hero font-bold leading-display">
            Editor cockpit
          </h1>
          <p className="mt-4 text-sm leading-6 text-sidebar-muted/74">
            A compact review surface for relevance-ranked content, review work,
            and source health.
          </p>
        </div>

        <nav className="grid gap-4">
          <Link
            className="rounded-panel border border-sidebar-ink/8 bg-sidebar-ink/3 px-4 py-4 transition hover:-translate-y-0.5 hover:border-sidebar-ink/22 hover:bg-sidebar-ink/6"
            href={`/${projectQuery}`}
          >
            Dashboard
          </Link>
          <Link
            className="rounded-panel border border-sidebar-ink/8 bg-sidebar-ink/3 px-4 py-4 transition hover:-translate-y-0.5 hover:border-sidebar-ink/22 hover:bg-sidebar-ink/6"
            href={`/trends${projectQuery}`}
          >
            Trends
          </Link>
          <Link
            className="rounded-panel border border-sidebar-ink/8 bg-sidebar-ink/3 px-4 py-4 transition hover:-translate-y-0.5 hover:border-sidebar-ink/22 hover:bg-sidebar-ink/6"
            href={`/themes${projectQuery}`}
          >
            Themes
          </Link>
          <Link
            className="rounded-panel border border-sidebar-ink/8 bg-sidebar-ink/3 px-4 py-4 transition hover:-translate-y-0.5 hover:border-sidebar-ink/22 hover:bg-sidebar-ink/6"
            href={`/ideas${projectQuery}`}
          >
            Ideas
          </Link>
          <Link
            className="rounded-panel border border-sidebar-ink/8 bg-sidebar-ink/3 px-4 py-4 transition hover:-translate-y-0.5 hover:border-sidebar-ink/22 hover:bg-sidebar-ink/6"
            href={`/entities${projectQuery}`}
          >
            Entities
          </Link>
          <Link
            className="rounded-panel border border-sidebar-ink/8 bg-sidebar-ink/3 px-4 py-4 transition hover:-translate-y-0.5 hover:border-sidebar-ink/22 hover:bg-sidebar-ink/6"
            href={`/admin/health${projectQuery}`}
          >
            Ingestion health
          </Link>
          <Link
            className="rounded-panel border border-sidebar-ink/8 bg-sidebar-ink/3 px-4 py-4 transition hover:-translate-y-0.5 hover:border-sidebar-ink/22 hover:bg-sidebar-ink/6"
            href={`/admin/sources${projectQuery}`}
          >
            Source configs
          </Link>
          {canManageMembers && selectedProjectId ? (
            <Link
              className="rounded-panel border border-sidebar-ink/8 bg-sidebar-ink/3 px-4 py-4 transition hover:-translate-y-0.5 hover:border-sidebar-ink/22 hover:bg-sidebar-ink/6"
              href={`/projects/${selectedProjectId}/members${projectQuery}`}
            >
              Members
            </Link>
          ) : null}
          <Link
            className="rounded-panel border border-sidebar-ink/8 bg-sidebar-ink/3 px-4 py-4 transition hover:-translate-y-0.5 hover:border-sidebar-ink/22 hover:bg-sidebar-ink/6"
            href="/admin/projects/new"
          >
            New project
          </Link>
        </nav>

        <section>
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">
            Project
          </p>
          <div className="mt-4 grid gap-4">
            {projects.map((project) => {
              const isActive = project.id === selectedProjectId
              return (
                <Link
                  data-active={isActive ? "true" : "false"}
                  key={project.id}
                  href={`/?project=${project.id}`}
                  className={`grid gap-1 rounded-panel border px-4 py-4 transition hover:-translate-y-0.5 ${
                    isActive
                      ? "border-warning-soft/46 bg-linear-to-b from-warning/18 to-sidebar-ink/3"
                      : "border-sidebar-ink/8 bg-sidebar-ink/3 hover:border-sidebar-ink/22 hover:bg-sidebar-ink/6"
                  }`}
                >
                  <span>{project.name}</span>
                  <small className="text-sidebar-muted/64">
                    {project.topic_description}
                  </small>
                </Link>
              )
            })}
          </div>
        </section>
      </aside>

      <main className="p-5 md:p-8">
        <header className="mb-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">
              Minimal dashboard
            </p>
            <h2 className="font-display text-display-page font-bold">
              {title}
            </h2>
            </div>
            <UserMenu />
          </div>
          <p className="max-w-xl text-sm leading-6 text-muted md:text-base">
            {description}
          </p>
        </header>
        {children}
      </main>
    </div>
  )
}

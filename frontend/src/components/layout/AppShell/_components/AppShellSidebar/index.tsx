import Link from "next/link"

import { Card, CardContent, CardDescription } from "@/components/ui/card"
import type { Project } from "@/lib/types"
import { cn } from "@/lib/utils"

type AppShellSidebarProps = {
  projects: Project[]
  selectedProjectId: number | null
  projectQuery: string
  canManageMembers: boolean
}

/** Render the shared dashboard navigation and project switcher. */
export function AppShellSidebar({
  projects,
  selectedProjectId,
  projectQuery,
  canManageMembers,
}: AppShellSidebarProps) {
  const navigationItems = [
    { href: `/${projectQuery}`, label: "Dashboard" },
    { href: `/trends${projectQuery}`, label: "Trends" },
    { href: `/themes${projectQuery}`, label: "Themes" },
    { href: `/ideas${projectQuery}`, label: "Ideas" },
    { href: `/drafts${projectQuery}`, label: "Drafts" },
    { href: `/entities${projectQuery}`, label: "Entities" },
    { href: `/admin/health${projectQuery}`, label: "Ingestion health" },
    { href: `/admin/sources${projectQuery}`, label: "Source configs" },
    ...(canManageMembers && selectedProjectId
      ? [
          {
            href: `/projects/${selectedProjectId}/members${projectQuery}`,
            label: "Members",
          },
        ]
      : []),
    { href: "/admin/projects/new", label: "New project" },
  ]

  return (
    <aside className="flex flex-col gap-6 bg-sidebar/95 p-5 text-sidebar-foreground md:p-8">
      <Card className="rounded-3xl bg-sidebar-accent/25 py-0 text-sidebar-foreground ring-sidebar-border/50 shadow-none">
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">
              Newsletter Maker
            </p>
            <h1 className="mt-1 font-display text-display-hero font-bold leading-display">
              Editor cockpit
            </h1>
          </div>
          <p className="text-sm leading-6 text-sidebar-foreground/74">
            A compact review surface for relevance-ranked content, review work,
            and source health.
          </p>
        </CardContent>
      </Card>

      <nav className="grid gap-3">
        {navigationItems.map((item) => (
          <Link className="block" href={item.href} key={item.label}>
            <Card className="rounded-panel bg-sidebar-accent/30 py-0 text-sidebar-foreground ring-sidebar-border/60 shadow-none transition hover:-translate-y-0.5 hover:bg-sidebar-accent/50 hover:ring-sidebar-ring/40">
              <CardContent className="px-4 py-4">{item.label}</CardContent>
            </Card>
          </Link>
        ))}
      </nav>

      <section>
        <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Project</p>
        <div className="mt-4 grid gap-3">
          {projects.map((project) => {
            const isActive = project.id === selectedProjectId

            return (
              <Link
                className="block"
                data-active={isActive ? "true" : "false"}
                href={`/?project=${project.id}`}
                key={project.id}
              >
                <Card
                  className={cn(
                    "rounded-panel py-0 text-sidebar-foreground shadow-none transition hover:-translate-y-0.5",
                    isActive
                      ? "bg-linear-to-b from-primary/15 to-sidebar-accent/40 ring-primary/30"
                      : "bg-sidebar-accent/30 ring-sidebar-border/60 hover:bg-sidebar-accent/50 hover:ring-sidebar-ring/40",
                  )}
                >
                  <CardContent className="grid gap-1 px-4 py-4">
                    <span>{project.name}</span>
                    <CardDescription className="text-sidebar-foreground/64">
                      {project.topic_description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>
    </aside>
  )
}
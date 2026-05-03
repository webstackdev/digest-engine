import Link from "next/link"

import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { MembershipInvitation, Project, ProjectMembership } from "@/lib/types"
import { cn } from "@/lib/utils"

import { InvitationsCard } from "../InvitationsCard"
import { MembershipsCard } from "../MembershipsCard"

type MembersPageContentProps = {
  projects: Project[]
  selectedProject: Project
  memberships: ProjectMembership[]
  invitations: MembershipInvitation[]
  errorMessage?: string
  successMessage?: string
}

/** Render the members management shell for one project. */
export function MembersPageContent({
  projects,
  selectedProject,
  memberships,
  invitations,
  errorMessage = "",
  successMessage = "",
}: MembersPageContentProps) {
  const redirectTarget = `/projects/${selectedProject.id}/members?project=${selectedProject.id}`

  return (
    <AppShell
      title="Members"
      description="Manage project roles, review pending invitations, and keep admin coverage intact."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      {errorMessage ? (
        <Alert className="rounded-panel border-destructive/20 bg-destructive/10" variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert className="rounded-panel border-border/10 bg-muted/60">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-4">
        <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
          <CardContent className="flex items-center justify-between gap-4 pt-4">
            <div>
              <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Roster</p>
              <h2 className="m-0 font-display text-title-sm font-bold text-foreground">
                {selectedProject.name} members
              </h2>
            </div>
            <Link
              className={cn(buttonVariants({ size: "lg" }), "min-h-11 rounded-full px-4 py-3")}
              href={`/projects/${selectedProject.id}/members/invite?project=${selectedProject.id}`}
            >
              Invite member
            </Link>
          </CardContent>
        </Card>

        <MembershipsCard
          memberships={memberships}
          projectId={selectedProject.id}
          redirectTarget={redirectTarget}
        />

        <InvitationsCard
          invitations={invitations}
          projectId={selectedProject.id}
          redirectTarget={redirectTarget}
        />
      </section>
    </AppShell>
  )
}
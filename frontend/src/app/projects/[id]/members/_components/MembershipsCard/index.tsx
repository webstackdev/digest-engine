import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ProjectMembership } from "@/lib/types"
import { formatDate } from "@/lib/view-helpers"

import { roleOptions } from "../shared"

type MembershipsCardProps = {
  memberships: ProjectMembership[]
  projectId: number
  redirectTarget: string
}

/** Render the current project roster and role-management actions. */
export function MembershipsCard({
  memberships,
  projectId,
  redirectTarget,
}: MembershipsCardProps) {
  return (
    <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-1">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Current team</p>
          <h3 className="m-0 font-display text-title-sm font-bold text-foreground">Memberships</h3>
        </div>
        <div className="space-y-3">
          {memberships.map((membership) => (
            <article
              className="grid gap-4 rounded-2xl border border-border/10 bg-muted/45 p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center"
              key={membership.id}
            >
              <div>
                <p className="m-0 text-sm font-semibold text-foreground">
                  {membership.display_name || membership.username}
                </p>
                <p className="m-0 text-sm text-muted">{membership.email}</p>
                <p className="mt-2 mb-0 text-xs uppercase tracking-eyebrow text-muted">
                  Joined {formatDate(membership.joined_at)}
                </p>
              </div>
              <form
                action={`/api/projects/${projectId}/members/${membership.id}`}
                className="flex flex-wrap items-center gap-3"
                method="POST"
              >
                <input name="redirectTo" type="hidden" value={redirectTarget} />
                <input name="intent" type="hidden" value="update-role" />
                <div className="grid gap-2">
                  <Label className="sr-only" htmlFor={`membership-role-${membership.id}`}>
                    Role for {membership.display_name || membership.username}
                  </Label>
                  <Select defaultValue={membership.role} name="role">
                    <SelectTrigger
                      className="min-h-11 rounded-2xl border-border/12 bg-card px-4 py-3 text-sm text-foreground"
                      id={`membership-role-${membership.id}`}
                    >
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit" variant="outline">
                  Update role
                </Button>
              </form>
              <form action={`/api/projects/${projectId}/members/${membership.id}`} method="POST">
                <input name="redirectTo" type="hidden" value={redirectTarget} />
                <input name="intent" type="hidden" value="remove" />
                <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit" variant="destructive">
                  Remove
                </Button>
              </form>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
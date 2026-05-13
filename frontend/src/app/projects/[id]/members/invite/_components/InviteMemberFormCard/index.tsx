import Link from "next/link"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

import { roleOptions } from "../shared"

type InviteMemberFormCardProps = {
  projectId: number
  redirectTarget: string
  backHref: string
}

/** Render the membership invitation form for a project. */
export function InviteMemberFormCard({
  projectId,
  redirectTarget,
  backHref,
}: InviteMemberFormCardProps) {
  return (
    <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-1">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Access</p>
          <h2 className="m-0 font-display text-title-sm font-bold text-content-active">
            Invite a new member
          </h2>
        </div>

        <form action={`/api/projects/${projectId}/invitations`} className="space-y-4" method="POST">
          <input name="redirectTo" type="hidden" value={redirectTarget} />
          <div className="grid gap-2">
            <Label htmlFor="invite-member-email">Email</Label>
            <Input id="invite-member-email" name="email" required type="email" />
          </div>
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="invite-member-role">Role</Label>
            <Select defaultValue="member" name="role">
              <SelectTrigger
                className="min-h-11 rounded-2xl border-trim-offset bg-muted px-4 py-3 text-sm text-content-active"
                id="invite-member-role"
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
          <div className="flex flex-wrap items-center gap-3">
            <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
              Send invitation
            </Button>
            <Link
              className={cn(buttonVariants({ size: "lg", variant: "outline" }), "min-h-11 rounded-full px-4 py-3")}
              href={backHref}
            >
              Back to members
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

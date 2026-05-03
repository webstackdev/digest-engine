import Link from "next/link"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

import { ideaStatusOptions, selectTriggerClassName } from "../shared"

type IdeasToolbarCardProps = {
  projectId: number
  statusFilter: string
  currentPageHref: string
}

/** Render the idea filter controls and queue generation action. */
export function IdeasToolbarCard({
  projectId,
  statusFilter,
  currentPageHref,
}: IdeasToolbarCardProps) {
  return (
    <Card className="mb-4 rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
      <CardContent className="flex flex-col gap-4 pt-4 xl:flex-row xl:items-end xl:justify-between">
        <form className="grid gap-2" method="GET">
          <input name="project" type="hidden" value={projectId} />
          <Label htmlFor="ideas-status-filter">Status</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Select defaultValue={statusFilter} name="status">
              <SelectTrigger className={cn(selectTriggerClassName, "md:min-w-56")} id="ideas-status-filter">
                <SelectValue placeholder="All ideas" />
              </SelectTrigger>
              <SelectContent>
                {ideaStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit" variant="outline">
              Apply filter
            </Button>
            <Link
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "min-h-11 rounded-full px-4 py-3",
              )}
              href={`/ideas?project=${projectId}`}
            >
              Reset
            </Link>
          </div>
        </form>

        <form action={`/api/projects/${projectId}/ideas/generate`} method="POST">
          <input name="redirectTo" type="hidden" value={currentPageHref} />
          <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
            Generate now
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
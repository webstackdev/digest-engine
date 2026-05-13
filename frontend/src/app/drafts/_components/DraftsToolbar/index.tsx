import Link from "next/link"

import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type DraftsToolbarProps = {
  /** Current project selection used by list filters and server actions. */
  selectedProjectId: number
  /** Current status filter preserved across submissions. */
  statusFilter: string
  /** Current page href used as a server-action redirect target. */
  currentPageHref: string
}

/** Render the draft queue filter controls and generate action. */
export function DraftsToolbar({
  selectedProjectId,
  statusFilter,
  currentPageHref,
}: DraftsToolbarProps) {
  return (
    <Card className="mb-4 rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
      <CardContent className="flex flex-col gap-4 pt-5 xl:flex-row xl:items-end xl:justify-between">
        <form className="grid gap-2" method="GET">
          <input type="hidden" name="project" value={selectedProjectId} />
          <label className="text-sm font-medium text-content-active" htmlFor="status">
            Status
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              defaultValue={statusFilter}
              id="status"
              name="status"
            >
              <SelectTrigger
                aria-label="Status"
                className="min-w-40 rounded-2xl border-trim-offset bg-muted px-4 py-3 text-sm data-[size=default]:h-11"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All drafts</SelectItem>
                <SelectItem value="generating">Generating</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="edited">Edited</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="discarded">Discarded</SelectItem>
              </SelectContent>
            </Select>
            <Button className="rounded-full" size="lg" type="submit" variant="outline">
              Apply filter
            </Button>
            <Link
              className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-full")}
              href={`/drafts?project=${selectedProjectId}`}
            >
              Reset
            </Link>
          </div>
        </form>

        <form action={`/api/projects/${selectedProjectId}/drafts/generate`} method="POST">
          <input type="hidden" name="redirectTo" value={currentPageHref} />
          <Button className="rounded-full" size="lg" type="submit">
            Generate now
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

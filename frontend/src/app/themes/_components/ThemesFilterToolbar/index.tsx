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

import { themeStatusOptions } from "../shared"

type ThemesFilterToolbarProps = {
  projectId: number
  statusFilter: string
}

/** Render the status-filter controls for the theme queue. */
export function ThemesFilterToolbar({
  projectId,
  statusFilter,
}: ThemesFilterToolbarProps) {
  return (
    <Card className="mb-4 rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
      <CardContent className="p-[1.1rem]">
        <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" method="GET">
          <input name="project" type="hidden" value={projectId} />
          <div className="grid gap-2">
            <Label htmlFor="theme-status-filter">Status</Label>
            <Select defaultValue={statusFilter} name="status">
              <SelectTrigger
                className="w-full rounded-2xl border-trim-offset bg-page-offset px-4 py-3 text-content-active sm:max-w-xs"
                id="theme-status-filter"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {themeStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
              Apply filter
            </Button>
            <Link
              className={cn(buttonVariants({ size: "lg", variant: "outline" }), "min-h-11 rounded-full px-4 py-3")}
              href={`/themes?project=${projectId}`}
            >
              Reset
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

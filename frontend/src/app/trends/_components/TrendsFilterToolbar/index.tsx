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

import { trendDaysOptions } from "../shared"

type TrendsFilterToolbarProps = {
  projectId: number
  availableSources: string[]
  sourceFilter: string
  daysFilter: number
}

/** Render the trends filter controls for source and published window. */
export function TrendsFilterToolbar({
  projectId,
  availableSources,
  sourceFilter,
  daysFilter,
}: TrendsFilterToolbarProps) {
  return (
    <Card className="mb-4 rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
      <CardContent className="p-[1.1rem]">
        <form
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end"
          method="GET"
        >
          <input name="project" type="hidden" value={projectId} />
          <div className="grid gap-2">
            <Label htmlFor="trends-source-filter">Source plugin</Label>
            <Select defaultValue={sourceFilter} name="source">
              <SelectTrigger
                className="w-full rounded-2xl border-trim-offset bg-muted px-4 py-3 text-content-active"
                id="trends-source-filter"
              >
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All sources</SelectItem>
                {availableSources.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="trends-days-filter">Published within</Label>
            <Select defaultValue={String(daysFilter)} name="days">
              <SelectTrigger
                className="w-full rounded-2xl border-trim-offset bg-muted px-4 py-3 text-content-active"
                id="trends-days-filter"
              >
                <SelectValue placeholder="Published within" />
              </SelectTrigger>
              <SelectContent>
                {trendDaysOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
              Apply filters
            </Button>
            <Link
              className={cn(buttonVariants({ size: "lg", variant: "outline" }), "min-h-11 rounded-full px-4 py-3")}
              href={`/trends?project=${projectId}`}
            >
              Reset
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

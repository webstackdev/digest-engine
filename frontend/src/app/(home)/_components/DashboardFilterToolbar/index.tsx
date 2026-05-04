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
import type { DashboardView, DuplicateStateFilter } from "@/lib/dashboard-view"
import { cn } from "@/lib/utils"

import {
  dashboardDayOptions,
  dashboardViewOptions,
  duplicateStateOptions,
} from "../shared"

const dashboardSelectTriggerClassName =
  "w-full rounded-2xl border-border/45 bg-card/95 px-4 py-3 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-secondary/88 focus-visible:border-ring"

type DashboardFilterToolbarProps = {
  projectId: number
  view: DashboardView
  contentTypes: string[]
  contentTypeFilter: string
  sources: string[]
  sourceFilter: string
  daysFilter: number
  duplicateStateFilter: DuplicateStateFilter
}

/** Render dashboard filtering controls for content and review views. */
export function DashboardFilterToolbar({
  projectId,
  view,
  contentTypes,
  contentTypeFilter,
  sources,
  sourceFilter,
  daysFilter,
  duplicateStateFilter,
}: DashboardFilterToolbarProps) {
  return (
    <Card className="mb-4 rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
      <CardContent className="p-[1.1rem]">
        <form
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] xl:items-end"
          method="GET"
        >
          <input name="project" type="hidden" value={projectId} />
          <div className="grid gap-2">
            <Label htmlFor="dashboard-view-filter">View</Label>
            <Select defaultValue={view} name="view">
              <SelectTrigger className={dashboardSelectTriggerClassName} id="dashboard-view-filter">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                {dashboardViewOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dashboard-content-type-filter">Content type</Label>
            <Select defaultValue={contentTypeFilter} name="contentType">
              <SelectTrigger className={dashboardSelectTriggerClassName} id="dashboard-content-type-filter">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All types</SelectItem>
                {contentTypes.map((contentType) => (
                  <SelectItem key={contentType} value={contentType}>
                    {contentType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dashboard-source-filter">Source</Label>
            <Select defaultValue={sourceFilter} name="source">
              <SelectTrigger className={dashboardSelectTriggerClassName} id="dashboard-source-filter">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All sources</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dashboard-days-filter">Published within</Label>
            <Select defaultValue={String(daysFilter)} name="days">
              <SelectTrigger className={dashboardSelectTriggerClassName} id="dashboard-days-filter">
                <SelectValue placeholder="Published within" />
              </SelectTrigger>
              <SelectContent>
                {dashboardDayOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dashboard-duplicate-filter">Duplicate state</Label>
            <Select defaultValue={duplicateStateFilter} name="duplicateState">
              <SelectTrigger className={dashboardSelectTriggerClassName} id="dashboard-duplicate-filter">
                <SelectValue placeholder="Duplicate state" />
              </SelectTrigger>
              <SelectContent>
                {duplicateStateOptions.map((option) => (
                  <SelectItem key={option.label} value={option.value}>
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
              href={`/?project=${projectId}`}
            >
              Reset
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

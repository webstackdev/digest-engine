import { Card, CardContent } from "@/components/ui/card"
import type { Project, SourceConfig } from "@/lib/types"

type DashboardSidebarProps = {
  selectedProject: Project
  sourceConfigs: SourceConfig[]
  pendingReviewCount: number
}

/** Render dashboard-side project and workflow summaries. */
export function DashboardSidebar({
  selectedProject,
  sourceConfigs,
  pendingReviewCount,
}: DashboardSidebarProps) {
  return (
    <aside className="space-y-4">
      <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
        <CardContent className="p-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Project focus</p>
          <h3 className="font-display text-title-md">{selectedProject.name}</h3>
          <p className="text-sm leading-6 text-muted">{selectedProject.topic_description}</p>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
        <CardContent className="p-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Active sources</p>
          <p className="mt-1 text-3xl font-bold">
            {sourceConfigs.filter((item) => item.is_active).length}
          </p>
          <p className="text-sm leading-6 text-muted">
            Configured feeds and subreddits delivering new content.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
        <CardContent className="p-5">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Editorial queue</p>
          <p className="mt-1 text-3xl font-bold">{pendingReviewCount}</p>
          <p className="text-sm leading-6 text-muted">
            Use the view switch above to resolve borderline items.
          </p>
        </CardContent>
      </Card>
    </aside>
  )
}
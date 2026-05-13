import { StatusBadge } from "@/components/elements/StatusBadge"
import { Button } from "@/components/ui/button"
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
import { Textarea } from "@/components/ui/textarea"
import type { IngestionRun, SourceConfig } from "@/lib/types"
import { formatDate } from "@/lib/view-helpers"

const selectTriggerClassName =
  "w-full rounded-2xl border-border bg-muted px-4 py-3 text-sm data-[size=default]:h-11"

type SourceConfigListProps = {
  selectedProjectId: number
  rows: Array<{
    sourceConfig: SourceConfig
    latestRun: IngestionRun | null
  }>
}

/** Render the editable source configuration list for the selected project. */
export function SourceConfigList({
  selectedProjectId,
  rows,
}: SourceConfigListProps) {
  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <div className="rounded-panel bg-muted px-4 py-4 text-sm leading-6 text-muted">
          No source configurations exist for this project yet.
        </div>
      ) : null}
      {rows.map(({ sourceConfig, latestRun }) => (
        <Card
          className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl"
          key={sourceConfig.id}
        >
          <CardContent className="space-y-4 pt-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="font-display text-title-md font-bold">
                  {sourceConfig.plugin_name}
                </h3>
                <div className="flex flex-wrap gap-2 text-sm text-muted">
                  <span>Config #{sourceConfig.id}</span>
                  <span>Last fetch {formatDate(sourceConfig.last_fetched_at)}</span>
                </div>
              </div>
              <StatusBadge tone={sourceConfig.is_active ? "positive" : "neutral"}>
                {sourceConfig.is_active ? "active" : "disabled"}
              </StatusBadge>
            </div>

            <form action={`/api/source-configs/${sourceConfig.id}`} className="space-y-4" method="POST">
              <input name="projectId" type="hidden" value={selectedProjectId} />
              <input name="redirectTo" type="hidden" value={`/admin/sources?project=${selectedProjectId}`} />
              <div className="grid gap-2">
                <Label htmlFor={`source-plugin-${sourceConfig.id}`}>Plugin</Label>
                <Input
                  className="h-11 rounded-2xl border-border bg-muted px-4"
                  defaultValue={sourceConfig.plugin_name}
                  id={`source-plugin-${sourceConfig.id}`}
                  name="plugin_name"
                  readOnly
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`source-config-json-${sourceConfig.id}`}>Config JSON</Label>
                <Textarea
                  className="min-h-30 rounded-2xl border-border bg-muted px-4 py-3 font-mono text-sm"
                  defaultValue={JSON.stringify(sourceConfig.config, null, 2)}
                  id={`source-config-json-${sourceConfig.id}`}
                  name="config_json"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`source-active-${sourceConfig.id}`}>Active</Label>
                <Select defaultValue={sourceConfig.is_active ? "true" : "false"} name="is_active">
                  <SelectTrigger className={selectTriggerClassName} id={`source-active-${sourceConfig.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-muted">
                <span>Latest run: {latestRun ? latestRun.status : "none"}</span>
                <span>{latestRun?.error_message || "No recent error"}</span>
              </div>
              <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
                Save source
              </Button>
            </form>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

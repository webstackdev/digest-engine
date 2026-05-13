import type { ComponentProps } from "react"

import { StatusBadge } from "@/components/elements/StatusBadge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { HealthStatus, IngestionRun, SourceConfig } from "@/lib/types"
import { formatDate, formatDisplayLabel, healthTone } from "@/lib/view-helpers"

type SourceHealthRow = {
  /** Stored source configuration for one plugin. */
  sourceConfig: SourceConfig
  /** Latest ingestion run for that plugin, if any. */
  latestRun: IngestionRun | null
  /** Computed health state for the source row. */
  status: HealthStatus
}

type SourceHealthPanelProps = {
  /** Source rows prepared by the page orchestration layer. */
  rows: SourceHealthRow[]
  /** Optional section status label. */
  statusLabel?: string
  /** Optional section status tone. */
  statusTone?: ComponentProps<typeof StatusBadge>["tone"]
}

/** Render the source-by-source ingestion health table for the selected project. */
export function SourceHealthPanel({
  rows,
  statusLabel = "sources",
  statusTone = "neutral",
}: SourceHealthPanelProps) {
  return (
    <Card className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-base leading-snug font-medium">
              Source configuration health
            </h2>
            <CardDescription>
              Per-plugin freshness, latest run outcome, and current source health for the selected project.
            </CardDescription>
          </div>
          <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
        </div>
      </CardHeader>

      <CardContent>
        {rows.length === 0 ? (
          <Card className="rounded-panel bg-muted shadow-none ring-0" size="sm">
            <CardContent className="text-sm leading-6 text-muted-foreground">
              No source configurations exist for this project yet.
            </CardContent>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border text-sm text-muted hover:bg-transparent">
                <TableHead className="px-3 py-4">Source</TableHead>
                <TableHead className="px-3 py-4">Status</TableHead>
                <TableHead className="px-3 py-4">Last fetch</TableHead>
                <TableHead className="px-3 py-4">Latest run</TableHead>
                <TableHead className="px-3 py-4">Items</TableHead>
                <TableHead className="px-3 py-4">Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ sourceConfig, latestRun, status }) => (
                <TableRow key={sourceConfig.id} className="border-border align-top">
                  <TableCell className="px-3 py-4 whitespace-normal">
                    <strong className="font-medium text-foreground">
                      {formatDisplayLabel(sourceConfig.plugin_name)}
                    </strong>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span>Config #{sourceConfig.id}</span>
                      <span>{formatDisplayLabel(sourceConfig.is_active ? "active" : "disabled")}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-4">
                    <StatusBadge tone={healthTone(status)}>{formatDisplayLabel(status)}</StatusBadge>
                  </TableCell>
                  <TableCell className="px-3 py-4 text-sm text-foreground">
                    {formatDate(sourceConfig.last_fetched_at)}
                  </TableCell>
                  <TableCell className="px-3 py-4 whitespace-normal text-sm text-foreground">
                    {latestRun
                      ? `${formatDisplayLabel(latestRun.status)} at ${formatDate(latestRun.started_at)}`
                      : "No runs yet"}
                  </TableCell>
                  <TableCell className="px-3 py-4 text-sm text-foreground">
                    {latestRun
                      ? `${latestRun.items_ingested}/${latestRun.items_fetched}`
                      : "0/0"}
                  </TableCell>
                  <TableCell className="px-3 py-4 whitespace-normal text-sm text-foreground">
                    {latestRun?.error_message || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

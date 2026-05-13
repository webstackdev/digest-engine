import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Content, ReviewQueueItem } from "@/lib/types"
import { formatDate, formatDisplayLabel, formatScore } from "@/lib/view-helpers"

type ReviewQueueTableProps = {
  projectId: number
  pendingReviewItems: ReviewQueueItem[]
  contentMap: Map<number, Content>
}

/** Render the review queue table and resolution actions. */
export function ReviewQueueTable({
  projectId,
  pendingReviewItems,
  contentMap,
}: ReviewQueueTableProps) {
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-panel backdrop-blur-xl">
      <Table>
        <TableHeader>
          <TableRow className="text-sm text-muted-foreground">
            <TableHead className="px-3 py-4 font-medium">Content</TableHead>
            <TableHead className="px-3 py-4 font-medium">Reason</TableHead>
            <TableHead className="px-3 py-4 font-medium">Confidence</TableHead>
            <TableHead className="px-3 py-4 font-medium">Queued</TableHead>
            <TableHead className="px-3 py-4 font-medium">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pendingReviewItems.length === 0 ? (
            <TableRow>
              <TableCell className="px-3 py-4" colSpan={5}>
                <Alert className="rounded-panel border-border bg-muted">
                  <AlertDescription>
                    No unresolved review items for this project right now.
                  </AlertDescription>
                </Alert>
              </TableCell>
            </TableRow>
          ) : null}
          {pendingReviewItems.map((item) => {
            const content = contentMap.get(item.content)

            return (
              <TableRow key={item.id} className="align-top last:border-b-0">
                <TableCell className="px-3 py-4 align-top whitespace-normal">
                  <strong className="font-medium text-foreground">
                    {content?.title ?? `Content #${item.content}`}
                  </strong>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>{formatDisplayLabel(content?.source_plugin ?? "unknown source")}</span>
                    <span>{formatDisplayLabel(content?.content_type || "unclassified")}</span>
                    {content?.duplicate_signal_count ? (
                      <span>
                        Also seen in {content.duplicate_signal_count} source
                        {content.duplicate_signal_count === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    {content?.duplicate_of ? <span>Duplicate of #{content.duplicate_of}</span> : null}
                  </div>
                </TableCell>
                <TableCell className="px-3 py-4 align-top whitespace-normal text-sm text-foreground">
                  {formatDisplayLabel(item.reason)}
                </TableCell>
                <TableCell className="px-3 py-4 align-top whitespace-normal text-sm text-foreground">
                  {formatScore(item.confidence)}
                </TableCell>
                <TableCell className="px-3 py-4 align-top whitespace-normal text-sm text-foreground">
                  {formatDate(item.created_at)}
                </TableCell>
                <TableCell className="px-3 py-4 align-top whitespace-normal">
                  <div className="flex flex-wrap items-center gap-3">
                    <form action={`/api/review/${item.id}`} method="POST">
                      <input name="projectId" type="hidden" value={projectId} />
                      <input name="resolved" type="hidden" value="true" />
                      <input name="resolution" type="hidden" value="human_approved" />
                      <input name="redirectTo" type="hidden" value={`/?project=${projectId}&view=review`} />
                      <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
                        Approve
                      </Button>
                    </form>
                    <form action={`/api/review/${item.id}`} method="POST">
                      <input name="projectId" type="hidden" value={projectId} />
                      <input name="resolved" type="hidden" value="true" />
                      <input name="resolution" type="hidden" value="human_rejected" />
                      <input name="redirectTo" type="hidden" value={`/?project=${projectId}&view=review`} />
                      <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit" variant="outline">
                        Reject
                      </Button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </section>
  )
}

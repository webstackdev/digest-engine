import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { EntityMentionSummary } from "@/lib/types"
import { formatDate } from "@/lib/view-helpers"

type EntityMentionsPanelProps = {
  mentions: EntityMentionSummary[]
  projectId: number
}

/** Render the extracted mention history linked to the current entity. */
export function EntityMentionsPanel({ mentions, projectId }: EntityMentionsPanelProps) {
  return (
    <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Mention history</p>
            <h3 className="m-0 font-display text-title-sm font-bold text-foreground">
              Extracted mentions linked to this entity
            </h3>
          </div>
          <span className="text-sm text-muted">
            {mentions.length} total mention{mentions.length === 1 ? "" : "s"}
          </span>
        </div>
        {mentions.length === 0 ? (
          <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
            No extracted mentions exist for this entity yet.
          </div>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {mentions.map((mention) => (
              <li className="rounded-2xl border border-border/10 bg-muted/45 p-4" key={mention.id}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <Link
                      className="font-medium text-foreground transition hover:text-primary"
                      href={`/content/${mention.content_id}?project=${projectId}`}
                    >
                      {mention.content_title}
                    </Link>
                    <div className="flex flex-wrap gap-2 text-sm text-muted">
                      <span>{mention.role}</span>
                      {mention.sentiment ? <span>{mention.sentiment}</span> : null}
                      <span>{Math.round(mention.confidence * 100)}% confidence</span>
                      <span>{formatDate(mention.created_at)}</span>
                    </div>
                  </div>
                  {mention.span ? (
                    <Badge className="rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.16em]" variant="outline">
                      {mention.span}
                    </Badge>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

import Link from "next/link"

import { SkillActionBar } from "@/app/content/[id]/_components/SkillActionBar"
import { StatusBadge } from "@/components/elements/StatusBadge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { Content, SkillResult } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  formatDate,
  formatDisplayLabel,
  formatPercentScore,
  formatScore,
} from "@/lib/view-helpers"

type PendingSkillName = "relevance_scoring" | "summarization"

type ContentDetailMainColumnProps = {
  content: Content
  contentSkillResults: SkillResult[]
  selectedProjectId: number
  effectiveRelevanceScore: number | null
  canSummarize: boolean
  initialPendingSkills: PendingSkillName[]
}

/** Render the main content detail column with article metadata and skill activity. */
export function ContentDetailMainColumn({
  content,
  contentSkillResults,
  selectedProjectId,
  effectiveRelevanceScore,
  canSummarize,
  initialPendingSkills,
}: ContentDetailMainColumnProps) {
  return (
    <div className="space-y-4">
      <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <p className="mb-3 text-eyebrow uppercase tracking-eyebrow opacity-70">
                {formatDisplayLabel(content.source_plugin)}
              </p>
              <h2 className="font-display text-title-md font-bold">{content.title}</h2>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span>{formatDate(content.published_date)}</span>
                <span>{content.author || "Unknown author"}</span>
                <span>{formatDisplayLabel(content.content_type || "unclassified")}</span>
              </div>
            </div>
            <StatusBadge
              tone={
                (effectiveRelevanceScore ?? 0) >= 0.7 ? "positive" : "warning"
              }
            >
              Adjusted {formatPercentScore(effectiveRelevanceScore)}
            </StatusBadge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className={cn(buttonVariants({ size: "lg" }), "rounded-full")}
              href={content.url}
              target="_blank"
            >
              Open source
            </Link>
            <form action="/api/feedback" method="POST">
              <input name="projectId" type="hidden" value={selectedProjectId} />
              <input name="contentId" type="hidden" value={content.id} />
              <input name="feedbackType" type="hidden" value="upvote" />
              <input
                name="redirectTo"
                type="hidden"
                value={`/content/${content.id}?project=${selectedProjectId}`}
              />
              <Button className="rounded-full" size="lg" type="submit">
                Upvote
              </Button>
            </form>
            <form action="/api/feedback" method="POST">
              <input name="projectId" type="hidden" value={selectedProjectId} />
              <input name="contentId" type="hidden" value={content.id} />
              <input name="feedbackType" type="hidden" value="downvote" />
              <input
                name="redirectTo"
                type="hidden"
                value={`/content/${content.id}?project=${selectedProjectId}`}
              />
              <Button className="rounded-full" size="lg" type="submit" variant="outline">
                Downvote
              </Button>
            </form>
          </div>

          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground">
              Canonical URL {content.canonical_url || content.url}
            </span>
            {content.authority_adjusted_score !== null ? (
              <span className="inline-flex items-center rounded-full border border-primary/18 bg-primary/8 px-3 py-1 text-sm text-foreground">
                Base {formatPercentScore(content.relevance_score)}
              </span>
            ) : null}
            {content.duplicate_signal_count > 0 ? (
              <span className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground">
                Also seen in {content.duplicate_signal_count} source
                {content.duplicate_signal_count === 1 ? "" : "s"}
              </span>
            ) : null}
            {content.duplicate_of ? (
              <Link
                className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-foreground transition hover:bg-muted/80"
                href={`/content/${content.duplicate_of}?project=${selectedProjectId}`}
              >
                Duplicate of #{content.duplicate_of}
              </Link>
            ) : null}
            {content.newsletter_promotion_at ? (
              <Link
                className="inline-flex items-center rounded-full border border-primary/18 bg-primary/8 px-3 py-1 text-sm text-foreground transition hover:bg-primary/12"
                href={
                  content.newsletter_promotion_theme
                    ? `/themes?project=${selectedProjectId}&theme=${content.newsletter_promotion_theme}`
                    : `/themes?project=${selectedProjectId}`
                }
              >
                Promoted {formatDate(content.newsletter_promotion_at)}
              </Link>
            ) : null}
          </div>

          <div className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground md:text-base">
            {content.content_text}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
        <CardContent className="space-y-4 p-5">
          <p className="mb-3 text-eyebrow uppercase tracking-eyebrow opacity-70">
            Skill action bar
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <SkillActionBar
              key={`${selectedProjectId}:${content.id}:${initialPendingSkills.slice().sort().join(",")}`}
              canSummarize={canSummarize}
              contentId={content.id}
              initialPendingSkills={initialPendingSkills}
              projectId={selectedProjectId}
            />
            <form action="/api/skills/find_related" method="POST">
              <input name="projectId" type="hidden" value={selectedProjectId} />
              <input name="contentId" type="hidden" value={content.id} />
              <input
                name="redirectTo"
                type="hidden"
                value={`/content/${content.id}?project=${selectedProjectId}`}
              />
              <Button className="rounded-full" size="lg" type="submit">
                Find related
              </Button>
            </form>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            These controls create new persisted SkillResult records. Summarization is
            only available once a content item has reached a final adjusted relevance
            score of at least 70%.
          </p>
        </CardContent>
      </Card>

      {contentSkillResults.map((skillResult) => (
        <Card
          className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl"
          key={skillResult.id}
        >
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="mb-3 text-eyebrow uppercase tracking-eyebrow opacity-70">
                  {formatDisplayLabel(skillResult.skill_name)}
                </p>
                <h3 className="font-display text-title-md font-bold">
                  {formatDisplayLabel(skillResult.status)}
                </h3>
              </div>
              <StatusBadge
                tone={
                  skillResult.status === "completed"
                    ? "positive"
                    : skillResult.status === "failed"
                      ? "negative"
                      : "warning"
                }
              >
                {skillResult.model_used || "model pending"}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>Created {formatDate(skillResult.created_at)}</span>
              <span>Latency {skillResult.latency_ms ?? 0} ms</span>
              <span>Confidence {formatScore(skillResult.confidence)}</span>
            </div>
            {skillResult.error_message ? (
              <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">
                {skillResult.error_message}
              </div>
            ) : null}
            <pre className="overflow-auto rounded-2xl border border-border/12 bg-muted/60 p-4 text-sm text-foreground">
              {JSON.stringify(skillResult.result_data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

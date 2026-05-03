import { AuthorityWeightControls } from "@/app/entities/[id]/_components/AuthorityWeightControls"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type {
  Entity,
  EntityAuthoritySnapshot,
  ProjectConfig,
} from "@/lib/types"
import { formatDate, formatPercentScore } from "@/lib/view-helpers"

type AuthorityHistoryPanelProps = {
  authorityComponents: EntityAuthoritySnapshot | null
  authorityHistory: EntityAuthoritySnapshot[]
  entity: Entity
  projectConfig: ProjectConfig | null
  projectId: number
  redirectTo: string
  userRole: "admin" | "member" | "reader" | null
}

/** Render the entity authority breakdown, trend, and admin configuration controls. */
export function AuthorityHistoryPanel({
  authorityComponents,
  authorityHistory,
  entity,
  projectConfig,
  projectId,
  redirectTo,
  userRole,
}: AuthorityHistoryPanelProps) {
  const latestSnapshot = authorityComponents ?? authorityHistory[0] ?? null
  const trendPoints = buildAuthorityTrendPoints(authorityHistory)
  const componentMix = latestSnapshot ? buildAuthorityComponentMix(latestSnapshot) : []
  const carryForwardWeight = latestSnapshot
    ? Math.max(0, latestSnapshot.decayed_prior)
    : 0

  return (
    <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Authority view</p>
            <h3 className="m-0 font-display text-title-sm font-bold text-foreground">
              Current score and history
            </h3>
          </div>
          <span className="text-sm text-muted">
            {authorityHistory.length} snapshot{authorityHistory.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)]">
          <div className="space-y-4 rounded-2xl border border-border/10 bg-muted/45 p-4">
            <div className="space-y-1">
              <p className="m-0 text-sm uppercase tracking-[0.18em] text-muted">Authority score</p>
              <p className="m-0 font-display text-4xl font-bold text-foreground">
                {formatPercentScore(entity.authority_score)}
              </p>
              <p className="m-0 text-sm leading-6 text-muted">
                This reflects the latest blend of mention frequency, engagement, recency,
                source quality, cross-newsletter corroboration, editorial feedback,
                duplicate corroboration, and carry-forward history.
              </p>
            </div>

            {latestSnapshot ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted">
                  <span>Current component mix</span>
                  <span>Carry-forward {formatPercentScore(carryForwardWeight)}</span>
                </div>
                <div
                  aria-label="Authority component mix"
                  className="overflow-hidden rounded-full border border-border/10 bg-card/80"
                  role="img"
                >
                  <svg className="block h-4 w-full" preserveAspectRatio="none" viewBox="0 0 100 8">
                    {componentMix.map((component) => (
                      <rect
                        className={component.className}
                        height="8"
                        key={component.label}
                        rx="0"
                        ry="0"
                        width={component.width}
                        x={component.offset}
                        y="0"
                      >
                        <title>{`${component.label} ${formatPercentScore(component.value)}`}</title>
                      </rect>
                    ))}
                  </svg>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {componentMix.map((component) => (
                    <div className="flex items-center gap-2 text-sm text-muted" key={component.label}>
                      <span className={`h-3 w-3 rounded-full ${component.className}`} />
                      <span>{component.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {authorityHistory.length > 1 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-muted">
                  <span>Recent trend</span>
                  <span>Latest {formatDate(authorityHistory[0]?.computed_at ?? null)}</span>
                </div>
                <svg
                  aria-label="Authority score trend"
                  className="h-20 w-full overflow-visible"
                  role="img"
                  viewBox="0 0 220 72"
                >
                  <polyline
                    fill="none"
                    points={trendPoints}
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                  />
                </svg>
              </div>
            ) : (
              <p className="m-0 text-sm leading-6 text-muted">
                More recomputations will draw the trend line here.
              </p>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-border/10 bg-muted/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                Latest components
              </h4>
              {latestSnapshot ? (
                <span className="text-sm text-muted">
                  Updated {formatDate(latestSnapshot.computed_at)}
                </span>
              ) : null}
            </div>
            {latestSnapshot ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <AuthorityComponentCard label="Mention frequency" value={latestSnapshot.mention_component} />
                <AuthorityComponentCard label="Engagement" value={latestSnapshot.engagement_component} />
                <AuthorityComponentCard label="Recency" value={latestSnapshot.recency_component} />
                <AuthorityComponentCard label="Source quality" value={latestSnapshot.source_quality_component} />
                <AuthorityComponentCard label="Cross-newsletter" value={latestSnapshot.cross_newsletter_component} />
                <AuthorityComponentCard label="Feedback" value={latestSnapshot.feedback_component} />
                <AuthorityComponentCard label="Duplicate signal" value={latestSnapshot.duplicate_component} />
                <AuthorityComponentCard label="Carry-forward" value={latestSnapshot.decayed_prior} />
              </div>
            ) : (
              <p className="m-0 text-sm leading-6 text-muted">
                Authority history has not been recomputed for this entity yet.
              </p>
            )}

            {latestSnapshot?.weights_at_compute ? (
              <div className="space-y-2">
                <h5 className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                  Weights at compute
                </h5>
                <div className="flex flex-wrap gap-2 text-sm text-muted">
                  {Object.entries(latestSnapshot.weights_at_compute).map(([key, value]) => (
                    <Badge className="rounded-full px-3 py-1 text-sm" key={key} variant="outline">
                      {formatWeightLabel(key)} {formatPercentScore(value)}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {userRole === "admin" ? (
              <AuthorityWeightControls
                projectConfig={projectConfig}
                projectId={projectId}
                redirectTo={redirectTo}
              />
            ) : null}
          </div>
        </div>

        {authorityHistory.length > 0 ? (
          <ul className="m-0 grid list-none gap-3 p-0">
            {authorityHistory.slice(0, 5).map((snapshot) => (
              <li className="rounded-2xl border border-border/10 bg-muted/45 p-4" key={snapshot.id}>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap gap-2 text-sm text-muted">
                    <span>{formatDate(snapshot.computed_at)}</span>
                    <span>Final {formatPercentScore(snapshot.final_score)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm text-muted">
                    <span>M {formatPercentScore(snapshot.mention_component)}</span>
                    <span>E {formatPercentScore(snapshot.engagement_component)}</span>
                    <span>R {formatPercentScore(snapshot.recency_component)}</span>
                    <span>SQ {formatPercentScore(snapshot.source_quality_component)}</span>
                    <span>CN {formatPercentScore(snapshot.cross_newsletter_component)}</span>
                    <span>F {formatPercentScore(snapshot.feedback_component)}</span>
                    <span>D {formatPercentScore(snapshot.duplicate_component)}</span>
                    <span>Carry {formatPercentScore(snapshot.decayed_prior)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}

function buildAuthorityTrendPoints(authorityHistory: EntityAuthoritySnapshot[]) {
  if (authorityHistory.length <= 1) {
    return "0,36 220,36"
  }

  return authorityHistory
    .slice()
    .reverse()
    .map((snapshot, index, snapshots) => {
      const x = (index / (snapshots.length - 1)) * 220
      const y = 72 - snapshot.final_score * 72
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}

function buildAuthorityComponentMix(snapshot: EntityAuthoritySnapshot) {
  const components = [
    {
      label: "Mention frequency",
      value: Math.max(0, snapshot.mention_component),
      className: "bg-primary",
    },
    {
      label: "Engagement",
      value: Math.max(0, snapshot.engagement_component),
      className: "bg-emerald-500",
    },
    {
      label: "Recency",
      value: Math.max(0, snapshot.recency_component),
      className: "bg-cyan-500",
    },
    {
      label: "Source quality",
      value: Math.max(0, snapshot.source_quality_component),
      className: "bg-amber-500",
    },
    {
      label: "Cross-newsletter",
      value: Math.max(0, snapshot.cross_newsletter_component),
      className: "bg-fuchsia-500",
    },
    {
      label: "Feedback",
      value: Math.max(0, snapshot.feedback_component),
      className: "bg-sky-500",
    },
    {
      label: "Duplicate signal",
      value: Math.max(0, snapshot.duplicate_component),
      className: "bg-rose-500",
    },
  ]
  const total = components.reduce((sum, component) => sum + component.value, 0)
  let offset = 0

  return components.map((component) => {
    const share = total > 0 ? component.value / total : 1 / components.length
    const mappedComponent = {
      ...component,
      share,
      offset,
      width: share * 100,
    }
    offset += mappedComponent.width
    return mappedComponent
  })
}

function formatWeightLabel(label: string) {
  return label.replaceAll("_", " ")
}

function AuthorityComponentCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/10 bg-card/80 p-4">
      <p className="m-0 text-sm uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mb-0 mt-2 text-2xl font-bold text-foreground">
        {formatPercentScore(value)}
      </p>
    </div>
  )
}

import { StatusBadge } from "@/components/elements/StatusBadge"
import { Card, CardContent } from "@/components/ui/card"
import type { Entity } from "@/lib/types"
import { formatDate, formatPercentScore } from "@/lib/view-helpers"

type EntityOverviewCardProps = {
  entity: Entity
}

/** Render the summary card for the selected tracked entity. */
export function EntityOverviewCard({ entity }: EntityOverviewCardProps) {
  const identityLinks = [
    entity.website_url ? { href: entity.website_url, label: "Website" } : null,
    entity.github_url ? { href: entity.github_url, label: "GitHub" } : null,
    entity.linkedin_url ? { href: entity.linkedin_url, label: "LinkedIn" } : null,
  ].filter((link): link is { href: string; label: string } => link !== null)

  const identityHandles = [
    entity.bluesky_handle ? `Bluesky ${entity.bluesky_handle}` : null,
    entity.mastodon_handle ? `Mastodon ${entity.mastodon_handle}` : null,
    entity.twitter_handle ? `Twitter ${entity.twitter_handle}` : null,
  ].filter((label): label is string => label !== null)

  return (
    <Card className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl">
      <CardContent className="space-y-5 pt-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Tracked entity</p>
            <h2 className="m-0 font-display text-title-lg font-bold text-foreground">
              {entity.name}
            </h2>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>Created {formatDate(entity.created_at)}</span>
              <span>
                {entity.mention_count} mention{entity.mention_count === 1 ? "" : "s"}
              </span>
              <span>Authority {formatPercentScore(entity.authority_score)}</span>
            </div>
          </div>
          <StatusBadge tone="neutral">{entity.type}</StatusBadge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-2xl border border-border bg-muted p-4">
            <h3 className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Description
            </h3>
            <p className="m-0 text-sm leading-7 text-foreground">
              {entity.description || "No description is set for this entity yet."}
            </p>
          </div>
          <div className="space-y-3 rounded-2xl border border-border bg-muted p-4">
            <h3 className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Identity links
            </h3>
            <ul className="m-0 grid list-none gap-2 p-0 text-sm text-muted-foreground">
              {identityLinks.map((link) => (
                <li key={link.label}>
                  <a
                    className="text-foreground transition hover:text-primary"
                    href={link.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              {identityHandles.map((label) => (
                <li key={label}>{label}</li>
              ))}
              {identityLinks.length === 0 && identityHandles.length === 0 ? (
                <li>No external identity links are set yet.</li>
              ) : null}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

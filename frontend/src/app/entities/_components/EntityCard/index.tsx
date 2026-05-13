import Link from "next/link"

import { StatusBadge } from "@/components/elements/StatusBadge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Entity } from "@/lib/types"
import { formatDate } from "@/lib/view-helpers"

import {
  EntityTypeSelect,
  inputClassName,
  textareaClassName,
} from "../shared"

type EntityCardProps = {
  entity: Entity
  projectId: number
}

/** Render a single editable entity card with recent mention context. */
export function EntityCard({ entity, projectId }: EntityCardProps) {
  return (
    <Card className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl">
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="font-display text-title-md font-bold">
              <Link className="transition hover:text-primary" href={`/entities/${entity.id}?project=${projectId}`}>
                {entity.name}
              </Link>
            </h3>
            <div className="flex flex-wrap gap-2 text-sm text-muted">
              <span>{formatDate(entity.created_at)}</span>
              <span>Authority {entity.authority_score.toFixed(2)}</span>
              <span>
                {entity.mention_count} mention{entity.mention_count === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <StatusBadge tone="neutral">{entity.type}</StatusBadge>
        </div>

        <section className="space-y-3 rounded-2xl border border-border bg-muted p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">
              Recent mentions
            </h4>
            <span className="text-sm text-muted">{entity.mention_count} total</span>
          </div>
          {entity.latest_mentions.length === 0 ? (
            <Alert className="rounded-panel border-border bg-card">
              <AlertDescription>No extracted mentions for this entity yet.</AlertDescription>
            </Alert>
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0">
              {entity.latest_mentions.map((mention) => (
                <li className="rounded-2xl border border-border bg-card p-3" key={mention.id}>
                  <div className="flex flex-wrap gap-2 text-sm text-muted">
                    <span>{mention.content_title}</span>
                    <span>{mention.role}</span>
                    {mention.sentiment ? <span>{mention.sentiment}</span> : null}
                    <span>{Math.round(mention.confidence * 100)}% confidence</span>
                  </div>
                  {mention.span ? (
                    <p className="mb-0 mt-2 text-sm leading-6 text-foreground">Matched span: {mention.span}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <form action={`/api/entities/${entity.id}`} className="space-y-4" method="POST">
          <input name="projectId" type="hidden" value={projectId} />
          <input name="redirectTo" type="hidden" value={`/entities?project=${projectId}`} />
          <input name="intent" type="hidden" value="update" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`entity-name-${entity.id}`}>Name</Label>
              <Input
                className={inputClassName}
                defaultValue={entity.name}
                id={`entity-name-${entity.id}`}
                name="name"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`entity-type-${entity.id}`}>Type</Label>
              <EntityTypeSelect defaultValue={entity.type} id={`entity-type-${entity.id}`} name="type" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`entity-description-${entity.id}`}>Description</Label>
            <Textarea
              className={textareaClassName}
              defaultValue={entity.description}
              id={`entity-description-${entity.id}`}
              name="description"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`entity-website-url-${entity.id}`}>Website URL</Label>
              <Input
                className={inputClassName}
                defaultValue={entity.website_url}
                id={`entity-website-url-${entity.id}`}
                name="website_url"
                type="url"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`entity-github-url-${entity.id}`}>GitHub URL</Label>
              <Input
                className={inputClassName}
                defaultValue={entity.github_url}
                id={`entity-github-url-${entity.id}`}
                name="github_url"
                type="url"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`entity-linkedin-url-${entity.id}`}>LinkedIn URL</Label>
              <Input
                className={inputClassName}
                defaultValue={entity.linkedin_url}
                id={`entity-linkedin-url-${entity.id}`}
                name="linkedin_url"
                type="url"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`entity-bluesky-handle-${entity.id}`}>Bluesky handle</Label>
              <Input
                className={inputClassName}
                defaultValue={entity.bluesky_handle}
                id={`entity-bluesky-handle-${entity.id}`}
                name="bluesky_handle"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`entity-mastodon-handle-${entity.id}`}>Mastodon handle</Label>
              <Input
                className={inputClassName}
                defaultValue={entity.mastodon_handle}
                id={`entity-mastodon-handle-${entity.id}`}
                name="mastodon_handle"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`entity-twitter-handle-${entity.id}`}>Twitter handle</Label>
              <Input
                className={inputClassName}
                defaultValue={entity.twitter_handle}
                id={`entity-twitter-handle-${entity.id}`}
                name="twitter_handle"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
              Save changes
            </Button>
          </div>
        </form>

        <form action={`/api/entities/${entity.id}`} method="POST">
          <input name="projectId" type="hidden" value={projectId} />
          <input name="redirectTo" type="hidden" value={`/entities?project=${projectId}`} />
          <input name="intent" type="hidden" value="delete" />
          <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit" variant="destructive">
            Delete entity
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

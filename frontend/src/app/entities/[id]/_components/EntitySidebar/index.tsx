import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Entity } from "@/lib/types"
import { cn } from "@/lib/utils"

type EntitySidebarProps = {
  selectedProjectId: number
  siblingEntities: Entity[]
}

/** Render the entity-detail sidebar navigation and same-project entity list. */
export function EntitySidebar({
  selectedProjectId,
  siblingEntities,
}: EntitySidebarProps) {
  return (
    <div className="space-y-4">
      <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
        <CardContent className="space-y-4 pt-4">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Navigation</p>
          <div className="flex flex-wrap gap-2">
            <Link
              className={cn(
                buttonVariants({ size: "lg" }),
                "min-h-11 rounded-full px-4 py-3"
              )}
              href={`/entities?project=${selectedProjectId}`}
            >
              Back to entities
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-border/12 bg-card/85 shadow-panel backdrop-blur-xl">
        <CardContent className="space-y-4 pt-4">
          <div>
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Related entities</p>
            <h3 className="m-0 font-display text-title-sm font-bold text-foreground">
              Same-project entities
            </h3>
          </div>
          {siblingEntities.length === 0 ? (
            <p className="m-0 text-sm leading-6 text-muted">
              No other entities exist in this project yet.
            </p>
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0">
              {siblingEntities.slice(0, 6).map((siblingEntity) => (
                <li className="rounded-2xl border border-border/10 bg-muted/45 p-4" key={siblingEntity.id}>
                  <Link
                    className="font-medium text-foreground transition hover:text-primary"
                    href={`/entities/${siblingEntity.id}?project=${selectedProjectId}`}
                  >
                    {siblingEntity.name}
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
                    <span>{siblingEntity.type}</span>
                    <span>
                      {siblingEntity.mention_count} mention
                      {siblingEntity.mention_count === 1 ? "" : "s"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
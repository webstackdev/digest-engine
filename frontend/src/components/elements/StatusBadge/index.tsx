import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"

type StatusBadgeProps = {
  /** Semantic tone that maps to the badge color treatment. */
  tone: "positive" | "warning" | "negative" | "neutral"
  /** Visible badge label content. */
  children: ReactNode
}

/**
 * Render a compact status pill with the project's semantic tone styles.
 *
 * This keeps small health and workflow labels visually consistent across dashboard
 * and admin screens. The `tone` prop selects one of the fixed theme mappings, while
 * the children provide the visible label text or inline content.
 */
export function StatusBadge({ tone, children }: StatusBadgeProps) {
  const toneClasses = {
    positive: "border-transparent bg-primary/15 text-primary",
    warning: "border-transparent bg-secondary text-secondary-foreground",
    negative: "border-transparent bg-destructive/15 text-destructive",
    neutral: "border-transparent bg-muted text-muted-foreground",
  }

  return (
    <Badge
      data-tone={tone}
      className={`inline-flex min-h-7 rounded-full px-3 py-1 text-sm font-semibold ${toneClasses[tone]}`}
    >
      {children}
    </Badge>
  )
}

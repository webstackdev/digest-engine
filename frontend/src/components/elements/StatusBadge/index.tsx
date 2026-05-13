import { cva } from "class-variance-authority"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type StatusBadgeTone = "positive" | "warning" | "negative" | "neutral"

const statusBadgeVariants = cva(
  "inline-flex min-h-7 rounded-full border-transparent px-3 py-1 text-sm font-semibold",
  {
    variants: {
      tone: {
        positive: "bg-primary text-primary",
        warning: "bg-secondary text-secondary-foreground",
        negative: "bg-destructive text-destructive",
        neutral: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
)

type StatusBadgeProps = {
  /** Semantic tone that maps to the badge color treatment. */
  tone: StatusBadgeTone
  /** Visible badge label content. */
  children: ReactNode
  /** Optional class overrides applied on top of the tone styles. */
  className?: string
}

/**
 * Render a compact status pill with the project's semantic tone styles.
 *
 * This keeps small health and workflow labels visually consistent across dashboard
 * and admin screens. The `tone` prop selects one of the fixed theme mappings, while
 * the children provide the visible label text or inline content.
 */
export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return (
    <Badge
      data-tone={tone}
      variant="outline"
      className={cn(statusBadgeVariants({ tone }), className)}
    >
      {children}
    </Badge>
  )
}

import type { ReactNode } from "react"

type StatusBadgeProps = {
  tone: "positive" | "warning" | "negative" | "neutral"
  children: ReactNode
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  const toneClasses = {
    positive: "bg-primary/15 text-primary",
    warning: "bg-warning/16 text-warning",
    negative: "bg-danger/15 text-danger",
    neutral: "bg-ink/8 text-muted",
  }

  return (
    <span
      data-tone={tone}
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${toneClasses[tone]}`}
    >
      {children}
    </span>
  )
}

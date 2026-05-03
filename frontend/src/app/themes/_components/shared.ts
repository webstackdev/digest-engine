export const DEFAULT_THEME_DISMISSAL_REASONS = [
  "off-topic",
  "already covered",
  "not actionable",
] as const

export const themeStatusOptions = [
  { value: "all", label: "All themes" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "used", label: "Used" },
  { value: "dismissed", label: "Dismissed" },
] as const
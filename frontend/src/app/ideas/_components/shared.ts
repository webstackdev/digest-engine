export const DEFAULT_IDEA_DISMISSAL_REASONS = [
  "already assigned",
  "needs stronger evidence",
  "off-topic",
] as const

export const ideaStatusOptions = [
  { value: "all", label: "All ideas" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "written", label: "Written" },
  { value: "dismissed", label: "Dismissed" },
] as const

export const selectTriggerClassName = "min-h-11 w-full rounded-2xl border-trim-offset bg-page-offset px-4 py-3 text-sm text-content-active"

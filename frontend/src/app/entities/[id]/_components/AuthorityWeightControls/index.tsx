"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import type { ProjectConfig } from "@/lib/types"

type AuthorityWeightControlsProps = {
  /** Numeric project identifier used by the API route. */
  projectId: number
  /** Existing project configuration row, if one has been created already. */
  projectConfig: ProjectConfig | null
  /** Redirect target for non-JS fallbacks. */
  redirectTo: string
}

type AuthorityWeightField = {
  key:
    | "authority_weight_mention"
    | "authority_weight_engagement"
    | "authority_weight_recency"
    | "authority_weight_source_quality"
    | "authority_weight_cross_newsletter"
    | "authority_weight_feedback"
    | "authority_weight_duplicate"
  label: string
}

const WEIGHT_FIELDS: AuthorityWeightField[] = [
  { key: "authority_weight_mention", label: "Mention frequency" },
  { key: "authority_weight_engagement", label: "Engagement" },
  { key: "authority_weight_recency", label: "Recency" },
  { key: "authority_weight_source_quality", label: "Source quality" },
  { key: "authority_weight_cross_newsletter", label: "Cross-newsletter" },
  { key: "authority_weight_feedback", label: "Feedback" },
  { key: "authority_weight_duplicate", label: "Duplicate signal" },
]

const DEFAULT_CONFIG_VALUES = {
  draft_schedule_cron: "",
  authority_weight_mention: 0.2,
  authority_weight_engagement: 0.15,
  authority_weight_recency: 0.15,
  authority_weight_source_quality: 0.15,
  authority_weight_cross_newsletter: 0.2,
  authority_weight_feedback: 0.1,
  authority_weight_duplicate: 0.05,
  upvote_authority_weight: 0.05,
  downvote_authority_weight: -0.05,
  authority_decay_rate: 0.9,
} satisfies Omit<ProjectConfig, "id" | "project">

/**
 * Render admin-only sliders for project authority weights.
 */
export function AuthorityWeightControls({
  projectId,
  projectConfig,
  redirectTo,
}: AuthorityWeightControlsProps) {
  const router = useRouter()
  const initialValues = projectConfig ?? {
    id: 0,
    project: projectId,
    ...DEFAULT_CONFIG_VALUES,
  }
  const [weights, setWeights] = useState(initialValues)
  const [pendingAction, setPendingAction] = useState<"save" | "save_and_recompute" | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const totalWeight = WEIGHT_FIELDS.reduce(
    (sum, field) => sum + weights[field.key],
    0,
  )

  async function submit(intent: "save" | "save_and_recompute") {
    setPendingAction(intent)
    setStatusMessage(null)
    setErrorMessage(null)

    const formData = new FormData()
    formData.set("redirectTo", redirectTo)
    formData.set("intent", intent)
    if (projectConfig?.id) {
      formData.set("configId", String(projectConfig.id))
    }
    formData.set("draft_schedule_cron", weights.draft_schedule_cron)
    formData.set("upvote_authority_weight", String(weights.upvote_authority_weight))
    formData.set("downvote_authority_weight", String(weights.downvote_authority_weight))
    formData.set("authority_decay_rate", String(weights.authority_decay_rate))
    for (const field of WEIGHT_FIELDS) {
      formData.set(field.key, String(weights[field.key]))
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/authority-settings?mode=json`,
        {
          method: "POST",
          body: formData,
        },
      )
      const payload = (await response.json()) as { message?: string }

      if (!response.ok || !payload.message) {
        throw new Error(payload.message || "Unable to save authority settings.")
      }

      setStatusMessage(payload.message)
      router.refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save authority settings.",
      )
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <article className="space-y-4 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Admin controls</p>
          <h4 className="m-0 font-display text-title-sm font-bold text-foreground">
            Authority weights
          </h4>
        </div>
        <span className="text-sm text-muted">Configured total {Math.round(totalWeight * 100)}%</span>
      </div>

      <p className="m-0 text-sm leading-6 text-muted">
        These sliders are normalized to 100% at recompute time, so you can emphasize one signal without manually balancing every field.
      </p>

      <div className="space-y-4">
        {WEIGHT_FIELDS.map((field) => (
          <label className="grid gap-2" htmlFor={field.key} key={field.key}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">{field.label}</span>
              <span className="text-muted">{Math.round(weights[field.key] * 100)}%</span>
            </div>
            <input
              aria-label={field.label}
              className="w-full accent-primary"
              id={field.key}
              max="1"
              min="0"
              onChange={(event) => {
                const nextValue = Number.parseFloat(event.target.value)
                setWeights((current) => ({
                  ...current,
                  [field.key]: Number.isFinite(nextValue) ? nextValue : 0,
                }))
              }}
              step="0.01"
              type="range"
              value={weights[field.key]}
            />
          </label>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm" htmlFor="authority_decay_rate">
          <span className="font-medium text-foreground">Authority decay rate</span>
          <input
            className="rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            id="authority_decay_rate"
            onChange={(event) => {
              const nextValue = Number.parseFloat(event.target.value)
              setWeights((current) => ({
                ...current,
                authority_decay_rate: Number.isFinite(nextValue) ? nextValue : 0,
              }))
            }}
            step="0.01"
            type="number"
            value={weights.authority_decay_rate}
          />
        </label>
        <label className="grid gap-2 text-sm" htmlFor="draft_schedule_cron">
          <span className="font-medium text-foreground">Draft schedule cron</span>
          <input
            className="rounded-2xl border border-border/12 bg-muted/70 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            id="draft_schedule_cron"
            onChange={(event) => {
              setWeights((current) => ({
                ...current,
                draft_schedule_cron: event.target.value,
              }))
            }}
            placeholder="0 9 * * *"
            value={weights.draft_schedule_cron}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pendingAction !== null}
          onClick={() => {
            void submit("save")
          }}
          type="button"
        >
          {pendingAction === "save" ? "Saving..." : "Save weights"}
        </button>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pendingAction !== null}
          onClick={() => {
            void submit("save_and_recompute")
          }}
          type="button"
        >
          {pendingAction === "save_and_recompute"
            ? "Saving and recomputing..."
            : "Save and recompute"}
        </button>
      </div>

      {statusMessage ? (
        <p className="rounded-panel bg-muted/60 px-4 py-3 text-sm leading-6 text-muted" role="status">
          {statusMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="rounded-panel bg-destructive/14 px-4 py-3 text-sm leading-6 text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </article>
  )
}
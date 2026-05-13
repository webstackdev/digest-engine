"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
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

const inputClassName =
  "h-11 rounded-2xl border-border bg-muted px-4"

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
    <Card className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl">
      <CardHeader>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Admin controls</p>
            <CardTitle className="font-display text-title-sm font-bold text-foreground">
              Authority weights
            </CardTitle>
          </div>
          <span className="text-sm text-muted">
            Configured total {Math.round(totalWeight * 100)}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="m-0 text-sm leading-6 text-muted">
          These sliders are normalized to 100% at recompute time, so you can emphasize one signal without manually balancing every field.
        </p>

        <div className="space-y-4">
          {WEIGHT_FIELDS.map((field) => (
            <div className="grid gap-2" key={field.key}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <Label htmlFor={field.key}>{field.label}</Label>
                <span className="text-muted">{Math.round(weights[field.key] * 100)}%</span>
              </div>
              <Slider
                aria-label={field.label}
                id={field.key}
                max={1}
                min={0}
                onValueChange={(value) => {
                  const nextValue = Array.isArray(value) ? (value[0] ?? 0) : value
                  setWeights((current) => ({
                    ...current,
                    [field.key]: Number.isFinite(nextValue) ? nextValue : 0,
                  }))
                }}
                step={0.01}
                value={[weights[field.key]]}
              />
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2 text-sm">
            <Label htmlFor="authority_decay_rate">Authority decay rate</Label>
            <Input
              className={inputClassName}
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
          </div>
          <div className="grid gap-2 text-sm">
            <Label htmlFor="draft_schedule_cron">Draft schedule cron</Label>
            <Input
              className={inputClassName}
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
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            className="min-h-11 rounded-full px-4 py-3"
            disabled={pendingAction !== null}
            onClick={() => {
              void submit("save")
            }}
            size="lg"
            type="button"
            variant="outline"
          >
            {pendingAction === "save" ? "Saving..." : "Save weights"}
          </Button>
          <Button
            className="min-h-11 rounded-full px-4 py-3"
            disabled={pendingAction !== null}
            onClick={() => {
              void submit("save_and_recompute")
            }}
            size="lg"
            type="button"
          >
            {pendingAction === "save_and_recompute"
              ? "Saving and recomputing..."
              : "Save and recompute"}
          </Button>
        </div>

        {statusMessage ? (
          <Alert className="rounded-panel border-border bg-muted" role="status">
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        ) : null}
        {errorMessage ? (
          <Alert className="rounded-panel border-destructive bg-destructive" variant="destructive">
            <AlertDescription className="text-destructive">{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}

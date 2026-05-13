"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { ContentSkillName, SkillResult } from "@/lib/types"

type AsyncSkillName = Extract<
  ContentSkillName,
  "relevance_scoring" | "summarization"
>

type SkillActionBarProps = {
  /** Numeric project identifier used by the API routes. */
  projectId: number
  /** Numeric content identifier receiving the skill run. */
  contentId: number
  /** Whether summarization is allowed for the current content. */
  canSummarize: boolean
  /** Skills already pending when the page first loads. */
  initialPendingSkills: AsyncSkillName[]
}

type SkillActionResponse = {
  message: string
  skillResult: SkillResult
}

function isPendingStatus(status: SkillResult["status"]) {
  return status === "pending" || status === "running"
}

function getSkillLabel(skillName: AsyncSkillName, isBusy: boolean) {
  if (skillName === "summarization") {
    return isBusy ? "Summarizing..." : "Summarize"
  }

  return isBusy ? "Scoring relevance..." : "Explain relevance"
}

/**
 * Render the per-content action buttons for running ad hoc AI skills.
 *
 * The component coordinates optimistic UI state with the App Router and React Query.
 * It can start summarization or relevance scoring, poll for watched pending skills,
 * and refresh the current page once asynchronous work settles so downstream panels
 * render the latest `SkillResult` records. Summarization is disabled when the caller
 * knows the content cannot be summarized, while pending or running skills lock their
 * matching action button and show progress-oriented labels.
 */
export function SkillActionBar({
  projectId,
  contentId,
  canSummarize,
  initialPendingSkills,
}: SkillActionBarProps) {
  const router = useRouter()
  const refreshRequestedRef = useRef(false)
  const [queuedSkills, setQueuedSkills] = useState<AsyncSkillName[]>([])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const watchedSkills = [...new Set([...initialPendingSkills, ...queuedSkills])]

  const contentSkillResultsQuery = useQuery({
    queryKey: ["content-skill-results", projectId, contentId],
    enabled: watchedSkills.length > 0,
    queryFn: async (): Promise<SkillResult[]> => {
      const response = await fetch(
        `/api/content-skills?projectId=${projectId}&contentId=${contentId}`,
        {
          cache: "no-store",
        },
      )

      if (!response.ok) {
        throw new Error("Unable to refresh skill status.")
      }

      return (await response.json()) as SkillResult[]
    },
    refetchInterval: 2000,
  })

  const hasPendingWatchedSkill = watchedSkills.some((skillName) => {
    const latestSkillResult = contentSkillResultsQuery.data?.find(
      (skillResult) =>
        skillResult.skill_name === skillName && skillResult.superseded_by === null,
    )

    return latestSkillResult ? isPendingStatus(latestSkillResult.status) : false
  })

  useEffect(() => {
    if (
      !contentSkillResultsQuery.data ||
      watchedSkills.length === 0 ||
      hasPendingWatchedSkill ||
      refreshRequestedRef.current
    ) {
      return
    }

    refreshRequestedRef.current = true
    router.refresh()
  }, [contentSkillResultsQuery.data, hasPendingWatchedSkill, router, watchedSkills.length])

  const queueSkillMutation = useMutation({
    mutationFn: async (skillName: AsyncSkillName) => {
      const formData = new FormData()
      formData.set("projectId", String(projectId))
      formData.set("contentId", String(contentId))
      formData.set("redirectTo", `/content/${contentId}?project=${projectId}`)

      const response = await fetch(`/api/skills/${skillName}?mode=json`, {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json()) as Partial<SkillActionResponse>

      if (!response.ok || !payload.skillResult || !payload.message) {
        throw new Error(payload.message || `Unable to run ${skillName}.`)
      }

      return payload as SkillActionResponse
    },
    onSuccess: ({ message, skillResult }) => {
      refreshRequestedRef.current = false
      setErrorMessage(null)
      setStatusMessage(message)

      if (isPendingStatus(skillResult.status)) {
        const queuedSkill = skillResult.skill_name as AsyncSkillName
        setQueuedSkills((currentSkills) =>
          currentSkills.includes(queuedSkill)
            ? currentSkills
            : [...currentSkills, queuedSkill],
        )
        router.refresh()
        return
      }

      router.refresh()
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to queue skill.",
      )
    },
  })

  const isBusy = (skillName: AsyncSkillName) =>
    watchedSkills.includes(skillName) ||
    (queueSkillMutation.isPending && queueSkillMutation.variables === skillName)

  return (
    <>
      <Button
        disabled={!canSummarize || isBusy("summarization")}
        onClick={() => {
          setStatusMessage(null)
          queueSkillMutation.mutate("summarization")
        }}
        size="lg"
        type="button"
      >
        {getSkillLabel("summarization", isBusy("summarization"))}
      </Button>
      <Button
        disabled={isBusy("relevance_scoring")}
        onClick={() => {
          setStatusMessage(null)
          queueSkillMutation.mutate("relevance_scoring")
        }}
        size="lg"
        type="button"
      >
        {getSkillLabel("relevance_scoring", isBusy("relevance_scoring"))}
      </Button>
      {statusMessage ? (
        <Alert className="basis-full rounded-3xl border-trim-offset bg-muted" role="status">
          <AlertDescription>{statusMessage}</AlertDescription>
        </Alert>
      ) : null}
      {errorMessage ? (
        <Alert
          className="basis-full rounded-3xl border-destructive bg-destructive"
          role="alert"
          variant="destructive"
        >
          <AlertDescription className="text-destructive">
            {errorMessage}
          </AlertDescription>
        </Alert>
      ) : null}
    </>
  )
}

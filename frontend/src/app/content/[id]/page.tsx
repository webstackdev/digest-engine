import { ContentDetailMainColumn } from "@/app/content/[id]/_components/ContentDetailMainColumn"
import { ContentDetailSidebar } from "@/app/content/[id]/_components/ContentDetailSidebar"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  getProjectContent,
  getProjectFeedback,
  getProjectReviewQueue,
  getProjects,
  getProjectSkillResults,
} from "@/lib/api"
import {
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type ContentDetailPageProps = {
  /** Route params promise containing the content id. */
  params: Promise<{ id: string }>
  /** Search params promise containing the optional `project`, `error`, and `message` values. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Derive the pending skill actions that should hydrate the client action bar.
 */
export function deriveInitialPendingSkills(
  skillResults: Awaited<ReturnType<typeof getProjectSkillResults>>,
) {
  return skillResults
    .filter(
      (item) =>
        item.superseded_by === null &&
        (item.skill_name === "relevance_scoring" ||
          item.skill_name === "summarization") &&
        (item.status === "pending" || item.status === "running"),
    )
    .map((item) => item.skill_name as "relevance_scoring" | "summarization")
}

/**
 * Render the detail view for a single content item within the selected project.
 */
export default async function ContentDetailPage({
  params,
  searchParams,
}: ContentDetailPageProps) {
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ])
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Content detail"
        description="No project is available for the configured API user."
        projects={[]}
        selectedProjectId={null}
      >
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
          Create a project first in Django admin.
        </div>
      </AppShell>
    )
  }

  const contentId = Number.parseInt(id, 10)
  const [content, skillResults, reviewQueue, feedback] = await Promise.all([
    getProjectContent(selectedProject.id, contentId),
    getProjectSkillResults(selectedProject.id),
    getProjectReviewQueue(selectedProject.id),
    getProjectFeedback(selectedProject.id),
  ])

  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)
  const contentSkillResults = skillResults.filter(
    (item) => item.content === content.id,
  )
  const reviewItems = reviewQueue.filter((item) => item.content === content.id)
  const contentFeedback = feedback.filter((item) => item.content === content.id)
  const upvotes = contentFeedback.filter(
    (item) => item.feedback_type === "upvote",
  ).length
  const downvotes = contentFeedback.filter(
    (item) => item.feedback_type === "downvote",
  ).length
  const effectiveRelevanceScore =
    content.authority_adjusted_score ?? content.relevance_score
  const canSummarize = (effectiveRelevanceScore ?? 0) >= 0.7
  const initialPendingSkills = deriveInitialPendingSkills(contentSkillResults)

  return (
    <AppShell
      title="Content detail"
      description="Inspect the raw article, persisted skill outputs, and editorial status for a single content item."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      {errorMessage ? (
        <Alert
          className="rounded-panel border-destructive/20 bg-destructive/14"
          variant="destructive"
        >
          <AlertDescription className="text-destructive">
            {errorMessage}
          </AlertDescription>
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert className="rounded-panel border-border/12 bg-muted/60">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.95fr)]">
        <ContentDetailMainColumn
          canSummarize={canSummarize}
          content={content}
          contentSkillResults={contentSkillResults}
          effectiveRelevanceScore={effectiveRelevanceScore}
          initialPendingSkills={initialPendingSkills}
          selectedProjectId={selectedProject.id}
        />
        <ContentDetailSidebar
          content={content}
          downvotes={downvotes}
          reviewItems={reviewItems}
          selectedProjectId={selectedProject.id}
          upvotes={upvotes}
        />
      </section>
    </AppShell>
  )
}

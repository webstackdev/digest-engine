import Link from "next/link"

import { StatusBadge } from "@/components/elements/StatusBadge"
import { AppShell } from "@/components/layout/AppShell"
import {
  getProjectEntities,
  getProjectEntityCandidates,
  getProjects,
} from "@/lib/api"
import type { EntityCandidate } from "@/lib/types"
import {
  formatDate,
  getErrorMessage,
  getSuccessMessage,
  selectProject,
} from "@/lib/view-helpers"

type CandidateQueuePageProps = {
  /** Search params promise containing the active project and optional tab/flash state. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

type CandidateCluster = {
  clusterKey: string
  members: EntityCandidate[]
  totalOccurrences: number
  sourcePlugins: string[]
  identitySurfaces: string[]
}

function groupCandidateClusters(candidates: EntityCandidate[]): CandidateCluster[] {
  const grouped = new Map<string, EntityCandidate[]>()

  for (const candidate of candidates) {
    const clusterKey = candidate.cluster_key || `candidate-${candidate.id}`
    const existing = grouped.get(clusterKey) ?? []
    existing.push(candidate)
    grouped.set(clusterKey, existing)
  }

  return Array.from(grouped.entries())
    .map(([clusterKey, members]) => ({
      clusterKey,
      members: members.slice().sort((left, right) => right.occurrence_count - left.occurrence_count),
      totalOccurrences: members.reduce(
        (sum, candidate) => sum + candidate.occurrence_count,
        0,
      ),
      sourcePlugins: Array.from(
        new Set(members.flatMap((candidate) => candidate.source_plugins)),
      ).sort(),
      identitySurfaces: Array.from(
        new Set(members.flatMap((candidate) => candidate.identity_surfaces)),
      ).sort(),
    }))
    .sort((left, right) => right.totalOccurrences - left.totalOccurrences)
}

/**
 * Render the clustered entity-candidate review queue for one project.
 */
export default async function CandidateQueuePage({
  searchParams,
}: CandidateQueuePageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Entity candidates"
        description="No project found for this API user."
        projects={[]}
        selectedProjectId={null}
      >
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
          Create a project first in Django admin.
        </div>
      </AppShell>
    )
  }

  const [entities, candidates] = await Promise.all([
    getProjectEntities(selectedProject.id),
    getProjectEntityCandidates(selectedProject.id),
  ])
  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)
  const activeTab = String(resolvedSearchParams.tab || "review")
  const pendingCandidates = candidates.filter((candidate) => candidate.status === "pending")
  const resolvedCandidates = candidates
    .filter((candidate) => candidate.status !== "pending")
    .slice()
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
  const candidateClusters = groupCandidateClusters(pendingCandidates)

  return (
    <AppShell
      title="Entity candidate clusters"
      description="Review clustered candidate groups, batch editorial actions, and inspect the latest auto-promotion outcomes."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      {errorMessage ? (
        <div className="rounded-panel bg-destructive/14 px-4 py-4 text-sm leading-6 text-destructive">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">{successMessage}</div>
      ) : null}

      <section className="mb-4 grid gap-4 sm:grid-cols-3">
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Clusters</p>
          <p className="mt-1 text-3xl font-bold">{candidateClusters.length}</p>
          <p className="text-sm leading-6 text-muted">Grouped review cards for pending candidates.</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Pending</p>
          <p className="mt-1 text-3xl font-bold">{pendingCandidates.length}</p>
          <p className="text-sm leading-6 text-muted">Candidates still waiting for editorial action or auto-promotion.</p>
        </article>
        <article className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Auto-promotion log</p>
          <p className="mt-1 text-3xl font-bold">{resolvedCandidates.length}</p>
          <p className="text-sm leading-6 text-muted">Accepted, rejected, or merged candidates already resolved.</p>
        </article>
      </section>

      <section className="mb-4 flex flex-wrap gap-3 rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50"
          href={`/entities/candidates?project=${selectedProject.id}`}
        >
          Review clusters
        </Link>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50"
          href={`/entities/candidates?project=${selectedProject.id}&tab=auto-log`}
        >
          Auto-promotion log
        </Link>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-transparent px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/50"
          href={`/entities?project=${selectedProject.id}`}
        >
          Back to entities
        </Link>
      </section>

      {activeTab === "auto-log" ? (
        <section className="space-y-4">
          {resolvedCandidates.length === 0 ? (
            <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
              No auto-promotion or review history is available for this project yet.
            </div>
          ) : null}
          {resolvedCandidates.map((candidate) => (
            <article key={candidate.id} className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <h2 className="m-0 font-display text-title-sm font-bold text-foreground">{candidate.name}</h2>
                  <div className="flex flex-wrap gap-2 text-sm text-muted">
                    <span>{candidate.occurrence_count} occurrences</span>
                    <span>{candidate.source_plugin_count} sources</span>
                    <span>Resolved {formatDate(candidate.updated_at)}</span>
                    {candidate.merged_into_name ? <span>Merged into {candidate.merged_into_name}</span> : null}
                  </div>
                </div>
                <StatusBadge tone={candidate.status === "rejected" ? "negative" : "positive"}>
                  {candidate.status}
                </StatusBadge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
                {candidate.source_plugins.map((plugin) => (
                  <span className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-foreground" key={`${candidate.id}:${plugin}`}>
                    {plugin}
                  </span>
                ))}
                {candidate.identity_surfaces.map((surface) => (
                  <span className="inline-flex items-center rounded-full border border-border/12 bg-card px-3 py-1 text-foreground" key={`${candidate.id}:${surface}`}>
                    {surface} identity hint
                  </span>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="space-y-4">
          {candidateClusters.length === 0 ? (
            <div className="rounded-panel bg-muted/60 px-4 py-4 text-sm leading-6 text-muted">
              No pending candidate clusters need review right now.
            </div>
          ) : null}

          {candidateClusters.map((cluster) => (
            <article key={cluster.clusterKey} className="rounded-3xl border border-border/12 bg-card/85 p-5 shadow-panel backdrop-blur-xl">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Cluster review</p>
                  <h2 className="m-0 font-display text-title-sm font-bold text-foreground">
                    Cluster of {cluster.members.length} candidate{cluster.members.length === 1 ? "" : "s"}
                  </h2>
                  <div className="flex flex-wrap gap-2 text-sm text-muted">
                    <span>{cluster.totalOccurrences} total occurrences</span>
                    <span>{cluster.sourcePlugins.length} source families</span>
                    {cluster.identitySurfaces.length > 0 ? (
                      <span>{cluster.identitySurfaces.length} identity hints</span>
                    ) : null}
                  </div>
                </div>
                <span className="rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-sm text-muted">
                  {cluster.clusterKey}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
                {cluster.sourcePlugins.map((plugin) => (
                  <span className="inline-flex items-center rounded-full border border-border/12 bg-muted/55 px-3 py-1 text-foreground" key={`${cluster.clusterKey}:${plugin}`}>
                    {plugin}
                  </span>
                ))}
                {cluster.identitySurfaces.map((surface) => (
                  <span className="inline-flex items-center rounded-full border border-border/12 bg-card px-3 py-1 text-foreground" key={`${cluster.clusterKey}:${surface}`}>
                    {surface} identity hint
                  </span>
                ))}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.95fr)]">
                <div className="space-y-3">
                  {cluster.members.map((candidate) => (
                    <article key={candidate.id} className="rounded-2xl border border-border/10 bg-muted/45 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h3 className="m-0 font-semibold text-foreground">{candidate.name}</h3>
                          <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted">
                            <span>{candidate.suggested_type}</span>
                            <span>{candidate.occurrence_count} occurrences</span>
                            <span>{candidate.evidence_count} evidence rows</span>
                            {candidate.first_seen_title ? <span>First seen in {candidate.first_seen_title}</span> : null}
                          </div>
                        </div>
                        <StatusBadge tone="warning">{candidate.status}</StatusBadge>
                      </div>
                      {candidate.auto_promotion_blocked_reason ? (
                        <p className="mb-0 mt-3 text-sm leading-6 text-muted">
                          Auto-promotion blocked: {candidate.auto_promotion_blocked_reason.replaceAll("_", " ")}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>

                <div className="space-y-3 rounded-2xl border border-border/10 bg-muted/45 p-4">
                  <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-muted">Bulk cluster actions</p>
                  <form action={`/api/projects/${selectedProject.id}/entity-candidate-bulk`} method="POST" className="flex flex-wrap gap-3">
                    <input type="hidden" name="redirectTo" value={`/entities/candidates?project=${selectedProject.id}`} />
                    <input type="hidden" name="intent" value="accept" />
                    {cluster.members.map((candidate) => (
                      <input key={`accept-${candidate.id}`} type="hidden" name="candidateId" value={candidate.id} />
                    ))}
                    <button className="inline-flex min-h-11 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:brightness-105" type="submit">
                      Accept cluster
                    </button>
                  </form>

                  <form action={`/api/projects/${selectedProject.id}/entity-candidate-bulk`} method="POST" className="flex flex-wrap gap-3">
                    <input type="hidden" name="redirectTo" value={`/entities/candidates?project=${selectedProject.id}`} />
                    <input type="hidden" name="intent" value="reject" />
                    {cluster.members.map((candidate) => (
                      <input key={`reject-${candidate.id}`} type="hidden" name="candidateId" value={candidate.id} />
                    ))}
                    <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-destructive/25 bg-destructive/12 px-4 py-3 text-sm font-medium text-destructive transition hover:bg-destructive/16" type="submit">
                      Reject cluster
                    </button>
                  </form>

                  <form action={`/api/projects/${selectedProject.id}/entity-candidate-bulk`} className="grid gap-3" method="POST">
                    <input type="hidden" name="redirectTo" value={`/entities/candidates?project=${selectedProject.id}`} />
                    <input type="hidden" name="intent" value="merge" />
                    {cluster.members.map((candidate) => (
                      <input key={`merge-${candidate.id}`} type="hidden" name="candidateId" value={candidate.id} />
                    ))}
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-foreground">Merge cluster into entity</span>
                      <select className="w-full rounded-2xl border border-border/12 bg-card/80 px-4 py-3 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" defaultValue="" name="mergedInto">
                        <option value="">Select entity</option>
                        {entities.map((entity) => (
                          <option key={entity.id} value={entity.id}>{entity.name}</option>
                        ))}
                      </select>
                    </label>
                    <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/12 bg-card px-4 py-3 text-sm font-medium text-foreground transition hover:border-primary/30 hover:bg-muted/80" type="submit">
                      Merge cluster
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </AppShell>
  )
}

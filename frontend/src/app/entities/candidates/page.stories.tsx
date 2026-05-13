import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { CandidateClusterCard } from "@/app/entities/candidates/_components/CandidateClusterCard"
import { CandidateQueueOverview } from "@/app/entities/candidates/_components/CandidateQueueOverview"
import { ResolvedCandidateList } from "@/app/entities/candidates/_components/ResolvedCandidateList"
import { groupCandidateClusters } from "@/app/entities/candidates/_components/shared"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createEntity,
  createEntityCandidate,
  createProject,
} from "@/lib/storybook-fixtures"

type CandidateQueuePagePreviewProps = {
  showError?: boolean
  showMessage?: boolean
  activeTab?: "review" | "auto-log"
}

const meta = {
  title: "Pages/EntityCandidates",
  component: CandidateQueuePagePreview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {},
} satisfies Meta<typeof CandidateQueuePagePreview>

export default meta

type Story = StoryObj<typeof meta>

export const Review: Story = {}

export const AutoLog: Story = {
  args: {
    activeTab: "auto-log",
  },
}

export const WithFlashes: Story = {
  args: {
    showError: true,
    showMessage: true,
  },
}

function CandidateQueuePagePreview({
  showError = false,
  showMessage = false,
  activeTab = "review",
}: CandidateQueuePagePreviewProps) {
  const selectedProject = createProject()
  const entities = [
    createEntity({ id: 7, name: "OpenAI" }),
    createEntity({ id: 8, name: "Anthropic", type: "organization" }),
  ]
  const candidates = [
    createEntityCandidate(),
    createEntityCandidate({
      id: 15,
      name: "River Labs AI",
      occurrence_count: 4,
      evidence_count: 4,
    }),
    createEntityCandidate({
      id: 18,
      status: "accepted",
      updated_at: "2026-05-02T12:00:00Z",
    }),
  ]
  const pendingCandidates = candidates.filter((candidate) => candidate.status === "pending")
  const resolvedCandidates = candidates.filter((candidate) => candidate.status !== "pending")
  const clusters = groupCandidateClusters(pendingCandidates)

  return (
    <AppShell
      title="Entity candidate clusters"
      description="Review clustered candidate groups, batch editorial actions, and inspect the latest auto-promotion outcomes."
      projects={[selectedProject]}
      selectedProjectId={selectedProject.id}
    >
      <div className="space-y-4">
        {showError ? (
          <Alert className="rounded-3xl border-destructive bg-destructive" variant="destructive">
            <AlertDescription className="text-destructive">Could not resolve cluster</AlertDescription>
          </Alert>
        ) : null}
        {showMessage ? (
          <Alert className="rounded-3xl border-trim-offset bg-muted">
            <AlertDescription>Cluster resolved</AlertDescription>
          </Alert>
        ) : null}

        <CandidateQueueOverview
          activeTab={activeTab}
          clusterCount={clusters.length}
          pendingCount={pendingCandidates.length}
          resolvedCount={resolvedCandidates.length}
          selectedProjectId={selectedProject.id}
        />

        {activeTab === "auto-log" ? (
          <ResolvedCandidateList resolvedCandidates={resolvedCandidates} />
        ) : (
          <section className="space-y-4">
            {clusters.map((cluster) => (
              <CandidateClusterCard
                cluster={cluster}
                entities={entities}
                key={cluster.clusterKey}
                selectedProjectId={selectedProject.id}
              />
            ))}
          </section>
        )}
      </div>
    </AppShell>
  )
}

import { NewsletterIntakePanel } from "@/app/admin/sources/_components/NewsletterIntakePanel"
import { ProviderSetupPanel } from "@/app/admin/sources/_components/ProviderSetupPanel"
import { SourceConfigList } from "@/app/admin/sources/_components/SourceConfigList"
export {
  buildIntakeAddressTemplate,
  buildLatestRunByPlugin,
  buildNewsletterIntakePreview,
  deriveBlueskyVerificationState,
  deriveLinkedInVerificationState,
  deriveMastodonVerificationState,
  filterNewsletterIntakes,
} from "@/app/admin/sources/_components/helpers"
import {
  buildIntakeAddressTemplate,
  buildLatestRunByPlugin,
  deriveBlueskyVerificationState,
  deriveLinkedInVerificationState,
  deriveMastodonVerificationState,
  filterNewsletterIntakes,
} from "@/app/admin/sources/_components/helpers"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  getProjectBlueskyCredentials,
  getProjectIngestionRuns,
  getProjectIntakeAllowlist,
  getProjectLinkedInCredentials,
  getProjectMastodonCredentials,
  getProjectNewsletterIntakes,
  getProjects,
  getProjectSourceConfigs,
} from "@/lib/api"
import { getErrorMessage, getSuccessMessage, selectProject } from "@/lib/view-helpers"

type SourcesPageProps = {
  /** Search params promise containing the optional `project`, `message`, and `error` values. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the source-configuration admin page for the selected project.
 */
export default async function SourcesPage({ searchParams }: SourcesPageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Sources"
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

  const [
    sourceConfigs,
    ingestionRuns,
    intakeAllowlist,
    newsletterIntakes,
    blueskyCredentials,
    linkedinCredentials,
    mastodonCredentials,
  ] = await Promise.all([
    getProjectSourceConfigs(selectedProject.id),
    getProjectIngestionRuns(selectedProject.id),
    getProjectIntakeAllowlist(selectedProject.id),
    getProjectNewsletterIntakes(selectedProject.id),
    getProjectBlueskyCredentials(selectedProject.id),
    getProjectLinkedInCredentials(selectedProject.id),
    getProjectMastodonCredentials(selectedProject.id),
  ])

  const latestRunByPlugin = buildLatestRunByPlugin(ingestionRuns)
  const intakeAddressTemplate = buildIntakeAddressTemplate(
    selectedProject.intake_token ?? "",
  )
  const sortedSourceConfigs = sourceConfigs
    .slice()
    .sort((left, right) => left.plugin_name.localeCompare(right.plugin_name))
  const sourceConfigRows = sortedSourceConfigs.map((sourceConfig) => ({
    sourceConfig,
    latestRun: latestRunByPlugin.get(sourceConfig.plugin_name) ?? null,
  }))
  const intakeStatusFilter = String(resolvedSearchParams.intakeStatus || "")
  const intakeSenderFilter = String(resolvedSearchParams.intakeSender || "")
  const selectedIntakeId = Number.parseInt(
    String(resolvedSearchParams.intakeId || "0"),
    10,
  )
  const filteredNewsletterIntakes = filterNewsletterIntakes(newsletterIntakes, {
    status: intakeStatusFilter,
    sender: intakeSenderFilter,
  })
  const recentNewsletterIntakes = filteredNewsletterIntakes.slice(0, 6)
  const selectedIntake =
    newsletterIntakes.find((intake) => intake.id === selectedIntakeId) ??
    recentNewsletterIntakes[0] ??
    null

  const currentBlueskyCredentials = blueskyCredentials[0] ?? null
  const currentLinkedInCredentials = linkedinCredentials[0] ?? null
  const currentMastodonCredentials = mastodonCredentials[0] ?? null
  const blueskyVerificationState = deriveBlueskyVerificationState(selectedProject)
  const linkedinVerificationState = deriveLinkedInVerificationState(
    currentLinkedInCredentials,
  )
  const mastodonVerificationState = deriveMastodonVerificationState(
    currentMastodonCredentials,
  )

  const errorMessage = getErrorMessage(resolvedSearchParams)
  const successMessage = getSuccessMessage(resolvedSearchParams)

  return (
    <AppShell
      title="Source configuration"
      description="Add, tune, and disable RSS, Reddit, Bluesky, Mastodon, and LinkedIn ingestion while keeping newsletter intake controls in the same editor dashboard."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      {errorMessage ? (
        <Alert className="rounded-panel border-destructive/20 bg-destructive/14" variant="destructive">
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
        <div className="space-y-4">
          <NewsletterIntakePanel
            intakeAddressTemplate={intakeAddressTemplate}
            intakeAllowlist={intakeAllowlist}
            intakeSenderFilter={intakeSenderFilter}
            intakeStatusFilter={intakeStatusFilter}
            recentNewsletterIntakes={recentNewsletterIntakes}
            selectedIntake={selectedIntake}
            selectedProject={selectedProject}
          />
          <ProviderSetupPanel
            blueskyVerificationState={blueskyVerificationState}
            currentBlueskyCredentials={currentBlueskyCredentials}
            currentLinkedInCredentials={currentLinkedInCredentials}
            currentMastodonCredentials={currentMastodonCredentials}
            hasBlueskyCredentials={selectedProject.has_bluesky_credentials ?? false}
            linkedinVerificationState={linkedinVerificationState}
            mastodonVerificationState={mastodonVerificationState}
            selectedProjectId={selectedProject.id}
          />
        </div>

        <SourceConfigList
          rows={sourceConfigRows}
          selectedProjectId={selectedProject.id}
        />
      </section>
    </AppShell>
  )
}
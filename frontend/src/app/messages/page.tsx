import { MessagesPageContent } from "@/app/messages/_components/MessagesPageContent"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  getCurrentUserProfile,
  getMessageThreads,
  getProjectMemberships,
  getProjects,
  getThreadMessages,
} from "@/lib/api"
import { selectProject } from "@/lib/view-helpers"

type MessagesPageProps = {
  /** Search params promise containing the optional `project` and `thread` selectors. */
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Render the direct-message workspace for the selected project shell.
 */
export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const resolvedSearchParams = await searchParams
  const projects = await getProjects()
  const selectedProject = selectProject(projects, resolvedSearchParams)

  if (!selectedProject) {
    return (
      <AppShell
        title="Messages"
        description="No project found for this API user."
        projects={[]}
        selectedProjectId={null}
      >
        <Alert className="rounded-3xl border-trim-offset bg-muted">
          <AlertDescription>Create a project first in Django admin.</AlertDescription>
        </Alert>
      </AppShell>
    )
  }

  const [currentUser, projectMemberships, threads] = await Promise.all([
    getCurrentUserProfile(),
    getProjectMemberships(selectedProject.id),
    getMessageThreads(),
  ])
  const availableRecipients = projectMemberships.filter(
    (membership) => membership.user !== currentUser.id,
  )
  const requestedThreadId = Number.parseInt(String(resolvedSearchParams.thread || ""), 10)
  const requestedRecipientId = Number.parseInt(
    String(resolvedSearchParams.recipient || ""),
    10,
  )
  const recipientThread = threads.find(
    (thread) => thread.counterpart?.id === requestedRecipientId,
  )
  const selectedThread =
    threads.find((thread) => thread.id === requestedThreadId) ??
    recipientThread ??
    threads[0] ??
    null
  const initialMessages = selectedThread
    ? await getThreadMessages(selectedThread.id)
    : []

  return (
    <MessagesPageContent
      availableRecipients={availableRecipients}
      currentUserId={currentUser.id}
      initialMessages={initialMessages}
      initialRecipientUserId={
        Number.isNaN(requestedRecipientId) ? null : requestedRecipientId
      }
      initialSelectedThreadId={selectedThread?.id ?? null}
      initialThreads={threads}
      projects={projects}
      selectedProject={selectedProject}
    />
  )
}

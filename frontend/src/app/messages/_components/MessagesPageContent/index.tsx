import { MessagesWorkspace } from "@/app/messages/_components/MessagesWorkspace"
import { AppShell } from "@/components/layout/AppShell"
import type {
  DirectMessage,
  MessageThread,
  Project,
  ProjectMembership,
} from "@/lib/types"

type MessagesPageContentProps = {
  availableRecipients: ProjectMembership[]
  projects: Project[]
  selectedProject: Project
  currentUserId: number
  initialThreads: MessageThread[]
  initialRecipientUserId: number | null
  initialSelectedThreadId: number | null
  initialMessages: DirectMessage[]
}

function getApiBaseUrl() {
  return process.env.NEWSLETTER_API_BASE_URL ?? "http://127.0.0.1:8080"
}

/** Render the editor-facing direct-message workspace for one selected project shell. */
export function MessagesPageContent({
  availableRecipients,
  projects,
  selectedProject,
  currentUserId,
  initialThreads,
  initialRecipientUserId,
  initialSelectedThreadId,
  initialMessages,
}: MessagesPageContentProps) {
  return (
    <AppShell
      title="Messages"
      description="Catch up on one-to-one conversations with other project collaborators and keep the active thread live as new replies arrive."
      projects={projects}
      selectedProjectId={selectedProject.id}
    >
      <MessagesWorkspace
        apiBaseUrl={getApiBaseUrl()}
        availableRecipients={availableRecipients}
        currentUserId={currentUserId}
        initialMessages={initialMessages}
        initialRecipientUserId={initialRecipientUserId}
        initialSelectedThreadId={initialSelectedThreadId}
        initialThreads={initialThreads}
      />
    </AppShell>
  )
}
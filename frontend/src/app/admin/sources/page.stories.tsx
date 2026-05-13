import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { NewsletterIntakePanel } from "@/app/admin/sources/_components/NewsletterIntakePanel"
import { ProviderSetupPanel } from "@/app/admin/sources/_components/ProviderSetupPanel"
import { SourceConfigList } from "@/app/admin/sources/_components/SourceConfigList"
import { AppShell } from "@/components/layout/AppShell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { compactDocsParameters } from "@/lib/storybook-docs"
import {
  createIngestionRun,
  createProject,
  createSourceConfig,
} from "@/lib/storybook-fixtures"
import type {
  BlueskyCredentials,
  IntakeAllowlistEntry,
  LinkedInCredentials,
  MastodonCredentials,
  NewsletterIntake,
} from "@/lib/types"

type SourcesPagePreviewProps = {
  showError?: boolean
  showMessage?: boolean
}

function createAllowlistEntry(
  overrides: Partial<IntakeAllowlistEntry> = {},
): IntakeAllowlistEntry {
  return {
    id: 11,
    project: 1,
    sender_email: "newsletter@example.com",
    is_confirmed: true,
    confirmed_at: "2026-04-29T09:00:00Z",
    confirmation_token: "confirm-token-123",
    created_at: "2026-04-28T08:00:00Z",
    ...overrides,
  }
}

function createNewsletterIntake(
  overrides: Partial<NewsletterIntake> = {},
): NewsletterIntake {
  return {
    id: 31,
    project: 1,
    sender_email: "newsletter@example.com",
    subject: "Morning digest",
    received_at: "2026-04-29T08:15:00Z",
    raw_html: "",
    raw_text: "Top story https://example.com/post",
    message_id: "msg-31",
    status: "extracted",
    extraction_result: {
      method: "heuristic",
      items: [
        {
          title: "Story one",
          url: "https://example.com/story-one",
          excerpt: "First story",
          position: 1,
        },
      ],
    },
    error_message: "",
    ...overrides,
  }
}

function createBlueskyCredentials(
  overrides: Partial<BlueskyCredentials> = {},
): BlueskyCredentials {
  return {
    id: 6,
    project: 1,
    handle: "project.bsky.social",
    pds_url: "",
    is_active: true,
    has_stored_credential: true,
    last_verified_at: "2026-04-29T10:00:00Z",
    last_error: "",
    created_at: "2026-04-29T09:00:00Z",
    updated_at: "2026-04-29T10:00:00Z",
    ...overrides,
  }
}

function createMastodonCredentials(
  overrides: Partial<MastodonCredentials> = {},
): MastodonCredentials {
  return {
    id: 8,
    project: 1,
    instance_url: "https://hachyderm.io",
    account_acct: "alice@hachyderm.io",
    is_active: true,
    has_stored_credential: true,
    last_verified_at: "2026-04-29T10:00:00Z",
    last_error: "",
    created_at: "2026-04-29T09:00:00Z",
    updated_at: "2026-04-29T10:00:00Z",
    ...overrides,
  }
}

function createLinkedInCredentials(
  overrides: Partial<LinkedInCredentials> = {},
): LinkedInCredentials {
  return {
    id: 10,
    project: 1,
    member_urn: "urn:li:person:abc123",
    expires_at: "2026-05-30T10:00:00Z",
    is_active: true,
    has_stored_credential: true,
    last_verified_at: "2026-04-29T10:00:00Z",
    last_error: "",
    created_at: "2026-04-29T09:00:00Z",
    updated_at: "2026-04-29T10:00:00Z",
    ...overrides,
  }
}

const meta = {
  title: "Pages/AdminSources",
  component: SourcesPagePreview,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {},
} satisfies Meta<typeof SourcesPagePreview>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithFlashes: Story = {
  args: {
    showError: true,
    showMessage: true,
  },
}

function SourcesPagePreview({ showError = false, showMessage = false }: SourcesPagePreviewProps) {
  const selectedProject = createProject({
    intake_token: "intake-token-123",
    intake_enabled: true,
    has_bluesky_credentials: true,
    bluesky_last_verified_at: "2026-04-29T10:00:00Z",
  })
  const selectedIntake = createNewsletterIntake()

  return (
    <AppShell
      title="Source configuration"
      description="Add, tune, and disable RSS, Reddit, Bluesky, Mastodon, and LinkedIn ingestion while keeping newsletter intake controls in the same editor dashboard."
      projects={[selectedProject]}
      selectedProjectId={selectedProject.id}
    >
      {showError ? (
        <Alert className="rounded-panel border-destructive bg-destructive" variant="destructive">
          <AlertDescription className="text-destructive">
            Could not save source
          </AlertDescription>
        </Alert>
      ) : null}
      {showMessage ? (
        <Alert className="rounded-panel border-border bg-muted">
          <AlertDescription>Source saved</AlertDescription>
        </Alert>
      ) : null}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.95fr)]">
        <div className="space-y-4">
          <NewsletterIntakePanel
            intakeAddressTemplate="intake+intake-token-123@inbox.example.com"
            intakeAllowlist={[createAllowlistEntry()]}
            intakeSenderFilter=""
            intakeStatusFilter=""
            recentNewsletterIntakes={[selectedIntake]}
            selectedIntake={selectedIntake}
            selectedProject={selectedProject}
          />
          <ProviderSetupPanel
            blueskyVerificationState={{ label: "verified", tone: "positive" }}
            currentBlueskyCredentials={createBlueskyCredentials()}
            currentLinkedInCredentials={createLinkedInCredentials()}
            currentMastodonCredentials={createMastodonCredentials()}
            hasBlueskyCredentials
            linkedinVerificationState={{ label: "verified", tone: "positive" }}
            mastodonVerificationState={{ label: "verified", tone: "positive" }}
            selectedProjectId={selectedProject.id}
          />
        </div>
        <SourceConfigList
          rows={[
            {
              sourceConfig: createSourceConfig(),
              latestRun: createIngestionRun(),
            },
            {
              sourceConfig: createSourceConfig({
                id: 8,
                plugin_name: "reddit",
                is_active: false,
              }),
              latestRun: createIngestionRun({
                id: 23,
                plugin_name: "reddit",
                status: "failed",
                error_message: "Rate limited",
              }),
            },
          ]}
          selectedProjectId={selectedProject.id}
        />
      </section>
    </AppShell>
  )
}

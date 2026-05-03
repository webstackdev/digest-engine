import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import type { IntakeAllowlistEntry, NewsletterIntake, Project } from "@/lib/types"

import { NewsletterIntakePanel } from "."

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: "AI Weekly",
    topic_description: "AI news",
    content_retention_days: 30,
    intake_token: "intake-token-123",
    intake_enabled: true,
    user_role: "admin",
    has_bluesky_credentials: false,
    bluesky_handle: "",
    bluesky_is_active: false,
    bluesky_last_verified_at: null,
    bluesky_last_error: "",
    created_at: "2026-04-01T00:00:00Z",
    ...overrides,
  }
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

const defaultIntake = createNewsletterIntake()

const meta = {
  title: "Pages/AdminSources/Components/NewsletterIntakePanel",
  component: NewsletterIntakePanel,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    intakeAddressTemplate: "intake+intake-token-123@inbox.example.com",
    intakeAllowlist: [createAllowlistEntry()],
    intakeSenderFilter: "",
    intakeStatusFilter: "",
    recentNewsletterIntakes: [defaultIntake],
    selectedIntake: defaultIntake,
    selectedProject: createProject(),
  },
} satisfies Meta<typeof NewsletterIntakePanel>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    intakeAllowlist: [],
    recentNewsletterIntakes: [],
    selectedIntake: null,
    selectedProject: createProject({ intake_enabled: false }),
  },
}
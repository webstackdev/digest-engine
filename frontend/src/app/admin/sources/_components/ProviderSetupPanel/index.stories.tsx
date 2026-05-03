import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { compactDocsParameters } from "@/lib/storybook-docs"
import type {
  BlueskyCredentials,
  LinkedInCredentials,
  MastodonCredentials,
} from "@/lib/types"

import { ProviderSetupPanel } from "."

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
  title: "Pages/AdminSources/Components/ProviderSetupPanel",
  component: ProviderSetupPanel,
  tags: ["autodocs"],
  parameters: {
    docs: compactDocsParameters,
  },
  args: {
    blueskyVerificationState: { label: "verified", tone: "positive" },
    currentBlueskyCredentials: createBlueskyCredentials(),
    currentLinkedInCredentials: createLinkedInCredentials(),
    currentMastodonCredentials: createMastodonCredentials(),
    hasBlueskyCredentials: true,
    linkedinVerificationState: { label: "verified", tone: "positive" },
    mastodonVerificationState: { label: "verified", tone: "positive" },
    selectedProjectId: 1,
  },
} satisfies Meta<typeof ProviderSetupPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    blueskyVerificationState: { label: "not configured", tone: "neutral" },
    currentBlueskyCredentials: null,
    currentLinkedInCredentials: null,
    currentMastodonCredentials: null,
    hasBlueskyCredentials: false,
    linkedinVerificationState: { label: "not configured", tone: "neutral" },
    mastodonVerificationState: { label: "not configured", tone: "neutral" },
  },
}

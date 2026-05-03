import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

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

describe("ProviderSetupPanel", () => {
  it("renders provider setup panels and enabled verification actions", () => {
    render(
      <ProviderSetupPanel
        blueskyVerificationState={{ label: "verified", tone: "positive" }}
        currentBlueskyCredentials={createBlueskyCredentials()}
        currentLinkedInCredentials={createLinkedInCredentials()}
        currentMastodonCredentials={createMastodonCredentials()}
        hasBlueskyCredentials
        linkedinVerificationState={{ label: "verified", tone: "positive" }}
        mastodonVerificationState={{ label: "verified", tone: "positive" }}
        selectedProjectId={1}
      />,
    )

    expect(screen.getAllByText("Credential verification").length).toBeGreaterThan(1)
    expect(screen.getByText("OAuth authorization")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Verify credentials" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Verify LinkedIn credentials" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Verify Mastodon credentials" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Add LinkedIn source" })).toBeInTheDocument()
    expect(screen.getByText("Quick config shapes")).toBeInTheDocument()
  })

  it("renders disabled verification states when credentials are missing", () => {
    render(
      <ProviderSetupPanel
        blueskyVerificationState={{ label: "not configured", tone: "neutral" }}
        currentBlueskyCredentials={null}
        currentLinkedInCredentials={null}
        currentMastodonCredentials={null}
        hasBlueskyCredentials={false}
        linkedinVerificationState={{ label: "not configured", tone: "neutral" }}
        mastodonVerificationState={{ label: "not configured", tone: "neutral" }}
        selectedProjectId={1}
      />,
    )

    expect(screen.getByRole("button", { name: "Verify credentials" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Verify LinkedIn credentials" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Verify Mastodon credentials" })).toBeDisabled()
  })
})
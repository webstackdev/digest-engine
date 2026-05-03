import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

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

describe("NewsletterIntakePanel", () => {
  it("renders intake controls, allowlist entries, and intake details", () => {
    const selectedIntake = createNewsletterIntake()

    render(
      <NewsletterIntakePanel
        intakeAddressTemplate="intake+intake-token-123@inbox.example.com"
        intakeAllowlist={[createAllowlistEntry()]}
        intakeSenderFilter=""
        intakeStatusFilter=""
        recentNewsletterIntakes={[selectedIntake]}
        selectedIntake={selectedIntake}
        selectedProject={createProject()}
      />,
    )

    expect(screen.getByText("Project intake settings")).toBeInTheDocument()
    expect(screen.getByDisplayValue("intake-token-123")).toBeInTheDocument()
    expect(screen.getByText("Sender allowlist")).toBeInTheDocument()
    expect(screen.getAllByText("newsletter@example.com").length).toBeGreaterThan(0)
    expect(screen.getByText("Recent newsletter intake")).toBeInTheDocument()
    expect(screen.getAllByText("Story one").length).toBeGreaterThan(0)
    expect(screen.getByText("Selected intake")).toBeInTheDocument()
  })

  it("renders empty states when allowlist and intake history are empty", () => {
    render(
      <NewsletterIntakePanel
        intakeAddressTemplate="intake+intake-token-123@inbox.example.com"
        intakeAllowlist={[]}
        intakeSenderFilter=""
        intakeStatusFilter=""
        recentNewsletterIntakes={[]}
        selectedIntake={null}
        selectedProject={createProject({ intake_enabled: false })}
      />,
    )

    expect(
      screen.getByText("No senders have been allowlisted for this project yet."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("No inbound newsletters have been captured for this project yet."),
    ).toBeInTheDocument()
  })
})

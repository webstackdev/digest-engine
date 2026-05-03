import { fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type {
  BlueskyCredentials,
  IngestionRun,
  IntakeAllowlistEntry,
  LinkedInCredentials,
  MastodonCredentials,
  NewsletterIntake,
  Project,
  SourceConfig,
} from "@/lib/types"

const {
  getProjectBlueskyCredentialsMock,
  getProjectIngestionRunsMock,
  getProjectIntakeAllowlistMock,
  getProjectLinkedInCredentialsMock,
  getProjectMastodonCredentialsMock,
  getProjectNewsletterIntakesMock,
  getProjectsMock,
  getProjectSourceConfigsMock,
  selectProjectMock,
} = vi.hoisted(() => ({
  getProjectBlueskyCredentialsMock: vi.fn(),
  getProjectIngestionRunsMock: vi.fn(),
  getProjectIntakeAllowlistMock: vi.fn(),
  getProjectLinkedInCredentialsMock: vi.fn(),
  getProjectMastodonCredentialsMock: vi.fn(),
  getProjectNewsletterIntakesMock: vi.fn(),
  getProjectsMock: vi.fn(),
  getProjectSourceConfigsMock: vi.fn(),
  selectProjectMock: vi.fn(),
}))

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({
    children,
    description,
    title,
  }: {
    children: ReactNode
    description: string
    title: string
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
    </div>
  ),
}))

vi.mock("@/components/elements/StatusBadge", () => ({
  StatusBadge: ({
    children,
    tone,
  }: {
    children: ReactNode
    tone: string
  }) => (
    <span data-testid="status-badge" data-tone={tone}>
      {children}
    </span>
  ),
}))

vi.mock("@/lib/api", () => ({
  getProjectBlueskyCredentials: getProjectBlueskyCredentialsMock,
  getProjectIngestionRuns: getProjectIngestionRunsMock,
  getProjectIntakeAllowlist: getProjectIntakeAllowlistMock,
  getProjectLinkedInCredentials: getProjectLinkedInCredentialsMock,
  getProjectMastodonCredentials: getProjectMastodonCredentialsMock,
  getProjectNewsletterIntakes: getProjectNewsletterIntakesMock,
  getProjects: getProjectsMock,
  getProjectSourceConfigs: getProjectSourceConfigsMock,
}))

vi.mock("@/lib/view-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/view-helpers")>(
    "@/lib/view-helpers",
  )

  return {
    ...actual,
    selectProject: selectProjectMock,
  }
})

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    name: "AI Weekly",
    topic_description: "AI news",
    content_retention_days: 30,
    intake_token: "intake-token-123",
    intake_enabled: false,
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

function createSourceConfig(
  overrides: Partial<SourceConfig> = {},
): SourceConfig {
  return {
    id: 7,
    project: 1,
    plugin_name: "rss",
    config: { feed_url: "https://example.com/feed.xml" },
    is_active: true,
    last_fetched_at: "2026-04-28T08:00:00Z",
    ...overrides,
  }
}

function createIngestionRun(
  overrides: Partial<IngestionRun> = {},
): IngestionRun {
  return {
    id: 22,
    project: 1,
    plugin_name: "rss",
    started_at: "2026-04-28T09:00:00Z",
    completed_at: "2026-04-28T09:03:00Z",
    status: "success",
    items_fetched: 12,
    items_ingested: 9,
    error_message: "",
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
    is_confirmed: false,
    confirmed_at: null,
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
    status: "pending",
    extraction_result: null,
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
    account_acct: "project@hachyderm.io",
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
    expires_at: "2026-04-30T10:00:00Z",
    is_active: true,
    has_stored_credential: true,
    last_verified_at: "2026-04-29T10:00:00Z",
    last_error: "",
    created_at: "2026-04-29T09:00:00Z",
    updated_at: "2026-04-29T10:00:00Z",
    ...overrides,
  }
}

async function loadSourcesPageModule() {
  return import("./page")
}

async function renderSourcesPage(
  searchParams: Record<string, string | string[] | undefined> = {
    project: "1",
  },
) {
  const { default: SourcesPage } = await loadSourcesPageModule()

  return render(
    await SourcesPage({
      searchParams: Promise.resolve(searchParams),
    }),
  )
}

describe("buildLatestRunByPlugin", () => {
  it("keeps the first run seen for each plugin", async () => {
    const { buildLatestRunByPlugin } = await loadSourcesPageModule()
    const newestRssRun = createIngestionRun({ id: 100, plugin_name: "rss" })
    const olderRssRun = createIngestionRun({ id: 90, plugin_name: "rss" })
    const redditRun = createIngestionRun({ id: 80, plugin_name: "reddit" })

    const latestRunByPlugin = buildLatestRunByPlugin([
      newestRssRun,
      olderRssRun,
      redditRun,
    ])

    expect(latestRunByPlugin.get("rss")).toEqual(newestRssRun)
    expect(latestRunByPlugin.get("reddit")).toEqual(redditRun)
  })
})

describe("filterNewsletterIntakes", () => {
  it("filters newsletter intake rows by status and sender", async () => {
    const { filterNewsletterIntakes } = await loadSourcesPageModule()

    const filtered = filterNewsletterIntakes(
      [
        createNewsletterIntake({ id: 1, status: "pending", sender_email: "first@example.com" }),
        createNewsletterIntake({ id: 2, status: "extracted", sender_email: "second@example.com" }),
      ],
      { status: "extracted", sender: "second" },
    )

    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe(2)
  })
})

describe("SourcesPage", () => {
  beforeEach(() => {
    const defaultProject = createProject()

    getProjectsMock.mockReset()
    getProjectSourceConfigsMock.mockReset()
    getProjectIngestionRunsMock.mockReset()
    getProjectIntakeAllowlistMock.mockReset()
    getProjectNewsletterIntakesMock.mockReset()
    getProjectBlueskyCredentialsMock.mockReset()
    getProjectLinkedInCredentialsMock.mockReset()
    getProjectMastodonCredentialsMock.mockReset()
    selectProjectMock.mockReset()

    getProjectsMock.mockResolvedValue([defaultProject])
    getProjectSourceConfigsMock.mockResolvedValue([createSourceConfig()])
    getProjectIngestionRunsMock.mockResolvedValue([createIngestionRun()])
    getProjectIntakeAllowlistMock.mockResolvedValue([createAllowlistEntry()])
    getProjectNewsletterIntakesMock.mockResolvedValue([createNewsletterIntake()])
    getProjectBlueskyCredentialsMock.mockResolvedValue([createBlueskyCredentials()])
    getProjectLinkedInCredentialsMock.mockResolvedValue([
      createLinkedInCredentials({ expires_at: "2026-05-30T10:00:00Z" }),
    ])
    getProjectMastodonCredentialsMock.mockResolvedValue([createMastodonCredentials()])
    selectProjectMock.mockImplementation((projects: Project[]) => projects[0] ?? null)
  })

  it("renders the LinkedIn quick-add form alongside the OAuth panel", async () => {
    await renderSourcesPage({ project: "1" })

    expect(screen.getByText("OAuth authorization")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add LinkedIn source" })).toBeInTheDocument()
    expect(screen.getByText("Surface type")).toBeInTheDocument()
    expect(screen.getByText("Quick config shapes")).toBeInTheDocument()
  })
})

describe("SourcesPage", () => {
  beforeEach(() => {
    const defaultProject = createProject()

    getProjectBlueskyCredentialsMock.mockReset()
    getProjectsMock.mockReset()
    getProjectSourceConfigsMock.mockReset()
    getProjectIngestionRunsMock.mockReset()
    getProjectIntakeAllowlistMock.mockReset()
    getProjectLinkedInCredentialsMock.mockReset()
    getProjectMastodonCredentialsMock.mockReset()
    getProjectNewsletterIntakesMock.mockReset()
    selectProjectMock.mockReset()

    getProjectBlueskyCredentialsMock.mockResolvedValue([])
    getProjectsMock.mockResolvedValue([defaultProject])
    getProjectSourceConfigsMock.mockResolvedValue([])
    getProjectIngestionRunsMock.mockResolvedValue([])
    getProjectIntakeAllowlistMock.mockResolvedValue([])
    getProjectLinkedInCredentialsMock.mockResolvedValue([])
    getProjectMastodonCredentialsMock.mockResolvedValue([])
    getProjectNewsletterIntakesMock.mockResolvedValue([])
    selectProjectMock.mockImplementation((projects: Project[]) => {
      return projects[0] ?? null
    })
  })

  it("renders the no-project empty state and skips project-scoped API calls", async () => {
    getProjectsMock.mockResolvedValue([])
    selectProjectMock.mockReturnValue(null)

    await renderSourcesPage({})

    expect(selectProjectMock).toHaveBeenCalledWith([], {})
    expect(
      screen.getByText("No project found for this API user."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Create a project first in Django admin."),
    ).toBeInTheDocument()
    expect(getProjectSourceConfigsMock).not.toHaveBeenCalled()
    expect(getProjectIngestionRunsMock).not.toHaveBeenCalled()
    expect(getProjectBlueskyCredentialsMock).not.toHaveBeenCalled()
    expect(getProjectIntakeAllowlistMock).not.toHaveBeenCalled()
    expect(getProjectLinkedInCredentialsMock).not.toHaveBeenCalled()
    expect(getProjectMastodonCredentialsMock).not.toHaveBeenCalled()
    expect(getProjectNewsletterIntakesMock).not.toHaveBeenCalled()
  })

  it("renders flash messages from the search params", async () => {
    await renderSourcesPage({
      error: "Could not save source",
      message: "Source saved",
      project: "1",
    })

    expect(selectProjectMock).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 1 })],
      {
        error: "Could not save source",
        message: "Source saved",
        project: "1",
      },
    )
    expect(screen.getByText("Could not save source")).toBeInTheDocument()
    expect(screen.getByText("Source saved")).toBeInTheDocument()
  })

  it("renders the empty source-config state when the project has no sources", async () => {
    await renderSourcesPage()

    expect(
      screen.getByText("No source configurations exist for this project yet."),
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue("intake-token-123")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Verify credentials" }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Rotate token" }),
    ).toBeInTheDocument()
    expect(getProjectSourceConfigsMock).toHaveBeenCalledWith(1)
    expect(getProjectIngestionRunsMock).toHaveBeenCalledWith(1)
    expect(getProjectBlueskyCredentialsMock).toHaveBeenCalledWith(1)
    expect(getProjectIntakeAllowlistMock).toHaveBeenCalledWith(1)
    expect(getProjectLinkedInCredentialsMock).toHaveBeenCalledWith(1)
    expect(getProjectMastodonCredentialsMock).toHaveBeenCalledWith(1)
    expect(getProjectNewsletterIntakesMock).toHaveBeenCalledWith(1)
  })

  it("renders allowlist management and recent intake history", async () => {
    getProjectIntakeAllowlistMock.mockResolvedValue([
      createAllowlistEntry({
        id: 1,
        is_confirmed: true,
        confirmed_at: "2026-04-29T09:00:00Z",
      }),
      createAllowlistEntry({
        id: 2,
        sender_email: "pending@example.com",
      }),
    ])
    getProjectNewsletterIntakesMock.mockResolvedValue([
      createNewsletterIntake({
        id: 1,
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
      }),
      createNewsletterIntake({
        id: 2,
        subject: "Follow-up digest",
        sender_email: "pending@example.com",
        status: "pending",
      }),
    ])

    await renderSourcesPage({ project: "1" })

    expect(screen.getByText("Sender allowlist")).toBeInTheDocument()
    expect(screen.getAllByText("newsletter@example.com")).toHaveLength(3)
    expect(screen.getAllByText("pending@example.com")).toHaveLength(2)
    expect(screen.getByText("Recent newsletter intake")).toBeInTheDocument()
    expect(screen.getAllByText("Story one")).toHaveLength(2)
    expect(screen.getByText("Follow-up digest")).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "Open details" })).toHaveLength(2)
    expect(screen.getByText("Selected intake")).toBeInTheDocument()
  })

  it("applies intake filters from the search params", async () => {
    getProjectNewsletterIntakesMock.mockResolvedValue([
      createNewsletterIntake({ id: 1, sender_email: "first@example.com", status: "pending" }),
      createNewsletterIntake({
        id: 2,
        sender_email: "editor@example.com",
        status: "extracted",
        subject: "Filtered digest",
      }),
    ])

    await renderSourcesPage({
      project: "1",
      intakeStatus: "extracted",
      intakeSender: "editor",
      intakeId: "2",
    })

    expect(screen.getByDisplayValue("editor")).toBeInTheDocument()
    expect(screen.getAllByText("Filtered digest")).toHaveLength(2)
    expect(screen.queryByText("Morning digest")).not.toBeInTheDocument()
  })

  it("renders intake controls and Bluesky verification state from the selected project", async () => {
    const selectedProject = createProject({
      id: 3,
      intake_enabled: true,
      intake_token: "intake-token-xyz",
      has_bluesky_credentials: true,
      bluesky_handle: "project.bsky.social",
      bluesky_is_active: true,
      bluesky_last_verified_at: "2026-04-29T10:00:00Z",
    })

    getProjectsMock.mockResolvedValue([selectedProject])
    selectProjectMock.mockReturnValue(selectedProject)
    getProjectBlueskyCredentialsMock.mockResolvedValue([
      createBlueskyCredentials({ project: 3 }),
    ])

    await renderSourcesPage({ project: "3" })

    expect(screen.getByText("Project intake settings")).toBeInTheDocument()
    expect(screen.getByDisplayValue("intake-token-xyz")).toBeInTheDocument()
    expect(
      screen.getByDisplayValue("intake+intake-token-xyz@inbox.example.com"),
    ).toBeInTheDocument()
    expect(screen.getByText("project.bsky.social")).toBeInTheDocument()
    expect(screen.getByText("verified")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Verify credentials" }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", { name: "Update credentials" }),
    ).toBeInTheDocument()
  })

  it("renders Mastodon verification controls from stored credentials", async () => {
    const selectedProject = createProject({ id: 4 })

    getProjectsMock.mockResolvedValue([selectedProject])
    selectProjectMock.mockReturnValue(selectedProject)
    getProjectMastodonCredentialsMock.mockResolvedValue([
      createMastodonCredentials({ project: 4, account_acct: "alice@hachyderm.io" }),
    ])

    await renderSourcesPage({ project: "4" })

    expect(screen.getByText("alice@hachyderm.io")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Save an optional per-instance access token for higher rate limits, then verify it without leaving the editor dashboard.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Verify Mastodon credentials" }),
    ).toBeEnabled()
  })

  it("renders LinkedIn authorization controls from stored credentials", async () => {
    const selectedProject = createProject({ id: 5 })

    getProjectsMock.mockResolvedValue([selectedProject])
    selectProjectMock.mockReturnValue(selectedProject)
    getProjectLinkedInCredentialsMock.mockResolvedValue([
      createLinkedInCredentials({ project: 5 }),
    ])

    await renderSourcesPage({ project: "5" })

    expect(screen.getByText("urn:li:person:abc123")).toBeInTheDocument()
    expect(screen.getByText("OAuth authorization")).toBeInTheDocument()
    expect(screen.getByText(/Token expires/)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Verify LinkedIn credentials" }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", { name: "Reauthorize LinkedIn" }),
    ).toBeInTheDocument()
  })

  it("renders source cards with badge tones and the latest run summary", async () => {
    const selectedProject = createProject({ id: 3 })
    getProjectsMock.mockResolvedValue([selectedProject])
    selectProjectMock.mockReturnValue(selectedProject)
    getProjectSourceConfigsMock.mockResolvedValue([
      createSourceConfig({
        id: 1,
        project: 3,
        plugin_name: "rss",
        is_active: true,
      }),
      createSourceConfig({
        id: 2,
        project: 3,
        plugin_name: "reddit",
        is_active: false,
      }),
    ])
    getProjectIngestionRunsMock.mockResolvedValue([
      createIngestionRun({
        id: 9,
        project: 3,
        plugin_name: "rss",
        status: "success",
      }),
      createIngestionRun({
        id: 8,
        project: 3,
        plugin_name: "rss",
        status: "failed",
      }),
      createIngestionRun({
        id: 7,
        project: 3,
        plugin_name: "reddit",
        status: "failed",
        error_message: "Rate limited",
      }),
    ])

    await renderSourcesPage({ project: "3" })

    expect(screen.getByRole("heading", { name: "rss" })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "reddit" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Latest run: success")).toBeInTheDocument()
    expect(screen.getByText("Latest run: failed")).toBeInTheDocument()
    expect(screen.getByText("Rate limited")).toBeInTheDocument()

    const badges = screen.getAllByTestId("status-badge")
    expect(badges).toHaveLength(6)
    expect(
      badges.some(
        (badge) =>
          badge.getAttribute("data-tone") === "neutral" &&
          badge.textContent === "disabled",
      ),
    ).toBe(true)
    expect(
      badges.some(
        (badge) =>
          badge.getAttribute("data-tone") === "positive" &&
          badge.textContent === "active",
      ),
    ).toBe(true)
  })

  it("shows fallback latest-run text when a source has no ingestion history", async () => {
    getProjectSourceConfigsMock.mockResolvedValue([
      createSourceConfig({ plugin_name: "reddit" }),
    ])

    await renderSourcesPage({ project: "1" })

    expect(screen.getByText("Latest run: none")).toBeInTheDocument()
    expect(screen.getByText("No recent error")).toBeInTheDocument()
  })

  it("includes LinkedIn and Mastodon in the source creation options", async () => {
    await renderSourcesPage({ project: "1" })

    fireEvent.click(screen.getByLabelText("Plugin"))

    expect(
      screen.getByRole("option", { name: "LinkedIn" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Mastodon" }),
    ).toBeInTheDocument()
  })
})

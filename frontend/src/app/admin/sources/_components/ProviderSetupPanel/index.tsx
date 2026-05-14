import { StatusBadge } from "@/components/elements/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type {
  BlueskyCredentials,
  LinkedInCredentials,
  MastodonCredentials,
} from "@/lib/types"
import { formatDate } from "@/lib/view-helpers"

import type { VerificationState } from "../helpers"

const inputClassName = "h-11 rounded-2xl border-trim-offset bg-page-base px-4"
const selectTriggerClassName =
  "w-full rounded-2xl border-trim-offset bg-page-base px-4 py-3 text-sm data-[size=default]:h-11"

type ProviderSetupPanelProps = {
  selectedProjectId: number
  hasBlueskyCredentials: boolean
  currentBlueskyCredentials: BlueskyCredentials | null
  currentLinkedInCredentials: LinkedInCredentials | null
  currentMastodonCredentials: MastodonCredentials | null
  blueskyVerificationState: VerificationState
  linkedinVerificationState: VerificationState
  mastodonVerificationState: VerificationState
}

/** Render provider credential setup and source onboarding forms. */
export function ProviderSetupPanel({
  selectedProjectId,
  hasBlueskyCredentials,
  currentBlueskyCredentials,
  currentLinkedInCredentials,
  currentMastodonCredentials,
  blueskyVerificationState,
  linkedinVerificationState,
  mastodonVerificationState,
}: ProviderSetupPanelProps) {
  return (
    <div className="space-y-4">
      <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Bluesky</p>
              <h2 className="font-display text-title-sm font-bold text-content-active">
                Credential verification
              </h2>
              <CardDescription>
                Add Bluesky source configs below, then verify the stored account session
                without leaving the editor dashboard.
              </CardDescription>
            </div>
            <StatusBadge tone={blueskyVerificationState.tone}>
              {blueskyVerificationState.label}
            </StatusBadge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border border-trim-offset bg-page-offset shadow-none ring-0">
              <CardContent className="space-y-2 pt-4">
                <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-content-offset">
                  Stored credentials
                </p>
                <p className="m-0 text-sm leading-6 text-content-active">
                  {currentBlueskyCredentials
                    ? currentBlueskyCredentials.handle || "Handle available after save"
                    : "No Bluesky credentials are configured for this project yet."}
                </p>
                <p className="m-0 text-sm leading-6 text-content-offset">
                  {currentBlueskyCredentials?.last_verified_at
                    ? `Last verified ${formatDate(currentBlueskyCredentials.last_verified_at)}`
                    : "Run verification after saving credentials to confirm the session."}
                </p>
                {currentBlueskyCredentials?.last_error ? (
                  <p className="m-0 text-sm leading-6 text-danger">
                    {currentBlueskyCredentials.last_error}
                  </p>
                ) : null}
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-trim-offset bg-page-offset shadow-none ring-0">
              <CardContent className="space-y-4 pt-4">
                <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-content-offset">
                  Save credentials
                </p>
                <form
                  action={`/api/projects/${selectedProjectId}/bluesky-credentials`}
                  className="space-y-4"
                  method="POST"
                >
                  <input name="redirectTo" type="hidden" value={`/admin/sources?project=${selectedProjectId}`} />
                  <input name="credentialId" type="hidden" value={currentBlueskyCredentials?.id ?? ""} />
                  <div className="grid gap-2">
                    <Label htmlFor="bluesky-handle">Handle</Label>
                    <Input className={inputClassName} defaultValue={currentBlueskyCredentials?.handle ?? ""} id="bluesky-handle" name="handle" placeholder="project.bsky.social" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bluesky-pds-url">PDS URL</Label>
                    <Input className={inputClassName} defaultValue={currentBlueskyCredentials?.pds_url ?? ""} id="bluesky-pds-url" name="pds_url" placeholder="https://pds.example.com" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bluesky-app-password">App password</Label>
                    <Input
                      className={inputClassName}
                      id="bluesky-app-password"
                      name="app_password"
                      placeholder={
                        currentBlueskyCredentials?.has_stored_credential
                          ? "Leave blank to keep the current stored credential"
                          : "Required on first save"
                      }
                      type="password"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bluesky-active">Status</Label>
                    <Select
                      defaultValue={currentBlueskyCredentials?.is_active === false ? "false" : "true"}
                      name="is_active"
                    >
                      <SelectTrigger className={selectTriggerClassName} id="bluesky-active">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="lg" type="submit" variant="outline">
                    {currentBlueskyCredentials ? "Update credentials" : "Save credentials"}
                  </Button>
                </form>
                <p className="m-0 text-sm leading-6 text-content-offset">
                  Use <span className="font-mono text-content-active">{"{\"actor\": \"newsroom.bsky.social\"}"}</span> for an author timeline or <span className="font-mono text-content-active">{"{\"feed_uri\": \"at://did:plc.../app.bsky.feed.generator/...\"}"}</span> for a custom feed.
                </p>
              </CardContent>
            </Card>
          </div>

          <form action={`/api/projects/${selectedProjectId}/verify-bluesky-credentials`} method="POST">
            <input name="redirectTo" type="hidden" value={`/admin/sources?project=${selectedProjectId}`} />
            <Button className="min-h-11 rounded-full px-4 py-3" disabled={!hasBlueskyCredentials} size="lg" type="submit">
              Verify credentials
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">LinkedIn</p>
              <h2 className="font-display text-title-sm font-bold text-content-active">
                OAuth authorization
              </h2>
              <CardDescription>
                Connect the project&apos;s LinkedIn app authorization, monitor token
                expiry, and re-authorize without leaving the editor dashboard.
              </CardDescription>
            </div>
            <StatusBadge tone={linkedinVerificationState.tone}>
              {linkedinVerificationState.label}
            </StatusBadge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border border-trim-offset bg-page-offset shadow-none ring-0">
              <CardContent className="space-y-2 pt-4">
                <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-content-offset">
                  Stored authorization
                </p>
                <p className="m-0 text-sm leading-6 text-content-active">
                  {currentLinkedInCredentials
                    ? currentLinkedInCredentials.member_urn || "Member available after verification"
                    : "No LinkedIn authorization is configured for this project yet."}
                </p>
                <p className="m-0 text-sm leading-6 text-content-offset">
                  {currentLinkedInCredentials?.last_verified_at
                    ? `Last verified ${formatDate(currentLinkedInCredentials.last_verified_at)}`
                    : "Connect LinkedIn, then verify the stored tokens before enabling a LinkedIn source config."}
                </p>
                {currentLinkedInCredentials?.expires_at ? (
                  <p className="m-0 text-sm leading-6 text-content-offset">
                    {`Token expires ${formatDate(currentLinkedInCredentials.expires_at)}`}
                  </p>
                ) : null}
                {currentLinkedInCredentials?.last_error ? (
                  <p className="m-0 text-sm leading-6 text-danger">
                    {currentLinkedInCredentials.last_error}
                  </p>
                ) : null}
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-trim-offset bg-page-offset shadow-none ring-0">
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-content-offset">
                    OAuth flow
                  </p>
                  <p className="m-0 text-sm leading-6 text-content-offset">
                    Use the project-scoped OAuth callback to mint or replace encrypted
                    LinkedIn access and refresh tokens in one step.
                  </p>
                </div>
                <form action={`/api/projects/${selectedProjectId}/linkedin-oauth/start`} method="POST">
                  <input name="redirectTo" type="hidden" value={`/admin/sources?project=${selectedProjectId}`} />
                  <Button size="lg" type="submit" variant="outline">
                    {currentLinkedInCredentials ? "Reauthorize LinkedIn" : "Connect LinkedIn"}
                  </Button>
                </form>
                <p className="m-0 text-sm leading-6 text-content-offset">
                  Use <span className="font-mono text-content-active">{"{\"organization_urn\": \"urn:li:organization:1337\"}"}</span> for a company feed, <span className="font-mono text-content-active">{"{\"person_urn\": \"urn:li:person:abc123\"}"}</span> for a member feed, or <span className="font-mono text-content-active">{"{\"newsletter_urn\": \"urn:li:newsletter:42\"}"}</span> for a newsletter surface.
                </p>
              </CardContent>
            </Card>
          </div>

          <form action={`/api/projects/${selectedProjectId}/verify-linkedin-credentials`} method="POST">
            <input name="redirectTo" type="hidden" value={`/admin/sources?project=${selectedProjectId}`} />
            <Button className="min-h-11 rounded-full px-4 py-3" disabled={!currentLinkedInCredentials} size="lg" type="submit">
              Verify LinkedIn credentials
            </Button>
          </form>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <Card className="rounded-2xl border border-trim-offset bg-page-offset shadow-none ring-0">
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-1">
                  <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-content-offset">
                    Add LinkedIn source
                  </p>
                  <p className="m-0 text-sm leading-6 text-content-offset">
                    Create a project-scoped LinkedIn source without hand-writing
                    config JSON.
                  </p>
                </div>
                <form action={`/api/projects/${selectedProjectId}/linkedin-source-configs`} className="space-y-4" method="POST">
                  <input name="redirectTo" type="hidden" value={`/admin/sources?project=${selectedProjectId}`} />
                  <div className="grid gap-2">
                    <Label htmlFor="linkedin-surface">Surface type</Label>
                    <Select defaultValue="organization" name="surface">
                      <SelectTrigger className={selectTriggerClassName} id="linkedin-surface">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="organization">Organization page</SelectItem>
                        <SelectItem value="person">Person feed</SelectItem>
                        <SelectItem value="newsletter">Newsletter feed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="linkedin-urn">URN</Label>
                    <Input className={inputClassName} id="linkedin-urn" name="urn" placeholder="urn:li:organization:1337" required />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="linkedin-max-posts">Max posts per fetch</Label>
                      <Input className={inputClassName} defaultValue="50" id="linkedin-max-posts" min="1" name="max_posts_per_fetch" type="number" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="linkedin-include-reshares">Include reshares</Label>
                      <Select defaultValue="false" name="include_reshares">
                        <SelectTrigger className={selectTriggerClassName} id="linkedin-include-reshares">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">No</SelectItem>
                          <SelectItem value="true">Yes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button size="lg" type="submit" variant="outline">
                    Add LinkedIn source
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-trim-offset bg-page-offset shadow-none ring-0">
              <CardContent className="space-y-2 pt-4">
                <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-content-offset">
                  Quick config shapes
                </p>
                <p className="m-0 text-sm leading-6 text-content-offset">
                  Organization and newsletter sources use <span className="font-mono text-content-active">max_posts_per_fetch</span>. Person sources use <span className="font-mono text-content-active">include_reshares</span>.
                </p>
                <p className="m-0 text-sm leading-6 text-content-offset">
                  The generic source editor below still works for advanced payloads,
                  but most projects should be able to onboard LinkedIn surfaces from
                  this form alone.
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Mastodon</p>
              <h2 className="font-display text-title-sm font-bold text-content-active">
                Credential verification
              </h2>
              <CardDescription>
                Save an optional per-instance access token for higher rate limits,
                then verify it without leaving the editor dashboard.
              </CardDescription>
            </div>
            <StatusBadge tone={mastodonVerificationState.tone}>
              {mastodonVerificationState.label}
            </StatusBadge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border border-trim-offset bg-page-offset shadow-none ring-0">
              <CardContent className="space-y-2 pt-4">
                <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-content-offset">
                  Stored credentials
                </p>
                <p className="m-0 text-sm leading-6 text-content-active">
                  {currentMastodonCredentials
                    ? currentMastodonCredentials.account_acct || currentMastodonCredentials.instance_url
                    : "No Mastodon credentials are configured for this project yet."}
                </p>
                <p className="m-0 text-sm leading-6 text-content-offset">
                  {currentMastodonCredentials?.last_verified_at
                    ? `Last verified ${formatDate(currentMastodonCredentials.last_verified_at)}`
                    : "Run verification after saving credentials to confirm the token."}
                </p>
                {currentMastodonCredentials?.last_error ? (
                  <p className="m-0 text-sm leading-6 text-danger">
                    {currentMastodonCredentials.last_error}
                  </p>
                ) : null}
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-trim-offset bg-page-offset shadow-none ring-0">
              <CardContent className="space-y-4 pt-4">
                <p className="m-0 text-sm font-semibold uppercase tracking-[0.18em] text-content-offset">
                  Save credentials
                </p>
                <form action={`/api/projects/${selectedProjectId}/mastodon-credentials`} className="space-y-4" method="POST">
                  <input name="redirectTo" type="hidden" value={`/admin/sources?project=${selectedProjectId}`} />
                  <input name="credentialId" type="hidden" value={currentMastodonCredentials?.id ?? ""} />
                  <div className="grid gap-2">
                    <Label htmlFor="mastodon-instance-url">Instance URL</Label>
                    <Input className={inputClassName} defaultValue={currentMastodonCredentials?.instance_url ?? "https://mastodon.social"} id="mastodon-instance-url" name="instance_url" placeholder="https://hachyderm.io" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="mastodon-account-acct">Account acct</Label>
                    <Input className={inputClassName} defaultValue={currentMastodonCredentials?.account_acct ?? ""} id="mastodon-account-acct" name="account_acct" placeholder="alice@hachyderm.io" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="mastodon-access-token">Access token</Label>
                    <Input
                      className={inputClassName}
                      id="mastodon-access-token"
                      name="access_token"
                      placeholder={
                        currentMastodonCredentials?.has_stored_credential
                          ? "Leave blank to keep the current stored token"
                          : "Required on first save"
                      }
                      type="password"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="mastodon-active">Status</Label>
                    <Select
                      defaultValue={currentMastodonCredentials?.is_active === false ? "false" : "true"}
                      name="is_active"
                    >
                      <SelectTrigger className={selectTriggerClassName} id="mastodon-active">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Active</SelectItem>
                        <SelectItem value="false">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="lg" type="submit" variant="outline">
                    {currentMastodonCredentials ? "Update credentials" : "Save credentials"}
                  </Button>
                </form>
                <p className="m-0 text-sm leading-6 text-content-offset">
                  Use <span className="font-mono text-content-active">{"{\"instance_url\": \"https://hachyderm.io\", \"hashtag\": \"platformengineering\"}"}</span> for a hashtag timeline, <span className="font-mono text-content-active">{"{\"account_acct\": \"alice@hachyderm.io\"}"}</span> for an account, or <span className="font-mono text-content-active">{"{\"list_id\": 42}"}</span> for a list.
                </p>
              </CardContent>
            </Card>
          </div>

          <form action={`/api/projects/${selectedProjectId}/verify-mastodon-credentials`} method="POST">
            <input name="redirectTo" type="hidden" value={`/admin/sources?project=${selectedProjectId}`} />
            <Button className="min-h-11 rounded-full px-4 py-3" disabled={!currentMastodonCredentials} size="lg" type="submit">
              Verify Mastodon credentials
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-trim-offset bg-page-base shadow-panel backdrop-blur-xl">
        <CardHeader>
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Add source</p>
          <h2 className="font-display text-title-sm font-bold text-content-active">
            Create source configuration
          </h2>
        </CardHeader>
        <CardContent>
          <form action="/api/source-configs" className="space-y-4" method="POST">
            <input name="projectId" type="hidden" value={selectedProjectId} />
            <input name="redirectTo" type="hidden" value={`/admin/sources?project=${selectedProjectId}`} />
            <div className="grid gap-2">
              <Label htmlFor="create-source-plugin">Plugin</Label>
              <Select defaultValue="rss" name="plugin_name">
                <SelectTrigger className={selectTriggerClassName} id="create-source-plugin">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rss">RSS</SelectItem>
                  <SelectItem value="reddit">Reddit</SelectItem>
                  <SelectItem value="bluesky">Bluesky</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="mastodon">Mastodon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="create-source-config-json">Config JSON</Label>
              <Textarea className="min-h-30 rounded-2xl border-trim-offset bg-page-offset px-4 py-3 font-mono text-sm" defaultValue={JSON.stringify({ feed_url: "https://example.com/feed.xml" }, null, 2)} id="create-source-config-json" name="config_json" />
            </div>
            <p className="m-0 text-sm leading-6 text-content-offset">
              Bluesky configs accept either an actor handle or a feed URI. Mastodon
              configs accept an instance URL plus one of <span className="font-mono text-content-active">hashtag</span>, <span className="font-mono text-content-active">account_acct</span>, or <span className="font-mono text-content-active">list_id</span>. LinkedIn configs accept <span className="font-mono text-content-active">organization_urn</span>, <span className="font-mono text-content-active">person_urn</span>, or <span className="font-mono text-content-active">newsletter_urn</span>. RSS and Reddit continue to use the existing backend JSON shapes.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="create-source-active">Active</Label>
              <Select defaultValue="true" name="is_active">
                <SelectTrigger className={selectTriggerClassName} id="create-source-active">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
              Create source
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

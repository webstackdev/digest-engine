import Link from "next/link"

import { CopyButton } from "@/components/elements/CopyButton"
import { StatusBadge } from "@/components/elements/StatusBadge"
import { Button, buttonVariants } from "@/components/ui/button"
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
import type { IntakeAllowlistEntry, NewsletterIntake, Project } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatDate, formatDisplayLabel } from "@/lib/view-helpers"

import { buildNewsletterIntakePreview } from "../helpers"

const selectTriggerClassName =
  "w-full rounded-2xl border-border bg-card px-4 py-3 text-sm data-[size=default]:h-11"

type NewsletterIntakePanelProps = {
  selectedProject: Project
  intakeAddressTemplate: string
  intakeAllowlist: IntakeAllowlistEntry[]
  recentNewsletterIntakes: NewsletterIntake[]
  selectedIntake: NewsletterIntake | null
  intakeStatusFilter: string
  intakeSenderFilter: string
}

/** Render the newsletter intake controls, allowlist, and recent intake history. */
export function NewsletterIntakePanel({
  selectedProject,
  intakeAddressTemplate,
  intakeAllowlist,
  recentNewsletterIntakes,
  selectedIntake,
  intakeStatusFilter,
  intakeSenderFilter,
}: NewsletterIntakePanelProps) {
  return (
    <Card className="rounded-3xl border border-border bg-card shadow-panel backdrop-blur-xl">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">
              Newsletter intake
            </p>
            <h2 className="font-display text-title-sm font-bold text-foreground">
              Project intake settings
            </h2>
            <CardDescription>
              Enable inbound newsletter capture for this project and share the project
              token with the team managing your inbound mailbox.
            </CardDescription>
          </div>
          <StatusBadge tone={selectedProject.intake_enabled ? "positive" : "neutral"}>
            {selectedProject.intake_enabled ? "enabled" : "disabled"}
          </StatusBadge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="project-intake-token">Intake token</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                className="h-11 rounded-2xl border-border bg-muted px-4 font-mono text-sm"
                id="project-intake-token"
                readOnly
                value={selectedProject.intake_token ?? ""}
              />
              <CopyButton label="Copy token" value={selectedProject.intake_token ?? ""} />
              <form
                action={`/api/projects/${selectedProject.id}/rotate-intake-token`}
                method="POST"
              >
                <input
                  name="redirectTo"
                  type="hidden"
                  value={`/admin/sources?project=${selectedProject.id}`}
                />
                <Button size="lg" type="submit" variant="outline">
                  Rotate token
                </Button>
              </form>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="project-intake-address-pattern">Address pattern</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                className="h-11 rounded-2xl border-border bg-muted px-4 font-mono text-sm"
                id="project-intake-address-pattern"
                readOnly
                value={intakeAddressTemplate}
              />
              <CopyButton label="Copy pattern" value={intakeAddressTemplate} />
            </div>
            <p className="m-0 text-xs leading-5 text-muted">
              Replace <span className="font-mono text-foreground">inbox.example.com</span>
              {" "}with the inbound mailbox domain configured for your email provider.
            </p>
          </div>
        </div>

        <form
          action={`/api/projects/${selectedProject.id}/intake`}
          className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
          method="POST"
        >
          <input
            name="redirectTo"
            type="hidden"
            value={`/admin/sources?project=${selectedProject.id}`}
          />
          <div className="grid gap-2">
            <Label htmlFor="project-intake-enabled">Intake status</Label>
            <Select
              defaultValue={selectedProject.intake_enabled ? "true" : "false"}
              name="intake_enabled"
            >
              <SelectTrigger className={selectTriggerClassName} id="project-intake-enabled">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Enabled</SelectItem>
                <SelectItem value="false">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
            Save intake settings
          </Button>
        </form>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Card className="rounded-2xl border border-border bg-muted shadow-none ring-0">
            <CardHeader>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                Sender allowlist
              </h3>
              <CardDescription>
                Confirmed senders process automatically after the first email.
                Pending senders still need to visit their confirmation link.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                action={`/api/projects/${selectedProject.id}/intake-allowlist`}
                className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                method="POST"
              >
                <input
                  name="redirectTo"
                  type="hidden"
                  value={`/admin/sources?project=${selectedProject.id}`}
                />
                <div className="grid gap-2">
                  <Label htmlFor="allowlist-sender-email">Sender email</Label>
                  <Input
                    className="h-11 rounded-2xl border-border bg-card px-4"
                    id="allowlist-sender-email"
                    name="senderEmail"
                    placeholder="newsletter@example.com"
                    required
                    type="email"
                  />
                </div>
                <Button className="min-h-11 rounded-full px-4 py-3" size="lg" type="submit">
                  Add sender
                </Button>
              </form>

              {intakeAllowlist.length === 0 ? (
                <p className="m-0 rounded-panel bg-muted px-4 py-4 text-sm leading-6 text-muted">
                  No senders have been allowlisted for this project yet.
                </p>
              ) : (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {intakeAllowlist.map((entry) => (
                    <li key={entry.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <p className="m-0 text-sm font-medium text-foreground">{entry.sender_email}</p>
                          <p className="m-0 text-sm leading-6 text-muted">
                            {entry.is_confirmed
                              ? `Confirmed ${formatDate(entry.confirmed_at)}`
                              : "Awaiting confirmation via emailed link."}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={entry.is_confirmed ? "positive" : "warning"}>
                            {entry.is_confirmed ? "confirmed" : "pending"}
                          </StatusBadge>
                          <form
                            action={`/api/projects/${selectedProject.id}/intake-allowlist/${entry.id}`}
                            method="POST"
                          >
                            <input
                              name="redirectTo"
                              type="hidden"
                              value={`/admin/sources?project=${selectedProject.id}`}
                            />
                            <Button size="lg" type="submit" variant="destructive">
                              Remove
                            </Button>
                          </form>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-muted shadow-none ring-0">
            <CardHeader>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
                Recent newsletter intake
              </h3>
              <CardDescription>
                Latest inbound emails captured for this project, including extraction
                status and the first preview items the system stored.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end" method="GET">
                <input name="project" type="hidden" value={selectedProject.id} />
                <div className="grid gap-2">
                  <Label htmlFor="recent-intake-status">Status</Label>
                  <Select defaultValue={intakeStatusFilter} name="intakeStatus">
                    <SelectTrigger className={selectTriggerClassName} id="recent-intake-status">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="extracted">Extracted</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="recent-intake-sender">Sender contains</Label>
                  <Input
                    className="h-11 rounded-2xl border-border bg-card px-4"
                    defaultValue={intakeSenderFilter}
                    id="recent-intake-sender"
                    name="intakeSender"
                    placeholder="newsletter@example.com"
                  />
                </div>
                <Button size="lg" type="submit" variant="outline">
                  Filter
                </Button>
              </form>

              {recentNewsletterIntakes.length === 0 ? (
                <p className="m-0 rounded-panel bg-muted px-4 py-4 text-sm leading-6 text-muted">
                  No inbound newsletters have been captured for this project yet.
                </p>
              ) : (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {recentNewsletterIntakes.map((intake) => (
                    <li key={intake.id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <p className="m-0 text-sm font-medium text-foreground">{intake.subject}</p>
                          <div className="flex flex-wrap gap-2 text-sm text-muted">
                            <span>{intake.sender_email}</span>
                            <span>{formatDate(intake.received_at)}</span>
                            <span>{intake.message_id}</span>
                          </div>
                          <p className="m-0 text-sm leading-6 text-muted">
                            {buildNewsletterIntakePreview(intake)}
                          </p>
                        </div>
                        <StatusBadge
                          tone={
                            intake.status === "extracted"
                              ? "positive"
                              : intake.status === "failed"
                                ? "negative"
                                : "warning"
                          }
                        >
                          {formatDisplayLabel(intake.status)}
                        </StatusBadge>
                        <Link
                          className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
                          href={`/admin/sources?project=${selectedProject.id}&intakeId=${intake.id}${intakeStatusFilter ? `&intakeStatus=${encodeURIComponent(intakeStatusFilter)}` : ""}${intakeSenderFilter ? `&intakeSender=${encodeURIComponent(intakeSenderFilter)}` : ""}`}
                        >
                          Open details
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {selectedIntake ? (
                <Card className="rounded-2xl border border-border bg-card shadow-none ring-0">
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="m-0 text-sm font-semibold text-foreground">Selected intake</p>
                        <p className="m-0 text-sm leading-6 text-muted">{selectedIntake.subject}</p>
                      </div>
                      <StatusBadge
                        tone={
                          selectedIntake.status === "extracted"
                            ? "positive"
                            : selectedIntake.status === "failed"
                              ? "negative"
                              : "warning"
                        }
                      >
                        {formatDisplayLabel(selectedIntake.status)}
                      </StatusBadge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-muted">
                      <span>{selectedIntake.sender_email}</span>
                      <span>{selectedIntake.message_id}</span>
                      <span>{formatDate(selectedIntake.received_at)}</span>
                    </div>
                    {selectedIntake.extraction_result?.items?.length ? (
                      <ul className="m-0 grid list-none gap-2 p-0">
                        {selectedIntake.extraction_result.items.slice(0, 4).map((item) => (
                          <li key={`${selectedIntake.id}:${item.position}`} className="rounded-2xl border border-border bg-muted p-3 text-sm text-muted">
                            <span className="font-medium text-foreground">{item.title || item.url}</span>
                            <div className="mt-1 wrap-break-word">{item.url}</div>
                            {item.excerpt ? <div className="mt-1">{item.excerpt}</div> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="m-0 text-sm leading-6 text-muted">
                        {buildNewsletterIntakePreview(selectedIntake)}
                      </p>
                    )}
                    {selectedIntake.raw_text ? (
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-foreground">
                          Raw text preview
                        </summary>
                        <pre className="mt-3 overflow-auto rounded-2xl bg-sidebar p-4 text-sm text-sidebar-foreground whitespace-pre-wrap">
                          {selectedIntake.raw_text.slice(0, 2000)}
                        </pre>
                      </details>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}

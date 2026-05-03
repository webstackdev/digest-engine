"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription } from "@/components/ui/card"
import { fetchMessageThreads, MESSAGE_THREADS_QUERY_KEY } from "@/lib/messages"
import type { MessageThread, Project } from "@/lib/types"
import { cn } from "@/lib/utils"

type AppShellSidebarProps = {
  initialMessageThreads: MessageThread[]
  projects: Project[]
  selectedProjectId: number | null
  projectQuery: string
  canManageMembers: boolean
}

type BaseNavigationItem = {
  href: string
  label: string
}

type DefaultNavigationItem = BaseNavigationItem & {
  kind: "default"
}

type MessagesNavigationItem = BaseNavigationItem & {
  kind: "messages"
  messageThreadCount: number
  unreadMessageThreadCount: number
}

type NavigationItem = DefaultNavigationItem | MessagesNavigationItem

function buildMessagesHref(projectQuery: string, threadId?: number) {
  const searchParams = new URLSearchParams(projectQuery.replace(/^\?/, ""))
  if (threadId !== undefined) {
    searchParams.set("thread", String(threadId))
  }

  const query = searchParams.toString()
  return `/messages${query ? `?${query}` : ""}`
}

function latestUnreadThreadId(messageThreads: MessageThread[]) {
  return messageThreads
    .filter((thread) => thread.has_unread)
    .sort((left, right) => {
      const leftTimestamp = new Date(
        left.last_message_at ?? left.created_at,
      ).getTime()
      const rightTimestamp = new Date(
        right.last_message_at ?? right.created_at,
      ).getTime()

      return rightTimestamp - leftTimestamp
    })[0]?.id
}

/** Render the shared dashboard navigation and project switcher. */
export function AppShellSidebar({
  initialMessageThreads,
  projects,
  selectedProjectId,
  projectQuery,
  canManageMembers,
}: AppShellSidebarProps) {
  const messageThreadsQuery = useQuery({
    queryKey: MESSAGE_THREADS_QUERY_KEY,
    queryFn: fetchMessageThreads,
    initialData: initialMessageThreads,
  })
  const messageThreads = messageThreadsQuery.data ?? []
  const messageThreadCount = messageThreads.length
  const unreadMessageThreadCount = messageThreads.filter(
    (thread) => thread.has_unread,
  ).length
  const messagesHref = buildMessagesHref(projectQuery)
  const latestUnreadHref = buildMessagesHref(
    projectQuery,
    latestUnreadThreadId(messageThreads),
  )

  const navigationItems: NavigationItem[] = [
    { href: `/${projectQuery}`, kind: "default", label: "Dashboard" },
    {
      href: messagesHref,
      kind: "messages",
      label: "Messages",
      messageThreadCount,
      unreadMessageThreadCount,
    },
    { href: `/trends${projectQuery}`, kind: "default", label: "Trends" },
    { href: `/themes${projectQuery}`, kind: "default", label: "Themes" },
    { href: `/ideas${projectQuery}`, kind: "default", label: "Ideas" },
    { href: `/drafts${projectQuery}`, kind: "default", label: "Drafts" },
    { href: `/entities${projectQuery}`, kind: "default", label: "Entities" },
    {
      href: `/admin/health${projectQuery}`,
      kind: "default",
      label: "Ingestion health",
    },
    {
      href: `/admin/sources${projectQuery}`,
      kind: "default",
      label: "Source configs",
    },
    ...(canManageMembers && selectedProjectId
      ? [
          {
            href: `/projects/${selectedProjectId}/members${projectQuery}`,
            kind: "default" as const,
            label: "Members",
          },
        ]
      : []),
    { href: "/admin/projects/new", kind: "default", label: "New project" },
  ]

  return (
    <aside className="flex flex-col gap-6 bg-sidebar/95 p-5 text-sidebar-foreground md:p-8">
      <Card className="rounded-3xl bg-sidebar-accent/25 py-0 text-sidebar-foreground ring-sidebar-border/50 shadow-none">
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">
              Newsletter Maker
            </p>
            <h1 className="mt-1 font-display text-display-hero font-bold leading-display">
              Editor cockpit
            </h1>
          </div>
          <p className="text-sm leading-6 text-sidebar-foreground/74">
            A compact review surface for relevance-ranked content, review work,
            and source health.
          </p>
        </CardContent>
      </Card>

      <nav className="grid gap-3">
        {navigationItems.map((item) =>
          item.kind === "messages" ? (
            <Card
              className="rounded-panel bg-sidebar-accent/30 py-0 text-sidebar-foreground ring-sidebar-border/60 shadow-none transition hover:-translate-y-0.5 hover:bg-sidebar-accent/50 hover:ring-sidebar-ring/40"
              key={item.label}
            >
              <CardContent className="flex items-center justify-between gap-3 px-4 py-4">
                <Link className="min-w-0 flex-1" href={item.href}>
                  <span>{item.label}</span>
                </Link>
                {item.messageThreadCount > 0 ? (
                  <span className="flex items-center gap-2">
                    <Badge className="min-w-6 justify-center px-1.5" variant="outline">
                      {item.messageThreadCount}
                    </Badge>
                    {item.unreadMessageThreadCount > 0 ? (
                      <Link
                        aria-label="Open latest unread message thread"
                        href={latestUnreadHref}
                      >
                        <Badge className="min-w-6 justify-center px-1.5" variant="destructive">
                          {item.unreadMessageThreadCount}
                        </Badge>
                      </Link>
                    ) : null}
                  </span>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Link className="block" href={item.href} key={item.label}>
              <Card className="rounded-panel bg-sidebar-accent/30 py-0 text-sidebar-foreground ring-sidebar-border/60 shadow-none transition hover:-translate-y-0.5 hover:bg-sidebar-accent/50 hover:ring-sidebar-ring/40">
                <CardContent className="flex items-center justify-between gap-3 px-4 py-4">
                  <span>{item.label}</span>
                </CardContent>
              </Card>
            </Link>
          ),
        )}
      </nav>

      <section>
        <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">Project</p>
        <div className="mt-4 grid gap-3">
          {projects.map((project) => {
            const isActive = project.id === selectedProjectId

            return (
              <Link
                className="block"
                data-active={isActive ? "true" : "false"}
                href={`/?project=${project.id}`}
                key={project.id}
              >
                <Card
                  className={cn(
                    "rounded-panel py-0 text-sidebar-foreground shadow-none transition hover:-translate-y-0.5",
                    isActive
                      ? "bg-linear-to-b from-primary/15 to-sidebar-accent/40 ring-primary/30"
                      : "bg-sidebar-accent/30 ring-sidebar-border/60 hover:bg-sidebar-accent/50 hover:ring-sidebar-ring/40",
                  )}
                >
                  <CardContent className="grid gap-1 px-4 py-4">
                    <span>{project.name}</span>
                    <CardDescription className="text-sidebar-foreground/64">
                      {project.topic_description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>
    </aside>
  )
}

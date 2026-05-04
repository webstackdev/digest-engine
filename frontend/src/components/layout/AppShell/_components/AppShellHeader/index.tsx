import { MessageSquarePlus } from "lucide-react"
import Link from "next/link"

import { ThemeToggle } from "@/components/elements/ThemeToggle"
import { NotificationMenu } from "@/components/layout/NotificationMenu"
import { UserMenu } from "@/components/layout/UserMenu"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type AppShellHeaderProps = {
  eyebrow?: string | null
  title: string
  description: string
  messagesHref: string
}

function buildNotificationsWebsocketUrl() {
  const apiBaseUrl =
    process.env.NEWSLETTER_API_INTERNAL_URL ??
    process.env.NEWSLETTER_API_BASE_URL ??
    "http://127.0.0.1:8080"
  const websocketUrl = new URL("/ws/notifications/", apiBaseUrl)
  websocketUrl.protocol = websocketUrl.protocol === "https:" ? "wss:" : "ws:"
  return websocketUrl.toString()
}

/** Render the shared page header chrome for dashboard-style views. */
export function AppShellHeader({
  eyebrow,
  title,
  description,
  messagesHref,
}: AppShellHeaderProps) {
  return (
    <header className="mb-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className={eyebrow ? "space-y-2" : undefined}>
          {eyebrow ? (
            <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="font-display text-display-page font-bold">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <Link
            aria-label="Start a new message"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "min-h-10 rounded-full px-3")}
            href={messagesHref}
          >
            <MessageSquarePlus />
            <span className="hidden md:inline">New message</span>
          </Link>
          <NotificationMenu websocketUrl={buildNotificationsWebsocketUrl()} />
          <ThemeToggle />
          <Separator className="hidden h-6 bg-border/70 md:block" orientation="vertical" />
          <UserMenu />
        </div>
      </div>
      <p className="max-w-xl text-sm leading-6 text-muted-foreground md:text-base">{description}</p>
    </header>
  )
}

import { ThemeToggle } from "@/components/elements/ThemeToggle"
import { UserMenu } from "@/components/layout/UserMenu"
import { Separator } from "@/components/ui/separator"

type AppShellHeaderProps = {
  title: string
  description: string
}

/** Render the shared page header chrome for dashboard-style views. */
export function AppShellHeader({ title, description }: AppShellHeaderProps) {
  return (
    <header className="mb-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="m-0 text-eyebrow uppercase tracking-eyebrow opacity-70">
            Minimal dashboard
          </p>
          <h2 className="font-display text-display-page font-bold">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Separator className="hidden h-6 bg-border/70 md:block" orientation="vertical" />
          <UserMenu />
        </div>
      </div>
      <p className="max-w-xl text-sm leading-6 text-muted md:text-base">{description}</p>
    </header>
  )
}
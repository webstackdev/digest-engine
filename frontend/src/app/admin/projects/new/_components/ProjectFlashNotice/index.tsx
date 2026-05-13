import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type ProjectFlashNoticeProps = {
  /** Visual treatment for the flash notice. */
  tone: "error" | "success"
  /** Flash message content derived from the URL params. */
  children: string
}

/** Render the route-local flash notice for project creation outcomes. */
export function ProjectFlashNotice({ tone, children }: ProjectFlashNoticeProps) {
  const title = tone === "error" ? "Could not create project" : "Project updated"

  return (
    <Alert
      className={
        tone === "success"
          ? "rounded-panel border-border bg-muted text-foreground"
          : "rounded-panel border-destructive bg-destructive"
      }
      variant={tone === "error" ? "destructive" : "default"}
    >
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
